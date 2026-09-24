/**
 * What the app should be telling you, and when.
 *
 * One set of rules, used twice: the bell in the app lists whatever currently
 * applies, and the notifier on the Pi pushes the ones with a time attached
 * once that time arrives. Keeping them the same function is what stops the
 * phone buzzing about something the app then says is fine.
 *
 * Pushes are kept few on purpose. Everything that is merely true this morning
 * - overdue work, missed plans, things to triage - is folded into a single
 * morning brief; only events, the evening habit check and the weekly review
 * get their own. A notification you learn to swipe away is worse than none.
 */

import { addDays, differenceInCalendarDays, endOfMonth, format } from 'date-fns';

import type { Event, Habit, Task } from '@/types';
import { getTodayString, parseLocalDate, toDateString } from './dates';
import {
  checkNeedsReset, currentEventDate, getStartOfWeek, isHabitDueOn, localDay, nextRecurrenceDates,
} from './recurrence';
import { isOnToday } from './schedule';
import { isOverdue, isPressingBlocked } from './scoring';
import { apOf, HABIT_DEFAULT_AP } from './capacity';
import { milestoneLabel } from './milestones';

export type NoticeKind =
  | 'brief' | 'overdue' | 'missed' | 'followup' | 'blocked' | 'triage'
  | 'yesterday' | 'event' | 'habits' | 'review' | 'milestone';

export interface Notice {
  /** Stable for the thing and the day, so it is pushed and dismissed once. */
  key: string;
  kind: NoticeKind;
  level: 'info' | 'warn' | 'urgent';
  title: string;
  body: string;
  href: string;
  /** Local 'YYYY-MM-DDTHH:mm' this becomes due to push; null = in-app only. */
  pushAt: string | null;
}

export interface NoticeSettings {
  briefTime: string;        // HH:mm
  eveningTime: string;      // HH:mm
  eventLeadMinutes: number;
  /** Which pushes to send. The in-app list always shows everything. */
  push: Record<'brief' | 'event' | 'habits' | 'review', boolean>;
}

export const NOTICE_SETTINGS_PREF = 'notifications.settings';
export const NOTICE_DISMISSED_PREF = 'notifications.dismissed';

export const DEFAULT_NOTICE_SETTINGS: NoticeSettings = {
  briefTime: '08:00',
  eveningTime: '20:00',
  eventLeadMinutes: 15,
  push: { brief: true, event: true, habits: true, review: true },
};

export function parseNoticeSettings(raw: string | undefined): NoticeSettings {
  if (!raw) return DEFAULT_NOTICE_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<NoticeSettings>;
    return {
      ...DEFAULT_NOTICE_SETTINGS,
      ...parsed,
      push: { ...DEFAULT_NOTICE_SETTINGS.push, ...(parsed.push ?? {}) },
    };
  } catch {
    return DEFAULT_NOTICE_SETTINGS;
  }
}

/** Dismissed keys, by the day they were dismissed. */
export function parseDismissed(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function pruneDismissed(map: Record<string, string>, today = getTodayString()): Record<string, string> {
  const cutoff = toDateString(addDays(parseLocalDate(today), -14));
  return Object.fromEntries(Object.entries(map).filter(([, day]) => day >= cutoff));
}

/**
 * Captured and still not sorted out, with a weekend in between.
 *
 * The weekend is when triage is meant to happen, so anything that has sat in
 * Needs Details through a Saturday or Sunday gets nagged about - and keeps
 * being nagged about every day until it is sorted.
 */
export function needsTriageNag(task: Pick<Task, 'status' | 'createdAt' | 'deletedAt'>, today = getTodayString()): boolean {
  if (task.deletedAt || task.status !== 'Needs Details') return false;
  const created = localDay(task.createdAt);
  if (!created) return false;
  const span = differenceInCalendarDays(parseLocalDate(today), parseLocalDate(created));
  if (span < 0) return false;
  if (span >= 6) return true;
  for (let i = 0; i <= span; i++) {
    const day = addDays(parseLocalDate(created), i).getDay();
    if (day === 0 || day === 6) return true;
  }
  return false;
}

/**
 * What the data will look like once the daily check has run.
 *
 * The check runs in the browser on the first visit of the day. The notifier
 * does not wait for that, so it applies the same rollover in memory - without
 * it, a morning brief sent before you open the app would miss every
 * recurring task due back today.
 */
export function rolledOver<T extends Task>(tasks: T[], today = getTodayString()): T[] {
  return tasks.map((task) => {
    if (task.deletedAt || !checkNeedsReset(task, today)) return task;
    const { dueDate, plannedDate } = nextRecurrenceDates(task);
    return { ...task, status: plannedDate ? 'Planned' : 'Backlog', dueDate, plannedDate, doneDate: null, lastCompleted: null };
  });
}

export function rolledOverEvents<E extends Event>(events: E[], today = getTodayString()): E[] {
  return events.map((e) => (e.deletedAt ? e : { ...e, date: currentEventDate(e, today) }));
}

/** Unfinished things that belonged to a day. */
export function unfinishedOn(
  day: string,
  tasks: Task[],
  habits: Habit[],
  events: Event[],
): { tasks: Task[]; habits: Habit[]; events: Event[] } {
  return {
    tasks: tasks.filter((t) => isOnToday(t, day)),
    habits: habits.filter((h) => !h.deletedAt && h.isActive && isHabitDueOn(h, day)),
    events: events.filter((e) => !e.deletedAt && e.recurrence === 'None' && e.date === day && e.lastCompleted !== day),
  };
}

const at = (day: string, time: string) => `${day}T${time}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const names = (items: { name: string }[], max = 3) => {
  const shown = items.slice(0, max).map((i) => i.name).join(', ');
  return items.length > max ? `${shown} +${items.length - max} more` : shown;
};

export interface NoticeInput {
  tasks: Task[];
  habits: Habit[];
  events: Event[];
  settings: NoticeSettings;
  /** What today is allowed to cost. */
  budget: number;
  defaultAP: number;
  now: Date;
}

export function buildNotices(input: NoticeInput): Notice[] {
  const { settings, now, defaultAP } = input;
  const today = toDateString(now);
  const yesterday = toDateString(addDays(parseLocalDate(today), -1));
  const tasks = rolledOver(input.tasks.filter((t) => !t.deletedAt), today);
  const events = rolledOverEvents(input.events.filter((e) => !e.deletedAt), today);
  const habits = input.habits.filter((h) => !h.deletedAt && h.isActive);
  const out: Notice[] = [];
  const tname = (t: Task) => ({ name: t.taskName });

  // --- the state of things this morning --------------------------------
  const overdue = tasks.filter((t) => isOverdue(t, today) && t.status !== 'Blocked')
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const missed = tasks.filter((t) =>
    t.status !== 'Done' && t.status !== 'Archived' && t.status !== 'Blocked' &&
    !!t.plannedDate && t.plannedDate < today && !(t.dueDate && t.dueDate < today));
  const followUps = tasks.filter((t) => t.status === 'Blocked' && !!t.followUpDate && t.followUpDate <= today);
  const pressing = tasks.filter((t) => isPressingBlocked(t, today));
  const triage = tasks.filter((t) => needsTriageNag(t, today));
  const back = unfinishedOn(yesterday, tasks, habits, events);
  const backCount = back.tasks.length + back.habits.length + back.events.length;

  if (overdue.length) out.push({
    key: `overdue:${today}`, kind: 'overdue', level: 'urgent', pushAt: null,
    title: `${plural(overdue.length, 'task')} overdue`,
    body: names(overdue.map(tname)), href: '/plan?view=triage&tab=overdue',
  });
  if (pressing.length) out.push({
    key: `blocked:${today}`, kind: 'blocked', level: 'urgent', pushAt: null,
    title: `${plural(pressing.length, 'blocked task')} with a deadline close`,
    body: names(pressing.map(tname)), href: '/plan?view=triage&tab=blocked',
  });
  if (missed.length) out.push({
    key: `missed:${today}`, kind: 'missed', level: 'warn', pushAt: null,
    title: `${plural(missed.length, 'plan')} missed`,
    body: names(missed.map(tname)), href: '/plan?view=triage&tab=missed',
  });
  if (followUps.length) out.push({
    key: `followup:${today}`, kind: 'followup', level: 'warn', pushAt: null,
    title: `${plural(followUps.length, 'follow-up')} due`,
    body: names(followUps.map(tname)), href: '/',
  });
  if (triage.length) out.push({
    key: `triage:${today}`, kind: 'triage', level: 'warn', pushAt: null,
    title: `${plural(triage.length, 'capture')} still need details`,
    body: names(triage.map(tname)), href: '/plan?view=triage&tab=needsDetails',
  });
  if (backCount) out.push({
    key: `yesterday:${today}`, kind: 'yesterday', level: 'info', pushAt: null,
    title: 'Anything to tick off from yesterday?',
    body: `${plural(backCount, 'thing')} from yesterday not marked done`, href: '/yesterday',
  });

  // --- the morning brief: one push that carries all of the above --------
  const todays = tasks.filter((t) => isOnToday(t, today));
  const habitsToday = habits.filter((h) => isHabitDueOn(h, today));
  const eventsToday = events.filter((e) => e.date === today);
  const planned =
    todays.reduce((n, t) => n + apOf(t, defaultAP), 0) +
    habitsToday.reduce((n, h) => n + apOf(h, HABIT_DEFAULT_AP), 0) +
    eventsToday.reduce((n, e) => n + apOf(e, defaultAP), 0);
  const lines = [
    [
      todays.length ? plural(todays.length, 'task') : null,
      habitsToday.length ? plural(habitsToday.length, 'habit') : null,
      eventsToday.length ? plural(eventsToday.length, 'event') : null,
    ].filter(Boolean).join(' · ') || 'Nothing planned yet',
    `${planned} of ${input.budget} AP`,
    overdue.length ? `${overdue.length} overdue` : null,
    pressing.length ? `${pressing.length} blocked & pressing` : null,
    missed.length ? `${missed.length} missed` : null,
    followUps.length ? `${followUps.length} to follow up` : null,
    triage.length ? `${triage.length} to triage` : null,
    backCount ? `${backCount} unticked from yesterday` : null,
  ].filter(Boolean);
  out.push({
    key: `brief:${today}`, kind: 'brief', level: planned > input.budget ? 'warn' : 'info',
    pushAt: settings.push.brief ? at(today, settings.briefTime) : null,
    title: planned > input.budget ? `Today is over budget (${planned}/${input.budget} AP)` : 'Your day',
    body: lines.join(' · '), href: '/',
  });

  // --- timed ------------------------------------------------------------
  for (const event of eventsToday) {
    if (!event.time || event.lastCompleted === today) continue;
    const start = new Date(`${today}T${event.time}:00`);
    const lead = new Date(start.getTime() - settings.eventLeadMinutes * 60000);
    const end = new Date(start.getTime() + (event.duration ?? 60) * 60000);
    if (now > end) continue;
    out.push({
      key: `event:${event.id}:${today}`, kind: 'event', level: 'info',
      pushAt: settings.push.event ? format(lead, "yyyy-MM-dd'T'HH:mm") : null,
      title: `${event.eventName} at ${event.time}`,
      body: settings.eventLeadMinutes ? `Starts in ${settings.eventLeadMinutes} minutes` : 'Starting now',
      href: '/events',
    });
  }

  const habitsLeft = habitsToday;
  if (habitsLeft.length) out.push({
    key: `habits:${today}`, kind: 'habits', level: 'info',
    pushAt: settings.push.habits ? at(today, settings.eveningTime) : null,
    title: `${plural(habitsLeft.length, 'habit')} left today`,
    body: names(habitsLeft.map((h) => ({ name: `${h.icon ? h.icon + ' ' : ''}${h.habitName}` }))), href: '/habits',
  });

  const weekday = parseLocalDate(today).getDay();
  if (weekday === 0) out.push({
    key: `review:week:${getStartOfWeek(parseLocalDate(today))}`, kind: 'review', level: 'info',
    pushAt: settings.push.review ? at(today, settings.eveningTime) : null,
    title: 'Your week in review', body: 'See how the week went before planning the next one.',
    href: '/retrospect?period=week',
  });
  if (toDateString(endOfMonth(parseLocalDate(today))) === today) out.push({
    key: `review:month:${today.slice(0, 7)}`, kind: 'review', level: 'info',
    pushAt: settings.push.review ? at(today, settings.eveningTime) : null,
    title: 'Your month in review', body: 'A look back at the month.',
    href: '/retrospect?period=month',
  });

  for (const habit of habits) {
    for (const m of habit.milestones ?? []) {
      if (m.date !== today) continue;
      out.push({
        key: `milestone:${habit.id}:${m.key}`, kind: 'milestone', level: 'info', pushAt: null,
        title: `🏆 ${habit.habitName}: ${milestoneLabel(m.key)}`, body: 'Milestone reached today.', href: '/habits',
      });
    }
  }

  return out;
}

/** Whether a notice should be listed in the app right now. */
export function isVisible(notice: Notice, now: Date): boolean {
  if (!notice.pushAt) return true;
  // The brief is useful all day; the rest appear when they fall due.
  if (notice.kind === 'brief') return true;
  return format(now, "yyyy-MM-dd'T'HH:mm") >= notice.pushAt;
}

/** How long after its time a push may still go out, e.g. after a restart. */
const PUSH_GRACE_MINUTES = 180;

/** Whether the notifier should push this notice now. */
export function isDueToPush(notice: Notice, now: Date): boolean {
  if (!notice.pushAt) return false;
  const due = new Date(`${notice.pushAt}:00`);
  const late = (now.getTime() - due.getTime()) / 60000;
  return late >= 0 && late <= PUSH_GRACE_MINUTES;
}

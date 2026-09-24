/**
 * When repeating things come round again.
 *
 * Pure date logic with no storage attached, so the server can use exactly the
 * same rules as the browser - the notifier on the Pi has to agree with the
 * app about what is due, or it would push reminders the app contradicts.
 * lib/db.ts re-exports all of this for the existing call sites.
 */

import { addDays, addMonths, addYears, differenceInCalendarDays } from 'date-fns';

import type { Event, Habit, Task } from '@/types';
import { getTodayString, parseLocalDate, parseLocalDateTime, toDateString } from './dates';

/** The local day a stored timestamp or date-only string falls on. */
export function localDay(value: string | null | undefined): string | null {
  if (!value) return null;
  return toDateString(parseLocalDateTime(value));
}

/**
 * Move a date one recurrence interval past `from`.
 *
 * Anchored on when the task was actually completed rather than on its old
 * due date: a weekly task finished three days late recurs a week from the
 * finish, not a week from a date already in the past. Without this the reset
 * left the old dates untouched and the task came back permanently overdue.
 */
export function advanceDate(
  from: Date,
  recurrence: Task['recurrence'],
  weekdays?: number[] | null,
): Date | null {
  // A weekly task can land on named days instead of "seven days later", which
  // is what "every weekday" or "Mon, Wed and Fri" actually mean. Without it
  // those had to be approximated as a plain weekly cycle that drifted to
  // whichever day you last happened to do it.
  if (recurrence === 'Weekly' && weekdays && weekdays.length) {
    const wanted = new Set(weekdays);
    for (let i = 1; i <= 7; i++) {
      const candidate = addDays(from, i);
      if (wanted.has(candidate.getDay())) return candidate;
    }
    return null;
  }

  switch (recurrence) {
    case 'Daily': return addDays(from, 1);
    case 'Weekly': return addDays(from, 7);
    case 'Biweekly': return addDays(from, 14);
    case 'Monthly': return addMonths(from, 1);
    case 'Bimonthly': return addMonths(from, 2);
    case 'Quarterly': return addMonths(from, 3);
    case 'Half-Yearly': return addMonths(from, 6);
    case 'Yearly': return addYears(from, 1);
    default: return null;
  }
}

/** One interval before `from`; the inverse of advanceDate for plain cadences. */
export function previousDate(from: Date, recurrence: Task['recurrence']): Date | null {
  switch (recurrence) {
    case 'Daily': return addDays(from, -1);
    case 'Weekly': return addDays(from, -7);
    case 'Biweekly': return addDays(from, -14);
    case 'Monthly': return addMonths(from, -1);
    case 'Bimonthly': return addMonths(from, -2);
    case 'Quarterly': return addMonths(from, -3);
    case 'Half-Yearly': return addMonths(from, -6);
    case 'Yearly': return addYears(from, -1);
    default: return null;
  }
}

/** Roughly how many days one cycle lasts. Used to count missed cycles. */
export function intervalDays(recurrence: Task['recurrence'], weekdays?: number[] | null): number {
  if (recurrence === 'Weekly' && weekdays && weekdays.length) return Math.max(1, Math.round(7 / weekdays.length));
  switch (recurrence) {
    case 'Daily': return 1;
    case 'Weekly': return 7;
    case 'Biweekly': return 14;
    case 'Monthly': return 30;
    case 'Bimonthly': return 61;
    case 'Quarterly': return 91;
    case 'Half-Yearly': return 182;
    case 'Yearly': return 365;
    default: return 0;
  }
}

/**
 * The deadline a repeating task carries by virtue of repeating.
 *
 * One interval on from the last time it was done - or from when it was
 * written, if it never has been. Only used when there is no explicit due
 * date, so anything with a real deadline keeps it.
 */
export function cycleDueDate(
  task: Partial<Pick<Task, 'recurrence' | 'lastCompleted' | 'createdAt' | 'recurrenceWeekdays' | 'rotSince'>>,
): string | null {
  if (!task.recurrence || task.recurrence === 'None') return null;
  // rotSince is restarted when an occurrence comes back, so it is the start of
  // the current cycle; lastCompleted is cleared at that moment.
  const since = task.lastCompleted || task.rotSince || task.createdAt;
  if (!since) return null;
  const next = advanceDate(parseLocalDate(localDay(since)!), task.recurrence, task.recurrenceWeekdays);
  return next ? toDateString(next) : null;
}

type RecurringFields = Pick<Task, 'recurrence' | 'recurrenceAnchor' | 'recurrenceWeekdays' | 'dueDate' | 'plannedDate' | 'lastCompleted'>;

/**
 * The due/planned dates a recurring task should carry after it is completed.
 *
 * The gap between planning and deadline is part of how the task is set up -
 * "plan it Wednesday, it is due Friday" - so the two dates move together
 * rather than collapsing onto the same day.
 */
export function nextRecurrenceDates(task: RecurringFields): { dueDate: string | null; plannedDate: string | null } {
  // A scheduled period keeps its own cadence: the fortnight after the one
  // that just ended, not a fortnight after you got round to it. Doing it four
  // days early must not drag every future deadline four days earlier with it.
  const anchor = task.recurrenceAnchor === 'schedule' && task.dueDate
    ? parseLocalDate(task.dueDate)
    : task.lastCompleted ? parseLocalDate(localDay(task.lastCompleted)!) : parseLocalDate(getTodayString());
  const next = advanceDate(anchor, task.recurrence, task.recurrenceWeekdays);
  if (!next) return { dueDate: task.dueDate, plannedDate: task.plannedDate };

  const nextStr = toDateString(next);
  // Anchor on whichever date the task actually had; if it had both, keep the
  // number of days between them.
  if (task.dueDate && task.plannedDate) {
    const gap = differenceInCalendarDays(parseLocalDate(task.dueDate), parseLocalDate(task.plannedDate));
    return { dueDate: nextStr, plannedDate: toDateString(addDays(next, -gap)) };
  }
  return {
    dueDate: task.dueDate ? nextStr : null,
    plannedDate: task.plannedDate ? nextStr : null,
  };
}

/**
 * The day a finished recurring task's next occurrence falls on.
 *
 * Its planned day if it keeps one, else its due day, else simply one interval
 * after it was done.
 */
export function followingOccurrence(task: RecurringFields): string | null {
  if (task.recurrence === 'None') return null;
  const { dueDate, plannedDate } = nextRecurrenceDates(task);
  if (plannedDate || dueDate) return plannedDate ?? dueDate;
  const from = task.lastCompleted ? parseLocalDate(localDay(task.lastCompleted)!) : parseLocalDate(getTodayString());
  const next = advanceDate(from, task.recurrence, task.recurrenceWeekdays);
  return next ? toDateString(next) : null;
}

/** True once a repeating task has run past its end date. */
export function seriesEnded(task: RecurringFields & Pick<Task, 'recurrenceEnd'>): boolean {
  if (!task.recurrenceEnd || task.recurrence === 'None') return false;
  const next = followingOccurrence(task);
  return !next || next > task.recurrenceEnd;
}

/**
 * When a recurring task is next on - what "↻ next on" shows.
 *
 * For open work that is the occurrence in hand; for finished work, the day
 * the next one comes back. Null when it does not repeat or the series is over.
 */
export function nextOnDate(task: Task): string | null {
  if (task.recurrence === 'None') return null;
  if (task.status === 'Done' || task.status === 'Archived') {
    if (seriesEnded(task)) return null;
    return followingOccurrence(task);
  }
  return task.plannedDate ?? task.dueDate ?? cycleDueDate(task);
}

// Check if a recurring task needs reset
export function checkNeedsReset(task: Task, today = getTodayString()): boolean {
  if (task.recurrence === 'None' || task.status !== 'Done' || !task.lastCompleted) {
    return false;
  }
  if (seriesEnded(task)) return false;

  // A scheduled period reopens when the last one ends, not an interval after
  // you finished it. Completing Friday's return on Tuesday should not mean
  // waiting a fortnight from Tuesday before the next one exists.
  if (task.recurrenceAnchor === 'schedule' && task.dueDate) {
    return today > task.dueDate;
  }

  const doneDay = localDay(task.lastCompleted)!;

  // Named days reopen on the next named day, not seven days on.
  if (task.recurrence === 'Weekly' && task.recurrenceWeekdays?.length) {
    const next = advanceDate(parseLocalDate(doneDay), 'Weekly', task.recurrenceWeekdays);
    return !!next && today >= toDateString(next);
  }

  // Counted in calendar days, not elapsed hours. The daily check runs once,
  // on the first visit of the day; timing it in hours meant a daily task
  // finished at 9pm had not been "24 hours" by the next morning's check, so
  // it stayed finished for the whole of the day it should have been back.
  const days = differenceInCalendarDays(parseLocalDate(today), parseLocalDate(doneDay));
  const last = parseLocalDate(doneDay);
  const now = parseLocalDate(today);
  const monthsApart = (now.getFullYear() - last.getFullYear()) * 12 + (now.getMonth() - last.getMonth());

  switch (task.recurrence) {
    case 'Daily': return days >= 1;
    case 'Weekly': return days >= 7;
    case 'Biweekly': return days >= 14;
    // Longer cadences reopen with their period: "monthly" means once in each
    // calendar month, so the new one is available from the 1st.
    case 'Monthly': return monthsApart >= 1;
    case 'Bimonthly': return monthsApart >= 2;
    case 'Quarterly':
      return Math.floor(now.getMonth() / 3) !== Math.floor(last.getMonth() / 3) || now.getFullYear() !== last.getFullYear();
    case 'Half-Yearly': return monthsApart >= 6;
    case 'Yearly': return now.getFullYear() !== last.getFullYear();
    default: return false;
  }
}

/**
 * The later occurrences of a repeating task that fall inside [from, to].
 *
 * A recurring task is one row that resets, so every planning view used to see
 * a single occurrence: "read a page" daily looked like one page a week to the
 * planner. These are the rest - drawn faintly and reserved against the day's
 * energy, but not separate tasks you can lose track of.
 *
 * The occurrence in hand is excluded (it is the real task and is drawn as
 * one). Overdue work is projected as if done today, which is the soonest the
 * next one could follow it.
 */
export function projectOccurrences(task: Task, from: string, to: string, today = getTodayString()): string[] {
  if (task.deletedAt || task.recurrence === 'None' || task.status === 'Archived') return [];
  if (task.status === 'Blocked') return [];

  let cursor: string | null;
  const out: string[] = [];
  if (task.status === 'Done') {
    if (seriesEnded(task)) return [];
    cursor = followingOccurrence(task);
    if (cursor && cursor >= from && cursor <= to && (!task.recurrenceEnd || cursor <= task.recurrenceEnd)) out.push(cursor);
  } else {
    const base = task.plannedDate ?? task.dueDate ?? cycleDueDate(task) ?? today;
    cursor = base < today ? today : base;
  }

  for (let guard = 0; cursor && guard < 400; guard++) {
    const next = advanceDate(parseLocalDate(cursor), task.recurrence, task.recurrenceWeekdays);
    if (!next) break;
    cursor = toDateString(next);
    if (cursor > to) break;
    if (task.recurrenceEnd && cursor > task.recurrenceEnd) break;
    if (cursor >= from) out.push(cursor);
  }
  return out;
}

// --- events ----------------------------------------------------------------

/**
 * The date a recurring event should move to once its occurrence is done.
 *
 * Anchored on the event's own date rather than on when it was ticked off:
 * an event is an appointment, and a standing Monday meeting marked done on
 * Tuesday should still be next Monday, not drift a day each week. (Tasks use
 * the completion date instead - see nextRecurrenceDates.)
 */
export function nextEventDate(event: Pick<Event, 'date' | 'recurrence'>): string | null {
  const next = advanceDate(parseLocalDate(event.date), event.recurrence);
  return next ? toDateString(next) : null;
}

/**
 * Where a recurring event belongs today: its first occurrence on or after
 * today. An appointment that has passed has passed, attended or not; leaving
 * a standing meeting stuck on the one you skipped hid every later one.
 */
export function currentEventDate(event: Pick<Event, 'date' | 'recurrence'>, today = getTodayString()): string {
  if (event.recurrence === 'None' || event.date >= today) return event.date;
  let date = event.date;
  for (let guard = 0; guard < 2000 && date < today; guard++) {
    const next = nextEventDate({ date, recurrence: event.recurrence });
    if (!next) break;
    date = next;
  }
  return date;
}

export function checkEventNeedsReset(event: Event, today = getTodayString()): boolean {
  if (event.recurrence === 'None') return false;
  return currentEventDate(event, today) !== event.date;
}

/** The occurrence of a recurring event just before its current one. */
export function previousEventDate(event: Pick<Event, 'date' | 'recurrence'>): string | null {
  const prev = previousDate(parseLocalDate(event.date), event.recurrence);
  return prev ? toDateString(prev) : null;
}

// --- habits ----------------------------------------------------------------

// Get start of the week (Monday) containing `date`, as YYYY-MM-DD
export function getStartOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust to Monday (day 0 = Sunday, so we go back 6 days; day 1 = Monday, go back 0 days, etc.)
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return toDateString(d);
}

/** Completions in the Monday-to-Sunday week containing `date`, up to and including it. */
export function getCompletionsThisWeek(habit: Pick<Habit, 'completionDates'>, date = getTodayString()): number {
  const weekStart = getStartOfWeek(parseLocalDate(date));
  return (habit.completionDates || []).filter(d => d >= weekStart && d <= date).length;
}

/** Whether a habit is asked for on a given day. */
export function isHabitDueOn(habit: Habit, date: string): boolean {
  if (!habit.isActive || habit.deletedAt) return false;

  // Asked for at most once a day, whatever the cadence or quota. This used to
  // sit below the targetPerWeek branch, which returned purely on the weekly
  // count - so a habit completed today stayed in the due list and showed up
  // under "completed today" at the same time.
  if ((habit.completionDates || []).includes(date)) return false;

  const quotaMet = !!habit.targetPerWeek && habit.targetPerWeek > 0 &&
    getCompletionsThisWeek(habit, date) >= habit.targetPerWeek;

  // Chosen days: only those, and not once the week's quota is met.
  if (habit.weekdays && habit.weekdays.length) {
    return habit.weekdays.includes(parseLocalDate(date).getDay()) && !quotaMet;
  }

  // A weekly quota - "three times a week" - governs how often it is asked for
  // within the week, in place of the recurrence interval.
  if (habit.targetPerWeek && habit.targetPerWeek > 0) return !quotaMet;

  const lastDone = (habit.completionDates || []).filter(d => d < date).sort().pop()
    ?? (habit.lastCompleted ? localDay(habit.lastCompleted) : null);
  if (!lastDone || lastDone > date) return true;

  const days = differenceInCalendarDays(parseLocalDate(date), parseLocalDate(lastDone));
  const last = parseLocalDate(lastDone);
  const now = parseLocalDate(date);
  const monthsApart = (now.getFullYear() - last.getFullYear()) * 12 + (now.getMonth() - last.getMonth());

  switch (habit.recurrence) {
    case 'Daily': return days >= 1;
    case 'Weekly': return days >= 7;
    case 'Biweekly': return days >= 14;
    case 'Monthly': return monthsApart >= 1;
    case 'Bimonthly': return monthsApart >= 2;
    case 'Quarterly':
      return Math.floor(now.getMonth() / 3) !== Math.floor(last.getMonth() / 3) || now.getFullYear() !== last.getFullYear();
    case 'Half-Yearly': return monthsApart >= 6;
    case 'Yearly': return now.getFullYear() !== last.getFullYear();
    default: return false;
  }
}

export function isHabitDueToday(habit: Habit): boolean {
  return isHabitDueOn(habit, getTodayString());
}

// Prune completionDates older than retentionDays to prevent unbounded growth
export function pruneCompletionDates(dates: string[], retentionDays: number = 90, today = getTodayString()): string[] {
  const cutoff = toDateString(addDays(parseLocalDate(today), -retentionDays));
  return dates.filter(d => d >= cutoff);
}

/**
 * When a recurring task would come round again if it were finished today -
 * the "then" in "↻ Weekly · then Thu 1 Oct". For finished work, when it is
 * actually back.
 */
export function thenOn(task: Task, today = getTodayString()): string | null {
  if (task.recurrence === 'None') return null;
  if (task.status === 'Done' || task.status === 'Archived') return nextOnDate(task);
  const asIfDone = { ...task, lastCompleted: `${today}T12:00:00` };
  if (seriesEnded(asIfDone)) return null;
  return followingOccurrence(asIfDone);
}

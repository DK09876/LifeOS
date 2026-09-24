/**
 * A week or a month, looked back on.
 *
 * Everything is derived from the records themselves - completion logs, dates,
 * the energy history - rather than from snapshots, so a period reviewed late
 * (or reviewed again after ticking off yesterday) says the same thing.
 */

import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, startOfMonth } from 'date-fns';

import type { Domain, Event, Habit, Project, Task } from '@/types';
import { getTodayString, parseLocalDate, toDateString } from './dates';
import { getStartOfWeek, localDay } from './recurrence';
import { apOf, HABIT_DEFAULT_AP } from './capacity';
import type { History } from './history';

export type PeriodKind = 'week' | 'month';

export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
  label: string;
}

export function periodFor(kind: PeriodKind, offset: number, today = getTodayString()): Period {
  if (kind === 'week') {
    const start = addDays(parseLocalDate(getStartOfWeek(parseLocalDate(today))), offset * 7);
    const end = addDays(start, 6);
    return { kind, start: toDateString(start), end: toDateString(end), label: `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}` };
  }
  const start = startOfMonth(addMonths(parseLocalDate(today), offset));
  return { kind, start: toDateString(start), end: toDateString(endOfMonth(start)), label: format(start, 'MMMM yyyy') };
}

function daysOf(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = parseLocalDate(start); toDateString(d) <= end; d = addDays(d, 1)) out.push(toDateString(d));
  return out;
}

/** Local days a task was finished on. */
export function taskDoneDays(task: Task): string[] {
  const days = new Set(task.completions ?? []);
  if (task.status === 'Done') {
    const d = localDay(task.doneDate) ?? localDay(task.updatedAt);
    if (d) days.add(d);
  }
  return Array.from(days);
}

/**
 * Open backlog at the end of a day: one-off work that existed and was not yet
 * finished, archived or deleted. Recurring tasks are left out - they never
 * "shrink", and counting them would hide whether the finite pile is going down.
 */
export function openBacklogOn(tasks: Task[], day: string): number {
  let open = 0;
  for (const t of tasks) {
    if (t.recurrence !== 'None') continue;
    const created = localDay(t.createdAt);
    if (!created || created > day) continue;
    const deleted = localDay(t.deletedAt);
    if (deleted && deleted <= day) continue;
    if (t.status === 'Done') {
      const done = localDay(t.doneDate) ?? localDay(t.updatedAt);
      if (done && done <= day) continue;
    }
    if (t.status === 'Archived') {
      const archived = localDay(t.updatedAt);
      if (archived && archived <= day) continue;
    }
    open++;
  }
  return open;
}

/** Roughly how many times a habit was asked for across some days. */
export function expectedCompletions(habit: Habit, days: string[]): number {
  const created = localDay(habit.createdAt) ?? days[0];
  const live = days.filter((d) => d >= created);
  if (!live.length || !habit.isActive) return 0;
  if (habit.weekdays?.length) return live.filter((d) => habit.weekdays!.includes(parseLocalDate(d).getDay())).length;
  if (habit.targetPerWeek) return Math.round((habit.targetPerWeek * live.length) / 7);
  const per: Record<Habit['recurrence'], number> = {
    Daily: 1, Weekly: 7, Biweekly: 14, Monthly: 30, Bimonthly: 61, Quarterly: 91, 'Half-Yearly': 182, Yearly: 365,
  };
  return Math.max(1, Math.round(live.length / per[habit.recurrence]));
}

export interface DaySummary { date: string; spent: number; capacity: number; finished: number }

export interface Review {
  period: Period;
  days: DaySummary[];
  totals: { finished: number; spent: number; capacity: number; overDays: number; activeDays: number };
  finished: Array<{ task: Task; day: string }>;
  byDomain: Array<{ id: string | null; name: string; icon: string | null; ap: number; count: number }>;
  quietDomains: Domain[];
  backlog: { start: number; end: number; created: number; closed: number; series: Array<{ date: string; open: number }> };
  slipped: Task[];
  stillMissed: Task[];
  overdue: Task[];
  habits: Array<{ habit: Habit; done: number; expected: number }>;
  milestones: Array<{ habit: Habit; key: string; date: string }>;
  projects: Array<{ project: Project; logged: number; apDone: number }>;
  events: { attended: number };
}

export function buildReview(input: {
  period: Period;
  tasks: Task[];
  habits: Habit[];
  events: Event[];
  projects: Project[];
  domains: Domain[];
  history: History;
  defaultAP: number;
  budgetFor: (date: string) => number;
  today?: string;
}): Review {
  const today = input.today ?? getTodayString();
  const { period, defaultAP } = input;
  const all = daysOf(period.start, period.end);
  // Only days that have happened count; the rest of the week is not a failure.
  const lived = all.filter((d) => d <= today);
  const inPeriod = (d: string | null | undefined) => !!d && d >= period.start && d <= period.end;
  const tasks = input.tasks.filter((t) => !t.deletedAt);
  const habits = input.habits.filter((h) => !h.deletedAt);
  const events = input.events.filter((e) => !e.deletedAt);

  const finished: Review['finished'] = [];
  for (const task of tasks) for (const day of taskDoneDays(task)) if (inPeriod(day)) finished.push({ task, day });
  finished.sort((a, b) => a.day.localeCompare(b.day));

  const days: DaySummary[] = lived.map((date) => {
    let spent = 0;
    let count = 0;
    for (const f of finished) if (f.day === date) { spent += apOf(f.task, defaultAP); count++; }
    for (const h of habits) if ((h.completionDates || []).includes(date)) { spent += apOf(h, HABIT_DEFAULT_AP); count++; }
    for (const e of events) if (localDay(e.lastCompleted) === date) { spent += apOf(e, defaultAP); count++; }
    const recorded = input.history[date];
    return { date, spent, finished: count, capacity: recorded?.capacity ?? input.budgetFor(date) };
  });

  const totals = {
    finished: days.reduce((n, d) => n + d.finished, 0),
    spent: days.reduce((n, d) => n + d.spent, 0),
    capacity: days.reduce((n, d) => n + d.capacity, 0),
    overDays: days.filter((d) => d.spent > d.capacity).length,
    activeDays: days.filter((d) => d.finished > 0).length,
  };

  const domainMap = new Map(input.domains.filter((d) => !d.deletedAt).map((d) => [d.id, d]));
  const byDomainMap = new Map<string | null, { ap: number; count: number }>();
  for (const f of finished) {
    const key = f.task.domainId && domainMap.has(f.task.domainId) ? f.task.domainId : null;
    const cur = byDomainMap.get(key) ?? { ap: 0, count: 0 };
    byDomainMap.set(key, { ap: cur.ap + apOf(f.task, defaultAP), count: cur.count + 1 });
  }
  const byDomain = Array.from(byDomainMap.entries()).map(([id, v]) => ({
    id, name: id ? domainMap.get(id)!.name : 'No domain', icon: id ? domainMap.get(id)!.icon : null, ...v,
  })).sort((a, b) => b.ap - a.ap);
  const quietDomains = Array.from(domainMap.values()).filter((d) => !byDomainMap.has(d.id));

  const before = toDateString(addDays(parseLocalDate(period.start), -1));
  const lastDay = lived[lived.length - 1] ?? before;
  const oneOff = tasks.filter((t) => t.recurrence === 'None');
  const backlog = {
    start: openBacklogOn(input.tasks, before),
    end: openBacklogOn(input.tasks, lastDay),
    created: oneOff.filter((t) => inPeriod(localDay(t.createdAt))).length,
    closed: finished.filter((f) => f.task.recurrence === 'None').length,
    series: lived.map((date) => ({ date, open: openBacklogOn(input.tasks, date) })),
  };

  const open = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Archived');
  const slipped = open.filter((t) => (t.slipCount ?? 0) > 0).sort((a, b) => (b.slipCount ?? 0) - (a.slipCount ?? 0));
  const stillMissed = open.filter((t) => t.plannedDate && inPeriod(t.plannedDate) && t.plannedDate < today);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today && t.dueDate <= period.end);

  const habitRows = habits.filter((h) => h.isActive).map((habit) => ({
    habit,
    done: (habit.completionDates || []).filter((d) => inPeriod(d)).length,
    expected: expectedCompletions(habit, lived),
  }));
  const milestones = habits.flatMap((habit) =>
    (habit.milestones ?? []).filter((m) => inPeriod(m.date)).map((m) => ({ habit, key: m.key, date: m.date })));

  const projects = input.projects.filter((p) => !p.deletedAt && p.status !== 'Archived').map((project) => ({
    project,
    logged: (project.progressLog ?? []).filter((e) => inPeriod(e.date)).reduce((n, e) => n + e.amount, 0),
    apDone: finished.filter((f) => f.task.projectId === project.id).reduce((n, f) => n + apOf(f.task, defaultAP), 0),
  })).filter((p) => p.logged !== 0 || p.apDone > 0);

  return {
    period, days, totals, finished, byDomain, quietDomains, backlog, slipped, stillMissed, overdue,
    habits: habitRows, milestones, projects,
    events: { attended: events.filter((e) => inPeriod(localDay(e.lastCompleted))).length },
  };
}

/** Whole days between two dates, for "n days late". */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseLocalDate(b), parseLocalDate(a));
}

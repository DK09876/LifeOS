/**
 * How much effort a day is allowed to cost, and how much it has cost so far.
 *
 * The AP budget used to exist only inside the suggester: it shaped what got
 * proposed and then vanished, so nothing tracked what the day actually took.
 * This is the same number made visible and adjustable on the day itself -
 * some days you have less in you than others, and the plan should be able to
 * say so.
 */

import type { Task, Event, Habit } from '@/types';
import { getTodayString, parseLocalDateTime } from './dates';

/** Per-date overrides, keyed YYYY-MM-DD. Absent means "use the default". */
export type CapacityMap = Record<string, number>;

export const CAPACITY_PREF = 'ap.capacityByDate';

/** Overrides older than this are dropped; they are only useful while recent. */
const KEEP_DAYS = 60;

export function parseCapacityMap(raw: string | undefined): CapacityMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CapacityMap = {};
    for (const [date, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[date] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Drop overrides that have aged out, so the preference cannot grow forever. */
export function pruneCapacityMap(map: CapacityMap, today = getTodayString()): CapacityMap {
  const cutoff = new Date(new Date(today + 'T00:00:00').getTime() - KEEP_DAYS * 86400000);
  const out: CapacityMap = {};
  for (const [date, value] of Object.entries(map)) {
    if (new Date(date + 'T00:00:00') >= cutoff) out[date] = value;
  }
  return out;
}

/**
 * A default per weekday, indexed 0=Sunday. A slot left null uses the single
 * daily default, so "lighter on Mondays" is one number, not seven.
 */
export type WeekdayBudget = Array<number | null>;

export const WEEKDAY_BUDGET_PREF = 'ap.weekdayBudget';

export function parseWeekdayBudget(raw: string | undefined): WeekdayBudget | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 7) return null;
    const out = parsed.map((v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null));
    return out.some((v) => v !== null) ? out : null;
  } catch {
    return null;
  }
}

/**
 * What a day is allowed to cost: a one-off override for that date, else the
 * default for its weekday, else the daily default.
 */
export function capacityFor(
  map: CapacityMap,
  date: string,
  fallback: number,
  weekdays?: WeekdayBudget | null,
): number {
  const override = map[date];
  if (typeof override === 'number') return override;
  const byWeekday = weekdays?.[new Date(date + 'T00:00:00').getDay()];
  return typeof byWeekday === 'number' ? byWeekday : fallback;
}

/** A task's effort, falling back to the configured default when unestimated. */
export function apOf(item: { actionPoints: string | null }, defaultAP: number): number {
  // An explicit 0 is a real answer - brushing your teeth is worth keeping and
  // not worth budgeting for - so it must survive rather than falling through
  // to the default the way an unestimated item does.
  if (item.actionPoints === '0') return 0;
  return parseInt(item.actionPoints || '0') || defaultAP;
}

export interface DayLoad {
  /** Effort already spent on things finished today. */
  done: number;
  /** Effort still committed for today but not finished. */
  planned: number;
  /** done + planned: what the day is on course to cost. */
  committed: number;
}

/**
 * What today has cost and is still going to cost.
 *
 * Events count against the budget as well as tasks - an hour at the dentist
 * takes the same capacity as an hour of work, and a day that ignores them
 * reads as emptier than it is.
 */
export function dayLoad(
  tasks: Task[],
  events: Event[],
  defaultAP: number,
  today = getTodayString(),
  habits: { due: Habit[]; done: Habit[] } = { due: [], done: [] },
): DayLoad {
  let done = 0;
  let planned = 0;

  for (const task of tasks) {
    if (task.deletedAt) continue;
    if (task.status === 'Done') {
      // Finished today, whichever day it was scheduled for: the effort was
      // spent today and the day should account for it.
      if (task.doneDate && sameLocalDay(task.doneDate, today)) done += apOf(task, defaultAP);
      continue;
    }
    if (task.status === 'Archived') continue;
    if (task.plannedDate === today || task.dueDate === today) planned += apOf(task, defaultAP);
  }

  for (const event of events) {
    if (event.deletedAt || event.date !== today) continue;
    if (event.lastCompleted === today) done += apOf(event, defaultAP);
    else planned += apOf(event, defaultAP);
  }

  // Habits are a third of most days and used to cost nothing at all, which
  // made the meter quietly optimistic. They carry their own estimate, often 0.
  for (const habit of habits.done) done += apOf(habit, HABIT_DEFAULT_AP);
  for (const habit of habits.due) planned += apOf(habit, HABIT_DEFAULT_AP);

  return { done, planned, committed: done + planned };
}

/**
 * What an unestimated habit costs.
 *
 * Lower than the task default: habits skew small and repetitive, and guessing
 * 2 for every one of them would swamp a day's budget with things the user
 * never thought were expensive.
 */
export const HABIT_DEFAULT_AP = 1;

function sameLocalDay(stored: string, today: string): boolean {
  // doneDate is a timestamp from the web app and a date-only string from the
  // voice assistant; parseLocalDateTime reads both without shifting the day.
  const date = parseLocalDateTime(stored);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` === today;
}

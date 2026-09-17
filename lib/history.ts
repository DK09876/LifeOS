/**
 * What days actually cost, kept so the app can say something about you.
 *
 * The day meter is a snapshot that evaporates at midnight, which means it can
 * tell you that today is full but never that you are always full. A budget
 * you consistently blow is not a budget, it is a wish - and you cannot find
 * that out from a number that only ever describes now.
 *
 * Recorded once a day for the day before, which is the first moment a day is
 * finished and safe to total up.
 */

import { Event, Habit, Task } from './db';
import { getTodayString, parseLocalDate, parseLocalDateTime, toDateString } from './dates';
import { apOf, HABIT_DEFAULT_AP } from './capacity';

export const HISTORY_PREF = 'ap.history';

/** Roughly a quarter. Long enough to see a pattern, short enough to stay small. */
const KEEP_DAYS = 90;

export interface DayRecord {
  /** What the day was allowed to cost. */
  capacity: number;
  /** What it actually cost. */
  spent: number;
  /** How many things were finished, regardless of their weight. */
  finished: number;
}

export type History = Record<string, DayRecord>;

export function parseHistory(raw: string | undefined): History {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: History = {};
    for (const [date, value] of Object.entries(parsed as Record<string, unknown>)) {
      const v = value as Partial<DayRecord>;
      if (typeof v?.capacity === 'number' && typeof v?.spent === 'number') {
        out[date] = { capacity: v.capacity, spent: v.spent, finished: v.finished ?? 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function pruneHistory(history: History, today = getTodayString()): History {
  const cutoff = toDateString(new Date(parseLocalDate(today).getTime() - KEEP_DAYS * 86400000));
  const out: History = {};
  for (const [date, record] of Object.entries(history)) {
    if (date >= cutoff) out[date] = record;
  }
  return out;
}

/** The local day a stored timestamp or date-only string falls on. */
function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = parseLocalDateTime(value);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * What was finished on a given day, and what it cost.
 *
 * Only completions: what was *planned* for a past day is not recoverable
 * afterwards, and guessing would make the record less trustworthy than no
 * record at all.
 */
export function spentOn(
  date: string,
  tasks: Task[],
  events: Event[],
  habits: Habit[],
  defaultAP: number,
): { spent: number; finished: number } {
  let spent = 0;
  let finished = 0;

  for (const task of tasks) {
    if (task.deletedAt || task.status !== 'Done') continue;
    if (dayOf(task.doneDate) !== date) continue;
    spent += apOf(task, defaultAP);
    finished += 1;
  }
  for (const event of events) {
    if (event.deletedAt) continue;
    if (dayOf(event.lastCompleted) !== date) continue;
    spent += apOf(event, defaultAP);
    finished += 1;
  }
  for (const habit of habits) {
    if (habit.deletedAt) continue;
    if (!(habit.completionDates || []).includes(date)) continue;
    spent += apOf(habit, HABIT_DEFAULT_AP);
    finished += 1;
  }
  return { spent, finished };
}

/** The days from `days` ago up to yesterday, oldest first. */
export function recentDays(days: number, today = getTodayString()): string[] {
  const end = parseLocalDate(today);
  const out: string[] = [];
  for (let i = days; i >= 1; i--) {
    out.push(toDateString(new Date(end.getTime() - i * 86400000)));
  }
  return out;
}

export interface Calibration {
  /** Days with anything recorded. */
  days: number;
  averageCapacity: number;
  averageSpent: number;
  /** Days where more was spent than the budget allowed. */
  overDays: number;
}

/**
 * How well the budget matches reality.
 *
 * Days with nothing recorded are left out rather than averaged in as zero: a
 * holiday is not evidence that you overestimate yourself.
 */
export function calibrate(history: History, dates: string[]): Calibration {
  const records = dates.map((d) => history[d]).filter((r): r is DayRecord => !!r && r.spent > 0);
  if (!records.length) return { days: 0, averageCapacity: 0, averageSpent: 0, overDays: 0 };
  const mean = (pick: (r: DayRecord) => number) =>
    Math.round((records.reduce((sum, r) => sum + pick(r), 0) / records.length) * 10) / 10;
  return {
    days: records.length,
    averageCapacity: mean((r) => r.capacity),
    averageSpent: mean((r) => r.spent),
    overDays: records.filter((r) => r.spent > r.capacity).length,
  };
}

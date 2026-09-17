/**
 * Habit streaks and the recent-history strip.
 *
 * The unit has to follow the habit or the number is a lie. A daily habit
 * streaks in days. A "three times a week" habit streaks in *weeks that hit
 * the target* - counting its days would show the chain breaking every single
 * week, which is both wrong and the opposite of encouraging.
 */

import { getStartOfWeek } from './db';
import { getTodayString, parseLocalDate, toDateString } from './dates';

export interface StreakInfo {
  /** Length of the run ending now (or at the last completed period). */
  current: number;
  /** 'day' for plain recurrence, 'week' for a weekly target. */
  unit: 'day' | 'week';
  /**
   * Consecutive days, always. For a habit with a weekly target the headline
   * run is in weeks, but the day run is what you feel while you are doing it -
   * three days in a row on a five-a-week habit is a real thing that the weekly
   * number alone reports as nothing.
   */
  days: number;
}

const DAY = 86_400_000;

export function streakUnit(targetPerWeek: number | null | undefined): 'day' | 'week' {
  return targetPerWeek && targetPerWeek > 0 ? 'week' : 'day';
}

/**
 * The run ending today.
 *
 * Today not being done yet does not break a daily streak - the day is not
 * over. The run is measured from yesterday in that case, so a streak only
 * breaks once a day has been missed outright.
 */
export function currentStreak(
  completionDates: string[],
  targetPerWeek: number | null | undefined,
  today = getTodayString(),
): StreakInfo {
  const unit = streakUnit(targetPerWeek);
  const done = new Set(completionDates);

  // Consecutive days is computed either way; today not being done yet does not
  // break it, because the day is not over.
  let cursor = parseLocalDate(today);
  if (!done.has(today)) cursor = new Date(cursor.getTime() - DAY);
  let days = 0;
  while (done.has(toDateString(cursor))) {
    days += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }

  if (unit === 'day') {
    return { current: days, unit, days };
  }

  const target = targetPerWeek as number;
  let weekStart = parseLocalDate(getStartOfWeek(parseLocalDate(today)));
  // The current week only counts once it has met the target; an unfinished
  // week should not break the chain either.
  if (countInWeek(done, weekStart) < target) {
    weekStart = new Date(weekStart.getTime() - 7 * DAY);
  }
  let run = 0;
  while (countInWeek(done, weekStart) >= target) {
    run += 1;
    weekStart = new Date(weekStart.getTime() - 7 * DAY);
  }
  return { current: run, unit, days };
}

function countInWeek(done: Set<string>, weekStart: Date): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (done.has(toDateString(new Date(weekStart.getTime() + i * DAY)))) n += 1;
  }
  return n;
}

/**
 * The last `days` days, oldest first, for the dot strip.
 *
 * Returned as data rather than rendered here so the shape stays testable and
 * the component only decides how a dot looks.
 */
export interface HistoryDay {
  date: string;
  done: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export function recentHistory(
  completionDates: string[],
  days = 30,
  today = getTodayString(),
): HistoryDay[] {
  const done = new Set(completionDates);
  const end = parseLocalDate(today);
  const out: HistoryDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * DAY);
    const date = toDateString(d);
    const weekday = d.getDay();
    out.push({ date, done: done.has(date), isToday: date === today, isWeekend: weekday === 0 || weekday === 6 });
  }
  return out;
}

/**
 * The best run to record, given what we knew before.
 *
 * Completion dates are pruned to 90 days, so a best streak computed from them
 * alone would quietly shrink as history aged out. Carrying the previous high
 * water mark forward is what makes the number mean "best ever" rather than
 * "best still visible".
 */
export function bestStreakSoFar(previous: number | null | undefined, current: number): number {
  return Math.max(previous ?? 0, current);
}

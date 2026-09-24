/**
 * Habit milestones: the points worth marking on the way.
 *
 * A habit has no finish line, which is what makes it a habit - and also what
 * makes it hard to feel progress on. A streak number going up by one is easy
 * to stop seeing; "30 days" and "100 times" are moments you notice.
 *
 * Each milestone is celebrated once, the first time it is reached, and kept
 * with the day it happened so reviews can show when you got there.
 */

import type { Habit, MilestoneRecord } from '@/types';
import { streakUnit } from './streaks';

const STREAK_DAYS = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000];
const STREAK_WEEKS = [2, 4, 8, 12, 26, 52, 104];
const TOTALS = [10, 25, 50, 100, 150, 200, 300, 365, 500, 750, 1000];

export interface Milestone {
  key: string;
  label: string;
}

function streakMilestone(n: number, unit: 'day' | 'week'): Milestone {
  return { key: `streak-${unit}:${n}`, label: `${n}-${unit} streak` };
}

function totalMilestone(n: number): Milestone {
  return { key: `total:${n}`, label: `${n} times` };
}

/** Every milestone at or below the given streak and total. */
export function milestonesFor(streak: number, unit: 'day' | 'week', total: number): Milestone[] {
  const ladder = unit === 'week' ? STREAK_WEEKS : STREAK_DAYS;
  return [
    ...ladder.filter((n) => n <= streak).map((n) => streakMilestone(n, unit)),
    ...TOTALS.filter((n) => n <= total).map(totalMilestone),
  ];
}

/** Milestones reached now that had not been reached before. */
export function newMilestones(
  habit: Pick<Habit, 'milestones' | 'targetPerWeek'>,
  streak: number,
  total: number,
): Milestone[] {
  const seen = new Set((habit.milestones ?? []).map((m) => m.key));
  return milestonesFor(streak, streakUnit(habit.targetPerWeek), total).filter((m) => !seen.has(m.key));
}

export function recordMilestones(
  existing: MilestoneRecord[] | null | undefined,
  reached: Milestone[],
  date: string,
): MilestoneRecord[] {
  return [...(existing ?? []), ...reached.map((m) => ({ key: m.key, date }))];
}

/** The next one to aim for on each ladder. */
export function nextMilestones(
  habit: Pick<Habit, 'targetPerWeek'>,
  streak: number,
  total: number,
): { streak: { at: number; label: string; remaining: number } | null; total: { at: number; label: string; remaining: number } | null } {
  const unit = streakUnit(habit.targetPerWeek);
  const ladder = unit === 'week' ? STREAK_WEEKS : STREAK_DAYS;
  const nextStreak = ladder.find((n) => n > streak);
  const nextTotal = TOTALS.find((n) => n > total);
  return {
    streak: nextStreak ? { at: nextStreak, label: streakMilestone(nextStreak, unit).label, remaining: nextStreak - streak } : null,
    total: nextTotal ? { at: nextTotal, label: totalMilestone(nextTotal).label, remaining: nextTotal - total } : null,
  };
}

/** Human label for a stored milestone key. */
export function milestoneLabel(key: string): string {
  const [kind, value] = key.split(':');
  if (kind === 'total') return `${value} times`;
  const unit = kind === 'streak-week' ? 'week' : 'day';
  return `${value}-${unit} streak`;
}

/** Lifetime completions, falling back to what is still on record for old habits. */
export function totalCompletions(habit: Pick<Habit, 'totalCompletions' | 'completionDates'>): number {
  return habit.totalCompletions ?? (habit.completionDates ?? []).length;
}

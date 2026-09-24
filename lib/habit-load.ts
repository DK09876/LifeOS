/**
 * What your habits cost a day, before any task is planned.
 *
 * The suggester used to ignore habits entirely, so it offered the whole daily
 * budget to tasks on days that already had a gym session and a dog walk in
 * them. Today's meter counted them and the planner did not, which meant the
 * two pages disagreed about the same day.
 *
 * Habits are a floor under the week, not something to schedule around, so
 * this reserves their effort rather than placing them.
 */

import type { Habit } from '@/types';
import { apOf, HABIT_DEFAULT_AP } from './capacity';

/**
 * Which days of a range a habit should be expected on.
 *
 * A habit with a weekly target does not say *which* days, only how many, so
 * its occurrences are spread as evenly as the range allows. Reserving them
 * all at the front would make Monday look impossible and Friday empty; not
 * reserving them at all is how the planner came to overbook every day.
 */
export function expectedDays(habit: Habit, dayCount: number, start?: Date): number[] {
  if (!habit.isActive || dayCount <= 0) return [];

  // Chosen days say exactly which ones, so no spreading is needed.
  if (habit.weekdays?.length && start) {
    const wanted = new Set(habit.weekdays);
    const out: number[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      if (wanted.has(d.getDay())) out.push(i);
    }
    return out;
  }

  const target = habit.targetPerWeek ?? 0;
  if (target > 0) {
    // Scale the weekly target to the length of the range being planned.
    const occurrences = Math.min(dayCount, Math.max(1, Math.round((target / 7) * dayCount)));
    const step = dayCount / occurrences;
    return Array.from({ length: occurrences }, (_, i) => Math.min(dayCount - 1, Math.floor(i * step)));
  }

  // No target: it is due on whatever cadence it recurs on.
  switch (habit.recurrence) {
    case 'Daily':
      return Array.from({ length: dayCount }, (_, i) => i);
    case 'Weekly':
      return [0];
    case 'Biweekly':
      return dayCount >= 14 ? [0] : [];
    default:
      // Monthly and rarer: too infrequent to reserve against a week.
      return [];
  }
}

/**
 * Effort reserved for habits on each day of a range, by index.
 *
 * Zero-cost habits contribute nothing, which is the point of letting a habit
 * be worth 0 - brushing your teeth belongs on the list without eating a
 * planning budget.
 */
export function habitLoadByDay(habits: Habit[], dayCount: number, start?: Date): number[] {
  const load = new Array<number>(Math.max(0, dayCount)).fill(0);
  for (const habit of habits) {
    if (habit.deletedAt || !habit.isActive) continue;
    const ap = apOf(habit, HABIT_DEFAULT_AP);
    if (ap <= 0) continue;
    for (const index of expectedDays(habit, dayCount, start)) load[index] += ap;
  }
  return load;
}

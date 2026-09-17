/**
 * Tests for task scoring - the function every list sorts by.
 *
 * A regression here does not throw. It quietly reorders your priorities, and
 * you notice weeks later when the tool stops feeling trustworthy.
 *
 * Every date-dependent test pins the clock. calculateTaskScores parses
 * `dueDate + 'T00:00:00'`, which is LOCAL time, so a helper built on
 * toISOString() (UTC) silently tests the wrong tier for part of each day.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateTaskScores } from './db';

/** Midday, so no timezone offset can push the date across a boundary. */
const NOW = new Date(2026, 5, 15, 12, 0, 0); // 15 June 2026, local

/** A YYYY-MM-DD string N days from NOW, built in local time like the app. */
function dueIn(days: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('calculateTaskScores', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  describe('importance', () => {
    it('adds task priority to domain priority', () => {
      expect(calculateTaskScores({ taskPriority: '1 - Urgent' }, '1 - Critical').importanceScore).toBe(80);
      expect(calculateTaskScores({ taskPriority: '5 - Optional' }, '3 - Maintenance').importanceScore).toBe(20);
    });

    it('defaults to Normal task and Maintenance domain', () => {
      expect(calculateTaskScores({}).importanceScore).toBe(40);
    });

    it('degrades predictably on an unrecognised value rather than producing NaN', () => {
      // The lookups fail soft by design. Pinning that so a typo stays
      // harmless instead of poisoning the sort with NaN.
      const scores = calculateTaskScores({ taskPriority: 'nonsense' as never }, 'nonsense');
      expect(scores.importanceScore).toBe(40);
      expect(Number.isFinite(scores.combinedScore)).toBe(true);
    });
  });

  describe('urgency and the due-date bonus', () => {
    it('applies no pressure to a fresh undated task', () => {
      const now = new Date().toISOString();
      expect(calculateTaskScores({ urgency: '3 - Normal', updatedAt: now }).urgencyScore).toBe(30);
    });

    it('scores each documented tier as specified', () => {
      // Urgency field is Normal (30) throughout, so the delta is the bonus.
      const bonus = (days: number) =>
        calculateTaskScores({ urgency: '3 - Normal', dueDate: dueIn(days) }).urgencyScore - 30;

      expect(bonus(-1)).toBe(50);  // overdue
      expect(bonus(0)).toBe(45);   // today
      expect(bonus(1)).toBe(40);   // tomorrow
      expect(bonus(2)).toBe(35);
      expect(bonus(4)).toBe(30);
      expect(bonus(7)).toBe(25);
      expect(bonus(14)).toBe(20);
      expect(bonus(30)).toBe(15);
      expect(bonus(60)).toBe(10);
      expect(bonus(120)).toBe(5);  // beyond every tier
    });

    it('never increases as the due date recedes, and does fall overall', () => {
      const horizons = [-1, 0, 1, 2, 4, 7, 14, 30, 60, 120];
      const scores = horizons.map((d) => calculateTaskScores({ dueDate: dueIn(d) }).urgencyScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
      // Monotonicity alone would pass if every value were identical.
      expect(scores.at(-1)).toBeLessThan(scores[0]);
    });
  });

  describe('combined score', () => {
    it('is multiplicative, so one high dimension is not enough', () => {
      const both = calculateTaskScores(
        { taskPriority: '1 - Urgent', urgency: '1 - Critical', dueDate: dueIn(-1) }, '1 - Critical');
      const importantOnly = calculateTaskScores(
        { taskPriority: '1 - Urgent', urgency: '5 - Someday' }, '1 - Critical');
      const urgentOnly = calculateTaskScores(
        { taskPriority: '5 - Optional', urgency: '1 - Critical', dueDate: dueIn(-1) }, '3 - Maintenance');

      expect(both.combinedScore).toBeGreaterThan(importantOnly.combinedScore);
      expect(both.combinedScore).toBeGreaterThan(urgentOnly.combinedScore);
    });

    it('returns an integer, since the value is stored and indexed', () => {
      const scores = calculateTaskScores(
        { taskPriority: '2 - High', urgency: '2 - High', dueDate: dueIn(3) }, '2 - Important');
      expect(Number.isInteger(scores.combinedScore)).toBe(true);
    });
  });

  // The regression guard. Scores used to be computed once and stored, so a
  // task written a month early kept its month-away score even when overdue.
  // If this passes but lists still rank wrongly, the fault is in the daily
  // rescore in hooks.ts, not in this function.
  describe('time sensitivity', () => {
    it('scores the same untouched task higher as its due date approaches', () => {
      const task = { taskPriority: '3 - Normal' as const, urgency: '3 - Normal' as const, dueDate: '2026-06-15' };

      vi.setSystemTime(new Date(2026, 4, 1, 12, 0, 0));   // six weeks out
      const farOut = calculateTaskScores(task).combinedScore;

      vi.setSystemTime(new Date(2026, 5, 14, 12, 0, 0));  // tomorrow
      const tomorrow = calculateTaskScores(task).combinedScore;

      vi.setSystemTime(new Date(2026, 5, 20, 12, 0, 0));  // overdue
      const overdue = calculateTaskScores(task).combinedScore;

      expect(tomorrow).toBeGreaterThan(farOut);
      expect(overdue).toBeGreaterThan(tomorrow);
    });
  });
});

describe('rot: overdue escalates and neglect accrues', () => {
  // Same pinned clock as above: dueIn() is built relative to NOW, so without
  // this the ladder is measured against the real date and every case lands
  // in the "over a month gone" bucket.
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const pressure = (extra: Record<string, unknown>) =>
    calculateTaskScores({ urgency: '3 - Normal', ...extra }).urgencyScore - 30;

  // A flat overdue value made a task one day late and one three months late
  // rank identically, so nothing ever visibly rotted.
  it('climbs for each of the first five days late', () => {
    expect(pressure({ dueDate: dueIn(-1) })).toBe(50);
    expect(pressure({ dueDate: dueIn(-2) })).toBe(53);
    expect(pressure({ dueDate: dueIn(-3) })).toBe(56);
    expect(pressure({ dueDate: dueIn(-4) })).toBe(59);
    expect(pressure({ dueDate: dueIn(-5) })).toBe(62);
  });

  it('then steps by week and by month', () => {
    expect(pressure({ dueDate: dueIn(-6) })).toBe(65);
    expect(pressure({ dueDate: dueIn(-7) })).toBe(65);
    expect(pressure({ dueDate: dueIn(-20) })).toBe(68);
    expect(pressure({ dueDate: dueIn(-31) })).toBe(70);
  });

  it('never lets a later task rank below an earlier one', () => {
    const lateness = [-1, -2, -3, -4, -5, -8, -40].map((d) => pressure({ dueDate: dueIn(d) }));
    const sorted = [...lateness].sort((a, b) => a - b);
    expect(lateness).toEqual(sorted);
  });

  it('accrues pressure on an undated task that is left alone', () => {
    expect(pressure({ updatedAt: daysAgo(1) })).toBe(0);
    expect(pressure({ updatedAt: daysAgo(14) })).toBe(5);
    expect(pressure({ updatedAt: daysAgo(30) })).toBe(10);
    expect(pressure({ updatedAt: daysAgo(60) })).toBe(15);
    expect(pressure({ updatedAt: daysAgo(120) })).toBe(20);
  });

  // The case that motivated the change: a long-neglected urgent task should
  // not sit below a middling one that merely has a date on it.
  it('lets a rotted urgent task outrank a medium task due next week', () => {
    const rotted = calculateTaskScores(
      { taskPriority: '3 - Normal', urgency: '1 - Critical', updatedAt: daysAgo(120) }, '1 - Critical');
    const dated = calculateTaskScores(
      { taskPriority: '3 - Normal', urgency: '3 - Normal', dueDate: dueIn(7) }, '2 - Important');
    expect(rotted.combinedScore).toBeGreaterThan(dated.combinedScore);
  });

  // But a deadline still beats a vague intention, which is the point of
  // keeping the dated ladder above the neglect one.
  it('keeps a task due today above a freshly written undated one', () => {
    expect(pressure({ dueDate: dueIn(0) })).toBeGreaterThan(pressure({ updatedAt: daysAgo(120) }));
  });
});

/**
 * Tests for task scoring - the function the whole app sorts by.
 *
 * A silent regression here does not throw: it quietly reorders every list,
 * and you only notice weeks later when the priorities stop feeling right.
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';

import { calculateTaskScores } from './db';

/** Days from today as the YYYY-MM-DD string the app stores. */
function dueIn(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('calculateTaskScores', () => {
  describe('importance', () => {
    it('combines task priority with domain priority', () => {
      // Urgent (50) + Critical domain (30)
      expect(calculateTaskScores({ taskPriority: '1 - Urgent' }, '1 - Critical').importanceScore).toBe(80);
      // Optional (10) + Maintenance domain (10)
      expect(calculateTaskScores({ taskPriority: '5 - Optional' }, '3 - Maintenance').importanceScore).toBe(20);
    });

    it('falls back to Normal/Maintenance when either is missing', () => {
      expect(calculateTaskScores({}).importanceScore).toBe(40); // 30 + 10
    });

    it('does not throw on an unrecognised priority string', () => {
      // The lookups fail soft by design; this pins that behaviour so a typo
      // degrades predictably rather than producing NaN.
      const scores = calculateTaskScores({ taskPriority: 'nonsense' as never }, 'also nonsense');
      expect(Number.isFinite(scores.importanceScore)).toBe(true);
      expect(scores.importanceScore).toBe(40);
    });
  });

  describe('urgency and the due-date bonus', () => {
    it('scores an overdue task above one due today', () => {
      const overdue = calculateTaskScores({ urgency: '3 - Normal', dueDate: dueIn(-1) }).urgencyScore;
      const today = calculateTaskScores({ urgency: '3 - Normal', dueDate: dueIn(0) }).urgencyScore;
      expect(overdue).toBeGreaterThan(today);
    });

    it('decreases monotonically as the due date gets further away', () => {
      const horizons = [0, 1, 2, 4, 7, 14, 30, 60, 120];
      const scores = horizons.map((d) => calculateTaskScores({ dueDate: dueIn(d) }).urgencyScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    it('gives no bonus at all when there is no due date', () => {
      expect(calculateTaskScores({ urgency: '3 - Normal' }).urgencyScore).toBe(30);
    });
  });

  describe('combined score', () => {
    it('is multiplicative, so both dimensions must be high to rank high', () => {
      const both = calculateTaskScores({ taskPriority: '1 - Urgent', urgency: '1 - Critical', dueDate: dueIn(-1) }, '1 - Critical');
      const importantOnly = calculateTaskScores({ taskPriority: '1 - Urgent', urgency: '5 - Someday' }, '1 - Critical');
      const urgentOnly = calculateTaskScores({ taskPriority: '5 - Optional', urgency: '1 - Critical', dueDate: dueIn(-1) }, '3 - Maintenance');

      expect(both.combinedScore).toBeGreaterThan(importantOnly.combinedScore);
      expect(both.combinedScore).toBeGreaterThan(urgentOnly.combinedScore);
    });

    it('returns whole numbers, since the value is stored and sorted on', () => {
      const scores = calculateTaskScores({ taskPriority: '2 - High', urgency: '2 - High', dueDate: dueIn(3) }, '2 - Important');
      expect(Number.isInteger(scores.combinedScore)).toBe(true);
    });
  });

  // This is the regression guard for the bug where scores were computed once
  // and never recomputed: the same task, untouched, must score higher as its
  // due date approaches. If this passes but lists still rank wrongly, the
  // fault is in the daily rescore, not here.
  describe('time sensitivity', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('scores the same unchanged task higher as its due date nears', () => {
      const task = { taskPriority: '3 - Normal' as const, urgency: '3 - Normal' as const, dueDate: '2026-06-15' };

      vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
      const farOut = calculateTaskScores(task).combinedScore;

      vi.setSystemTime(new Date('2026-06-14T12:00:00Z'));
      const tomorrow = calculateTaskScores(task).combinedScore;

      vi.setSystemTime(new Date('2026-06-20T12:00:00Z'));
      const overdue = calculateTaskScores(task).combinedScore;

      expect(tomorrow).toBeGreaterThan(farOut);
      expect(overdue).toBeGreaterThan(tomorrow);
    });
  });
});

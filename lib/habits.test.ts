/**
 * What a habit asks of you today.
 *
 * The rule: show it until it is done, and stop once the week's quota is met.
 * The previous version returned purely on the weekly count whenever a target
 * was set, so a habit completed today stayed in the due list and appeared
 * under "completed today" at the same moment.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCompletionsThisWeek, isHabitDueToday } from './db';
import { getTodayString, toDateString } from './dates';

// A Thursday, so the Monday-start week has several days either side.
const NOW = new Date('2026-09-17T09:00:00');

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

const daysAgo = (n: number) => toDateString(new Date(NOW.getTime() - n * 86400000));

const habit = (extra: Record<string, unknown> = {}) => ({
  id: 'h', habitName: 'Morning walk', recurrence: 'Daily', lastCompleted: null,
  targetPerWeek: null, completionDates: [], notes: '', icon: null, isActive: true,
  deletedAt: null, createdAt: '', updatedAt: '', ...extra,
}) as never;

describe('isHabitDueToday', () => {
  it('is due when it has never been done', () => {
    expect(isHabitDueToday(habit())).toBe(true);
  });

  it('is not due once it is done today', () => {
    expect(isHabitDueToday(habit({ completionDates: [getTodayString()] }))).toBe(false);
  });

  it('is never due while paused', () => {
    expect(isHabitDueToday(habit({ isActive: false }))).toBe(false);
  });

  // The bug: a quota made the "already done today" check unreachable.
  it('stops asking today even when the weekly quota is unmet', () => {
    const h = habit({ targetPerWeek: 5, completionDates: [getTodayString()] });
    expect(getCompletionsThisWeek(h)).toBe(1);
    expect(isHabitDueToday(h)).toBe(false);
  });

  it('asks again the next day while the quota is unmet', () => {
    expect(isHabitDueToday(habit({ targetPerWeek: 5, completionDates: [daysAgo(1)] }))).toBe(true);
  });

  it('stops for the rest of the week once the quota is met', () => {
    const done = [daysAgo(3), daysAgo(2), daysAgo(1)];
    expect(isHabitDueToday(habit({ targetPerWeek: 3, completionDates: done }))).toBe(false);
    expect(isHabitDueToday(habit({ targetPerWeek: 4, completionDates: done }))).toBe(true);
  });

  it('counts only completions inside this week', () => {
    // 10 days ago is two Mondays back, so it must not count toward the quota.
    const h = habit({ targetPerWeek: 2, completionDates: [daysAgo(10), daysAgo(1)] });
    expect(getCompletionsThisWeek(h)).toBe(1);
    expect(isHabitDueToday(h)).toBe(true);
  });

  describe('without a quota, the recurrence interval decides', () => {
    it('daily comes back the next day', () => {
      expect(isHabitDueToday(habit({ recurrence: 'Daily', lastCompleted: new Date(NOW.getTime() - 86400000).toISOString(), completionDates: [daysAgo(1)] }))).toBe(true);
    });

    it('weekly does not come back the next day', () => {
      expect(isHabitDueToday(habit({ recurrence: 'Weekly', lastCompleted: new Date(NOW.getTime() - 86400000).toISOString(), completionDates: [daysAgo(1)] }))).toBe(false);
    });

    it('weekly comes back after seven days', () => {
      expect(isHabitDueToday(habit({ recurrence: 'Weekly', lastCompleted: new Date(NOW.getTime() - 8 * 86400000).toISOString(), completionDates: [daysAgo(8)] }))).toBe(true);
    });
  });
});

/**
 * Streaks are the part of a habit tracker people actually look at, so the
 * number has to be defensible. The two traps: counting a "3x a week" habit in
 * days (the chain breaks every week), and breaking a daily streak at midnight
 * because today is not done yet (the day is not over).
 */

import { describe, expect, it } from 'vitest';

import { bestStreakSoFar, currentStreak, recentHistory, streakUnit } from './streaks';

// A Thursday.
const TODAY = '2026-09-17';
const daysBefore = (n: number) =>
  new Date(new Date(TODAY + 'T00:00:00').getTime() - n * 86400000).toISOString().slice(0, 10);
const run = (n: number, from = 0) => Array.from({ length: n }, (_, i) => daysBefore(from + i));

describe('streakUnit', () => {
  it('counts weeks when there is a weekly target, days otherwise', () => {
    expect(streakUnit(3)).toBe('week');
    expect(streakUnit(null)).toBe('day');
    expect(streakUnit(0)).toBe('day');
  });
});

describe('currentStreak, daily', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(run(4), null, TODAY)).toMatchObject({ current: 4, days: 4 });
  });

  // Today is not over. A streak should break on a missed day, not at midnight.
  it('does not break just because today is not done yet', () => {
    expect(currentStreak(run(3, 1), null, TODAY).current).toBe(3);
  });

  it('breaks on a genuinely missed day', () => {
    expect(currentStreak(run(3, 2), null, TODAY).current).toBe(0);
  });

  it('is zero when nothing has been done', () => {
    expect(currentStreak([], null, TODAY).current).toBe(0);
  });

  it('ignores a gap further back', () => {
    expect(currentStreak([...run(2), daysBefore(9)], null, TODAY).current).toBe(2);
  });
});

describe('currentStreak, weekly target', () => {
  // Mon 14 Sep starts this week; the previous two weeks start 7 and 14 Sep-7.
  const week = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) =>
      new Date(new Date('2026-09-14T00:00:00').getTime() + (i - offset * 7) * 86400000)
        .toISOString().slice(0, 10));

  it('counts weeks that met the target', () => {
    const dates = [...week(0, 3), ...week(1, 3), ...week(2, 3)];
    expect(currentStreak(dates, 3, TODAY)).toMatchObject({ current: 3, unit: 'week' });
  });

  // Weeks are the headline, but three days running on a five-a-week habit is
  // a real thing the weekly number alone reports as nothing.
  it('also reports the consecutive-day run', () => {
    const consecutive = [daysBefore(1), daysBefore(2), daysBefore(3)];
    expect(currentStreak(consecutive, 5, TODAY).days).toBe(3);
  });

  it('reports a day run even when no week has met its target', () => {
    const s = currentStreak([daysBefore(1), daysBefore(2)], 5, TODAY);
    expect(s.current).toBe(0);
    expect(s.days).toBe(2);
  });

  // The whole point of the week unit: a partial current week is in progress,
  // not a break.
  it('does not break on a current week still in progress', () => {
    const dates = [...week(0, 1), ...week(1, 3), ...week(2, 3)];
    expect(currentStreak(dates, 3, TODAY).current).toBe(2);
  });

  it('breaks on a past week that missed the target', () => {
    const dates = [...week(0, 3), ...week(1, 1), ...week(2, 3)];
    expect(currentStreak(dates, 3, TODAY).current).toBe(1);
  });
});

describe('recentHistory', () => {
  it('returns the window oldest first, ending today', () => {
    const h = recentHistory(run(2), 30, TODAY);
    expect(h).toHaveLength(30);
    expect(h[29].date).toBe(TODAY);
    expect(h[29].isToday).toBe(true);
    expect(h[29].done).toBe(true);
    expect(h[0].date).toBe(daysBefore(29));
  });

  it('marks weekends so the pattern is readable', () => {
    const h = recentHistory([], 7, TODAY);
    expect(h.filter(d => d.isWeekend)).toHaveLength(2);
  });
});

describe('bestStreakSoFar', () => {
  // Completions prune at 90 days, so a best streak recomputed from them alone
  // would silently shrink. The stored high water mark is what stops that.
  it('never goes down as history ages out', () => {
    expect(bestStreakSoFar(12, 3)).toBe(12);
    expect(bestStreakSoFar(null, 3)).toBe(3);
    expect(bestStreakSoFar(2, 9)).toBe(9);
  });
});

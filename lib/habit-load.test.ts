/**
 * The floor habits put under a week.
 *
 * The planner used to ignore them, so it offered a whole day's budget on a
 * day that already had a gym session and a dog walk in it. Today's meter
 * counted habits and the planner did not, which meant the two pages
 * disagreed about the same day.
 */

import { describe, expect, it } from 'vitest';

import { expectedDays, habitLoadByDay } from './habit-load';
import type { Habit } from './db';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h', habitName: 'H', recurrence: 'Daily', lastCompleted: null, targetPerWeek: null,
  actionPoints: '2', completionDates: [], bestStreak: 0, notes: '', icon: null,
  isActive: true, deletedAt: null, createdAt: '', updatedAt: '',
  ...over,
}) as Habit;

describe('expectedDays', () => {
  it('puts a plain daily habit on every day', () => {
    expect(expectedDays(habit(), 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  // A weekly target says how many times, not which days, so spreading them
  // is the honest reading: front-loading makes Monday look impossible.
  it('spreads a weekly target across the range', () => {
    expect(expectedDays(habit({ targetPerWeek: 3 }), 7)).toEqual([0, 2, 4]);
  });

  it('scales the target to a shorter range', () => {
    // 3 a week over 3 days is roughly one.
    expect(expectedDays(habit({ targetPerWeek: 3 }), 3)).toHaveLength(1);
  });

  it('never asks for more days than the range has', () => {
    expect(expectedDays(habit({ targetPerWeek: 7 }), 3)).toHaveLength(3);
  });

  it('places a weekly habit once', () => {
    expect(expectedDays(habit({ recurrence: 'Weekly' }), 7)).toEqual([0]);
  });

  it('ignores cadences too rare to reserve against a week', () => {
    expect(expectedDays(habit({ recurrence: 'Monthly' }), 7)).toEqual([]);
    expect(expectedDays(habit({ recurrence: 'Biweekly' }), 7)).toEqual([]);
  });

  it('reserves nothing for a paused habit', () => {
    expect(expectedDays(habit({ isActive: false }), 7)).toEqual([]);
  });
});

describe('habitLoadByDay', () => {
  it('adds up what each day owes', () => {
    const load = habitLoadByDay([
      habit({ id: 'a', actionPoints: '3' }),
      habit({ id: 'b', actionPoints: '2', targetPerWeek: 7 }),
    ], 7);
    expect(load).toEqual([5, 5, 5, 5, 5, 5, 5]);
  });

  // The whole point of offering a zero rung: brushing your teeth belongs on
  // the list without eating a planning budget.
  it('lets a zero-cost habit cost nothing', () => {
    expect(habitLoadByDay([habit({ actionPoints: '0' })], 3)).toEqual([0, 0, 0]);
  });

  it('skips paused and deleted habits', () => {
    expect(habitLoadByDay([
      habit({ isActive: false }),
      habit({ id: 'd', deletedAt: '2026-01-01' }),
    ], 3)).toEqual([0, 0, 0]);
  });

  it('charges an unestimated habit the habit default, not the task one', () => {
    expect(habitLoadByDay([habit({ actionPoints: null })], 2)).toEqual([1, 1]);
  });

  it('returns an empty floor for an empty range', () => {
    expect(habitLoadByDay([habit()], 0)).toEqual([]);
  });
});

/**
 * The sentence under the frequency picker. It used to restate the label
 * instead of answering the question the label raises - given what I just
 * picked, when will this turn up? - and a weekly quota in particular is not
 * obvious until you have watched one for a week.
 */

import { describe, expect, it } from 'vitest';

import { frequencyHint } from './frequency';

describe('frequencyHint', () => {
  it('describes each fixed schedule distinctly', () => {
    const hints = (['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Bimonthly', 'Quarterly', 'Half-Yearly', 'Yearly'] as const)
      .map((r) => frequencyHint(r, null));
    expect(new Set(hints).size).toBe(hints.length);
    expect(hints.every((h) => h.length > 0)).toBe(true);
  });

  // The old copy said "every week" for Weekly, which reads as a set weekday.
  it('is honest that a weekly habit is not tied to a weekday', () => {
    expect(frequencyHint('Weekly', null)).toMatch(/not on a set weekday/);
  });

  it('explains what a quota does, including when it rests', () => {
    const hint = frequencyHint('Daily', 3);
    expect(hint).toMatch(/3 times this week/);
    expect(hint).toMatch(/rests until Monday/);
  });

  it('reads naturally for a quota of one', () => {
    expect(frequencyHint('Daily', 1)).toMatch(/done it once this week/);
  });

  // Seven a week is every day, so the quota machinery buys nothing.
  it('points out when a quota has become a daily schedule', () => {
    expect(frequencyHint('Daily', 7)).toMatch(/fixed daily schedule may suit better/);
  });

  it('lets the quota win over the recurrence, as the form does', () => {
    expect(frequencyHint('Monthly', 2)).toMatch(/2 times this week/);
  });
});

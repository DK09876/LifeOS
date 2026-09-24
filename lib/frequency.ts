/**
 * What a habit's frequency actually means, in words.
 *
 * The form offered two modes and then described both with the same sentence -
 * "a fixed schedule (e.g., every day, every week)" - which restates the label
 * rather than answering the question the label raises: given what I just
 * picked, when will this turn up? The two modes behave quite differently, and
 * a quota in particular is not obvious until you have watched one for a week.
 */

import type { Habit } from '@/types';

export function frequencyHint(
  recurrence: Habit['recurrence'],
  targetPerWeek: number | null,
): string {
  if (targetPerWeek && targetPerWeek > 0) {
    const times = targetPerWeek === 1 ? 'once' : `${targetPerWeek} times`;
    return targetPerWeek >= 7
      ? 'Shows every day. Doing it seven times a week is every day, so a fixed daily schedule may suit better.'
      : `Shows every day until you have done it ${times} this week, then rests until Monday. Any days you like.`;
  }

  switch (recurrence) {
    case 'Daily':
      return 'Shows every day, and again the next day once you have done it.';
    case 'Weekly':
      return 'Shows a week after you last did it — not on a set weekday.';
    case 'Biweekly':
      return 'Shows a fortnight after you last did it.';
    case 'Monthly':
      return 'Shows once a month, in the month after you last did it.';
    case 'Bimonthly':
      return 'Shows once every two months.';
    case 'Quarterly':
      return 'Shows once a quarter.';
    case 'Half-Yearly':
      return 'Shows twice a year.';
    case 'Yearly':
      return 'Shows once a year.';
    default:
      return '';
  }
}

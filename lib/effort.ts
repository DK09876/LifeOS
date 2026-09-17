/**
 * What an action point means.
 *
 * The scale was "Low" to "High" with nothing in between, which is not a scale
 * so much as a shrug: one person's 1 is brushing their teeth and another's is
 * an hour at the gym, and a budget built on that cannot mean anything.
 *
 * These anchors fix it to a day's capacity rather than to clock time. Time
 * alone would be wrong - a twenty-minute conversation you have been dreading
 * costs more of a day than an hour of easy admin - but time is the handle
 * most people can actually estimate with, so each rung names both.
 */

export interface EffortLevel {
  value: number;
  name: string;
  hint: string;
}

export const EFFORT_LEVELS: EffortLevel[] = [
  { value: 0, name: 'Free',   hint: 'Seconds, no thought. Worth keeping, not worth budgeting.' },
  { value: 1, name: 'Tiny',   hint: 'A few minutes. A reply, the bins, a quick look.' },
  { value: 2, name: 'Small',  hint: 'Half an hour of ordinary attention. Errands, admin, a call.' },
  { value: 3, name: 'Real',   hint: 'About an hour, or anything you must be present for. The gym.' },
  { value: 4, name: 'Heavy',  hint: 'A couple of hours of focus. Drafting, deep cleaning, a review.' },
  { value: 5, name: 'Big',    hint: 'Eats an afternoon, or you are dreading it. Both, usually.' },
];

/** A normal weekday's discretionary capacity, before anything is planned. */
export const DEFAULT_DAILY_AP = 8;

export function effortLevel(value: string | null | undefined): EffortLevel | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return EFFORT_LEVELS.find((level) => level.value === Number(value));
}

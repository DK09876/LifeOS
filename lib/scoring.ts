/**
 * Task scoring - the order every list sorts by.
 *
 * Pure, so the notifier on the Pi ranks things the way the app does.
 */

import { differenceInCalendarDays } from 'date-fns';

import type { Task } from '@/types';
import { getTodayString, parseLocalDate } from './dates';
import { cycleDueDate, intervalDays, localDay, recurrenceKind } from './recurrence';

/**
 * How time pressure is ranked, loudest first:
 *
 *   a real deadline, overdue        50-70   a date someone is holding you to
 *   a missed recurring cycle        36-49   "every two weeks" that didn't happen
 *   a plan you missed               32-44   you said you'd do it, and didn't
 *   a real deadline, upcoming        5-45
 *   neglect (rot)                    5-20   nobody has said when this happens
 *
 * Only the loudest one counts - they are different readings of the same
 * question, and adding them would count one task as pressing several times
 * over. Slips are the exception: moving a missed plan again is its own
 * signal, so it is added on top.
 */
export const PRESSURE = {
  cycleOverdueCap: 49,
  missedPlanCap: 44,
  slipEach: 4,
  slipCap: 16,
} as const;

function dueLadder(days: number): number {
  if (days < 0) {
    // Overdue escalates instead of saturating. A flat value meant a task a
    // day late and one three months late were indistinguishable, so nothing
    // ever visibly rotted.
    const late = -days;
    if (late === 1) return 50;
    if (late === 2) return 53;
    if (late === 3) return 56;
    if (late === 4) return 59;
    if (late === 5) return 62;
    if (late <= 7) return 65;    // the rest of the first week
    if (late <= 30) return 68;   // within the month
    return 70;                   // over a month gone
  }
  if (days === 0) return 45;
  if (days === 1) return 40;
  if (days === 2) return 35;
  if (days <= 4) return 30;
  if (days <= 7) return 25;
  if (days <= 14) return 20;
  if (days <= 30) return 15;
  if (days <= 60) return 10;
  return 5;
}

/**
 * "Every two weeks" already says when it is due, and a missed cycle should
 * pile up: three missed waterings is worse than one. But it is your own
 * cadence, not a date someone else holds you to, so it stays below any real
 * overdue deadline however far behind it gets.
 */
function cycleLadder(days: number, cyclesMissed: number): number {
  if (days < 0) {
    const late = -days;
    return Math.min(PRESSURE.cycleOverdueCap, 34 + 2 * Math.min(late, 7) + 5 * (cyclesMissed - 1));
  }
  if (days === 0) return 32;
  if (days === 1) return 28;
  if (days === 2) return 24;
  if (days <= 4) return 20;
  if (days <= 7) return 16;
  if (days <= 14) return 12;
  if (days <= 30) return 8;
  return 4;
}

/** How many whole cycles have gone by since a cycle fell due. */
export function cyclesMissed(task: Partial<Task>, today = getTodayString()): number {
  // A daily or named-day task does not owe its missed days; they lapse.
  if (isLapsing(task)) return 0;
  const due = cycleDueDate(task);
  if (!due || due >= today) return 0;
  const late = differenceInCalendarDays(parseLocalDate(today), parseLocalDate(due));
  const interval = intervalDays(task.recurrence ?? 'None', task.recurrenceWeekdays) || 1;
  return 1 + Math.floor(late / interval);
}

function isLapsing(task: Partial<Task>): boolean {
  if (!task.recurrence || task.recurrence === 'None') return false;
  return recurrenceKind({
    recurrence: task.recurrence,
    recurrenceAnchor: task.recurrenceAnchor ?? null,
    recurrenceWeekdays: task.recurrenceWeekdays ?? null,
    dueDate: task.dueDate ?? null,
  }) === 'lapsing';
}

export function calculateTaskScores(
  task: Partial<Task>, domainPriority?: string, today = getTodayString(),
): { importanceScore: number; urgencyScore: number; combinedScore: number } {
  // Importance = task priority (10-50) + domain priority (5-15) → range 15-65.
  //
  // The domain used to swing 20 points across a priority range of only 40, so
  // it was half the signal. Domain is now a tiebreaker; what the task is worth
  // is mostly what you said it is worth.
  const priorityScores: Record<string, number> = {
    '1 - Urgent': 50, '2 - High': 40, '3 - Normal': 30, '4 - Low': 20, '5 - Optional': 10,
  };
  const domainScores: Record<string, number> = {
    '1 - Critical': 15, '2 - Important': 10, '3 - Maintenance': 5,
  };
  const importanceScore = (priorityScores[task.taskPriority || '3 - Normal'] || 30)
    + (domainScores[domainPriority || '3 - Maintenance'] || 5);

  const urgencyFieldScores: Record<string, number> = {
    '1 - Critical': 50, '2 - High': 40, '3 - Normal': 30, '4 - Low': 20, '5 - Someday': 10,
  };

  // Blocked work is not being neglected, it is waiting on someone else, and
  // it is not yours to be late on either. It keeps only its deadline.
  const waiting = task.status === 'Blocked';
  const daysTo = (date: string) => differenceInCalendarDays(parseLocalDate(date), parseLocalDate(today));

  let deadline = task.dueDate ? dueLadder(daysTo(task.dueDate)) : 0;

  // Blocked work that has reached its follow-up day: chasing it is now due,
  // and a chase left undone goes overdue like anything else.
  if (waiting && task.followUpDate && task.followUpDate <= today) {
    deadline = Math.max(deadline, dueLadder(daysTo(task.followUpDate)));
  }

  // Daily and named-day tasks: each day's occurrence is optional practice,
  // not a debt. No cycle pressure, no rot, and a plan for a day that has gone
  // simply lapses.
  const lapsing = isLapsing(task);

  let cycle = 0;
  if (!task.dueDate && !waiting && !lapsing) {
    const due = cycleDueDate(task);
    if (due) cycle = cycleLadder(daysTo(due), cyclesMissed(task, today));
  }

  // A plan whose day has gone. You already decided this mattered enough to
  // put on a day, so it outranks work nobody has placed yet.
  let missedPlan = 0;
  if (!waiting && !lapsing && task.plannedDate && task.plannedDate < today) {
    const missed = -daysTo(task.plannedDate);
    missedPlan = Math.min(PRESSURE.missedPlanCap, 30 + 2 * Math.min(missed, 7));
  }

  // Neglect: the pressure of nobody having said when this happens. Measured
  // from when the clock started (creation, unblocking or the last cycle), not
  // the last edit - an edit is not progress, and sliding a plan must not
  // reset it. A plan for today or later settles the question for now.
  const stillPlanned = !!task.plannedDate && task.plannedDate >= today;
  let neglect = 0;
  const since = localDay(task.rotSince ?? task.createdAt);
  if (!stillPlanned && !waiting && !lapsing && since) {
    const age = -daysTo(since);
    if (age >= 90) neglect = 20;
    else if (age >= 60) neglect = 15;
    else if (age >= 30) neglect = 10;
    else if (age >= 14) neglect = 5;
  }

  const slips = waiting || lapsing ? 0 : Math.min(PRESSURE.slipCap, (task.slipCount ?? 0) * PRESSURE.slipEach);

  const timePressure = Math.max(deadline, cycle, missedPlan, neglect) + slips;
  const urgencyScore = (urgencyFieldScores[task.urgency || '3 - Normal'] || 30) + timePressure;

  const combinedScore = Math.round((importanceScore * urgencyScore) / 100);
  return { importanceScore, urgencyScore, combinedScore };
}

/** The date a task counts as due by: its real deadline, else its cycle. */
export function effectiveDueDate(task: Partial<Task>): string | null {
  return task.dueDate ?? cycleDueDate(task);
}

/** Past its real deadline. */
export function isOverdue(task: Pick<Task, 'dueDate' | 'status'>, today = getTodayString()): boolean {
  if (task.status === 'Done' || task.status === 'Archived') return false;
  return !!task.dueDate && task.dueDate < today;
}

/** Blocked, but with a deadline close enough that waiting is becoming a problem. */
export const PRESSING_BLOCKED_DAYS = 7;
export function isPressingBlocked(task: Pick<Task, 'dueDate' | 'status' | 'deletedAt'>, today = getTodayString()): boolean {
  if (task.status !== 'Blocked' || task.deletedAt || !task.dueDate) return false;
  return differenceInCalendarDays(parseLocalDate(task.dueDate), parseLocalDate(today)) <= PRESSING_BLOCKED_DAYS;
}

/**
 * A plan whose day went by without it - the "plans you missed" list. Daily
 * and named-day tasks are left out: their missed day lapses instead.
 */
export function isMissedPlan(task: Task, today = getTodayString()): boolean {
  if (task.deletedAt || task.status === 'Done' || task.status === 'Archived' || task.status === 'Blocked') return false;
  if (!task.plannedDate || task.plannedDate >= today) return false;
  return !isLapsing(task);
}

/** Blocked with nothing that will ever bring it back: no task to wait on, no date to chase. */
export function isStrandedBlocked(task: Pick<Task, 'status' | 'deletedAt' | 'blockedBy' | 'followUpDate'>): boolean {
  if (task.status !== 'Blocked' || task.deletedAt) return false;
  return !task.followUpDate && !(task.blockedBy ?? []).some((b) => b.type === 'task');
}

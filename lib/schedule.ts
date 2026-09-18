import { Task } from './db';
import { parseLocalDateTime } from './dates';

/**
 * Where a task belongs on a calendar, and why it is there.
 *
 * A task shows on one day only. If it has been planned, that is the planned
 * day - the deadline is already accounted for by having made a plan, and
 * drawing it twice made the week look busier than it is. If it has not been
 * planned, it shows on its due date instead, so an unplanned deadline is
 * still visible in the week it falls in rather than only in a backlog list.
 *
 * `kind` is what the calendars use to tell the two apart visually: a planned
 * task is work you have committed to that day, a due one is a deadline you
 * have not yet made room for.
 */
export type Placement = { date: string; kind: 'planned' | 'due' | 'done' };

type Placeable = Pick<Task, 'status' | 'plannedDate' | 'dueDate' | 'doneDate'>;

export function taskPlacement(task: Placeable, includeDone = false): Placement | null {
  // Archived work is put away deliberately and never belongs on a calendar.
  if (task.status === 'Archived') return null;

  // Blocked work is parked. It is not yours to act on, so it stays off every
  // calendar; its follow-up date is what brings it back, and nothing else
  // should be nagging about it in the meantime.
  if (task.status === 'Blocked') return null;

  if (task.status === 'Done') {
    if (!includeDone) return null;
    // A finished task stays on the day it was meant for, so the week reads as
    // "this is what that day held" rather than shuffling under you on
    // completion. Only undated work falls back to when it was actually done.
    const date = task.plannedDate ?? task.dueDate ?? doneDay(task.doneDate);
    return date ? { date, kind: 'done' } : null;
  }

  if (task.plannedDate) return { date: task.plannedDate, kind: 'planned' };
  if (task.dueDate) return { date: task.dueDate, kind: 'due' };
  return null;
}

/** doneDate may be a timestamp or a date-only string; take its local day. */
function doneDay(doneDate: string | null | undefined): string | null {
  if (!doneDate) return null;
  const d = parseLocalDateTime(doneDate);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The tasks belonging to one day, with the reason each one is there. */
export function tasksForDay<T extends Placeable>(
  tasks: T[],
  dayStr: string,
  includeDone = false,
): Array<{ task: T; kind: Placement['kind'] }> {
  const out: Array<{ task: T; kind: Placement['kind'] }> = [];
  for (const task of tasks) {
    const placement = taskPlacement(task, includeDone);
    if (placement && placement.date === dayStr) out.push({ task, kind: placement.kind });
  }
  return out;
}

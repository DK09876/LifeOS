import { Task } from './db';

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
export type Placement = { date: string; kind: 'planned' | 'due' };

export function taskPlacement(task: Pick<Task, 'status' | 'plannedDate' | 'dueDate'>): Placement | null {
  // A finished task is not upcoming work, whichever date it carried.
  if (task.status === 'Done' || task.status === 'Archived') return null;
  if (task.plannedDate) return { date: task.plannedDate, kind: 'planned' };
  if (task.dueDate) return { date: task.dueDate, kind: 'due' };
  return null;
}

/** The tasks belonging to one day, with the reason each one is there. */
export function tasksForDay<T extends Pick<Task, 'status' | 'plannedDate' | 'dueDate'>>(
  tasks: T[],
  dayStr: string,
): Array<{ task: T; kind: Placement['kind'] }> {
  const out: Array<{ task: T; kind: Placement['kind'] }> = [];
  for (const task of tasks) {
    const placement = taskPlacement(task);
    if (placement && placement.date === dayStr) out.push({ task, kind: placement.kind });
  }
  return out;
}

/**
 * A task appears on exactly one day of a calendar. Drawing a planned task
 * again on its due date double-counted the week; dropping unplanned due
 * dates entirely hid deadlines nobody had made room for yet.
 */

import { describe, expect, it } from 'vitest';

import { taskPlacement, tasksForDay } from './schedule';

const task = (extra: Record<string, unknown> = {}) =>
  ({ status: 'Backlog', plannedDate: null, dueDate: null, doneDate: null, ...extra }) as never;

describe('taskPlacement', () => {
  it('uses the planned date when there is one', () => {
    expect(taskPlacement(task({ plannedDate: '2026-09-18', dueDate: '2026-09-20' })))
      .toEqual({ date: '2026-09-18', kind: 'planned' });
  });

  it('falls back to the due date when the task is unplanned', () => {
    expect(taskPlacement(task({ dueDate: '2026-09-20' })))
      .toEqual({ date: '2026-09-20', kind: 'due' });
  });

  it('places a task nowhere when it has neither date', () => {
    expect(taskPlacement(task())).toBeNull();
  });

  it('keeps finished work off the calendar by default', () => {
    expect(taskPlacement(task({ status: 'Done', dueDate: '2026-09-20' }))).toBeNull();
    expect(taskPlacement(task({ status: 'Archived', plannedDate: '2026-09-18' }))).toBeNull();
  });

  describe('when a view asks for finished work too', () => {
    // The Week view is a record of what a day held, so a completed task stays
    // put and greys out rather than vanishing the moment it is ticked.
    it('leaves a done task on the day it was meant for', () => {
      expect(taskPlacement(task({ status: 'Done', plannedDate: '2026-09-16', dueDate: '2026-09-18',
        doneDate: '2026-09-17T10:00:00.000Z' }), true))
        .toEqual({ date: '2026-09-16', kind: 'done' });
    });

    it('falls back to the day it was finished when it had no dates', () => {
      expect(taskPlacement(task({ status: 'Done', doneDate: '2026-09-17T10:00:00.000Z' }), true))
        .toEqual({ date: '2026-09-17', kind: 'done' });
    });

    it('reads a date-only doneDate as its local day', () => {
      expect(taskPlacement(task({ status: 'Done', doneDate: '2026-09-17' }), true))
        .toEqual({ date: '2026-09-17', kind: 'done' });
    });

    it('still hides archived work', () => {
      expect(taskPlacement(task({ status: 'Archived', plannedDate: '2026-09-18' }), true)).toBeNull();
    });
  });

  // The double-draw this replaced: planned Wednesday, due Friday used to show
  // on both days, so a seven-task week could read as ten.
  it('does not also draw a planned task on its due date', () => {
    const t = task({ plannedDate: '2026-09-16', dueDate: '2026-09-18' });
    expect(tasksForDay([t], '2026-09-16')).toHaveLength(1);
    expect(tasksForDay([t], '2026-09-18')).toHaveLength(0);
  });

  it('labels each placement so the two can be told apart', () => {
    const planned = task({ plannedDate: '2026-09-18' });
    const due = task({ dueDate: '2026-09-18' });
    expect(tasksForDay([planned, due], '2026-09-18').map((p) => p.kind)).toEqual(['planned', 'due']);
  });
});

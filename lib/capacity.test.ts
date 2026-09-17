/**
 * The day's effort meter. Its job is to be believable: if it undercounts,
 * you overcommit on its say-so, and a meter you have learned to distrust is
 * worse than no meter.
 */

import { describe, expect, it } from 'vitest';

import { apOf, capacityFor, dayLoad, parseCapacityMap, pruneCapacityMap } from './capacity';

const TODAY = '2026-09-17';
const task = (extra: Record<string, unknown> = {}) => ({
  id: 't', status: 'Planned', actionPoints: '2', plannedDate: TODAY, dueDate: null,
  doneDate: null, deletedAt: null, ...extra,
}) as never;
const event = (extra: Record<string, unknown> = {}) => ({
  id: 'e', date: TODAY, actionPoints: '1', lastCompleted: null, deletedAt: null, ...extra,
}) as never;

describe('apOf', () => {
  it('uses the estimate when there is one', () => {
    expect(apOf({ actionPoints: '4' }, 2)).toBe(4);
  });
  // Unestimated work is not free, so it has to cost something.
  it('falls back to the default when unestimated', () => {
    expect(apOf({ actionPoints: null }, 2)).toBe(2);
    expect(apOf({ actionPoints: '' }, 3)).toBe(3);
  });
});

describe('capacityFor', () => {
  it('prefers a per-day override', () => {
    expect(capacityFor({ [TODAY]: 5 }, TODAY, 8)).toBe(5);
  });
  it('falls back to the configured budget', () => {
    expect(capacityFor({}, TODAY, 8)).toBe(8);
  });
  // A deliberate zero is a real answer - "nothing today" - not a missing one.
  it('treats an explicit zero as an override', () => {
    expect(capacityFor({ [TODAY]: 0 }, TODAY, 8)).toBe(0);
  });
});

describe('parseCapacityMap / pruneCapacityMap', () => {
  it('survives absent or corrupt storage', () => {
    expect(parseCapacityMap(undefined)).toEqual({});
    expect(parseCapacityMap('not json')).toEqual({});
    expect(parseCapacityMap('[1,2]')).toEqual({});
  });
  it('drops non-numeric values rather than trusting them', () => {
    expect(parseCapacityMap('{"2026-09-17":5,"2026-09-18":"x"}')).toEqual({ '2026-09-17': 5 });
  });
  it('keeps recent overrides and drops aged ones', () => {
    const pruned = pruneCapacityMap({ '2026-09-16': 5, '2026-01-01': 9 }, TODAY);
    expect(pruned).toEqual({ '2026-09-16': 5 });
  });
});

describe('dayLoad', () => {
  it('separates what is finished from what is still committed', () => {
    const load = dayLoad([
      task({ id: 'a', status: 'Done', doneDate: `${TODAY}T14:00:00.000Z`, actionPoints: '3' }),
      task({ id: 'b', actionPoints: '2' }),
    ], [], 2, TODAY);
    expect(load).toEqual({ done: 3, planned: 2, committed: 5 });
  });

  it('counts events against the same budget', () => {
    const load = dayLoad([], [event({ actionPoints: '2' })], 2, TODAY);
    expect(load.planned).toBe(2);
  });

  it('counts a task due today even when it was never planned', () => {
    expect(dayLoad([task({ plannedDate: null, dueDate: TODAY })], [], 2, TODAY).planned).toBe(2);
  });

  it('ignores other days, archived tasks and deleted rows', () => {
    const load = dayLoad([
      task({ id: 'x', plannedDate: '2026-09-18' }),
      task({ id: 'y', status: 'Archived' }),
      task({ id: 'z', deletedAt: '2026-09-01' }),
    ], [], 2, TODAY);
    expect(load.committed).toBe(0);
  });

  // Effort spent today counts today even if the task was scheduled earlier -
  // otherwise clearing yesterday's backlog looks like a free day.
  it('credits work finished today that was planned earlier', () => {
    const load = dayLoad([
      task({ status: 'Done', plannedDate: '2026-09-10', doneDate: `${TODAY}T09:00:00.000Z`, actionPoints: '4' }),
    ], [], 2, TODAY);
    expect(load.done).toBe(4);
  });

  it('reads a date-only doneDate as the local day, not UTC midnight', () => {
    expect(dayLoad([task({ status: 'Done', doneDate: TODAY, actionPoints: '3' })], [], 2, TODAY).done).toBe(3);
  });
});

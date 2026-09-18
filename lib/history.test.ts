/**
 * The record of what days cost. Its only job is to be trustworthy: a
 * calibration built on guesses would tell you confident things about yourself
 * that are not true, which is worse than telling you nothing.
 */

import { describe, expect, it } from 'vitest';

import { calibrate, parseHistory, pruneHistory, recentDays, spentOn } from './history';

const TODAY = '2026-09-17';
const rec = (capacity: number, spent: number, finished = 1) => ({ capacity, spent, finished });

describe('parseHistory', () => {
  it('survives absent or corrupt storage', () => {
    expect(parseHistory(undefined)).toEqual({});
    expect(parseHistory('nope')).toEqual({});
    expect(parseHistory('[1]')).toEqual({});
  });
  it('drops entries that are not shaped like a day', () => {
    expect(parseHistory('{"2026-09-16":{"capacity":8,"spent":5},"bad":{"capacity":"x"}}'))
      .toEqual({ '2026-09-16': { capacity: 8, spent: 5, finished: 0 } });
  });
});

describe('pruneHistory', () => {
  it('keeps the recent quarter and drops the rest', () => {
    const pruned = pruneHistory({ '2026-09-16': rec(8, 5), '2026-01-01': rec(8, 5) }, TODAY);
    expect(Object.keys(pruned)).toEqual(['2026-09-16']);
  });
});

describe('recentDays', () => {
  it('ends yesterday, because today is not finished', () => {
    const days = recentDays(3, TODAY);
    expect(days).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
  });
});

describe('spentOn', () => {
  const task = (extra: Record<string, unknown> = {}) =>
    ({ status: 'Done', actionPoints: '3', doneDate: `${TODAY}T10:00:00.000Z`, deletedAt: null, ...extra }) as never;

  it('totals tasks finished that day', () => {
    expect(spentOn(TODAY, [task(), task({ actionPoints: '2' })], [], [], 2))
      .toEqual({ spent: 5, finished: 2 });
  });

  it('counts habits and events on the same footing', () => {
    const habit = { completionDates: [TODAY], actionPoints: '3', deletedAt: null } as never;
    const event = { lastCompleted: TODAY, actionPoints: '1', deletedAt: null } as never;
    expect(spentOn(TODAY, [], [event], [habit], 2)).toEqual({ spent: 4, finished: 2 });
  });

  it('reads a date-only completion as its local day', () => {
    expect(spentOn(TODAY, [task({ doneDate: TODAY })], [], [], 2).finished).toBe(1);
  });

  it('ignores other days, unfinished work and deleted rows', () => {
    const other = task({ doneDate: '2026-09-16T10:00:00.000Z' });
    expect(spentOn(TODAY, [other, task({ status: 'Backlog' }), task({ deletedAt: 'x' })], [], [], 2))
      .toEqual({ spent: 0, finished: 0 });
  });
});

describe('calibrate', () => {
  const history = {
    '2026-09-14': rec(8, 12),
    '2026-09-15': rec(8, 10),
    '2026-09-16': rec(8, 5),
  };
  const dates = ['2026-09-14', '2026-09-15', '2026-09-16'];

  it('reports the gap between what you allow and what you spend', () => {
    const c = calibrate(history, dates);
    expect(c).toEqual({ days: 3, averageCapacity: 8, averageSpent: 9, overDays: 2 });
  });

  // A holiday is not evidence that you overestimate yourself.
  it('leaves empty days out rather than averaging them in as zero', () => {
    const c = calibrate({ ...history, '2026-09-13': rec(8, 0) }, ['2026-09-13', ...dates]);
    expect(c.days).toBe(3);
    expect(c.averageSpent).toBe(9);
  });

  it('says nothing when there is nothing to say', () => {
    expect(calibrate({}, dates)).toEqual({ days: 0, averageCapacity: 0, averageSpent: 0, overDays: 0 });
  });
});

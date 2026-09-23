/**
 * Project progress.
 *
 * The bug this replaces: a goal pursued by a daily recurring task read 0%,
 * jumped to 100% the moment the task was ticked, and fell back to 0% at the
 * next rollover - because it measured the state of a task row rather than the
 * work that had been done. Fifty pages read left it exactly where it started.
 */

import { describe, expect, it } from 'vitest';

import { loggedOn, loggedTotal, logProgress, loggingStreak, projectProgress } from './progress';
import type { Project, Task } from './db';

const bundle = (over: Partial<Project> = {}) =>
  ({ kind: 'bundle', targetCount: null, targetUnit: null, progressLog: [], ...over }) as Project;
const target = (over: Partial<Project> = {}) =>
  ({ kind: 'target', targetCount: 300, targetUnit: 'pages', progressLog: [], ...over }) as Project;

const task = (over: Partial<Task> = {}) =>
  ({ status: 'Backlog', actionPoints: '2', deletedAt: null, ...over }) as Task;

describe('bundle projects', () => {
  it('measures completed action points', () => {
    const p = projectProgress(bundle(), [task({ status: 'Done' }), task({ actionPoints: '4' })]);
    expect(p).toMatchObject({ done: 2, total: 6, unit: 'AP', percent: 33 });
  });

  it('is complete when every task is', () => {
    expect(projectProgress(bundle(), [task({ status: 'Done' })]).complete).toBe(true);
  });

  it('ignores archived and deleted tasks', () => {
    const p = projectProgress(bundle(), [task({ status: 'Done' }), task({ status: 'Archived' }), task({ deletedAt: 'x' })]);
    expect(p.total).toBe(2);
    expect(p.percent).toBe(100);
  });

  it('says nothing rather than 0% when there are no tasks', () => {
    expect(projectProgress(bundle(), []).total).toBeNull();
  });
});

describe('target projects', () => {
  it('accumulates what has been logged', () => {
    const p = projectProgress(target({ progressLog: [
      { date: '2026-09-21', amount: 2 }, { date: '2026-09-22', amount: 4 },
    ] }), []);
    expect(p).toMatchObject({ done: 6, total: 300, unit: 'pages', percent: 2 });
  });

  // The whole point: progress must survive the task being un-completed,
  // because it is not measuring a task at all.
  it('does not depend on any task row', () => {
    const log = [{ date: '2026-09-21', amount: 50 }];
    expect(projectProgress(target({ progressLog: log }), []).done).toBe(50);
    expect(projectProgress(target({ progressLog: log }), [task({ status: 'Backlog' })]).done).toBe(50);
  });

  it('is complete once the target is reached or passed', () => {
    expect(projectProgress(target({ targetCount: 10, progressLog: [{ date: 'd', amount: 10 }] }), []).complete).toBe(true);
    expect(projectProgress(target({ targetCount: 10, progressLog: [{ date: 'd', amount: 12 }] }), []).complete).toBe(true);
  });

  it('never shows more than 100%', () => {
    expect(projectProgress(target({ targetCount: 10, progressLog: [{ date: 'd', amount: 40 }] }), []).percent).toBe(100);
  });

  // Counting up with no finish line is a legitimate way to use this.
  it('keeps counting when there is no target', () => {
    const p = projectProgress(target({ targetCount: null, progressLog: [{ date: 'd', amount: 7 }] }), []);
    expect(p.done).toBe(7);
    expect(p.total).toBeNull();
    expect(p.percent).toBe(0);
  });
});

describe('logging', () => {
  it('appends an entry', () => {
    expect(logProgress([], 2, undefined, '2026-09-22')).toEqual([{ date: '2026-09-22', amount: 2 }]);
  });

  it('keeps a note when given one', () => {
    expect(logProgress([], 2, 'chapter 3', '2026-09-22')[0].note).toBe('chapter 3');
  });

  it('ignores a zero or nonsense amount', () => {
    expect(logProgress([], 0)).toEqual([]);
    expect(logProgress([], NaN)).toEqual([]);
  });

  // Negative amounts are how you take back a mis-log.
  it('accepts a negative amount to undo', () => {
    const log = logProgress(logProgress([], 5, undefined, 'd'), -2, undefined, 'd');
    expect(loggedTotal(log)).toBe(3);
  });

  it('reports what was logged on a given day', () => {
    const log = [{ date: 'a', amount: 2 }, { date: 'b', amount: 3 }, { date: 'a', amount: 1 }];
    expect(loggedOn(log, 'a')).toBe(3);
  });
});

describe('loggingStreak', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 8, 22 - n)).toISOString().slice(0, 10);
  const TODAY = day(0);

  it('counts consecutive days with something logged', () => {
    const log = [0, 1, 2].map((n) => ({ date: day(n), amount: 1 }));
    expect(loggingStreak(log, TODAY)).toBe(3);
  });

  it('does not break just because today is not logged yet', () => {
    const log = [1, 2].map((n) => ({ date: day(n), amount: 1 }));
    expect(loggingStreak(log, TODAY)).toBe(2);
  });

  it('breaks on a genuinely missed day', () => {
    const log = [2, 3].map((n) => ({ date: day(n), amount: 1 }));
    expect(loggingStreak(log, TODAY)).toBe(0);
  });

  it('ignores days whose entries only take progress away', () => {
    expect(loggingStreak([{ date: TODAY, amount: -3 }], TODAY)).toBe(0);
  });
});

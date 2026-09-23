/**
 * How far along a project is.
 *
 * The two kinds answer the question differently, and conflating them was the
 * original bug: a "read a book" goal pursued by a daily recurring task showed
 * 0%, flicked to 100% the moment the task was completed, and fell back to 0%
 * at the next rollover. It oscillated instead of accumulating, because it was
 * measuring the state of a task row rather than the work done.
 */

import type { ProgressEntry, Project, Task } from './db';
import { getTodayString } from './dates';

export const DEFAULT_TASK_AP = 2;

export interface Progress {
  /** 0-100, clamped. */
  percent: number;
  /** What has been done, in whatever the project counts. */
  done: number;
  /** What there is to do, or null when a bundle has no tasks yet. */
  total: number | null;
  /** "AP" for a bundle, the project's own unit for a target. */
  unit: string;
  complete: boolean;
}

const apOf = (task: Pick<Task, 'actionPoints'>) =>
  parseInt(task.actionPoints || '0') || DEFAULT_TASK_AP;

/** Everything logged against a target project. */
export function loggedTotal(log: ProgressEntry[] | undefined): number {
  return (log ?? []).reduce((sum, entry) => sum + entry.amount, 0);
}

export function projectProgress(
  project: Pick<Project, 'kind' | 'targetCount' | 'targetUnit' | 'progressLog'>,
  tasks: Task[],
): Progress {
  if (project.kind === 'target') {
    const done = loggedTotal(project.progressLog);
    const total = project.targetCount && project.targetCount > 0 ? project.targetCount : null;
    return {
      done,
      total,
      unit: project.targetUnit?.trim() || 'done',
      // Without a target there is nothing to be a percentage of, so the count
      // stands on its own rather than inventing a denominator.
      percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0,
      complete: total !== null && done >= total,
    };
  }

  const live = tasks.filter((t) => !t.deletedAt && t.status !== 'Archived');
  const total = live.reduce((sum, t) => sum + apOf(t), 0);
  const done = live.filter((t) => t.status === 'Done').reduce((sum, t) => sum + apOf(t), 0);
  return {
    done,
    total: total > 0 ? total : null,
    unit: 'AP',
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done >= total,
  };
}

/** Add to a target project's log, newest last. Amounts may be negative to undo. */
export function logProgress(
  log: ProgressEntry[] | undefined,
  amount: number,
  note?: string,
  date = getTodayString(),
): ProgressEntry[] {
  if (!Number.isFinite(amount) || amount === 0) return log ?? [];
  const entry: ProgressEntry = { date, amount, ...(note?.trim() ? { note: note.trim() } : {}) };
  return [...(log ?? []), entry];
}

/** What was logged today, so the UI can show the day's contribution. */
export function loggedOn(log: ProgressEntry[] | undefined, date = getTodayString()): number {
  return (log ?? []).filter((e) => e.date === date).reduce((sum, e) => sum + e.amount, 0);
}

/** Consecutive days ending today (or yesterday) with something logged. */
export function loggingStreak(log: ProgressEntry[] | undefined, today = getTodayString()): number {
  const days = new Set((log ?? []).filter((e) => e.amount > 0).map((e) => e.date));
  if (!days.size) return 0;
  const day = (offset: number) => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  // Today not being logged yet does not break a run; the day is not over.
  let offset = days.has(today) ? 0 : 1;
  let run = 0;
  while (days.has(day(offset))) {
    run += 1;
    offset += 1;
  }
  return run;
}

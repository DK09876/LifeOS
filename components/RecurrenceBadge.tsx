'use client';

import { format } from 'date-fns';

import type { Task } from '@/types';
import { parseLocalDate } from '@/lib/dates';
import { thenOn } from '@/lib/recurrence';
import { cyclesMissed } from '@/lib/scoring';

/**
 * "↻ Weekly · next Thu 1 Oct" - when a recurring task comes round again.
 *
 * For open work the date is when the following one falls if this one is done
 * today; for finished work, when it is back.
 */
export default function RecurrenceBadge({ task, className = '' }: { task: Task; className?: string }) {
  if (task.recurrence === 'None') return null;
  const next = thenOn(task);
  const ended = !next && !!task.recurrenceEnd;
  // Open and behind its own cadence: say so, rather than only scoring it.
  const missed = task.status !== 'Done' && task.status !== 'Archived' && !task.dueDate ? cyclesMissed(task) : 0;
  return (
    <span className={`inline-flex items-center gap-1 text-cyan-400/90 ${className}`}
          title={task.recurrenceEnd ? `Repeats until ${format(parseLocalDate(task.recurrenceEnd), 'd MMM yyyy')}` : undefined}>
      <span aria-hidden>↻</span>
      <span>{task.recurrence}</span>
      {next && <span className="text-[var(--muted)]">· next {format(parseLocalDate(next), 'EEE d MMM')}</span>}
      {ended && <span className="text-[var(--muted)]">· last one</span>}
      {missed > 0 && <span className="text-amber-400">· {missed} missed</span>}
    </span>
  );
}

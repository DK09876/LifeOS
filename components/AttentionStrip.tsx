'use client';

/**
 * The few things Today has to say that are not on today's list.
 *
 * Triage holds the work, but nothing important should live *only* there:
 * a blocked task whose deadline is closing in, captures that have sat
 * unsorted through a weekend, and yesterday's unticked items all surface
 * here as one line each, with the way to deal with them one tap away.
 */

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

import type { Task } from '@/types';
import { parseLocalDate } from '@/lib/dates';

interface Props {
  pressingBlocked: Task[];
  triageNag: Task[];
  yesterdayCount: number;
  onEdit: (task: Task) => void;
}

export default function AttentionStrip({ pressingBlocked, triageNag, yesterdayCount, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  if (!pressingBlocked.length && !triageNag.length && !yesterdayCount) return null;

  // Today is a dashboard for today, so this stays one line until opened:
  // a chip per kind of thing, coloured by how much it matters.
  const chips = [
    pressingBlocked.length ? { text: `${pressingBlocked.length} blocked & pressing`, cls: 'bg-red-500/15 text-red-300' } : null,
    triageNag.length ? { text: `${triageNag.length} to triage`, cls: 'bg-yellow-500/15 text-yellow-300' } : null,
    yesterdayCount ? { text: `${yesterdayCount} from yesterday`, cls: 'bg-[var(--card-hover)] text-[var(--muted)]' } : null,
  ].filter((c): c is { text: string; cls: string } => c !== null);

  return (
    <div className="mb-6 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left">
        <span className="text-sm text-white flex-shrink-0">👀 Worth a look</span>
        <span className="flex flex-wrap gap-1 flex-1 min-w-0">
          {chips.map(c => (
            <span key={c.text} className={`text-xs px-2 py-0.5 rounded-full ${c.cls}`}>{c.text}</span>
          ))}
        </span>
        <span className="text-xs text-[var(--muted)] flex-shrink-0">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {pressingBlocked.length > 0 && (
            <div>
              <p className="text-xs text-red-300 mb-1">⛔ Blocked, but the deadline is close — worth chasing</p>
              <div className="space-y-1">
                {pressingBlocked.map(task => (
                  <button key={task.id} onClick={() => onEdit(task)}
                          className="w-full flex items-center justify-between gap-2 rounded bg-[var(--background)] px-2 py-1.5 text-left text-sm hover:bg-[var(--card-hover)]">
                    <span className="text-white truncate">{task.taskName}</span>
                    <span className="text-xs text-red-300 flex-shrink-0">
                      due {format(parseLocalDate(task.dueDate!), 'EEE d MMM')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {triageNag.length > 0 && (
            <Link href="/plan?view=triage&tab=needsDetails"
                  className="flex items-center justify-between rounded bg-[var(--background)] px-2 py-1.5 text-sm hover:bg-[var(--card-hover)]">
              <span className="text-yellow-300">
                📥 {triageNag.length} {triageNag.length === 1 ? 'capture has' : 'captures have'} sat through a weekend without details
              </span>
              <span className="text-xs text-[var(--muted)] flex-shrink-0">Sort →</span>
            </Link>
          )}

          {yesterdayCount > 0 && (
            <Link href="/yesterday"
                  className="flex items-center justify-between rounded bg-[var(--background)] px-2 py-1.5 text-sm hover:bg-[var(--card-hover)]">
              <span className="text-[var(--muted)]">
                ↩ {yesterdayCount} {yesterdayCount === 1 ? 'thing' : 'things'} from yesterday not ticked off
              </span>
              <span className="text-xs text-blue-400 flex-shrink-0">Review →</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

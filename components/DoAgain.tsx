'use client';

/**
 * Chores you do regularly but not on a schedule. Once done, they wait here;
 * tapping one asks whether it is for today or just back on the list.
 */

import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';

import type { Task } from '@/types';
import { parseLocalDateTime } from '@/lib/dates';

export default function DoAgain({ tasks, onReopen }: { tasks: Task[]; onReopen: (task: Task, toToday: boolean) => Promise<void> }) {
  const [asking, setAsking] = useState<Task | null>(null);
  const [open, setOpen] = useState(true);
  if (!tasks.length) return null;

  return (
    <div className="mb-6">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
              className="w-full flex items-center justify-between mb-3 text-left">
        <h2 className="text-lg font-medium text-white">Do again</h2>
        <span className="text-xs text-[var(--muted)]">{tasks.length} · {open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-2">
          {tasks.map(task => (
            <button key={task.id} onClick={() => setAsking(task)}
                    className="rounded-lg bg-[var(--card-bg)] hover:bg-[var(--card-hover)] px-3 py-2 text-left">
              <span className="block text-sm text-white">↺ {task.taskName}</span>
              {task.doneDate && (
                <span className="block text-[11px] text-[var(--muted)]">
                  done {formatDistanceToNowStrict(parseLocalDateTime(task.doneDate), { addSuffix: true })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {asking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setAsking(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Do ${asking.taskName} again`}
               className="w-full max-w-sm rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 pb-safe"
               onClick={(e) => e.stopPropagation()}>
            <p className="text-white font-medium mb-1">Add &ldquo;{asking.taskName}&rdquo; to today?</p>
            <p className="text-sm text-[var(--muted)] mb-4">Or just put it back on your list to plan later.</p>
            <div className="flex flex-col gap-2">
              <button onClick={async () => { await onReopen(asking, true); setAsking(null); }}
                      className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">Add to today</button>
              <button onClick={async () => { await onReopen(asking, false); setAsking(null); }}
                      className="py-2.5 rounded-lg bg-[var(--card-hover)] text-white text-sm">Just reopen</button>
              <button onClick={() => setAsking(null)} className="py-2 text-sm text-[var(--muted)]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

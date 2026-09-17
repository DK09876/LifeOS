'use client';

/**
 * Plans you made and did not keep.
 *
 * Deliberately not merged into today's list: a day that silently absorbs
 * everything you meant to do earlier stops being a plan and becomes a pile,
 * and you stop reading it. These need a decision each - do it, move it, or
 * admit it was never going to happen - so they get their own strip with the
 * decision one tap away.
 *
 * Overdue *deadlines* are a different thing and live in Plan. This is only
 * about intentions: a planned date that has passed.
 */

import { useState } from 'react';
import { format } from 'date-fns';

import { Task } from '@/types';
import { getTodayString, parseLocalDate } from '@/lib/dates';

interface Props {
  tasks: Task[];
  onReschedule: (taskId: string, date: string | null) => void;
  onDone: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onMoveAll: (date: string) => void;
}

export default function MissedStrip({ tasks, onReschedule, onDone, onEdit, onMoveAll }: Props) {
  const [open, setOpen] = useState(false);
  if (!tasks.length) return null;

  const today = getTodayString();
  const tomorrow = format(new Date(parseLocalDate(today).getTime() + 86400000), 'yyyy-MM-dd');

  return (
    <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm text-amber-300">
          ⚠ {tasks.length} {tasks.length === 1 ? 'plan' : 'plans'} you missed
        </span>
        <span className="text-xs text-[var(--muted)]">{open ? 'Hide' : 'Review'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="flex flex-wrap items-center gap-2 rounded bg-[var(--background)] p-2">
              <button
                onClick={() => onEdit(task)}
                className="flex-1 min-w-[8rem] text-left text-sm text-white hover:underline"
              >
                {task.taskName}
                {task.plannedDate && (
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {format(parseLocalDate(task.plannedDate), 'EEE d MMM')}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-1 text-xs">
                <Action label="Today" onClick={() => onReschedule(task.id, today)} />
                <Action label="Tomorrow" onClick={() => onReschedule(task.id, tomorrow)} />
                <Action label="Unplan" onClick={() => onReschedule(task.id, null)} />
                <Action label="Done" onClick={() => onDone(task.id)} tone="done" />
              </div>
            </div>
          ))}
          {tasks.length > 1 && (
            <button
              onClick={() => onMoveAll(today)}
              className="text-xs text-[var(--muted)] hover:text-white underline"
            >
              Move all to today
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Action({ label, onClick, tone }: { label: string; onClick: () => void; tone?: 'done' }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded hover:bg-white/10 ${
        tone === 'done' ? 'text-green-400' : 'text-[var(--muted)] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

'use client';

/**
 * Blocked work whose follow-up date has arrived.
 *
 * A blocked task used to sit in Triage accruing neglect while appearing on no
 * working view - scored as one of your most pressing items and never shown to
 * you. Waiting is not neglect, so it no longer rots; instead you name a day to
 * chase it, and on that day it asks for a decision here.
 */

import { useState } from 'react';
import { format } from 'date-fns';

import { Task } from '@/types';
import { getTodayString, parseLocalDate } from '@/lib/dates';

interface Props {
  tasks: Task[];
  onDefer: (taskId: string, date: string) => void;
  onUnblock: (taskId: string) => void;
  onEdit: (task: Task) => void;
}

const DAY = 86_400_000;

export default function FollowUpStrip({ tasks, onDefer, onUnblock, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  if (!tasks.length) return null;

  const today = getTodayString();
  const plus = (n: number) => format(new Date(parseLocalDate(today).getTime() + n * DAY), 'yyyy-MM-dd');

  return (
    <div className="mb-6 rounded-lg border border-sky-500/30 bg-sky-500/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm text-sky-300">
          ⏳ {tasks.length} {tasks.length === 1 ? 'thing' : 'things'} to chase
        </span>
        <span className="text-xs text-[var(--muted)]">{open ? 'Hide' : 'Review'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {tasks.map(task => {
            const waitingOn = (task.blockedBy || [])
              .map(b => (b.type === 'note' ? b.note : 'another task'))
              .join(', ');
            return (
              <div key={task.id} className="flex flex-wrap items-center gap-2 rounded bg-[var(--background)] p-2">
                <button
                  onClick={() => onEdit(task)}
                  className="flex-1 min-w-[8rem] text-left text-sm text-white hover:underline"
                >
                  {task.taskName}
                  {waitingOn && (
                    <span className="ml-2 text-xs text-[var(--muted)]">waiting on {waitingOn}</span>
                  )}
                  {task.followUpDate && task.followUpDate < today && (
                    <span className="ml-2 text-xs text-red-400">
                      chase overdue {Math.round((parseLocalDate(today).getTime() - parseLocalDate(task.followUpDate).getTime()) / DAY)}d
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1 text-xs">
                  <Action label="Chased — a week" onClick={() => onDefer(task.id, plus(7))} />
                  <Action label="Tomorrow" onClick={() => onDefer(task.id, plus(1))} />
                  <Action label="Unblock" onClick={() => onUnblock(task.id)} tone="go" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Action({ label, onClick, tone }: { label: string; onClick: () => void; tone?: 'go' }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded hover:bg-white/10 ${
        tone === 'go' ? 'text-green-400' : 'text-[var(--muted)] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

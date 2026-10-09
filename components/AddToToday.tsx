'use client';

/**
 * Add something to today in one line.
 *
 * Type a name and press Enter: it is planned for today. If the name matches
 * something you already have - a finished chore, or an open task - it offers
 * that instead, so "dishes" brings back the dishes task rather than writing
 * a fourth one.
 */

import { useMemo, useState } from 'react';

import type { Task } from '@/types';
import { EFFORT_LEVELS } from '@/lib/effort';
import { getTodayString } from '@/lib/dates';

interface Props {
  tasks: Task[];
  onCreate: (name: string, actionPoints: string | null) => Promise<void>;
  onReopen: (task: Task) => Promise<void>;
  onPlanToday: (task: Task) => Promise<void>;
}

export default function AddToToday({ tasks, onCreate, onReopen, onPlanToday }: Props) {
  const [name, setName] = useState('');
  const [ap, setAp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = getTodayString();

  const matches = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return [];
    return tasks
      .filter(t => !t.deletedAt && t.status !== 'Archived' && t.taskName.toLowerCase().includes(q))
      .filter(t => !(t.status !== 'Done' && t.plannedDate === today))
      // Finished chores first - the reason this exists - then open tasks.
      .sort((a, b) => Number(b.status === 'Done' && !!b.repeatable) - Number(a.status === 'Done' && !!a.repeatable)
        || Number(b.status === 'Done') - Number(a.status === 'Done'))
      .slice(0, 4);
  }, [name, tasks, today]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); setName(''); setAp(null); } finally { setBusy(false); }
  }

  const submit = () => {
    const value = name.trim();
    if (!value || busy) return;
    void run(() => onCreate(value, ap));
  };

  return (
    <div className="mb-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Add to today…"
          aria-label="Add a task to today"
          enterKeyHint="done"
          className="flex-1 min-w-0 px-3 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-white placeholder-[var(--muted)] focus:outline-none focus:border-blue-500"
        />
        <button onClick={submit} disabled={!name.trim() || busy}
                className="px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm">
          Add
        </button>
      </div>

      {name.trim() && (
        <div className="mt-2 space-y-1.5">
          {matches.map(task => {
            const again = task.status === 'Done';
            return (
              <button key={task.id} disabled={busy}
                      onClick={() => run(() => (again ? onReopen(task) : onPlanToday(task)))}
                      className="w-full flex items-center justify-between gap-2 rounded-lg bg-[var(--card-bg)] px-3 py-2 text-left text-sm hover:bg-[var(--card-hover)]">
                <span className="text-white truncate">{again ? '↺' : '📅'} {task.taskName}</span>
                <span className="text-xs text-blue-300 flex-shrink-0">{again ? 'Do again today' : 'Plan for today'}</span>
              </button>
            );
          })}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--muted)] mr-1">Effort</span>
            {EFFORT_LEVELS.filter(l => l.value > 0).map(({ value, name: label }) => (
              <button key={value} type="button" onClick={() => setAp(ap === String(value) ? null : String(value))}
                      title={label}
                      className={`w-8 h-8 rounded text-xs ${ap === String(value) ? 'bg-blue-600 text-white' : 'bg-[var(--card-hover)] text-[var(--muted)]'}`}>
                {value}
              </button>
            ))}
            <span className="text-xs text-[var(--muted)] ml-1 truncate">new task · fill the rest later</span>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Recording work against a goal.
 *
 * Deliberately not tied to finishing a task or a habit. The point of a target
 * project is that you did some amount of the thing - two pages, or four, or
 * none - and say so. Coupling it to a recurring task was what made progress
 * swing between 0% and 100% instead of adding up.
 */

import { useState } from 'react';

import type { Project } from '@/types';
import { loggedOn, loggingStreak } from '@/lib/progress';

export default function LogProgress({
  project,
  onLog,
}: {
  project: Project;
  onLog: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  const today = loggedOn(project.progressLog);
  const streak = loggingStreak(project.progressLog);

  const log = async (by: number) => {
    setBusy(true);
    try { await onLog(by); } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-color)] pt-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => setAmount((a) => Math.max(1, a - 1))}
          aria-label="Log less"
          className="h-7 w-7 rounded border border-[var(--border-color)] text-[var(--muted)] hover:text-white disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          aria-label="How much to log"
          className="w-14 rounded border border-[var(--border-color)] bg-[var(--background)] px-1 py-1 text-center text-sm text-white"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => setAmount((a) => a + 1)}
          aria-label="Log more"
          className="h-7 w-7 rounded border border-[var(--border-color)] text-[var(--muted)] hover:text-white disabled:opacity-40"
        >
          +
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => log(amount)}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Log {amount} {project.targetUnit?.trim() || ''}
      </button>

      <div className="ml-auto flex items-center gap-3 text-xs text-[var(--muted)]">
        {today !== 0 && <span>{today > 0 ? `+${today}` : today} today</span>}
        {streak > 0 && <span className="text-orange-400">🔥 {streak} day{streak === 1 ? '' : 's'}</span>}
        {today > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => log(-today)}
            className="hover:text-red-400"
          >
            Undo today
          </button>
        )}
      </div>
    </div>
  );
}

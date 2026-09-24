'use client';

/**
 * "Plan for…": pick a day for a task, seeing what each day already holds.
 *
 * Dragging onto a calendar does not work on a phone - Safari's drag and drop
 * never fires on touch - so this is how anything gets planned there. On a
 * desktop it sits alongside dragging, for when the day you want is not on
 * screen.
 */

import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';

import Modal from './Modal';
import { useToast } from './Toast';
import { updateTaskData, useEnergySettings, useEvents, useHabits, useTasks } from '@/lib/hooks';
import { apOf, dayLoad } from '@/lib/capacity';
import { getTodayString, parseLocalDate, toDateString } from '@/lib/dates';
import { isHabitDueOn, projectOccurrences } from '@/lib/recurrence';
import type { Task } from '@/types';

const DAYS_SHOWN = 8;

export default function PlanSheet({ task, onClose, onPlanned }: {
  task: Task | null;
  onClose: () => void;
  onPlanned?: (date: string | null) => void;
}) {
  const tasks = useTasks();
  const events = useEvents();
  const habits = useHabits();
  const energy = useEnergySettings();
  const { showToast } = useToast();
  const [custom, setCustom] = useState('');
  const today = getTodayString();

  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = toDateString(addDays(parseLocalDate(today), i));
    const due = habits.filter(h => isHabitDueOn(h, date));
    const load = dayLoad(tasks, events, energy.controls.defaultAP, date, { due, done: [] });
    // Later occurrences of recurring tasks will land on these days too.
    const recurring = tasks
      .filter(t => t.recurrence !== 'None' && projectOccurrences(t, date, date, today).length > 0)
      .reduce((n, t) => n + apOf(t, energy.controls.defaultAP), 0);
    return { date, load: load.committed + recurring, budget: energy.budgetFor(date) };
  }), [tasks, events, habits, energy, today]);

  if (!task) return null;
  const cost = apOf(task, energy.controls.defaultAP);

  async function plan(date: string | null) {
    try {
      await updateTaskData(task!.id, { plannedDate: date });
      onPlanned?.(date);
      onClose();
    } catch {
      showToast('Could not plan that', 'error');
    }
  }

  const label = (date: string, i: number) =>
    i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(parseLocalDate(date), 'EEEE');

  return (
    <Modal isOpen={!!task} onClose={onClose} title={`Plan “${task.taskName}”`} maxWidth="sm">
      <p className="text-xs text-[var(--muted)] mb-3">
        Costs {cost} AP. Each day shows what it already holds against its budget.
        {task.dueDate && <> Due {format(parseLocalDate(task.dueDate), 'EEE d MMM')}.</>}
      </p>
      <div className="space-y-1.5">
        {days.map(({ date, load, budget }, i) => {
          const here = task.plannedDate === date;
          const after = here ? load : load + cost;
          const over = after > budget;
          const late = !!task.dueDate && date > task.dueDate;
          return (
            <button key={date} onClick={() => plan(date)} disabled={here}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                      here ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'bg-[var(--background)] hover:bg-[var(--card-hover)] active:bg-[var(--card-hover)]'
                    }`}>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-white">{label(date, i)}</span>
                <span className="block text-xs text-[var(--muted)]">
                  {format(parseLocalDate(date), 'd MMM')}{late && <span className="text-red-400"> · after it is due</span>}
                </span>
              </span>
              <span className="w-24 flex-shrink-0">
                <span className="block h-1.5 rounded-full bg-[var(--card-hover)] overflow-hidden">
                  <span className={`block h-full rounded-full ${over ? 'bg-amber-500' : 'bg-green-500/80'}`}
                        style={{ width: `${Math.min(100, (after / Math.max(1, budget)) * 100)}%` }} />
                </span>
                <span className={`block text-[11px] text-right mt-0.5 ${over ? 'text-amber-400' : 'text-[var(--muted)]'}`}>
                  {here ? `${load}/${budget} · here now` : `${after}/${budget} AP`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-3">
        <input type="date" value={custom} min={today} onChange={(e) => setCustom(e.target.value)}
               aria-label="Another day"
               className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-white" />
        <button onClick={() => custom && plan(custom)} disabled={!custom}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm">
          Plan
        </button>
      </div>

      {task.plannedDate && (
        <button onClick={() => plan(null)} className="w-full mt-3 py-2 text-sm text-[var(--muted)] hover:text-white">
          Unplan — back to the backlog
        </button>
      )}
    </Modal>
  );
}

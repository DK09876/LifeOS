'use client';

/**
 * "Plan for…": pick a day for a task - or for one occurrence of a repeating
 * task - seeing what each day already holds.
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
import { planOccurrence, updateTaskData, useEnergySettings, useEvents, useHabits, useTasks } from '@/lib/hooks';
import { apOf, dayLoad } from '@/lib/capacity';
import { getTodayString, parseLocalDate, toDateString } from '@/lib/dates';
import { isHabitDueOn, recurrenceKind, upcomingOccurrences } from '@/lib/recurrence';
import type { Task } from '@/types';

const DAYS_SHOWN = 8;

export interface PlanTarget {
  task: Task;
  /** Set when planning a later occurrence rather than the task itself. */
  occurrence?: { due: string; windowStart: string; plannedDate: string | null; skipped: boolean };
}

export default function PlanSheet({ target, onClose }: { target: PlanTarget | null; onClose: () => void }) {
  const tasks = useTasks();
  const events = useEvents();
  const habits = useHabits();
  const energy = useEnergySettings();
  const { showToast } = useToast();
  const [custom, setCustom] = useState('');
  const today = getTodayString();

  // What each day already holds: the day's own tasks, events and habits, plus
  // any later occurrences of repeating tasks that have been planned onto it.
  // Unplanned occurrences take nothing.
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = toDateString(addDays(parseLocalDate(today), i));
    const due = habits.filter(h => isHabitDueOn(h, date));
    const load = dayLoad(tasks, events, energy.controls.defaultAP, date, { due, done: [] });
    const planned = tasks.flatMap(t => upcomingOccurrences(t, date, today))
      .filter(o => o.plannedDate === date && !o.skipped)
      .reduce((n, o) => n + apOf(o.task, energy.controls.defaultAP), 0);
    return { date, load: load.committed + planned, budget: energy.budgetFor(date) };
  }), [tasks, events, habits, energy, today]);

  if (!target) return null;
  const { task, occurrence } = target;
  const cost = apOf(task, energy.controls.defaultAP);
  const kind = recurrenceKind(task);
  const current = occurrence ? occurrence.plannedDate : task.plannedDate;
  // A daily or named-day occurrence belongs to its own day: it is planned
  // (or skipped) there, not moved - moving it would just double up another day.
  const fixedDay = occurrence && kind === 'lapsing' ? occurrence.due : null;
  const earliest = occurrence ? (occurrence.windowStart > today ? occurrence.windowStart : today) : today;

  async function plan(date: string | null) {
    try {
      if (occurrence) await planOccurrence(task.id, occurrence.due, { plannedDate: date });
      else await updateTaskData(task.id, { plannedDate: date });
      onClose();
    } catch {
      showToast('Could not plan that', 'error');
    }
  }

  async function skip(skipped: boolean) {
    if (!occurrence) return;
    try {
      await planOccurrence(task.id, occurrence.due, { plannedDate: null, skipped });
      onClose();
    } catch {
      showToast('Could not change that', 'error');
    }
  }

  const label = (date: string, i: number) =>
    i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(parseLocalDate(date), 'EEEE');
  const title = occurrence
    ? `Plan “${task.taskName}” — ${format(parseLocalDate(occurrence.due), 'EEE d MMM')}`
    : `Plan “${task.taskName}”`;
  const shown = days.filter(d => (fixedDay ? d.date === fixedDay : d.date >= earliest));

  return (
    <Modal isOpen={!!target} onClose={onClose} title={title} maxWidth="sm">
      <p className="text-xs text-[var(--muted)] mb-3">
        Costs {cost} AP{occurrence ? ' on the day it is planned' : ''}. Each day shows what it already holds against its budget.
        {occurrence && kind !== 'lapsing' && <> This one is due {format(parseLocalDate(occurrence.due), 'EEE d MMM')}.</>}
        {!occurrence && task.dueDate && <> Due {format(parseLocalDate(task.dueDate), 'EEE d MMM')}.</>}
      </p>

      {occurrence?.skipped ? (
        <p className="text-sm text-[var(--muted)] mb-3">This one is skipped.</p>
      ) : (
        <div className="space-y-1.5">
          {shown.length === 0 && fixedDay && (
            <p className="text-sm text-[var(--muted)]">{format(parseLocalDate(fixedDay), 'EEEE d MMM')} is more than a week out — plan it nearer the time.</p>
          )}
          {shown.map(({ date, load, budget }) => {
            const i = days.findIndex(d => d.date === date);
            const here = current === date;
            const after = here ? load : load + cost;
            const over = after > budget;
            const late = !occurrence && !!task.dueDate && date > task.dueDate || (!!occurrence && kind !== 'lapsing' && date > occurrence.due);
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
      )}

      {!fixedDay && !occurrence?.skipped && (
        <div className="flex gap-2 mt-3">
          <input type="date" value={custom} min={earliest} onChange={(e) => setCustom(e.target.value)}
                 aria-label="Another day"
                 className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-white" />
          <button onClick={() => custom && plan(custom)} disabled={!custom}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm">
            Plan
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {current && !occurrence?.skipped && (
          <button onClick={() => plan(null)} className="flex-1 py-2 text-sm text-[var(--muted)] hover:text-white rounded-lg bg-[var(--background)]">
            Unplan
          </button>
        )}
        {occurrence && (
          <button onClick={() => skip(!occurrence.skipped)}
                  className="flex-1 py-2 text-sm rounded-lg bg-[var(--background)] text-amber-300 hover:text-amber-200">
            {occurrence.skipped ? 'Unskip' : 'Skip this one'}
          </button>
        )}
      </div>
    </Modal>
  );
}

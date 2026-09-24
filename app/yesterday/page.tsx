'use client';

/**
 * Yesterday, as it should have been recorded.
 *
 * You will not always tick things off as you do them. This is the one place
 * to put yesterday right: anything marked here counts on *yesterday* - in the
 * energy history, the review, streaks, and for a recurring task, the date the
 * next one is counted from.
 */

import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';

import { useToast } from '@/components/Toast';
import {
  completionDaysOf, logProjectProgress, markEventDone, markHabitDone, markTaskDone, undoEventDone,
  undoHabitDone, undoTaskDone, updateTaskData, useEnergySettings, useEvents, useHabits, useProjects, useTasks,
} from '@/lib/hooks';
import { getTodayString, parseLocalDate, toDateString } from '@/lib/dates';
import { isHabitDueOn, previousEventDate } from '@/lib/recurrence';
import { loggedOn } from '@/lib/progress';
import { spentOn } from '@/lib/history';
import type { Event, Habit, Task } from '@/types';

export default function YesterdayPage() {
  const tasks = useTasks();
  const habits = useHabits();
  const events = useEvents();
  const projects = useProjects();
  const energy = useEnergySettings();
  const { showToast } = useToast();
  const [extraId, setExtraId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const today = getTodayString();
  const day = toDateString(addDays(parseLocalDate(today), -1));

  const doneOn = (task: Task) => completionDaysOf(task).includes(day);

  // What belonged to yesterday: planned or due then, or already recorded as done then.
  const dayTasks = useMemo(() => tasks.filter(t =>
    t.status !== 'Archived' && t.status !== 'Blocked' &&
    (t.plannedDate === day || t.dueDate === day || completionDaysOf(t).includes(day)),
  ).sort((a, b) => a.taskName.localeCompare(b.taskName)), [tasks, day]);

  // Anything else still open, for "I also did this yesterday".
  const otherOpen = useMemo(() => tasks.filter(t =>
    t.status !== 'Done' && t.status !== 'Archived' && !dayTasks.includes(t),
  ).sort((a, b) => a.taskName.localeCompare(b.taskName)), [tasks, dayTasks]);

  // Every active habit, with whether yesterday was one of its days.
  const dayHabits = useMemo(() => habits.filter(h => h.isActive).map(h => {
    const withoutDay = { ...h, completionDates: (h.completionDates || []).filter(d => d !== day) };
    return { habit: h, done: (h.completionDates || []).includes(day), due: isHabitDueOn(withoutDay, day) };
  }).sort((a, b) => Number(b.due) - Number(a.due) || a.habit.habitName.localeCompare(b.habit.habitName)), [habits, day]);

  // A recurring event has moved on to its next date; look one step back for yesterday's.
  const dayEvents = useMemo(() => events.filter(e =>
    e.date === day || (e.recurrence !== 'None' && e.date >= today && previousEventDate(e) === day),
  ), [events, day, today]);

  const targets = projects.filter(p => p.kind === 'target' && p.status === 'Active');

  const spent = spentOn(day, tasks, events, habits, energy.controls.defaultAP);
  const budget = energy.budgetFor(day);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    try { await action(); } catch { showToast('Could not save that', 'error'); } finally { setBusy(null); }
  }

  const toggleTask = (task: Task) => run(task.id, () =>
    doneOn(task) ? undoTaskDone(task.id, day) : markTaskDone(task.id, day));
  const toggleHabit = (habit: Habit, done: boolean) => run(habit.id, async () => {
    if (done) return undoHabitDone(habit.id, day);
    const reached = await markHabitDone(habit.id, day);
    for (const m of reached) showToast(`🏆 ${m.label}!`, 'success');
  });
  const toggleEvent = (event: Event) => run(event.id, () =>
    event.lastCompleted === day ? undoEventDone(event.id, day) : markEventDone(event.id, day));

  const Check = ({ on, label, onClick, pending }: { on: boolean; label: string; onClick: () => void; pending: boolean }) => (
    <button onClick={onClick} disabled={pending} aria-pressed={on} aria-label={label}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              on ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-[var(--muted)] hover:border-green-500'
            } ${pending ? 'opacity-50' : ''}`}>
      {on && <span className="text-xs">✓</span>}
    </button>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Yesterday</h1>
        <p className="text-[var(--muted)]">
          {format(parseLocalDate(day), 'EEEE, MMMM d')} — anything ticked here counts on that day
        </p>
      </div>

      <div className="bg-[var(--card-bg)] rounded-lg p-4 mb-6 flex items-center justify-between">
        <span className="text-sm text-[var(--muted)]">Recorded for yesterday</span>
        <span className={`text-sm font-medium ${spent.spent > budget ? 'text-red-400' : 'text-white'}`}>
          {spent.finished} done · {spent.spent} of {budget} AP
        </span>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-white mb-3">Tasks</h2>
        <div className="space-y-2">
          {dayTasks.length === 0 && (
            <p className="text-sm text-[var(--muted)] bg-[var(--card-bg)] rounded-lg p-4">Nothing was planned or due yesterday.</p>
          )}
          {dayTasks.map(task => (
            <div key={task.id} className="bg-[var(--card-bg)] rounded-lg p-3 flex items-center gap-3">
              <Check on={doneOn(task)} label={`${task.taskName} done yesterday`} onClick={() => toggleTask(task)} pending={busy === task.id} />
              <div className="flex-1 min-w-0">
                <p className={doneOn(task) ? 'text-[var(--muted)] line-through' : 'text-white'}>{task.taskName}</p>
                <p className="text-xs text-[var(--muted)]">
                  {task.plannedDate === day ? 'Planned' : task.dueDate === day ? 'Due' : 'Done'} yesterday
                  {task.recurrence !== 'None' && ` · ↻ ${task.recurrence}`}
                </p>
              </div>
              {/* Missed it, doing it today instead. Still a slip - the plan did
                  move - but one tap rather than a trip through Plan. */}
              {!doneOn(task) && task.status !== 'Done' && (
                <button onClick={() => run(task.id, () => updateTaskData(task.id, { plannedDate: today }))}
                        disabled={busy === task.id}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-medium">
                  Do it today
                </button>
              )}
            </div>
          ))}
        </div>

        {otherOpen.length > 0 && (
          <div className="mt-3 flex gap-2">
            <select value={extraId} onChange={(e) => setExtraId(e.target.value)}
                    aria-label="Another task done yesterday"
                    className="flex-1 min-w-0 bg-[var(--background)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-white">
              <option value="">I also did…</option>
              {otherOpen.map(t => <option key={t.id} value={t.id}>{t.taskName}</option>)}
            </select>
            <button disabled={!extraId || busy !== null}
                    onClick={() => run(extraId, async () => { await markTaskDone(extraId, day); setExtraId(''); })}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm">
              Mark done
            </button>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-white mb-3">Habits</h2>
        <div className="space-y-2">
          {dayHabits.map(({ habit, done, due }) => (
            <div key={habit.id} className={`bg-[var(--card-bg)] rounded-lg p-3 flex items-center gap-3 ${!due && !done ? 'opacity-60' : ''}`}>
              <Check on={done} label={`${habit.habitName} done yesterday`} onClick={() => toggleHabit(habit, done)} pending={busy === habit.id} />
              <span className="text-lg">{habit.icon || '🔄'}</span>
              <p className={`flex-1 ${done ? 'text-[var(--muted)] line-through' : 'text-white'}`}>{habit.habitName}</p>
              {!due && !done && <span className="text-xs text-[var(--muted)]">not due</span>}
            </div>
          ))}
        </div>
      </section>

      {dayEvents.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-medium text-white mb-3">Events</h2>
          <div className="space-y-2">
            {dayEvents.map(event => (
              <div key={event.id} className="bg-[var(--card-bg)] rounded-lg p-3 flex items-center gap-3">
                <Check on={event.lastCompleted === day} label={`${event.eventName} attended yesterday`} onClick={() => toggleEvent(event)} pending={busy === event.id} />
                <p className="flex-1 text-indigo-300">{event.eventName}</p>
                {event.time && <span className="text-xs text-[var(--muted)]">{event.time}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {targets.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-medium text-white mb-3">Goals</h2>
          <div className="space-y-2">
            {targets.map(project => (
              <TargetRow key={project.id} name={`${project.icon || '🎯'} ${project.name}`}
                         unit={project.targetUnit || 'done'} logged={loggedOn(project.progressLog, day)}
                         onLog={(n) => run(project.id, () => logProjectProgress(project.id, n, undefined, day))} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TargetRow({ name, unit, logged, onLog }: { name: string; unit: string; logged: number; onLog: (n: number) => void }) {
  const [amount, setAmount] = useState(1);
  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-3 flex flex-wrap items-center gap-2">
      <p className="flex-1 min-w-[8rem] text-white">{name}</p>
      <span className="text-xs text-[var(--muted)]">{logged} {unit} logged yesterday</span>
      <input type="number" min={1} value={amount} aria-label={`Amount of ${unit}`}
             onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
             className="w-16 px-2 py-1 bg-[var(--background)] border border-[var(--border-color)] rounded text-sm text-center text-white" />
      <button onClick={() => onLog(amount)} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
        + Log
      </button>
    </div>
  );
}

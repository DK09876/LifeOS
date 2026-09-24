'use client';

import { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, isToday, addWeeks } from 'date-fns';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import { useToast } from '@/components/Toast';
import { useTasks, useDomains, useProjects, useEvents, markTaskDone, createTask, updateTaskData, deleteTask } from '@/lib/hooks';
import { Task } from '@/types';
import { getPriorityDotColor, levelRank } from '@/lib/colors';
import { tasksForDay } from '@/lib/schedule';
import { projectOccurrences } from '@/lib/recurrence';
import { getTodayString } from '@/lib/dates';
import { Event } from '@/types';

export default function WeekPage() {
  const tasks = useTasks();
  const domains = useDomains();
  const projects = useProjects();
  const events = useEvents();
  const [weekOffset, setWeekOffset] = useState(0);

  // Task CRUD modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPastDays, setShowPastDays] = useState(false);

  // Calculate current week
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return weekOffset === 0 ? start : addWeeks(start, weekOffset);
  }, [weekOffset]);

  // Get days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Filter tasks by week
  const weekTasks = useMemo(() => {
    return weekDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      // Planned work shows on its planned day; an unplanned deadline shows
      // on its due day. One task, one square - see lib/schedule.
      return {
        date: day,
        tasks: tasksForDay(tasks, dayStr, true).sort((a, b) => {
          // Committed work first, then deadlines still to be placed, then
          // what is already finished - done work is context, not a call to act.
          const rank = { planned: 0, due: 1, done: 2 } as const;
          if (a.kind !== b.kind) return rank[a.kind] - rank[b.kind];
          return levelRank(a.task.taskPriority) - levelRank(b.task.taskPriority);
        })
      };
    });
  }, [tasks, weekDays]);

  // Recurring tasks beyond the one occurrence that exists as a row: later
  // ones ahead (faint), and earlier completions behind (from the completion
  // log, since the row itself has moved on). The Week is a record, so both.
  const recurringByDay = useMemo(() => {
    const map = new Map<string, Array<{ task: Task; kind: 'ahead' | 'done' }>>();
    const from = format(weekDays[0], 'yyyy-MM-dd');
    const to = format(weekDays[6], 'yyyy-MM-dd');
    const today = getTodayString();
    const add = (day: string, task: Task, kind: 'ahead' | 'done') =>
      map.set(day, [...(map.get(day) ?? []), { task, kind }]);
    for (const task of tasks) {
      if (task.recurrence === 'None') continue;
      for (const day of projectOccurrences(task, from, to, today)) if (day >= today) add(day, task, 'ahead');
      for (const day of task.completions ?? []) {
        if (day < from || day > to) continue;
        // Skip the day it is already drawn on as a finished row.
        if (task.status === 'Done' && tasksForDay([task], day, true).length) continue;
        add(day, task, 'done');
      }
    }
    return map;
  }, [tasks, weekDays]);

  const { showToast } = useToast();

  // Task handlers
  async function handleMarkDone(taskId: string) {
    try {
      await markTaskDone(taskId);
    } catch { showToast('Failed to complete task', 'error'); }
  }

  function handleOpenCreateTask(date?: Date) {
    setEditingTask(null);
    setSelectedDate(date || null);
    setIsTaskModalOpen(true);
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setSelectedDate(null);
    setIsTaskModalOpen(true);
  }

  async function handleTaskSubmit(data: TaskFormData) {
    try {
      const taskData = selectedDate && !data.plannedDate
        ? { ...data, plannedDate: format(selectedDate, 'yyyy-MM-dd') }
        : data;

      if (editingTask) {
        await updateTaskData(editingTask.id, taskData);
      } else {
        await createTask(taskData);
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      setSelectedDate(null);
    } catch { showToast('Failed to save task', 'error'); }
  }

  async function handleConfirmDeleteTask() {
    try {
      if (taskToDelete) {
        await deleteTask(taskToDelete);
        setTaskToDelete(null);
      }
    } catch { showToast('Failed to delete task', 'error'); }
  }

  const totalTasks = weekTasks.reduce((sum, day) => sum + day.tasks.length, 0);
  const count = (kind: 'planned' | 'due' | 'done') =>
    weekTasks.reduce((sum, day) => sum + day.tasks.filter(t => t.kind === kind).length, 0);
  const plannedCount = count('planned');
  const dueCount = count('due');
  const doneCount = count('done');

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Week</h1>
          <p className="text-[var(--muted)]">
            {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-2 hover:bg-[var(--card-bg)] rounded text-[var(--muted)] hover:text-white"
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 bg-[var(--card-bg)] hover:bg-[var(--card-hover)] rounded text-sm text-white"
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-2 hover:bg-[var(--card-bg)] rounded text-[var(--muted)] hover:text-white"
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-[var(--card-bg)] rounded-lg p-4 mb-6">
        <p className="text-[var(--muted)] text-sm">
          <span className="text-white font-semibold">{totalTasks}</span> tasks this week
          {totalTasks > 0 && (
            <span className="text-[var(--muted)]">
              {' — '}{plannedCount} planned, {dueCount} due{doneCount > 0 && `, ${doneCount} done`}
            </span>
          )}
        </p>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {weekOffset === 0 && (
          <button onClick={() => setShowPastDays(v => !v)} className="md:hidden text-left text-xs text-[var(--muted)] px-1 py-1">
            {showPastDays ? '▲ Hide earlier days' : '▼ Show earlier days this week'}
          </button>
        )}
        {weekTasks.map(({ date, tasks: dayTasks }) => (
          // On a phone this week starts at today; earlier days are one tap away.
          <div key={date.toISOString()}
               className={`md:min-h-[300px] ${weekOffset === 0 && !showPastDays && format(date, 'yyyy-MM-dd') < getTodayString() ? 'hidden md:block' : ''}`}>
            {/* Day Header */}
            <div className={`p-2 rounded-t-lg flex md:block items-baseline gap-2 px-3 md:px-2 text-left md:text-center ${isToday(date) ? 'bg-blue-600' : 'bg-[var(--card-bg)]'}`}>
              <p className={`text-xs ${isToday(date) ? 'text-blue-200' : 'text-[var(--muted)]'}`}>
                {format(date, 'EEE')}
              </p>
              <p className="text-lg font-semibold text-white">
                {format(date, 'd')}
              </p>
            </div>

            {/* Day Tasks */}
            <div className="group bg-[var(--card-bg)] rounded-b-lg p-2 space-y-2 md:min-h-[250px]">
              {/* Events for this day */}
              {events.filter(e => e.date === format(date, 'yyyy-MM-dd')).map(event => (
                <div
                  key={event.id}
                  className="bg-indigo-500/10 rounded p-2 border-l-2 border-indigo-500 hover:bg-indigo-500/20 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-indigo-400 mt-0.5">🕐</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-indigo-300 text-sm line-clamp-2">{event.eventName}</p>
                      {event.time && (
                        <span className="text-xs text-indigo-400/70">{event.time}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {dayTasks.map(({ task, kind }) => (
                <div
                  key={task.id}
                  // A due-but-unplanned task is a deadline, not a commitment:
                  // dashed and dimmed so a glance separates the two.
                  className={`rounded p-2 group cursor-pointer transition-colors hover:bg-[var(--card-hover)] ${
                    kind === 'due'
                      ? 'bg-transparent border border-dashed border-amber-500/50'
                      : kind === 'done'
                        ? 'bg-[var(--background)]/40 opacity-50'
                        : 'bg-[var(--background)]'
                  }`}
                  onClick={() => handleEditTask(task)}
                >
                  <div className="flex items-start gap-2">
                    {kind === 'done' ? (
                      <span
                        className="w-4 h-4 mt-0.5 rounded-full border border-green-600/60 flex items-center justify-center flex-shrink-0 text-green-500 text-[10px]"
                        aria-label={`"${task.taskName}" is done`}
                      >
                        ✓
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkDone(task.id); }}
                        className="w-4 h-4 mt-0.5 rounded-full border border-[var(--muted)] hover:border-green-500 flex items-center justify-center flex-shrink-0"
                        aria-label={`Mark "${task.taskName}" as done`}
                      >
                        <span className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-green-500 text-[10px]">✓</span>
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm line-clamp-2 ${kind === 'done' ? 'text-[var(--muted)] line-through' : 'text-white'}`}>{task.taskName}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`w-2 h-2 rounded-full ${getPriorityDotColor(task.taskPriority)}`}></span>
                        {kind === 'due' && (
                          <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-400">due</span>
                        )}
                        {task.domain?.icon && (
                          <span className="text-xs">{task.domain.icon}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {(recurringByDay.get(format(date, 'yyyy-MM-dd')) ?? []).map(({ task, kind }) => (
                <div
                  key={`${kind}-${task.id}`}
                  onClick={() => handleEditTask(task)}
                  title={kind === 'ahead' ? 'A later occurrence of a recurring task' : 'Done that day'}
                  className={`rounded p-2 cursor-pointer text-sm ${
                    kind === 'ahead'
                      ? 'border border-dotted border-cyan-500/40 opacity-60 text-cyan-200'
                      : 'bg-[var(--background)]/40 opacity-50 text-[var(--muted)] line-through'
                  }`}
                >
                  {kind === 'done' ? '✓ ' : '↻ '}{task.taskName}
                </div>
              ))}

              {/* Add task button */}
              <button
                onClick={() => handleOpenCreateTask(date)}
                className="w-full p-2 text-[var(--muted)] hover:text-white hover:bg-[var(--background)] rounded text-sm text-left opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label={`Add task for ${format(date, 'EEEE, MMM d')}`}
              >
                + Add
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); setSelectedDate(null); }}
        title={editingTask ? 'Edit Task' : 'Create Task'}
        maxWidth="lg"
      >
        <TaskForm
          task={editingTask}
          domains={domains}
          allTasks={tasks}
          projects={projects}
          onSubmit={handleTaskSubmit}
          onCancel={() => { setIsTaskModalOpen(false); setEditingTask(null); setSelectedDate(null); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={taskToDelete !== null}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

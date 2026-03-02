'use client';

import { useState, useMemo } from 'react';
import { isToday } from 'date-fns';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import HabitForm, { HabitFormData } from '@/components/HabitForm';
import EventForm, { EventFormData } from '@/components/EventForm';
import HabitCard from '@/components/HabitCard';
import { useToast } from '@/components/Toast';
import { useTasks, useDomains, useProjects, useHabitsDueToday, useHabitsCompletedToday, useEventsToday, useEventsCompletedToday, markTaskDone, undoTaskDone, createTask, updateTaskData, deleteTask, markHabitDone, undoHabitDone, createHabit, updateHabitData, deleteHabit, createEvent, updateEventData, deleteEvent, markEventDone, undoEventDone } from '@/lib/hooks';
import { Task, Habit, Event } from '@/types';
import { getTodayString } from '@/lib/dates';
import { getTaskPriorityBorder } from '@/lib/colors';
import { parseLocalDate } from '@/lib/dates';

export default function TodayPage() {
  const tasks = useTasks();
  const domains = useDomains();
  const projects = useProjects();
  const habitsDueToday = useHabitsDueToday();
  const habitsCompletedToday = useHabitsCompletedToday();
  const eventsToday = useEventsToday();
  const eventsCompletedToday = useEventsCompletedToday();
  const { showToast } = useToast();

  // Task CRUD modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Habit CRUD modals
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);

  // Event CRUD modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Filter tasks for today
  const todayTasks = useMemo(() => {
    const todayStr = getTodayString();
    return tasks.filter(t => {
      if (t.status === 'Done' || t.status === 'Archived') return false;
      // Use string comparison to avoid timezone issues
      if (t.plannedDate === todayStr) return true;
      if (t.dueDate === todayStr) return true;
      return false;
    }).sort((a, b) => {
      // Sort by priority (1 = highest)
      const priorityA = parseInt(a.taskPriority[0]) || 3;
      const priorityB = parseInt(b.taskPriority[0]) || 3;
      return priorityA - priorityB;
    });
  }, [tasks]);

  // Completed today
  const completedToday = useMemo(() => {
    return tasks.filter(t => {
      if (t.status !== 'Done' || !t.doneDate) return false;
      return isToday(new Date(t.doneDate));
    });
  }, [tasks]);

  // Task handlers
  async function handleMarkDone(taskId: string) {
    try {
      await markTaskDone(taskId);
    } catch { showToast('Failed to complete task', 'error'); }
  }

  function handleOpenCreateTask() {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  }

  async function handleTaskSubmit(data: TaskFormData) {
    try {
      if (editingTask) {
        await updateTaskData(editingTask.id, data);
      } else {
        await createTask({ ...data, plannedDate: data.plannedDate || getTodayString() });
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
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

  // Habit handlers
  async function handleMarkHabitDone(habitId: string) {
    try {
      await markHabitDone(habitId);
    } catch { showToast('Failed to complete habit', 'error'); }
  }

  async function handleUndoHabitDone(habitId: string) {
    try {
      await undoHabitDone(habitId);
    } catch { showToast('Failed to undo habit', 'error'); }
  }

  async function handleUndoTaskDone(taskId: string) {
    try {
      await undoTaskDone(taskId);
    } catch { showToast('Failed to undo task', 'error'); }
  }

  function handleEditHabit(habit: Habit) {
    setEditingHabit(habit);
    setIsHabitModalOpen(true);
  }

  async function handleHabitSubmit(data: HabitFormData) {
    try {
      if (editingHabit) {
        await updateHabitData(editingHabit.id, data);
      } else {
        await createHabit(data);
      }
      setIsHabitModalOpen(false);
      setEditingHabit(null);
    } catch { showToast('Failed to save habit', 'error'); }
  }

  async function handleConfirmDeleteHabit() {
    try {
      if (habitToDelete) {
        await deleteHabit(habitToDelete);
        setHabitToDelete(null);
      }
    } catch { showToast('Failed to delete habit', 'error'); }
  }

  // Event handlers
  async function handleMarkEventDone(eventId: string) {
    try {
      await markEventDone(eventId);
    } catch { showToast('Failed to complete event', 'error'); }
  }

  async function handleUndoEventDone(eventId: string) {
    try {
      await undoEventDone(eventId);
    } catch { showToast('Failed to undo event', 'error'); }
  }

  function handleEditEvent(event: Event) {
    setEditingEvent(event);
    setIsEventModalOpen(true);
  }

  async function handleEventSubmit(data: EventFormData) {
    try {
      if (editingEvent) {
        await updateEventData(editingEvent.id, data);
      } else {
        await createEvent({ ...data, date: data.date || getTodayString() });
      }
      setIsEventModalOpen(false);
      setEditingEvent(null);
    } catch { showToast('Failed to save event', 'error'); }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Today</h1>
        <p className="text-[var(--muted)]">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--card-bg)] rounded-lg p-4">
          <p className="text-2xl font-semibold text-white">{habitsDueToday.length + todayTasks.length}</p>
          <p className="text-[var(--muted)] text-sm">To do ({habitsDueToday.length} habits + {todayTasks.length} tasks)</p>
        </div>
        <div className="bg-[var(--card-bg)] rounded-lg p-4">
          <p className="text-2xl font-semibold text-green-400">{habitsCompletedToday.length + completedToday.length}</p>
          <p className="text-[var(--muted)] text-sm">Completed ({habitsCompletedToday.length} habits + {completedToday.length} tasks)</p>
        </div>
        <div className="bg-[var(--card-bg)] rounded-lg p-4">
          <p className="text-2xl font-semibold text-white">{todayTasks.filter(t => t.taskPriority.startsWith('1') || t.taskPriority.startsWith('2')).length}</p>
          <p className="text-[var(--muted)] text-sm">High priority</p>
        </div>
      </div>

      {/* Habits Section (only shows if habits are due) */}
      {habitsDueToday.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Habits</h2>
          </div>
          <div className="space-y-2">
            {habitsDueToday.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                isDue={true}
                compact={true}
                onMarkDone={handleMarkHabitDone}
                onEdit={handleEditHabit}
              />
            ))}
          </div>
        </div>
      )}

      {/* Events Section */}
      {eventsToday.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Events</h2>
          </div>
          <div className="space-y-2">
            {eventsToday.map(event => (
              <div
                key={event.id}
                className="bg-[var(--card-bg)] rounded-lg border-l-4 border-indigo-500 bg-indigo-500/5 p-4 flex items-start gap-4 group hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                onClick={() => handleEditEvent(event)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleMarkEventDone(event.id); }}
                  className="w-5 h-5 mt-0.5 rounded-full border-2 border-indigo-400 hover:border-indigo-300 hover:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 transition-colors"
                  aria-label={`Mark "${event.eventName}" as done`}
                >
                  <span className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-indigo-300 text-xs">✓</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-indigo-300 font-medium">{event.eventName}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-[var(--muted)]">
                    {event.time && (
                      <span className="flex items-center gap-1">
                        <span>Time:</span>
                        <span>{new Date(`2000-01-01T${event.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      </span>
                    )}
                    {event.duration && (
                      <span className="flex items-center gap-1">
                        <span>Duration:</span>
                        <span>{event.duration}min</span>
                      </span>
                    )}
                    {event.domain && (
                      <span className="flex items-center gap-1">
                        <span>{event.domain.icon || '📁'}</span>
                        <span>{event.domain.name}</span>
                      </span>
                    )}
                    {event.actionPoints && <span>AP: {event.actionPoints}</span>}
                    {event.recurrence !== 'None' && (
                      <span className="text-indigo-400">{event.recurrence}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">Tasks</h2>
          <button
            onClick={handleOpenCreateTask}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            + Add Task
          </button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="bg-[var(--card-bg)] rounded-lg p-8 text-center">
            <p className="text-[var(--muted)] mb-4">No tasks planned for today</p>
            <button
              onClick={handleOpenCreateTask}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              + Add a task
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map(task => (
              <div
                key={task.id}
                className={`bg-[var(--card-bg)] rounded-lg border-l-4 ${getTaskPriorityBorder(task.taskPriority)} p-4 flex items-start gap-4 group hover:bg-[var(--card-hover)] cursor-pointer transition-colors`}
                onClick={() => handleEditTask(task)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleMarkDone(task.id); }}
                  className="w-5 h-5 mt-0.5 rounded-full border-2 border-[var(--muted)] hover:border-green-500 hover:bg-green-500/20 flex items-center justify-center flex-shrink-0 transition-colors"
                  aria-label={`Mark "${task.taskName}" as done`}
                >
                  <span className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-green-500 text-xs">✓</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{task.taskName}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-[var(--muted)]">
                    {task.domain && (
                      <span className="flex items-center gap-1">
                        <span>{task.domain.icon || '📁'}</span>
                        <span>{task.domain.name}</span>
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <span>📅</span>
                        <span>Due {parseLocalDate(task.dueDate).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setTaskToDelete(task.id); }}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-red-400 hover:text-red-300 p-1 transition-opacity"
                  aria-label={`Delete "${task.taskName}"`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Today */}
      {(completedToday.length > 0 || habitsCompletedToday.length > 0 || eventsCompletedToday.length > 0) && (
        <div>
          <h2 className="text-lg font-medium text-[var(--muted)] mb-4">Completed Today</h2>
          <div className="space-y-2">
            {/* Completed Habits */}
            {habitsCompletedToday.map(habit => (
              <div
                key={habit.id}
                className="bg-[var(--card-bg)] rounded-lg p-4 flex items-center gap-4 opacity-60 group hover:opacity-80 transition-opacity"
              >
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-500 text-xs">✓</span>
                </div>
                <span className="text-xl flex-shrink-0">{habit.icon || '🔄'}</span>
                <p className="text-[var(--muted)] line-through flex-1">{habit.habitName}</p>
                <button
                  onClick={() => handleUndoHabitDone(habit.id)}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--muted)] hover:text-white text-sm px-2 py-1 rounded hover:bg-[var(--card-hover)] transition-all"
                  aria-label={`Undo completion of "${habit.habitName}"`}
                >
                  Undo
                </button>
              </div>
            ))}
            {/* Completed Events */}
            {eventsCompletedToday.map(event => (
              <div
                key={event.id}
                className="bg-[var(--card-bg)] rounded-lg p-4 flex items-center gap-4 opacity-60 group hover:opacity-80 transition-opacity"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-400 text-xs">✓</span>
                </div>
                <p className="text-[var(--muted)] line-through flex-1">{event.eventName}</p>
                <button
                  onClick={() => handleUndoEventDone(event.id)}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--muted)] hover:text-white text-sm px-2 py-1 rounded hover:bg-[var(--card-hover)] transition-all"
                  aria-label={`Undo completion of "${event.eventName}"`}
                >
                  Undo
                </button>
              </div>
            ))}
            {/* Completed Tasks */}
            {completedToday.map(task => (
              <div
                key={task.id}
                className="bg-[var(--card-bg)] rounded-lg p-4 flex items-center gap-4 opacity-60 group hover:opacity-80 transition-opacity"
              >
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-500 text-xs">✓</span>
                </div>
                <p className="text-[var(--muted)] line-through flex-1">{task.taskName}</p>
                <button
                  onClick={() => handleUndoTaskDone(task.id)}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--muted)] hover:text-white text-sm px-2 py-1 rounded hover:bg-[var(--card-hover)] transition-all"
                  aria-label={`Undo completion of "${task.taskName}"`}
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        title={editingTask ? 'Edit Task' : 'Create Task'}
        maxWidth="lg"
      >
        <TaskForm
          task={editingTask}
          domains={domains}
          allTasks={tasks}
          projects={projects}
          onSubmit={handleTaskSubmit}
          onCancel={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
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

      {/* Habit Modals */}
      <Modal
        isOpen={isHabitModalOpen}
        onClose={() => { setIsHabitModalOpen(false); setEditingHabit(null); }}
        title={editingHabit ? 'Edit Habit' : 'Create Habit'}
        maxWidth="lg"
      >
        <HabitForm
          key={editingHabit?.id ?? 'new'}
          habit={editingHabit}
          onSubmit={handleHabitSubmit}
          onCancel={() => { setIsHabitModalOpen(false); setEditingHabit(null); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={habitToDelete !== null}
        onClose={() => setHabitToDelete(null)}
        onConfirm={handleConfirmDeleteHabit}
        title="Delete Habit"
        message="Are you sure you want to delete this habit?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Event Modal */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
        maxWidth="lg"
      >
        <EventForm
          key={editingEvent?.id ?? 'new'}
          event={editingEvent}
          domains={domains}
          onSubmit={handleEventSubmit}
          onCancel={() => { setIsEventModalOpen(false); setEditingEvent(null); }}
        />
      </Modal>
    </div>
  );
}

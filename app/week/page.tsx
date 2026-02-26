'use client';

import { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, isToday, addWeeks } from 'date-fns';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import { useToast } from '@/components/Toast';
import { useTasks, useDomains, markTaskDone, createTask, updateTaskData, deleteTask } from '@/lib/hooks';
import { Task } from '@/types';
import { getPriorityDotColor } from '@/lib/colors';

export default function WeekPage() {
  const tasks = useTasks();
  const domains = useDomains();
  const [weekOffset, setWeekOffset] = useState(0);

  // Task CRUD modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
      return {
        date: day,
        tasks: tasks.filter(t => {
          if (t.status === 'Done' || t.status === 'Archived') return false;
          // Compare date strings directly to avoid timezone issues
          if (t.plannedDate === dayStr) return true;
          if (t.dueDate === dayStr) return true;
          return false;
        }).sort((a, b) => {
          const priorityA = parseInt(a.taskPriority[0]) || 3;
          const priorityB = parseInt(b.taskPriority[0]) || 3;
          return priorityA - priorityB;
        })
      };
    });
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
          <span className="text-white font-semibold">{totalTasks}</span> tasks planned this week
        </p>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekTasks.map(({ date, tasks: dayTasks }) => (
          <div key={date.toISOString()} className="min-h-[300px]">
            {/* Day Header */}
            <div className={`p-2 rounded-t-lg text-center ${isToday(date) ? 'bg-blue-600' : 'bg-[var(--card-bg)]'}`}>
              <p className={`text-xs ${isToday(date) ? 'text-blue-200' : 'text-[var(--muted)]'}`}>
                {format(date, 'EEE')}
              </p>
              <p className={`text-lg font-semibold ${isToday(date) ? 'text-white' : 'text-white'}`}>
                {format(date, 'd')}
              </p>
            </div>

            {/* Day Tasks */}
            <div className="bg-[var(--card-bg)] rounded-b-lg p-2 space-y-2 min-h-[250px]">
              {dayTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-[var(--background)] rounded p-2 group hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                  onClick={() => handleEditTask(task)}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkDone(task.id); }}
                      className="w-4 h-4 mt-0.5 rounded-full border border-[var(--muted)] hover:border-green-500 flex items-center justify-center flex-shrink-0"
                      aria-label={`Mark "${task.taskName}" as done`}
                    >
                      <span className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-green-500 text-[10px]">✓</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm line-clamp-2">{task.taskName}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`w-2 h-2 rounded-full ${getPriorityDotColor(task.taskPriority)}`}></span>
                        {task.domain?.icon && (
                          <span className="text-xs">{task.domain.icon}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add task button */}
              <button
                onClick={() => handleOpenCreateTask(date)}
                className="w-full p-2 text-[var(--muted)] hover:text-white hover:bg-[var(--background)] rounded text-sm text-left opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
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

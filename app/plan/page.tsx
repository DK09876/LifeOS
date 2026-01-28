'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import Modal from '@/components/Modal';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import { useTasks, useDomains, markTaskDone, resetTask, createTask, updateTaskData } from '@/lib/hooks';
import { Task } from '@/types';

type TriageTab = 'needsDetails' | 'blocked' | 'needsReset';
type APTab = 'low' | 'med' | 'high' | 'all';

export default function PlanPage() {
  const tasks = useTasks();
  const domains = useDomains();

  const [triageTab, setTriageTab] = useState<TriageTab>('needsDetails');
  const [apTab, setApTab] = useState<APTab>('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Triage tasks
  const triageTasks = useMemo(() => {
    return {
      needsDetails: tasks.filter(t => t.status === 'Needs Details'),
      blocked: tasks.filter(t => t.status === 'Blocked'),
      needsReset: tasks.filter(t => t.needsReset),
    };
  }, [tasks]);

  // Plan for week tasks (active, sorted by score)
  const planTasks = useMemo(() => {
    const active = tasks
      .filter(t => t.status !== 'Done' && t.status !== 'Archived' && t.status !== 'Needs Details' && t.status !== 'Blocked')
      .sort((a, b) => b.taskScore - a.taskScore);

    if (apTab === 'all') return active;

    return active.filter(t => {
      const ap = parseInt(t.actionPoints || '0') || 0;
      if (apTab === 'low') return ap <= 2;
      if (apTab === 'med') return ap >= 3 && ap <= 4;
      if (apTab === 'high') return ap >= 5;
      return true;
    });
  }, [tasks, apTab]);

  // Stats
  const stats = useMemo(() => ({
    needsAttention: triageTasks.needsDetails.length + triageTasks.blocked.length + triageTasks.needsReset.length,
    activeTasks: tasks.filter(t => t.status === 'Backlog').length,
    highPriority: tasks.filter(t => t.taskPriority.startsWith('1') || t.taskPriority.startsWith('2')).filter(t => t.status !== 'Done' && t.status !== 'Archived').length,
  }), [tasks, triageTasks]);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  async function handleTaskSubmit(data: TaskFormData) {
    if (editingTask) {
      await updateTaskData(editingTask.id, data);
    } else {
      await createTask(data);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  }

  async function handleMarkDone(taskId: string) {
    await markTaskDone(taskId);
  }

  async function handleResetTask(taskId: string) {
    await resetTask(taskId);
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '1 - Urgent': return 'bg-red-500/20 text-red-400';
      case '2 - High': return 'bg-orange-500/20 text-orange-400';
      case '3 - Normal': return 'bg-blue-500/20 text-blue-400';
      case '4 - Low': return 'bg-gray-500/20 text-gray-400';
      case '5 - Optional': return 'bg-gray-600/20 text-gray-500';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Plan</h1>
        <p className="text-[var(--muted)]">Triage, prioritize, and schedule your tasks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--card-bg)] rounded-lg p-4">
          <p className="text-2xl font-semibold text-yellow-400">{stats.needsAttention}</p>
          <p className="text-[var(--muted)] text-sm">Needs attention</p>
        </div>
        <div className="bg-[var(--card-bg)] rounded-lg p-4">
          <p className="text-2xl font-semibold text-white">{stats.activeTasks}</p>
          <p className="text-[var(--muted)] text-sm">In backlog</p>
        </div>
        <div className="bg-[var(--card-bg)] rounded-lg p-4">
          <p className="text-2xl font-semibold text-red-400">{stats.highPriority}</p>
          <p className="text-[var(--muted)] text-sm">High priority</p>
        </div>
      </div>

      {/* Section 1: Triage Tasks */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-white mb-4">Triage</h2>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { key: 'needsDetails' as const, label: 'Needs Details', count: triageTasks.needsDetails.length },
            { key: 'blocked' as const, label: 'Blocked', count: triageTasks.blocked.length },
            { key: 'needsReset' as const, label: 'Needs Reset', count: triageTasks.needsReset.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setTriageTab(tab.key)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                triageTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--card-bg)] text-[var(--muted)] hover:text-white'
              }`}
            >
              {tab.label} <span className="opacity-75">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Triage List */}
        <div className="bg-[var(--card-bg)] rounded-lg">
          {triageTasks[triageTab].length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)]">
              No tasks in this category
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {triageTasks[triageTab].map(task => (
                <div
                  key={task.id}
                  className="p-4 flex items-center justify-between hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                  onClick={() => handleEditTask(task)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white">{task.taskName}</span>
                    {task.domain && (
                      <span className="text-xs text-[var(--muted)]">
                        {task.domain.icon} {task.domain.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.taskPriority)}`}>
                      {task.taskPriority.split(' - ')[1]}
                    </span>
                    {triageTab === 'needsReset' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResetTask(task.id); }}
                        className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Plan for the Week */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">Backlog</h2>
          <button
            onClick={handleOpenCreateTask}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            + Add Task
          </button>
        </div>

        {/* AP Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { key: 'all' as const, label: 'All' },
            { key: 'low' as const, label: 'Low AP (1-2)' },
            { key: 'med' as const, label: 'Med AP (3-4)' },
            { key: 'high' as const, label: 'High AP (5+)' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setApTab(tab.key)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                apTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--card-bg)] text-[var(--muted)] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[var(--card-bg)] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Task</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Planned</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-20">AP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-20">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {planTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                    No tasks in backlog
                  </td>
                </tr>
              ) : (
                planTasks.map(task => (
                  <tr
                    key={task.id}
                    className="hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                    onClick={() => handleEditTask(task)}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkDone(task.id); }}
                        className="w-4 h-4 rounded border border-[var(--muted)] hover:border-green-500 flex items-center justify-center"
                      >
                        <span className="opacity-0 hover:opacity-100 text-green-500 text-xs">✓</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{task.taskName}</span>
                        {task.domain?.icon && (
                          <span className="text-xs">{task.domain.icon}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {task.plannedDate ? format(new Date(task.plannedDate), 'MMM d') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {task.actionPoints ? (
                        <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">
                          {task.actionPoints}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.taskPriority)}`}>
                        {task.taskPriority.split(' - ')[1]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {task.taskScore}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        title={editingTask ? 'Edit Task' : 'Create Task'}
        maxWidth="lg"
      >
        <TaskForm
          task={editingTask}
          domains={domains}
          onSubmit={handleTaskSubmit}
          onCancel={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        />
      </Modal>
    </div>
  );
}

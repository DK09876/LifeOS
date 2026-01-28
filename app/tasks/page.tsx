'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import { useTasks, useDomains, createTask, updateTaskData, deleteTask } from '@/lib/hooks';
import { Task } from '@/types';

type SortField = 'taskName' | 'status' | 'taskPriority' | 'dueDate' | 'plannedDate' | 'domain' | 'taskScore';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'Needs Details' | 'Backlog' | 'Planned' | 'Blocked' | 'Done' | 'Archived';

export default function TasksPage() {
  const tasks = useTasks();
  const domains = useDomains();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('taskScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.taskName.toLowerCase().includes(query) ||
        t.notes.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Domain filter
    if (domainFilter !== 'all') {
      result = result.filter(t => t.domainId === domainFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'taskName':
          comparison = a.taskName.localeCompare(b.taskName);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'taskPriority':
          comparison = a.taskPriority.localeCompare(b.taskPriority);
          break;
        case 'dueDate':
          comparison = (a.dueDate || '').localeCompare(b.dueDate || '');
          break;
        case 'plannedDate':
          comparison = (a.plannedDate || '').localeCompare(b.plannedDate || '');
          break;
        case 'domain':
          comparison = (a.domain?.name || '').localeCompare(b.domain?.name || '');
          break;
        case 'taskScore':
          comparison = a.taskScore - b.taskScore;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tasks, searchQuery, statusFilter, domainFilter, sortField, sortDirection]);

  // Handlers
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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
    if (editingTask) {
      await updateTaskData(editingTask.id, data);
    } else {
      await createTask(data);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  }

  async function handleConfirmDeleteTask() {
    if (taskToDelete) {
      await deleteTask(taskToDelete);
      setTaskToDelete(null);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done': return 'bg-green-500/20 text-green-400';
      case 'Blocked': return 'bg-gray-500/20 text-gray-400';
      case 'Needs Details': return 'bg-yellow-500/20 text-yellow-400';
      case 'Backlog': return 'bg-blue-500/20 text-blue-400';
      case 'Planned': return 'bg-purple-500/20 text-purple-400';
      case 'Archived': return 'bg-gray-600/20 text-gray-500';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="opacity-30">↕</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Tasks</h1>
          <p className="text-[var(--muted)]">{filteredTasks.length} of {tasks.length} tasks</p>
        </div>
        <button
          onClick={handleOpenCreateTask}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white placeholder-[var(--muted)] focus:outline-none focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="Needs Details">Needs Details</option>
          <option value="Backlog">Backlog</option>
          <option value="Planned">Planned</option>
          <option value="Blocked">Blocked</option>
          <option value="Done">Done</option>
          <option value="Archived">Archived</option>
        </select>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Domains</option>
          {domains.map(d => (
            <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--card-bg)] rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('taskName')}
              >
                Task <SortIcon field="taskName" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-28"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-28"
                onClick={() => handleSort('taskPriority')}
              >
                Priority <SortIcon field="taskPriority" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-24"
                onClick={() => handleSort('dueDate')}
              >
                Due <SortIcon field="dueDate" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-24"
                onClick={() => handleSort('plannedDate')}
              >
                Planned <SortIcon field="plannedDate" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-32"
                onClick={() => handleSort('domain')}
              >
                Domain <SortIcon field="domain" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-20">
                AP
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">
                Recurrence
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-20"
                onClick={() => handleSort('taskScore')}
              >
                Score <SortIcon field="taskScore" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-16">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[var(--muted)]">
                  No tasks found
                </td>
              </tr>
            ) : (
              filteredTasks.map(task => (
                <tr
                  key={task.id}
                  className="hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                  onClick={() => handleEditTask(task)}
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{task.taskName}</div>
                    {task.notes && (
                      <div className="text-xs text-[var(--muted)] truncate max-w-[300px]">{task.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.taskPriority)}`}>
                      {task.taskPriority.split(' - ')[1]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted)]">
                    {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted)]">
                    {task.plannedDate ? format(new Date(task.plannedDate), 'MMM d') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {task.domain ? (
                      <span className="flex items-center gap-1">
                        <span>{task.domain.icon || '📁'}</span>
                        <span className="text-[var(--muted)]">{task.domain.name}</span>
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.actionPoints ? (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((dot) => {
                          const ap = parseInt(task.actionPoints!);
                          const colors = ['bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
                          return (
                            <div
                              key={dot}
                              className={`w-2 h-2 rounded-full ${
                                dot <= ap ? colors[ap - 1] : 'bg-[var(--border-color)]'
                              }`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted)]">
                    {task.recurrence !== 'None' ? task.recurrence : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted)]">
                    {task.taskScore}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setTaskToDelete(task.id); }}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
          onSubmit={handleTaskSubmit}
          onCancel={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={taskToDelete !== null}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

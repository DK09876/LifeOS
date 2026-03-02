'use client';

import { useState, useMemo } from 'react';
import { format, startOfDay, addDays } from 'date-fns';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import { ColumnsButton, SortButton, FilterButton, SortLevel, ColumnDef, FilterDef, FilterValues, multiLevelSort, usePersistedSet, usePersistedSortLevels, usePersistedFilters, matchesFilter, isFilterActive } from '@/components/ViewControls';
import { useToast } from '@/components/Toast';
import { useTasks, useDomains, useProjects, createTask, updateTaskData, deleteTask } from '@/lib/hooks';
import { Task } from '@/types';
import { getStatusColor, getTaskPriorityColor, getUrgencyColor, getDueDateColor } from '@/lib/colors';
import { parseLocalDate } from '@/lib/dates';

const TASK_FILTERS: FilterDef[] = [
  {
    key: 'status', label: 'Status',
    options: [
      { value: 'all', label: 'All Status' },
      { value: 'Needs Details', label: 'Needs Details' },
      { value: 'Backlog', label: 'Backlog' },
      { value: 'Planned', label: 'Planned' },
      { value: 'Blocked', label: 'Blocked' },
      { value: 'Done', label: 'Done' },
      { value: 'Archived', label: 'Archived' },
    ],
  },
  {
    key: 'priority', label: 'Priority',
    options: [
      { value: 'all', label: 'All Priorities' },
      { value: '1 - Urgent', label: 'Urgent' },
      { value: '2 - High', label: 'High' },
      { value: '3 - Normal', label: 'Normal' },
      { value: '4 - Low', label: 'Low' },
      { value: '5 - Optional', label: 'Optional' },
    ],
  },
  {
    key: 'urgency', label: 'Urgency',
    options: [
      { value: 'all', label: 'All Urgency' },
      { value: '1 - Critical', label: 'Critical' },
      { value: '2 - High', label: 'High' },
      { value: '3 - Normal', label: 'Normal' },
      { value: '4 - Low', label: 'Low' },
      { value: '5 - Someday', label: 'Someday' },
    ],
  },
  {
    key: 'recurrence', label: 'Recurrence',
    options: [
      { value: 'all', label: 'All' },
      { value: 'None', label: 'None' },
      { value: 'Daily', label: 'Daily' },
      { value: 'Weekly', label: 'Weekly' },
      { value: 'Biweekly', label: 'Biweekly' },
      { value: 'Monthly', label: 'Monthly' },
      { value: 'Bimonthly', label: 'Bimonthly' },
      { value: 'Quarterly', label: 'Quarterly' },
      { value: 'Half-Yearly', label: 'Half-Yearly' },
      { value: 'Yearly', label: 'Yearly' },
    ],
  },
  {
    key: 'dueDate', label: 'Due Date',
    options: [
      { value: 'all', label: 'All' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Due Today' },
      { value: 'this-week', label: 'This Week' },
      { value: 'next-two-weeks', label: 'Next Two Weeks' },
      { value: 'this-month', label: 'This Month' },
      { value: 'has-due-date', label: 'Has Due Date' },
      { value: 'no-due-date', label: 'No Due Date' },
    ],
  },
];

const TASK_COLUMNS: ColumnDef[] = [
  { key: 'taskName', label: 'Task', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'taskPriority', label: 'Priority', defaultVisible: true },
  { key: 'urgency', label: 'Urgency', defaultVisible: true },
  { key: 'dueDate', label: 'Due', defaultVisible: true },
  { key: 'plannedDate', label: 'Planned', defaultVisible: true },
  { key: 'doneDate', label: 'Done', defaultVisible: false },
  { key: 'domain', label: 'Domain', defaultVisible: true },
  { key: 'actionPoints', label: 'AP', defaultVisible: true },
  { key: 'recurrence', label: 'Recurrence', defaultVisible: false },
  { key: 'taskScore', label: 'Score', defaultVisible: true },
  { key: 'notes', label: 'Notes', defaultVisible: false },
  { key: 'createdAt', label: 'Created', defaultVisible: false },
];

const SORTABLE_COLUMNS = TASK_COLUMNS.filter(c => !['notes'].includes(c.key));

const DEFAULT_VISIBLE = new Set(TASK_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));

export default function TasksPage() {
  const tasks = useTasks();
  const domains = useDomains();
  const projects = useProjects();
  const { showToast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = usePersistedSet('tasks-visible-columns', DEFAULT_VISIBLE);
  const [sortLevels, setSortLevels] = usePersistedSortLevels('tasks-sort-levels', [{ field: 'taskScore', direction: 'desc' }]);
  const [filterValues, setFilterValues] = usePersistedFilters('tasks-filters', { status: [], priority: [], urgency: [], domain: [], recurrence: [], dueDate: [], project: [] });

  // Build filters with dynamic domain and project options
  const taskFilters = useMemo<FilterDef[]>(() => [
    ...TASK_FILTERS,
    {
      key: 'domain', label: 'Domain',
      options: [
        { value: 'all', label: 'All Domains' },
        ...domains.map(d => ({ value: d.id, label: `${d.icon || '📁'} ${d.name}` })),
      ],
    },
    {
      key: 'project', label: 'Project',
      options: [
        { value: 'all', label: 'All Projects' },
        { value: 'none', label: 'No Project' },
        ...projects.filter(p => p.status === 'Active').map(p => ({ value: p.id, label: `${p.icon || '📦'} ${p.name}` })),
      ],
    },
  ], [domains, projects]);

  // Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Comparators for multi-level sort
  const comparators: Record<string, (a: Task, b: Task) => number> = useMemo(() => ({
    taskName: (a, b) => a.taskName.localeCompare(b.taskName),
    status: (a, b) => a.status.localeCompare(b.status),
    taskPriority: (a, b) => a.taskPriority.localeCompare(b.taskPriority),
    urgency: (a, b) => a.urgency.localeCompare(b.urgency),
    dueDate: (a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''),
    plannedDate: (a, b) => (a.plannedDate || '').localeCompare(b.plannedDate || ''),
    doneDate: (a, b) => (a.doneDate || '').localeCompare(b.doneDate || ''),
    domain: (a, b) => (a.domain?.name || '').localeCompare(b.domain?.name || ''),
    actionPoints: (a, b) => (parseInt(a.actionPoints || '0') || 0) - (parseInt(b.actionPoints || '0') || 0),
    recurrence: (a, b) => {
      const order: Record<string, number> = { None: 0, Yearly: 1, 'Half-Yearly': 2, Quarterly: 3, Bimonthly: 4, Monthly: 5, Biweekly: 6, Weekly: 7, Daily: 8 };
      return (order[a.recurrence] ?? 0) - (order[b.recurrence] ?? 0);
    },
    taskScore: (a, b) => a.taskScore - b.taskScore,
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  }), []);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.taskName.toLowerCase().includes(query) ||
        t.notes.toLowerCase().includes(query)
      );
    }

    // Apply multi-select filters
    result = result.filter(t => matchesFilter(filterValues.status || [], t.status));
    result = result.filter(t => matchesFilter(filterValues.priority || [], t.taskPriority));
    result = result.filter(t => matchesFilter(filterValues.urgency || [], t.urgency));
    result = result.filter(t => matchesFilter(filterValues.domain || [], t.domainId || ''));
    result = result.filter(t => matchesFilter(filterValues.recurrence || [], t.recurrence));

    // Due date filter
    const dueDateFilter = filterValues.dueDate || [];
    if (isFilterActive(dueDateFilter)) {
      const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
      result = result.filter(t => {
        for (const f of dueDateFilter) {
          if (f === 'overdue' && t.dueDate && t.dueDate < todayStr) return true;
          if (f === 'today' && t.dueDate === todayStr) return true;
          if (f === 'this-week' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= format(addDays(startOfDay(new Date()), 7), 'yyyy-MM-dd')) return true;
          if (f === 'next-two-weeks' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= format(addDays(startOfDay(new Date()), 14), 'yyyy-MM-dd')) return true;
          if (f === 'this-month' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= format(addDays(startOfDay(new Date()), 30), 'yyyy-MM-dd')) return true;
          if (f === 'has-due-date' && t.dueDate) return true;
          if (f === 'no-due-date' && !t.dueDate) return true;
        }
        return false;
      });
    }

    // Project filter
    const projectFilter = filterValues.project || [];
    if (isFilterActive(projectFilter)) {
      result = result.filter(t => {
        for (const f of projectFilter) {
          if (f === 'none' && !t.projectId) return true;
          if (f === t.projectId) return true;
        }
        return false;
      });
    }

    return multiLevelSort(result, sortLevels, comparators);
  }, [tasks, searchQuery, filterValues, sortLevels, comparators]);

  // Handlers
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
        await createTask(data);
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

  const show = (key: string) => visibleColumns.has(key);
  const colCount = Array.from(visibleColumns).length + 1; // +1 for actions

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

      {/* Filters + View Controls */}
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white placeholder-[var(--muted)] focus:outline-none focus:border-blue-500"
        />
        <FilterButton filters={taskFilters} values={filterValues} onChange={setFilterValues} />
        <ColumnsButton columns={TASK_COLUMNS} visibleColumns={visibleColumns} onChange={setVisibleColumns} />
        <SortButton columns={SORTABLE_COLUMNS} sortLevels={sortLevels} onChange={setSortLevels} />
      </div>

      {/* Table */}
      <div className="bg-[var(--card-bg)] rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              {show('taskName') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Task</th>
              )}
              {show('status') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-28">Status</th>
              )}
              {show('taskPriority') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-28">Priority</th>
              )}
              {show('urgency') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-28">Urgency</th>
              )}
              {show('dueDate') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Due</th>
              )}
              {show('plannedDate') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Planned</th>
              )}
              {show('doneDate') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Done</th>
              )}
              {show('domain') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-32">Domain</th>
              )}
              {show('actionPoints') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-20">AP</th>
              )}
              {show('recurrence') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Recurrence</th>
              )}
              {show('taskScore') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-20">Score</th>
              )}
              {show('notes') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-48">Notes</th>
              )}
              {show('createdAt') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Created</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-[var(--muted)]">
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
                  {show('taskName') && (
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{task.taskName}</div>
                    </td>
                  )}
                  {show('status') && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                  )}
                  {show('taskPriority') && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getTaskPriorityColor(task.taskPriority)}`}>
                        {task.taskPriority.split(' - ')[1]}
                      </span>
                    </td>
                  )}
                  {show('urgency') && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getUrgencyColor(task.urgency)}`}>
                        {task.urgency.split(' - ')[1]}
                      </span>
                    </td>
                  )}
                  {show('dueDate') && (
                    <td className={`px-4 py-3 text-sm ${getDueDateColor(task.dueDate)}`}>
                      {task.dueDate ? format(parseLocalDate(task.dueDate), 'MMM d') : '—'}
                    </td>
                  )}
                  {show('plannedDate') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {task.plannedDate ? format(parseLocalDate(task.plannedDate), 'MMM d') : '—'}
                    </td>
                  )}
                  {show('doneDate') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {task.doneDate ? format(new Date(task.doneDate), 'MMM d') : '—'}
                    </td>
                  )}
                  {show('domain') && (
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
                  )}
                  {show('actionPoints') && (
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
                  )}
                  {show('recurrence') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {task.recurrence !== 'None' ? task.recurrence : '—'}
                    </td>
                  )}
                  {show('taskScore') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {task.taskScore}
                    </td>
                  )}
                  {show('notes') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      <div className="truncate max-w-[200px]">{task.notes || '—'}</div>
                    </td>
                  )}
                  {show('createdAt') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {format(new Date(task.createdAt), 'MMM d')}
                    </td>
                  )}
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
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

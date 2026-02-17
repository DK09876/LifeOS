'use client';

import { useState, useMemo, DragEvent } from 'react';
import { format, startOfWeek, startOfMonth, addDays, addWeeks, addMonths, isToday, startOfDay, endOfMonth, getDay, isBefore, differenceInCalendarDays } from 'date-fns';
import Modal from '@/components/Modal';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import { FilterButton, SortButton, FilterDef, multiLevelSort, usePersistedSortLevels, usePersistedFilters, matchesFilter, isFilterActive } from '@/components/ViewControls';
import { useTasks, useDomains, useVisibleFilterPresets, markTaskDone, createTask, updateTaskData } from '@/lib/hooks';
import { Task } from '@/types';
import { FilterPreset } from '@/lib/db';

type MainView = 'triage' | 'planning';
type TriageTab = 'needsDetails' | 'blocked' | 'missed' | 'overdue' | 'archived';
type CalendarView = 'day' | 'week' | 'month';

const PLAN_FILTERS: FilterDef[] = [
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
    key: 'actionPoints', label: 'Action Points',
    options: [
      { value: 'all', label: 'All' },
      { value: 'low', label: 'Low (1-2)' },
      { value: 'med', label: 'Medium (3-4)' },
      { value: 'high', label: 'High (5)' },
    ],
  },
  {
    key: 'recurrence', label: 'Recurrence',
    options: [
      { value: 'all', label: 'All' },
      { value: 'None', label: 'One-time' },
      { value: 'recurring', label: 'Recurring' },
    ],
  },
];

const PLAN_COLUMNS = [
  { key: 'taskName', label: 'Task' },
  { key: 'taskPriority', label: 'Priority' },
  { key: 'dueDate', label: 'Due' },
  { key: 'domain', label: 'Domain' },
  { key: 'actionPoints', label: 'AP' },
  { key: 'taskScore', label: 'Score' },
];

// Color mapping for preset buttons
const PRESET_COLOR_MAP: Record<string, { active: string; inactive: string }> = {
  blue: { active: 'bg-blue-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
  red: { active: 'bg-red-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
  green: { active: 'bg-green-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
  yellow: { active: 'bg-yellow-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
  purple: { active: 'bg-purple-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
  orange: { active: 'bg-orange-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
  pink: { active: 'bg-pink-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
  gray: { active: 'bg-gray-600 text-white', inactive: 'bg-[var(--background)] text-[var(--muted)] hover:text-white' },
};

export default function PlanPage() {
  const tasks = useTasks();
  const domains = useDomains();
  const filterPresets = useVisibleFilterPresets();

  const [mainView, setMainView] = useState<MainView>('planning');
  const [triageTab, setTriageTab] = useState<TriageTab>('needsDetails');
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [dateOffset, setDateOffset] = useState(0);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Planning view state
  const [sortLevels, setSortLevels] = usePersistedSortLevels('plan-sort-levels', [{ field: 'taskScore', direction: 'desc' }]);
  const [filterValues, setFilterValues] = usePersistedFilters('plan-filters', { priority: [], domain: [], recurrence: [], actionPoints: [] });
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Build filters with dynamic domain options
  const planFilters = useMemo<FilterDef[]>(() => [
    ...PLAN_FILTERS,
    {
      key: 'domain', label: 'Domain',
      options: [
        { value: 'all', label: 'All Domains' },
        ...domains.map(d => ({ value: d.id, label: `${d.icon || '📁'} ${d.name}` })),
      ],
    },
  ], [domains]);

  // Comparators for sorting
  const comparators: Record<string, (a: Task, b: Task) => number> = useMemo(() => ({
    taskName: (a, b) => a.taskName.localeCompare(b.taskName),
    taskPriority: (a, b) => a.taskPriority.localeCompare(b.taskPriority),
    dueDate: (a, b) => (a.dueDate || 'z').localeCompare(b.dueDate || 'z'),
    domain: (a, b) => (a.domain?.name || '').localeCompare(b.domain?.name || ''),
    actionPoints: (a, b) => (parseInt(a.actionPoints || '0') || 0) - (parseInt(b.actionPoints || '0') || 0),
    taskScore: (a, b) => a.taskScore - b.taskScore,
  }), []);

  // Calculate current date range based on view
  const { currentStart, calendarDays, dateRangeLabel } = useMemo(() => {
    const today = startOfDay(new Date());

    if (calendarView === 'day') {
      const current = addDays(today, dateOffset);
      return {
        currentStart: current,
        calendarDays: [current],
        dateRangeLabel: format(current, 'EEEE, MMMM d, yyyy'),
      };
    }

    if (calendarView === 'month') {
      const monthStart = startOfMonth(addMonths(today, dateOffset));
      const monthEnd = endOfMonth(monthStart);
      const startDayOfWeek = getDay(monthStart);
      // Adjust for Monday start (0 = Monday in our case)
      const adjustedStart = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

      // Create array of days including padding for the calendar grid
      const days: Date[] = [];
      // Add days from previous month to fill the first week
      for (let i = adjustedStart - 1; i >= 0; i--) {
        days.push(addDays(monthStart, -i - 1));
      }
      // Add all days of the month
      let current = monthStart;
      while (current <= monthEnd) {
        days.push(current);
        current = addDays(current, 1);
      }
      // Add days to complete the last week (up to 42 total for 6 weeks)
      while (days.length < 42) {
        days.push(addDays(monthEnd, days.length - adjustedStart - (monthEnd.getDate() - 1)));
      }

      return {
        currentStart: monthStart,
        calendarDays: days,
        dateRangeLabel: format(monthStart, 'MMMM yyyy'),
      };
    }

    // Week view (default)
    const weekStart = startOfWeek(addWeeks(today, dateOffset), { weekStartsOn: 1 });
    return {
      currentStart: weekStart,
      calendarDays: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
      dateRangeLabel: `${format(weekStart, 'MMM d')} - ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`,
    };
  }, [calendarView, dateOffset]);

  // Triage tasks
  const triageTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const activeTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Archived');
    return {
      needsDetails: tasks.filter(t => t.status === 'Needs Details'),
      blocked: tasks.filter(t => t.status === 'Blocked'),
      missed: activeTasks.filter(t => {
        if (!t.plannedDate) return false;
        return isBefore(startOfDay(new Date(t.plannedDate + 'T00:00:00')), today);
      }),
      overdue: activeTasks.filter(t => {
        if (!t.dueDate) return false;
        return isBefore(startOfDay(new Date(t.dueDate + 'T00:00:00')), today);
      }),
      archived: tasks.filter(t => t.status === 'Archived'),
    };
  }, [tasks]);

  // Active tasks (not done/archived/needs details/blocked)
  const activeTasks = useMemo(() => {
    return tasks.filter(t =>
      t.status !== 'Done' &&
      t.status !== 'Archived' &&
      t.status !== 'Needs Details' &&
      t.status !== 'Blocked'
    );
  }, [tasks]);

  // Unscheduled tasks (with filters applied)
  const unscheduledTasks = useMemo(() => {
    let result = activeTasks.filter(t => !t.plannedDate);

    // Apply multi-select filters
    result = result.filter(t => matchesFilter(filterValues.priority || [], t.taskPriority));
    result = result.filter(t => matchesFilter(filterValues.domain || [], t.domainId || ''));

    // Recurrence filter - special handling for 'recurring' option
    const recurrenceFilter = filterValues.recurrence || [];
    if (isFilterActive(recurrenceFilter)) {
      result = result.filter(t => {
        if (recurrenceFilter.includes('recurring')) {
          // 'recurring' means any recurrence that's not 'None'
          if (t.recurrence !== 'None') return true;
        }
        return recurrenceFilter.includes(t.recurrence);
      });
    }

    // Action points filter - special handling for ranges
    const apFilter = filterValues.actionPoints || [];
    if (isFilterActive(apFilter)) {
      result = result.filter(t => {
        const ap = parseInt(t.actionPoints || '0') || 0;
        for (const f of apFilter) {
          if (f === 'low' && ap >= 1 && ap <= 2) return true;
          if (f === 'med' && ap >= 3 && ap <= 4) return true;
          if (f === 'high' && ap >= 5) return true;
        }
        return false;
      });
    }

    return multiLevelSort(result, sortLevels, comparators);
  }, [activeTasks, filterValues, sortLevels, comparators]);

  // Tasks by day for the calendar
  const tasksByDay = useMemo(() => {
    return calendarDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return {
        date: day,
        tasks: activeTasks.filter(t => {
          if (!t.plannedDate) return false;
          return t.plannedDate === dayStr;
        }).sort((a, b) => {
          const priorityA = parseInt(a.taskPriority[0]) || 3;
          const priorityB = parseInt(b.taskPriority[0]) || 3;
          return priorityA - priorityB;
        })
      };
    });
  }, [activeTasks, calendarDays]);

  // Stats
  const stats = useMemo(() => ({
    needsAttention: triageTasks.needsDetails.length + triageTasks.blocked.length + triageTasks.missed.length + triageTasks.overdue.length,
    unscheduled: unscheduledTasks.length,
  }), [triageTasks, unscheduledTasks]);

  // Handlers
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setSelectedDate(null);
    setIsTaskModalOpen(true);
  };

  const handleOpenCreateTask = (date?: Date) => {
    setEditingTask(null);
    setSelectedDate(date || null);
    setIsTaskModalOpen(true);
  };

  async function handleTaskSubmit(data: TaskFormData) {
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
  }

  async function handleMarkDone(taskId: string) {
    await markTaskDone(taskId);
  }

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnDate = async (e: DragEvent, date: Date) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const plannedDate = format(date, 'yyyy-MM-dd');
    await updateTaskData(draggedTaskId, { plannedDate });
    setDraggedTaskId(null);
  };

  const handleDropOnUnscheduled = async (e: DragEvent) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    await updateTaskData(draggedTaskId, { plannedDate: null });
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  // Helper to convert preset string value to array
  const presetToArray = (value: string | undefined): string[] => {
    if (!value || value === 'all') return [];
    return [value];
  };

  // Helper to check if arrays match
  const arraysMatch = (a: string[] | undefined, b: string[]): boolean => {
    const aArr = a || [];
    if (aArr.length !== b.length) return false;
    return aArr.every(v => b.includes(v)) && b.every(v => aArr.includes(v));
  };

  // Check if a preset matches current filter values
  const isPresetActive = (preset: FilterPreset) => {
    const presetPriority = presetToArray(preset.filters.priority);
    const presetAP = presetToArray(preset.filters.actionPoints);
    const presetDomain = presetToArray(preset.filters.domain);
    const presetRecurrence = presetToArray(preset.filters.recurrence);
    return (
      arraysMatch(filterValues.priority, presetPriority) &&
      arraysMatch(filterValues.actionPoints, presetAP) &&
      arraysMatch(filterValues.domain, presetDomain) &&
      arraysMatch(filterValues.recurrence, presetRecurrence)
    );
  };

  // Apply a preset's filters
  const applyPreset = (preset: FilterPreset) => {
    setFilterValues({
      priority: presetToArray(preset.filters.priority),
      actionPoints: presetToArray(preset.filters.actionPoints),
      domain: presetToArray(preset.filters.domain),
      recurrence: presetToArray(preset.filters.recurrence),
    });
    setActivePresetId(preset.id);
  };

  // Navigate to a specific day in the day view
  const navigateToDay = (date: Date) => {
    const today = startOfDay(new Date());
    const diffDays = differenceInCalendarDays(date, today);
    setCalendarView('day');
    setDateOffset(diffDays);
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

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case '1 - Urgent': return 'bg-red-500';
      case '2 - High': return 'bg-orange-500';
      case '3 - Normal': return 'bg-blue-500';
      case '4 - Low': return 'bg-gray-500';
      case '5 - Optional': return 'bg-gray-600';
      default: return 'bg-blue-500';
    }
  };

  const getDueDateColor = (dueDate: string | null) => {
    if (!dueDate) return 'text-[var(--muted)]';
    const due = startOfDay(new Date(dueDate));
    const today = startOfDay(new Date());
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'text-red-400 font-medium';
    if (daysUntil === 0) return 'text-orange-400 font-medium';
    if (daysUntil <= 2) return 'text-yellow-400';
    if (daysUntil <= 7) return 'text-blue-400';
    return 'text-[var(--muted)]';
  };

  // Render a draggable task card (for unscheduled list)
  const renderUnscheduledTask = (task: Task) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
      className={`p-2 bg-[var(--card-bg)] rounded hover:bg-[var(--card-hover)] cursor-grab active:cursor-grabbing transition-colors ${
        draggedTaskId === task.id ? 'opacity-50' : ''
      }`}
      onClick={() => handleEditTask(task)}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleMarkDone(task.id); }}
          className="w-4 h-4 mt-0.5 rounded border border-[var(--muted)] hover:border-green-500 flex-shrink-0 flex items-center justify-center group"
        >
          <span className="opacity-0 group-hover:opacity-100 text-green-500 text-xs">✓</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm truncate">{task.taskName}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${getPriorityDot(task.taskPriority)}`}></span>
            {task.domain?.icon && <span className="text-xs">{task.domain.icon}</span>}
            {task.dueDate && (
              <span className={`text-xs ${getDueDateColor(task.dueDate)}`}>
                Due {format(new Date(task.dueDate), 'MMM d')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render a detailed task card (for day view)
  const renderDetailedTask = (task: Task) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
      className={`p-4 bg-[var(--card-bg)] rounded-lg hover:bg-[var(--card-hover)] cursor-pointer transition-colors border-l-4 ${
        task.taskPriority === '1 - Urgent' ? 'border-red-500' :
        task.taskPriority === '2 - High' ? 'border-orange-500' :
        task.taskPriority === '3 - Normal' ? 'border-blue-500' :
        'border-gray-500'
      } ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
      onClick={() => handleEditTask(task)}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); handleMarkDone(task.id); }}
          className="w-5 h-5 mt-0.5 rounded border-2 border-[var(--muted)] hover:border-green-500 flex-shrink-0 flex items-center justify-center group"
        >
          <span className="opacity-0 group-hover:opacity-100 text-green-500 text-sm">✓</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium">{task.taskName}</h3>
            <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.taskPriority)}`}>
              {task.taskPriority.split(' - ')[1]}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)] mb-2">
            {task.domain && (
              <span className="flex items-center gap-1">
                {task.domain.icon || '📁'} {task.domain.name}
              </span>
            )}
            {task.dueDate && (
              <span className={getDueDateColor(task.dueDate)}>
                Due {format(new Date(task.dueDate + 'T00:00:00'), 'MMM d')}
              </span>
            )}
            {task.actionPoints && (
              <span>AP: {task.actionPoints}</span>
            )}
            {task.recurrence !== 'None' && (
              <span className="text-purple-400">{task.recurrence}</span>
            )}
          </div>

          {task.notes && (
            <p className="text-sm text-[var(--muted)] line-clamp-2 mt-2 pl-0 border-l-0">
              {task.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Render a task in the calendar
  const renderCalendarTask = (task: Task) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
      className={`bg-[var(--background)] rounded p-1.5 group hover:bg-[var(--card-hover)] cursor-grab active:cursor-grabbing transition-colors ${
        draggedTaskId === task.id ? 'opacity-50' : ''
      }`}
      onClick={() => handleEditTask(task)}
    >
      <div className="flex items-start gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); handleMarkDone(task.id); }}
          className="w-3 h-3 mt-0.5 rounded-full border border-[var(--muted)] hover:border-green-500 flex items-center justify-center flex-shrink-0"
        >
          <span className="opacity-0 group-hover:opacity-100 text-green-500 text-[8px]">✓</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs line-clamp-2">{task.taskName}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${getPriorityDot(task.taskPriority)}`}></span>
            {task.domain?.icon && <span className="text-[10px]">{task.domain.icon}</span>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Plan</h1>
          <p className="text-[var(--muted)]">Triage and schedule your tasks</p>
        </div>
        <button
          onClick={() => handleOpenCreateTask()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          + New Task
        </button>
      </div>

      {/* Main View Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          {[
            { key: 'triage' as const, label: 'Triage', count: stats.needsAttention },
            { key: 'planning' as const, label: 'Planning', count: stats.unscheduled },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainView(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mainView === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--card-bg)] text-[var(--muted)] hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  mainView === tab.key ? 'bg-blue-500' : 'bg-[var(--border-color)]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Triage View */}
      {mainView === 'triage' && (
        <div>
          {/* Triage Tabs */}
          <div className="flex items-center gap-2 mb-4">
            {[
              { key: 'needsDetails' as const, label: 'Needs Details', count: triageTasks.needsDetails.length, color: 'bg-yellow-600' },
              { key: 'blocked' as const, label: 'Blocked', count: triageTasks.blocked.length, color: 'bg-yellow-600' },
              { key: 'missed' as const, label: 'Missed', count: triageTasks.missed.length, color: 'bg-orange-600' },
              { key: 'overdue' as const, label: 'Overdue', count: triageTasks.overdue.length, color: 'bg-red-600' },
              { key: 'archived' as const, label: 'Archived', count: triageTasks.archived.length, color: 'bg-gray-600' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setTriageTab(tab.key)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  triageTab === tab.key
                    ? `${tab.color} text-white`
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
                {triageTab === 'needsDetails' && 'No tasks need details'}
                {triageTab === 'blocked' && 'No blocked tasks'}
                {triageTab === 'missed' && 'No missed tasks'}
                {triageTab === 'overdue' && 'No overdue tasks'}
                {triageTab === 'archived' && 'No archived tasks'}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)]">
                {triageTasks[triageTab].map(task => (
                  <div
                    key={task.id}
                    className={`p-4 flex items-center justify-between hover:bg-[var(--card-hover)] cursor-pointer transition-colors ${
                      triageTab === 'missed' ? 'border-l-4 border-orange-500' : ''
                    } ${triageTab === 'overdue' ? 'border-l-4 border-red-500' : ''} ${
                      triageTab === 'archived' ? 'border-l-4 border-gray-500 opacity-75' : ''
                    }`}
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
                      {triageTab === 'missed' && task.plannedDate && (
                        <span className="text-xs text-orange-400">
                          Planned {format(new Date(task.plannedDate + 'T00:00:00'), 'MMM d')}
                        </span>
                      )}
                      {triageTab === 'overdue' && task.dueDate && (
                        <span className="text-xs text-red-400">
                          Due {format(new Date(task.dueDate + 'T00:00:00'), 'MMM d')}
                        </span>
                      )}
                      {triageTab !== 'overdue' && task.dueDate && (
                        <span className={`text-xs ${getDueDateColor(task.dueDate)}`}>
                          Due {format(new Date(task.dueDate + 'T00:00:00'), 'MMM d')}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.taskPriority)}`}>
                        {task.taskPriority.split(' - ')[1]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Planning View */}
      {mainView === 'planning' && (
        <div className="flex gap-4">
          {/* Left: Unscheduled Tasks */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-[var(--card-bg)] rounded-lg sticky top-20">
              <div className="p-3 border-b border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">Unscheduled</h3>
                  <span className="text-xs text-[var(--muted)]">{unscheduledTasks.length} tasks</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <FilterButton filters={planFilters} values={filterValues} onChange={setFilterValues} />
                  <SortButton columns={PLAN_COLUMNS} sortLevels={sortLevels} onChange={setSortLevels} />
                </div>
                {/* Filter Presets */}
                <div className="flex flex-wrap gap-1">
                  {filterPresets.map(preset => {
                    const colors = PRESET_COLOR_MAP[preset.color] || PRESET_COLOR_MAP.blue;
                    const isActive = isPresetActive(preset);
                    return (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          isActive ? colors.active : colors.inactive
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDropOnUnscheduled}
                className={`p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto ${
                  draggedTaskId ? 'bg-gray-500/10' : ''
                }`}
              >
                {unscheduledTasks.length === 0 ? (
                  <div className="p-4 text-center text-[var(--muted)] text-sm">
                    {draggedTaskId ? 'Drop here to unschedule' : 'All tasks scheduled!'}
                  </div>
                ) : (
                  unscheduledTasks.map(task => renderUnscheduledTask(task))
                )}
              </div>
            </div>

          </div>

          {/* Right: Calendar */}
          <div className="flex-1 min-w-0">
            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDateOffset(prev => prev - 1)}
                  className="p-2 hover:bg-[var(--card-bg)] rounded text-[var(--muted)] hover:text-white"
                >
                  ←
                </button>
                <button
                  onClick={() => setDateOffset(0)}
                  className="px-3 py-1.5 bg-[var(--card-bg)] hover:bg-[var(--card-hover)] rounded text-sm text-white"
                >
                  Today
                </button>
                <button
                  onClick={() => setDateOffset(prev => prev + 1)}
                  className="p-2 hover:bg-[var(--card-bg)] rounded text-[var(--muted)] hover:text-white"
                >
                  →
                </button>
                <span className="text-[var(--muted)] text-sm ml-2">{dateRangeLabel}</span>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-[var(--card-bg)] rounded-lg p-1">
                {(['day', 'week', 'month'] as CalendarView[]).map(view => (
                  <button
                    key={view}
                    onClick={() => { setCalendarView(view); setDateOffset(0); }}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      calendarView === view
                        ? 'bg-blue-600 text-white'
                        : 'text-[var(--muted)] hover:text-white'
                    }`}
                  >
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Day View - Detailed Task List */}
            {calendarView === 'day' && (
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnDate(e, calendarDays[0])}
                className={`${draggedTaskId ? 'ring-2 ring-blue-500/30 rounded-lg' : ''}`}
              >
                {/* Day Header */}
                <div className={`p-4 rounded-lg mb-4 ${isToday(calendarDays[0]) ? 'bg-blue-600' : 'bg-[var(--card-bg)]'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {format(calendarDays[0], 'EEEE')}
                      </p>
                      <p className={`text-sm ${isToday(calendarDays[0]) ? 'text-blue-200' : 'text-[var(--muted)]'}`}>
                        {format(calendarDays[0], 'MMMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-white">{tasksByDay[0]?.tasks.length || 0}</p>
                      <p className={`text-sm ${isToday(calendarDays[0]) ? 'text-blue-200' : 'text-[var(--muted)]'}`}>
                        tasks scheduled
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="space-y-3">
                  {tasksByDay[0]?.tasks.length === 0 ? (
                    <div className="p-12 text-center bg-[var(--card-bg)] rounded-lg">
                      <p className="text-[var(--muted)] text-lg mb-2">
                        {draggedTaskId ? 'Drop task here to schedule' : 'No tasks scheduled for this day'}
                      </p>
                      <p className="text-[var(--muted)] text-sm mb-4">
                        Drag tasks from the left panel or create a new one
                      </p>
                      <button
                        onClick={() => handleOpenCreateTask(calendarDays[0])}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        + Add Task
                      </button>
                    </div>
                  ) : (
                    <>
                      {tasksByDay[0]?.tasks.map(task => renderDetailedTask(task))}
                      <button
                        onClick={() => handleOpenCreateTask(calendarDays[0])}
                        className="w-full p-3 text-[var(--muted)] hover:text-white bg-[var(--card-bg)] hover:bg-[var(--card-hover)] rounded-lg text-sm transition-colors"
                      >
                        + Add Task
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Week View */}
            {calendarView === 'week' && (
              <div className="grid grid-cols-7 gap-2">
                {tasksByDay.map(({ date, tasks: dayTasks }) => (
                  <div
                    key={date.toISOString()}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnDate(e, date)}
                    className={`min-h-[300px] ${draggedTaskId ? 'ring-2 ring-blue-500/30 ring-inset' : ''}`}
                  >
                    <button
                      onClick={() => navigateToDay(date)}
                      className={`w-full p-2 rounded-t-lg text-center cursor-pointer transition-opacity hover:opacity-80 ${isToday(date) ? 'bg-blue-600' : 'bg-[var(--card-bg)]'}`}
                    >
                      <p className={`text-xs ${isToday(date) ? 'text-blue-200' : 'text-[var(--muted)]'}`}>
                        {format(date, 'EEE')}
                      </p>
                      <p className="text-lg font-semibold text-white">
                        {format(date, 'd')}
                      </p>
                    </button>
                    <div className="bg-[var(--card-bg)] rounded-b-lg p-1.5 space-y-1.5 min-h-[250px]">
                      {dayTasks.map(task => renderCalendarTask(task))}
                      {draggedTaskId && dayTasks.length === 0 && (
                        <div className="p-2 text-center text-[var(--muted)] text-xs border-2 border-dashed border-[var(--border-color)] rounded">
                          Drop here
                        </div>
                      )}
                      <button
                        onClick={() => handleOpenCreateTask(date)}
                        className="w-full p-1.5 text-[var(--muted)] hover:text-white hover:bg-[var(--background)] rounded text-xs text-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Month View */}
            {calendarView === 'month' && (
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="p-2 text-center text-xs text-[var(--muted)]">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {tasksByDay.map(({ date, tasks: dayTasks }, index) => {
                    const isCurrentMonth = date.getMonth() === currentStart.getMonth();
                    return (
                      <div
                        key={date.toISOString()}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnDate(e, date)}
                        className={`min-h-[100px] rounded ${
                          isCurrentMonth ? 'bg-[var(--card-bg)]' : 'bg-[var(--card-bg)]/50'
                        } ${draggedTaskId ? 'ring-1 ring-blue-500/30 ring-inset' : ''} ${
                          isToday(date) ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <button
                          onClick={() => navigateToDay(date)}
                          className={`w-full p-1 text-right hover:bg-[var(--background)] rounded-t transition-colors ${isCurrentMonth ? '' : 'opacity-40'}`}
                        >
                          <span className={`text-sm ${isToday(date) ? 'bg-blue-600 text-white px-1.5 py-0.5 rounded-full' : 'text-[var(--muted)] hover:text-white'}`}>
                            {format(date, 'd')}
                          </span>
                        </button>
                        <div className="px-1 pb-1 space-y-0.5 max-h-[70px] overflow-y-auto">
                          {dayTasks.slice(0, 3).map(task => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleEditTask(task)}
                              className={`text-xs p-1 rounded truncate cursor-grab active:cursor-grabbing ${
                                getPriorityDot(task.taskPriority).replace('bg-', 'bg-').replace('-500', '-500/20')
                              } text-white hover:opacity-80 ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
                            >
                              {task.taskName}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-xs text-[var(--muted)] text-center">
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Modal */}
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
    </div>
  );
}

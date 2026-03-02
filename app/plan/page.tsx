'use client';

import { useState, useMemo, useCallback, DragEvent } from 'react';
import { format, startOfWeek, startOfMonth, addDays, addWeeks, addMonths, isToday, startOfDay, endOfMonth, getDay, isBefore, differenceInCalendarDays } from 'date-fns';
import Modal from '@/components/Modal';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import EventForm, { EventFormData } from '@/components/EventForm';
import EisenhowerMatrix from '@/components/EisenhowerMatrix';
import SuggestControlsComponent from '@/components/SuggestControls';
import { FilterButton, SortButton, FilterDef, multiLevelSort, usePersistedSortLevels, usePersistedFilters, matchesFilter, isFilterActive } from '@/components/ViewControls';
import { useTasks, useDomains, useVisibleFilterPresets, useEvents, useProjects, markTaskDone, createTask, updateTaskData, createEvent, updateEventData, deleteEvent } from '@/lib/hooks';
import { Task, Event } from '@/types';
import { FilterPreset } from '@/lib/db';
import { getTaskPriorityColor, getPriorityDotColor, getDueDateColor, getTaskPriorityBorder, getDueSoonLabel } from '@/lib/colors';
import { parseLocalDate, toDateString } from '@/lib/dates';
import { SuggestControls, DEFAULT_SUGGEST_CONTROLS, suggestNextTask, suggestWeekSchedule, WeekDayInfo } from '@/lib/suggest';

type MainView = 'triage' | 'planning' | 'matrix';
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

const PLAN_COLUMNS = [
  { key: 'taskName', label: 'Task' },
  { key: 'taskPriority', label: 'Priority' },
  { key: 'urgency', label: 'Urgency' },
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
  const events = useEvents();
  const projects = useProjects();

  const [mainView, setMainView] = useState<MainView>('planning');
  const [triageTab, setTriageTab] = useState<TriageTab>('needsDetails');
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [dateOffset, setDateOffset] = useState(0);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);

  // Suggest state
  const [suggestNextSkipIds, setSuggestNextSkipIds] = useState<Set<string>>(new Set());
  const [suggestNextDismissed, setSuggestNextDismissed] = useState(false);
  const [suggestedAssignments, setSuggestedAssignments] = useState<Map<string, string>>(new Map());
  const [pinnedTaskIds, setPinnedTaskIds] = useState<Set<string>>(new Set());
  const [suggestRemovedPlacements, setSuggestRemovedPlacements] = useState<Set<string>>(new Set()); // "taskId:dateStr"
  const [suggestSettingsOpen, setSuggestSettingsOpen] = useState(false);
  const [suggestControls, setSuggestControls] = useState<SuggestControls>(() => {
    if (typeof window === 'undefined') return DEFAULT_SUGGEST_CONTROLS;
    try {
      const stored = localStorage.getItem('suggest-settings');
      if (stored) return { ...DEFAULT_SUGGEST_CONTROLS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_SUGGEST_CONTROLS;
  });
  const updateSuggestControls = useCallback((c: SuggestControls) => {
    setSuggestControls(c);
    localStorage.setItem('suggest-settings', JSON.stringify(c));
  }, []);

  // Planning view state
  const [sortLevels, setSortLevels] = usePersistedSortLevels('plan-sort-levels', [{ field: 'taskScore', direction: 'desc' }]);
  const [filterValues, setFilterValues] = usePersistedFilters('plan-filters', { priority: [], urgency: [], domain: [], recurrence: [], actionPoints: [], dueDate: [], project: [] });
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
    {
      key: 'project', label: 'Project',
      options: [
        { value: 'all', label: 'All Projects' },
        { value: 'none', label: 'No Project' },
        ...projects.filter(p => p.status === 'Active').map(p => ({ value: p.id, label: `${p.icon || '📦'} ${p.name}` })),
      ],
    },
  ], [domains, projects]);

  // Comparators for sorting
  const comparators: Record<string, (a: Task, b: Task) => number> = useMemo(() => ({
    taskName: (a, b) => a.taskName.localeCompare(b.taskName),
    taskPriority: (a, b) => a.taskPriority.localeCompare(b.taskPriority),
    urgency: (a, b) => a.urgency.localeCompare(b.urgency),
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

  // Triage tasks (and missed events)
  const triageTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const activeTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Archived');
    return {
      needsDetails: tasks.filter(t => t.status === 'Needs Details'),
      blocked: tasks.filter(t => t.status === 'Blocked'),
      missed: activeTasks.filter(t => {
        if (!t.plannedDate) return false;
        return isBefore(startOfDay(new Date(t.plannedDate + 'T00:00:00')), today);
      }),
      missedEvents: events.filter(e => {
        if (e.date >= todayStr) return false;
        // Event is missed if lastCompleted doesn't match its date
        return e.lastCompleted !== e.date;
      }),
      overdue: activeTasks.filter(t => {
        if (!t.dueDate) return false;
        return isBefore(startOfDay(new Date(t.dueDate + 'T00:00:00')), today);
      }),
      archived: tasks.filter(t => t.status === 'Archived'),
    };
  }, [tasks, events]);

  // Active tasks (not done/archived/needs details/blocked)
  const activeTasks = useMemo(() => {
    return tasks.filter(t =>
      t.status !== 'Done' &&
      t.status !== 'Archived' &&
      t.status !== 'Needs Details' &&
      t.status !== 'Blocked'
    );
  }, [tasks]);

  // Shared filter logic for applying filterValues to a task list
  const applyFilters = useCallback((tasks: Task[]) => {
    let result = tasks;

    // Apply multi-select filters
    result = result.filter(t => matchesFilter(filterValues.priority || [], t.taskPriority));
    result = result.filter(t => matchesFilter(filterValues.urgency || [], t.urgency));
    result = result.filter(t => matchesFilter(filterValues.domain || [], t.domainId || ''));

    // Recurrence filter - special handling for 'recurring' option
    const recurrenceFilter = filterValues.recurrence || [];
    if (isFilterActive(recurrenceFilter)) {
      result = result.filter(t => {
        if (recurrenceFilter.includes('recurring')) {
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

    return result;
  }, [filterValues]);

  // Filtered active tasks (used by matrix view)
  const filteredActiveTasks = useMemo(() => applyFilters(activeTasks), [activeTasks, applyFilters]);

  // Unscheduled tasks (with filters + sort applied)
  const unscheduledTasks = useMemo(() => {
    const result = applyFilters(activeTasks.filter(t => !t.plannedDate));
    return multiLevelSort(result, sortLevels, comparators);
  }, [activeTasks, applyFilters, sortLevels, comparators]);

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

  // Events by day for the calendar
  const eventsByDay = useMemo(() => {
    return calendarDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return {
        date: day,
        events: events.filter(e => e.date === dayStr),
      };
    });
  }, [events, calendarDays]);

  // Stats
  const stats = useMemo(() => ({
    needsAttention: triageTasks.needsDetails.length + triageTasks.blocked.length + triageTasks.missed.length + triageTasks.missedEvents.length + triageTasks.overdue.length,
    unscheduled: unscheduledTasks.length,
  }), [triageTasks, unscheduledTasks]);

  // Suggest Next Task: compute ranked list
  const suggestNextRanked = useMemo(() => {
    const todayStr = toDateString(new Date());
    const scheduledToday = activeTasks.filter(t => t.plannedDate === todayStr);
    const eventsToday = events.filter(e => e.date === todayStr);
    return suggestNextTask(activeTasks, scheduledToday, eventsToday, suggestControls, suggestNextSkipIds);
  }, [activeTasks, events, suggestControls, suggestNextSkipIds]);

  // Suggest Week: compute week days info for current week
  const suggestWeekDays = useMemo((): WeekDayInfo[] => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const dateStr = toDateString(date);
      return {
        date,
        dateStr,
        existingTasks: activeTasks.filter(t => t.plannedDate === dateStr),
        events: events.filter(e => e.date === dateStr),
      };
    });
  }, [activeTasks, events]);

  // Get task AP helper for display
  const getDisplayAP = useCallback((task: Task) => {
    return parseInt(task.actionPoints || '0') || suggestControls.defaultAP;
  }, [suggestControls.defaultAP]);

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

  // Helper to convert preset filter value (string or array) to array
  const presetToArray = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
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
    const presetUrgency = presetToArray(preset.filters.urgency);
    const presetDueDate = presetToArray(preset.filters.dueDate);
    return (
      arraysMatch(filterValues.priority, presetPriority) &&
      arraysMatch(filterValues.actionPoints, presetAP) &&
      arraysMatch(filterValues.domain, presetDomain) &&
      arraysMatch(filterValues.recurrence, presetRecurrence) &&
      arraysMatch(filterValues.urgency, presetUrgency) &&
      arraysMatch(filterValues.dueDate, presetDueDate)
    );
  };

  // Apply a preset's filters (toggle off if already active)
  const applyPreset = (preset: FilterPreset) => {
    if (isPresetActive(preset)) {
      setFilterValues({ priority: [], actionPoints: [], domain: [], recurrence: [], urgency: [], dueDate: [] });
    } else {
      setFilterValues({
        priority: presetToArray(preset.filters.priority),
        actionPoints: presetToArray(preset.filters.actionPoints),
        domain: presetToArray(preset.filters.domain),
        recurrence: presetToArray(preset.filters.recurrence),
        urgency: presetToArray(preset.filters.urgency),
        dueDate: presetToArray(preset.filters.dueDate),
      });
    }
  };

  // Event handlers
  const handleOpenCreateEvent = (date?: Date) => {
    setEditingEvent(null);
    setSelectedEventDate(date || null);
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setSelectedEventDate(null);
    setIsEventModalOpen(true);
  };

  async function handleEventSubmit(data: EventFormData) {
    const eventData = selectedEventDate && !data.date
      ? { ...data, date: format(selectedEventDate, 'yyyy-MM-dd') }
      : data;

    if (editingEvent) {
      await updateEventData(editingEvent.id, eventData);
    } else {
      await createEvent(eventData);
    }
    setIsEventModalOpen(false);
    setEditingEvent(null);
    setSelectedEventDate(null);
  }

  async function handleDeleteEvent(eventId: string) {
    await deleteEvent(eventId);
  }

  // Navigate to a specific day in the day view
  const navigateToDay = (date: Date) => {
    const today = startOfDay(new Date());
    const diffDays = differenceInCalendarDays(date, today);
    setCalendarView('day');
    setDateOffset(diffDays);
  };

  // Suggest handlers
  const handleGenerateWeekSchedule = () => {
    const pinned = new Map(Array.from(pinnedTaskIds).reduce<[string, string][]>((acc, id) => {
      const v = suggestedAssignments.get(id);
      if (v) acc.push([id, v]);
      return acc;
    }, []));
    const result = suggestWeekSchedule(activeTasks, suggestWeekDays, suggestControls, pinned, suggestRemovedPlacements);
    setSuggestedAssignments(result);
  };

  const handleRerunWeekSchedule = () => {
    const pinned = new Map<string, string>();
    for (const id of pinnedTaskIds) {
      const dateStr = suggestedAssignments.get(id);
      if (dateStr) pinned.set(id, dateStr);
    }
    const result = suggestWeekSchedule(activeTasks, suggestWeekDays, suggestControls, pinned, suggestRemovedPlacements);
    setSuggestedAssignments(result);
  };

  const handleApplySuggestions = async () => {
    for (const taskId of pinnedTaskIds) {
      const dateStr = suggestedAssignments.get(taskId);
      if (dateStr) {
        await updateTaskData(taskId, { plannedDate: dateStr });
      }
    }
    setSuggestedAssignments(new Map());
    setPinnedTaskIds(new Set());
    setSuggestRemovedPlacements(new Set());
  };

  const handleDiscardSuggestions = () => {
    setSuggestedAssignments(new Map());
    setPinnedTaskIds(new Set());
    setSuggestRemovedPlacements(new Set());
  };

  const handleTogglePin = (taskId: string) => {
    const next = new Set(pinnedTaskIds);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    setPinnedTaskIds(next);
  };

  const handleRemoveSuggestion = (taskId: string) => {
    const dateStr = suggestedAssignments.get(taskId);
    if (dateStr) {
      setSuggestRemovedPlacements(prev => new Set([...prev, `${taskId}:${dateStr}`]));
    }
    const next = new Map(suggestedAssignments);
    next.delete(taskId);
    const nextPinned = new Set(pinnedTaskIds);
    nextPinned.delete(taskId);
    setSuggestedAssignments(next);
    setPinnedTaskIds(nextPinned);
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
            <span className={`w-2 h-2 rounded-full ${getPriorityDotColor(task.taskPriority)}`}></span>
            {task.domain?.icon && <span className="text-xs">{task.domain.icon}</span>}
            {task.dueDate && (
              <span className={`text-xs ${getDueDateColor(task.dueDate)}`}>
                Due {format(parseLocalDate(task.dueDate), 'MMM d')}
              </span>
            )}
            {getDueSoonLabel(task.dueDate) && (
              <span className={`${getDueSoonLabel(task.dueDate)!.color} text-white text-[10px] px-1 py-0.5 rounded font-medium`}>
                {getDueSoonLabel(task.dueDate)!.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render an event card in the calendar
  const renderCalendarEvent = (event: Event) => (
    <div
      key={event.id}
      className="bg-indigo-500/10 rounded p-1.5 border-l-2 border-indigo-500 hover:bg-indigo-500/20 cursor-pointer transition-colors"
      onClick={() => handleEditEvent(event)}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] text-indigo-400 mt-0.5">🕐</span>
        <div className="flex-1 min-w-0">
          <p className="text-indigo-300 text-xs line-clamp-1">{event.eventName}</p>
          {event.time && (
            <span className="text-[10px] text-indigo-400/70">
              {new Date(`2000-01-01T${event.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          )}
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
      className={`p-4 rounded-lg hover:bg-[var(--card-hover)] cursor-pointer transition-colors border-l-4 ${
        getTaskPriorityBorder(task.taskPriority)
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
            <span className={`px-2 py-0.5 rounded text-xs ${getTaskPriorityColor(task.taskPriority)}`}>
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
                Due {format(parseLocalDate(task.dueDate), 'MMM d')}
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
            <span className={`w-1.5 h-1.5 rounded-full ${getPriorityDotColor(task.taskPriority)}`}></span>
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
            { key: 'matrix' as const, label: 'Matrix', count: 0 },
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
              { key: 'missed' as const, label: 'Missed', count: triageTasks.missed.length + triageTasks.missedEvents.length, color: 'bg-orange-600' },
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
            {triageTasks[triageTab].length === 0 && (triageTab !== 'missed' || triageTasks.missedEvents.length === 0) ? (
              <div className="p-8 text-center text-[var(--muted)]">
                {triageTab === 'needsDetails' && 'No tasks need details'}
                {triageTab === 'blocked' && 'No blocked tasks'}
                {triageTab === 'missed' && 'No missed items'}
                {triageTab === 'overdue' && 'No overdue tasks'}
                {triageTab === 'archived' && 'No archived tasks'}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)]">
                {/* Missed events (only in missed tab) */}
                {triageTab === 'missed' && triageTasks.missedEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-4 flex items-center justify-between hover:bg-[var(--card-hover)] cursor-pointer transition-colors border-l-4 border-indigo-500"
                    onClick={() => handleEditEvent(event)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-indigo-400">🕐</span>
                      <span className="text-indigo-300">{event.eventName}</span>
                      {event.domain && (
                        <span className="text-xs text-[var(--muted)]">
                          {event.domain.icon} {event.domain.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-orange-400">
                        {format(new Date(event.date + 'T00:00:00'), 'MMM d')}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-300">
                        Event
                      </span>
                    </div>
                  </div>
                ))}
                {/* Tasks */}
                {triageTasks[triageTab].map(task => (
                  <div
                    key={task.id}
                    className={`p-4 hover:bg-[var(--card-hover)] cursor-pointer transition-colors ${
                      triageTab === 'missed' ? 'border-l-4 border-orange-500' : ''
                    } ${triageTab === 'overdue' ? 'border-l-4 border-red-500' : ''} ${
                      triageTab === 'archived' ? 'border-l-4 border-gray-500 opacity-75' : ''
                    }`}
                    onClick={() => handleEditTask(task)}
                  >
                    <div className="flex items-center justify-between">
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
                        <span className={`px-2 py-0.5 rounded text-xs ${getTaskPriorityColor(task.taskPriority)}`}>
                          {task.taskPriority.split(' - ')[1]}
                        </span>
                      </div>
                    </div>
                    {triageTab === 'blocked' && task.blockedBy && task.blockedBy.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-xs text-[var(--muted)]">Blocked by:</span>
                        {task.blockedBy.map((entry, i) => (
                          <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${entry.type === 'task' ? 'bg-yellow-500/15 text-yellow-300' : 'bg-orange-500/15 text-orange-300'}`}>
                            {entry.type === 'task'
                              ? tasks.find(t => t.id === entry.taskId)?.taskName || 'Unknown'
                              : entry.note}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Planning View */}
      {mainView === 'planning' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Unscheduled Tasks */}
          <div className="w-full lg:w-72 lg:flex-shrink-0">
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

              {/* Suggest Next Task */}
              {!suggestNextDismissed && suggestNextRanked.length > 0 && (
                <div className="p-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-yellow-400 font-medium flex items-center gap-1">
                      &#x1f4a1; Suggested
                      <span className="relative group/info">
                        <span className="text-[var(--muted)] hover:text-yellow-400 cursor-help text-[10px]">&#x24D8;</span>
                        <span className="absolute left-0 bottom-full mb-1 w-52 p-2 bg-[#252525] border border-[var(--border-color)] rounded-lg text-xs text-[var(--muted)] leading-relaxed shadow-xl opacity-0 pointer-events-none group-hover/info:opacity-100 group-hover/info:pointer-events-auto transition-opacity z-50">
                          Ranks unscheduled tasks by combining task score, deadline urgency, domain balance, and AP fit. Adjust weights via the &#x2699; button on the week view.
                        </span>
                      </span>
                    </span>
                    <button
                      onClick={() => setSuggestNextDismissed(true)}
                      className="text-[10px] text-[var(--muted)] hover:text-white"
                    >
                      Hide
                    </button>
                  </div>
                  <div
                    className="p-2 rounded border-2 border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10 cursor-pointer transition-colors"
                    onClick={() => handleEditTask(suggestNextRanked[0])}
                  >
                    <p className="text-white text-sm truncate">{suggestNextRanked[0].taskName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${getPriorityDotColor(suggestNextRanked[0].taskPriority)}`}></span>
                      {suggestNextRanked[0].domain?.icon && <span className="text-xs">{suggestNextRanked[0].domain.icon}</span>}
                      {suggestNextRanked[0].dueDate && (
                        <span className={`text-xs ${getDueDateColor(suggestNextRanked[0].dueDate)}`}>
                          Due {format(parseLocalDate(suggestNextRanked[0].dueDate), 'MMM d')}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--muted)]">AP:{getDisplayAP(suggestNextRanked[0])}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      onClick={() => setSuggestNextSkipIds(prev => new Set([...prev, suggestNextRanked[0].id]))}
                      className="px-2 py-1 text-xs text-[var(--muted)] hover:text-white bg-[var(--background)] hover:bg-[var(--card-hover)] rounded transition-colors"
                    >
                      Skip
                    </button>
                    {suggestNextSkipIds.size > 0 && (
                      <button
                        onClick={() => setSuggestNextSkipIds(new Set())}
                        className="px-2 py-1 text-xs text-[var(--muted)] hover:text-white hover:bg-[var(--card-hover)] rounded transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              {suggestNextDismissed && (
                <div className="px-2 py-1.5 border-b border-[var(--border-color)]">
                  <button
                    onClick={() => { setSuggestNextDismissed(false); setSuggestNextSkipIds(new Set()); }}
                    className="text-xs text-yellow-400/60 hover:text-yellow-400"
                  >
                    &#x1f4a1; Show suggestion
                  </button>
                </div>
              )}

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
                  aria-label="Previous"
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
                  aria-label="Next"
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

            {/* Suggest Week Controls (only visible in week view) */}
            {calendarView === 'week' && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-xs text-[var(--muted)]">AP:</span>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={suggestControls.dailyAPBudget}
                    onChange={(e) => updateSuggestControls({ ...suggestControls, dailyAPBudget: parseInt(e.target.value) })}
                    className="w-20 accent-blue-500"
                  />
                  <span className="text-xs text-white font-medium w-3">{suggestControls.dailyAPBudget}</span>
                </div>

                {suggestedAssignments.size === 0 ? (
                  <button
                    onClick={handleGenerateWeekSchedule}
                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    Suggest
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRerunWeekSchedule}
                      className="px-2 py-1 text-xs bg-[var(--background)] hover:bg-[var(--card-hover)] text-[var(--muted)] hover:text-white border border-[var(--border-color)] rounded transition-colors"
                    >
                      Re-run
                    </button>
                    <button
                      onClick={handleApplySuggestions}
                      disabled={pinnedTaskIds.size === 0}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        pinnedTaskIds.size > 0
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600/30 text-green-300/50 cursor-not-allowed'
                      }`}
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleDiscardSuggestions}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                      Discard
                    </button>
                    <span className="text-xs text-[var(--muted)]">
                      {suggestedAssignments.size} placed
                      {pinnedTaskIds.size > 0 && <> &middot; {pinnedTaskIds.size} pinned</>}
                    </span>
                  </>
                )}

                <button
                  onClick={() => setSuggestSettingsOpen(true)}
                  className="px-2 py-1 text-xs text-[var(--muted)] hover:text-white bg-[var(--background)] hover:bg-[var(--card-hover)] border border-[var(--border-color)] rounded transition-colors ml-auto"
                >
                  &#x2699;
                </button>
              </div>
            )}

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

                {/* Events for this day */}
                {eventsByDay[0]?.events.length > 0 && (
                  <div className="space-y-3 mb-3">
                    {eventsByDay[0].events.map(event => (
                      <div
                        key={event.id}
                        className="p-4 rounded-lg hover:bg-indigo-500/15 cursor-pointer transition-colors border-l-4 border-indigo-500 bg-indigo-500/5"
                        onClick={() => handleEditEvent(event)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-indigo-400">🕐</span>
                          <div className="flex-1">
                            <h3 className="text-indigo-300 font-medium">{event.eventName}</h3>
                            <div className="flex items-center gap-3 text-sm text-[var(--muted)] mt-1">
                              {event.time && (
                                <span>{new Date(`2000-01-01T${event.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                              )}
                              {event.duration && <span>{event.duration}min</span>}
                              {event.domain && <span>{event.domain.icon || '📁'} {event.domain.name}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenCreateTask(calendarDays[0])}
                      className="flex-1 p-3 text-[var(--muted)] hover:text-white bg-[var(--card-bg)] hover:bg-[var(--card-hover)] rounded-lg text-sm transition-colors"
                    >
                      + Add Task
                    </button>
                    <button
                      onClick={() => handleOpenCreateEvent(calendarDays[0])}
                      className="flex-1 p-3 text-[var(--muted)] hover:text-indigo-400 bg-[var(--card-bg)] hover:bg-[var(--card-hover)] rounded-lg text-sm transition-colors"
                    >
                      + Add Event
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Week View */}
            {calendarView === 'week' && (
              <div className="grid grid-cols-7 gap-2">
                {tasksByDay.map(({ date, tasks: dayTasks }) => {
                  const dayStr = format(date, 'yyyy-MM-dd');
                  const dayEvents = events.filter(e => e.date === dayStr);

                  // Get suggested tasks for this day
                  const suggestedTaskIds: string[] = [];
                  for (const [taskId, dateStr] of suggestedAssignments) {
                    if (dateStr === dayStr) suggestedTaskIds.push(taskId);
                  }
                  const suggestedTasks = suggestedTaskIds
                    .map(id => tasks.find(t => t.id === id))
                    .filter(Boolean) as Task[];

                  // Calculate AP for footer
                  const taskAP = dayTasks.reduce((sum, t) => sum + getDisplayAP(t), 0);
                  const eventAP = dayEvents.reduce((sum, e) => sum + (parseInt(e.actionPoints || '0') || suggestControls.defaultAP), 0);
                  const suggestedAP = suggestedTasks.reduce((sum, t) => sum + getDisplayAP(t), 0);
                  const totalAP = taskAP + eventAP + suggestedAP;
                  const hasSuggestions = suggestedTasks.length > 0;

                  return (
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
                        {dayEvents.map(event => renderCalendarEvent(event))}
                        {dayTasks.map(task => renderCalendarTask(task))}

                        {/* Suggested tasks (inline with dashed green border) */}
                        {suggestedTasks.map(task => {
                          const isPinned = pinnedTaskIds.has(task.id);
                          return (
                            <div
                              key={task.id}
                              className={`rounded p-1.5 transition-colors ${
                                isPinned
                                  ? 'border-2 border-green-500 bg-green-500/10'
                                  : 'border-2 border-dashed border-green-500/50 bg-green-500/5'
                              }`}
                            >
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-xs line-clamp-2">{task.taskName}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${getPriorityDotColor(task.taskPriority)}`}></span>
                                    {task.domain?.icon && <span className="text-[10px]">{task.domain.icon}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button
                                    onClick={() => handleTogglePin(task.id)}
                                    className={`p-0.5 rounded text-[10px] transition-colors ${
                                      isPinned
                                        ? 'text-green-400 hover:text-green-300'
                                        : 'text-[var(--muted)] hover:text-green-400'
                                    }`}
                                    title={isPinned ? 'Unpin' : 'Pin to this day'}
                                  >
                                    &#x1f4cc;
                                  </button>
                                  <button
                                    onClick={() => handleRemoveSuggestion(task.id)}
                                    className="p-0.5 rounded text-[10px] text-[var(--muted)] hover:text-red-400 transition-colors"
                                    title="Remove suggestion"
                                  >
                                    &#x2715;
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {draggedTaskId && dayTasks.length === 0 && !hasSuggestions && (
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
                      {/* AP usage footer */}
                      {(hasSuggestions || suggestedAssignments.size > 0) && (
                        <div className={`text-center py-0.5 text-[10px] ${
                          totalAP > suggestControls.dailyAPBudget ? 'text-red-400' : 'text-[var(--muted)]'
                        }`}>
                          AP: {totalAP}/{suggestControls.dailyAPBudget}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                          {(() => {
                            const dayStr = format(date, 'yyyy-MM-dd');
                            const dayEvents = events.filter(e => e.date === dayStr);
                            const allItems = [
                              ...dayEvents.map(e => ({ type: 'event' as const, item: e })),
                              ...dayTasks.map(t => ({ type: 'task' as const, item: t })),
                            ];
                            const visibleItems = allItems.slice(0, 3);
                            const overflowCount = allItems.length - 3;
                            return (
                              <>
                                {visibleItems.map(({ type, item }) =>
                                  type === 'event' ? (
                                    <div
                                      key={item.id}
                                      onClick={() => handleEditEvent(item as Event)}
                                      className="text-xs p-1 rounded truncate cursor-pointer bg-indigo-500/20 text-indigo-300 hover:opacity-80"
                                    >
                                      🕐 {(item as Event).eventName}
                                    </div>
                                  ) : (
                                    <div
                                      key={item.id}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, item.id)}
                                      onDragEnd={handleDragEnd}
                                      onClick={() => handleEditTask(item as Task)}
                                      className={`text-xs p-1 rounded truncate cursor-grab active:cursor-grabbing ${
                                        getTaskPriorityColor((item as Task).taskPriority)
                                      } hover:opacity-80 ${draggedTaskId === item.id ? 'opacity-50' : ''}`}
                                    >
                                      {(item as Task).taskName}
                                    </div>
                                  )
                                )}
                                {overflowCount > 0 && (
                                  <button
                                    onClick={() => navigateToDay(date)}
                                    className="text-xs text-[var(--muted)] hover:text-white text-center w-full transition-colors"
                                  >
                                    +{overflowCount} more
                                  </button>
                                )}
                              </>
                            );
                          })()}
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

      {/* Matrix View */}
      {mainView === 'matrix' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FilterButton filters={planFilters} values={filterValues} onChange={setFilterValues} />
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
          <EisenhowerMatrix tasks={filteredActiveTasks} onTaskClick={handleEditTask} />
        </div>
      )}

      {/* Suggest Settings Modal */}
      <Modal
        isOpen={suggestSettingsOpen}
        onClose={() => setSuggestSettingsOpen(false)}
        title="Suggest Settings"
      >
        <SuggestControlsComponent
          controls={suggestControls}
          onChange={updateSuggestControls}
          domains={domains}
        />
      </Modal>

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
          allTasks={tasks}
          projects={projects}
          onSubmit={handleTaskSubmit}
          onCancel={() => { setIsTaskModalOpen(false); setEditingTask(null); setSelectedDate(null); }}
        />
      </Modal>

      {/* Event Modal */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); setSelectedEventDate(null); }}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
        maxWidth="lg"
      >
        <EventForm
          event={editingEvent}
          domains={domains}
          onSubmit={handleEventSubmit}
          onCancel={() => { setIsEventModalOpen(false); setEditingEvent(null); setSelectedEventDate(null); }}
        />
      </Modal>
    </div>
  );
}

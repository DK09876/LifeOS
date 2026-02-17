'use client';

import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task, Domain, FilterPreset, Habit, checkNeedsReset, calculateTaskScore, isHabitDueToday } from './db';

// Core recurrence check logic - resets recurring tasks that are due
async function runRecurrenceCheckCore(): Promise<{ tasksReset: number }> {
  const allTasks = await db.tasks.toArray();
  let tasksReset = 0;

  for (const task of allTasks) {
    if (task.deletedAt) continue;
    if (checkNeedsReset(task)) {
      const newStatus = task.plannedDate ? 'Planned' : 'Backlog';
      await db.tasks.update(task.id, {
        status: newStatus,
        lastCompleted: null,
        doneDate: null,
        updatedAt: new Date().toISOString(),
      });
      tasksReset++;
    }
  }

  // Update the timestamp to mark when this ran
  const today = new Date().toISOString().slice(0, 10);
  await db.syncMetadata.put({
    id: 'recurrenceCheck',
    lastSyncedAt: today,
    googleDriveFileId: null,
    userEmail: null,
  });

  return { tasksReset };
}

// Hook to run daily auto-reset check for recurring tasks (runs once on app load)
export function useRecurrenceCheck() {
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const meta = await db.syncMetadata.get('recurrenceCheck');
      if (meta?.lastSyncedAt === today) return;

      await runRecurrenceCheckCore();
    })();
  }, []);
}

// Manual trigger for recurrence check - always runs regardless of last run time
export async function runRecurrenceCheck(): Promise<{ tasksReset: number; lastRun: string }> {
  const result = await runRecurrenceCheckCore();
  return {
    ...result,
    lastRun: new Date().toISOString(),
  };
}

// Get the last time recurrence check ran
export async function getRecurrenceCheckStatus(): Promise<{ lastRun: string | null }> {
  const meta = await db.syncMetadata.get('recurrenceCheck');
  return { lastRun: meta?.lastSyncedAt || null };
}

// Hook to get all tasks with computed fields
export function useTasks() {
  const tasks = useLiveQuery(async () => {
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    // Add computed fields
    return allTasks.map(task => {
      const domain = task.domainId ? domainMap.get(task.domainId) : null;
      return {
        ...task,
        domain: domain || null,
        domainPriority: domain?.priority || null,
      };
    }).sort((a, b) => b.taskScore - a.taskScore);
  }, []);

  return tasks || [];
}

// Hook to get all domains with task counts
export function useDomains() {
  const domains = useLiveQuery(async () => {
    const allDomains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);

    // Add task counts
    return allDomains.map(domain => ({
      ...domain,
      taskCount: allTasks.filter(t => t.domainId === domain.id).length,
    })).sort((a, b) => a.priority.localeCompare(b.priority));
  }, []);

  return domains || [];
}

// Hook to get a single task
export function useTask(id: string) {
  return useLiveQuery(async () => {
    const task = await db.tasks.get(id);
    if (!task) return null;

    const domain = task.domainId ? await db.domains.get(task.domainId) : null;
    return {
      ...task,
      domain: domain || null,
      domainPriority: domain?.priority || null,
    };
  }, [id]);
}

// Hook to get a single domain
export function useDomain(id: string) {
  return useLiveQuery(async () => {
    const domain = await db.domains.get(id);
    if (!domain) return null;

    const taskCount = await db.tasks.where('domainId').equals(id).count();
    return { ...domain, taskCount };
  }, [id]);
}

// Hook to get all filter presets
export function useFilterPresets() {
  const presets = useLiveQuery(async () => {
    const all = await db.filterPresets.orderBy('order').toArray();
    return all.filter(p => !p.deletedAt);
  }, []);

  return presets || [];
}

// Hook to get visible filter presets only
export function useVisibleFilterPresets() {
  const presets = useLiveQuery(async () => {
    const all = await db.filterPresets.orderBy('order').toArray();
    return all.filter(p => p.visible && !p.deletedAt);
  }, []);

  return presets || [];
}

// Filter preset actions
export async function createFilterPreset(presetData: {
  name: string;
  color: string;
  filters: FilterPreset['filters'];
  visible?: boolean;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Get max order (exclude tombstones)
  const allPresets = (await db.filterPresets.toArray()).filter(p => !p.deletedAt);
  const maxOrder = allPresets.length > 0 ? Math.max(...allPresets.map(p => p.order)) : -1;

  const preset: FilterPreset = {
    id,
    name: presetData.name,
    color: presetData.color,
    filters: presetData.filters,
    visible: presetData.visible ?? true,
    isDefault: false,
    order: maxOrder + 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.filterPresets.add(preset);
  return id;
}

export async function updateFilterPreset(presetId: string, updates: Partial<FilterPreset>): Promise<void> {
  await db.filterPresets.update(presetId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteFilterPreset(presetId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.filterPresets.update(presetId, { deletedAt: now, updatedAt: now });
}

export async function toggleFilterPresetVisibility(presetId: string): Promise<void> {
  const preset = await db.filterPresets.get(presetId);
  if (preset) {
    await db.filterPresets.update(presetId, {
      visible: !preset.visible,
      updatedAt: new Date().toISOString(),
    });
  }
}

// Check if a task has all required fields filled for auto-promotion
function isTaskComplete(task: Partial<Task>): boolean {
  return !!(
    task.taskName?.trim() &&
    task.taskPriority &&
    task.domainId &&
    task.actionPoints
  );
}

// Determine auto-status based on required field completeness and planned date
function autoStatus(task: Task): Task['status'] {
  if (task.status === 'Needs Details' && isTaskComplete(task)) {
    return task.plannedDate ? 'Planned' : 'Backlog';
  }
  if ((task.status === 'Backlog' || task.status === 'Planned') && !isTaskComplete(task)) {
    return 'Needs Details';
  }
  if (task.status === 'Backlog' && task.plannedDate) {
    return 'Planned';
  }
  if (task.status === 'Planned' && !task.plannedDate) {
    return 'Backlog';
  }
  return task.status;
}

// Task actions
export async function markTaskDone(taskId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.tasks.update(taskId, {
    status: 'Done',
    lastCompleted: now,
    doneDate: now,
    updatedAt: now,
  });
}

export async function undoTaskDone(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  await db.tasks.update(taskId, {
    status: task?.plannedDate ? 'Planned' : 'Backlog',
    doneDate: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function resetTask(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  await db.tasks.update(taskId, {
    status: task?.plannedDate ? 'Planned' : 'Backlog',
    lastCompleted: null,
    doneDate: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function createTask(taskData: {
  taskName: string;
  status?: Task['status'];
  taskPriority?: Task['taskPriority'];
  dueDate?: string | null;
  plannedDate?: string | null;
  recurrence?: Task['recurrence'];
  actionPoints?: string | null;
  notes?: string;
  domainId?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Get domain for score calculation
  let domainPriority: string | undefined;
  if (taskData.domainId) {
    const domain = await db.domains.get(taskData.domainId);
    domainPriority = domain?.priority;
  }

  const task: Task = {
    id,
    taskName: taskData.taskName,
    status: taskData.status || 'Needs Details',
    taskPriority: taskData.taskPriority || '3 - Normal',
    taskScore: 0, // Will be calculated
    dueDate: taskData.dueDate || null,
    plannedDate: taskData.plannedDate || null,
    recurrence: taskData.recurrence || 'None',
    lastCompleted: null,
    doneDate: null,
    actionPoints: taskData.actionPoints || null,
    notes: taskData.notes || '',
    domainId: taskData.domainId || null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  // Auto-promote/demote based on required fields
  task.status = autoStatus(task);

  // Calculate score
  task.taskScore = calculateTaskScore(task, domainPriority);

  await db.tasks.add(task);
  return id;
}

export async function updateTaskData(taskId: string, updates: Partial<Task>): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  // Recalculate score if relevant fields changed
  let taskScore = task.taskScore;
  if (updates.taskPriority || updates.dueDate !== undefined || updates.domainId !== undefined || updates.plannedDate !== undefined) {
    const domainId = updates.domainId !== undefined ? updates.domainId : task.domainId;
    let domainPriority: string | undefined;
    if (domainId) {
      const domain = await db.domains.get(domainId);
      domainPriority = domain?.priority;
    }
    taskScore = calculateTaskScore({ ...task, ...updates }, domainPriority);
  }

  // Auto-promote/demote based on required fields
  const merged = { ...task, ...updates, taskScore };
  const newStatus = autoStatus(merged);

  await db.tasks.update(taskId, {
    ...updates,
    status: updates.status !== undefined ? autoStatus({ ...merged, status: updates.status }) : newStatus,
    taskScore,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.tasks.update(taskId, { deletedAt: now, updatedAt: now });
}

// Domain actions
export async function createDomain(domainData: {
  name: string;
  icon?: string | null;
  priority?: Domain['priority'];
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const domain: Domain = {
    id,
    name: domainData.name,
    icon: domainData.icon ?? null,
    priority: domainData.priority || '3 - Maintenance',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.domains.add(domain);
  return id;
}

export async function updateDomainData(domainId: string, updates: Partial<Domain>): Promise<void> {
  await db.domains.update(domainId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  // If priority changed, recalculate all task scores for this domain
  if (updates.priority) {
    const tasks = await db.tasks.where('domainId').equals(domainId).toArray();
    for (const task of tasks) {
      const newScore = calculateTaskScore(task, updates.priority);
      await db.tasks.update(task.id, {
        taskScore: newScore,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function deleteDomain(domainId: string): Promise<void> {
  const now = new Date().toISOString();
  // Clear domain reference from non-deleted tasks
  const tasks = (await db.tasks.where('domainId').equals(domainId).toArray()).filter(t => !t.deletedAt);
  for (const task of tasks) {
    await db.tasks.update(task.id, {
      domainId: null,
      taskScore: calculateTaskScore(task, undefined),
      updatedAt: now,
    });
  }

  await db.domains.update(domainId, { deletedAt: now, updatedAt: now });
}

// Habit hooks and actions

// Hook to get all habits
export function useHabits() {
  const habits = useLiveQuery(async () => {
    const all = await db.habits.orderBy('habitName').toArray();
    return all.filter(h => !h.deletedAt);
  }, []);

  return habits || [];
}

// Hook to get habits that are due today (active and need completion)
export function useHabitsDueToday() {
  const habits = useLiveQuery(async () => {
    const allHabits = (await db.habits.toArray()).filter(h => !h.deletedAt);
    return allHabits.filter(habit => isHabitDueToday(habit));
  }, []);

  return habits || [];
}

// Mark a habit as done (sets lastCompleted to now and adds to completionDates)
export async function markHabitDone(habitId: string): Promise<void> {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  const now = new Date().toISOString();
  const todayStr = now.slice(0, 10); // YYYY-MM-DD

  // Add today to completionDates if not already there
  const completionDates = habit.completionDates || [];
  if (!completionDates.includes(todayStr)) {
    completionDates.push(todayStr);
  }

  await db.habits.update(habitId, {
    lastCompleted: now,
    completionDates,
    updatedAt: now,
  });
}

// Undo habit completion for today (removes today from completionDates)
export async function undoHabitDone(habitId: string): Promise<void> {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Remove today from completionDates
  const completionDates = (habit.completionDates || []).filter(d => d !== todayStr);

  // Find the most recent completion that's not today for lastCompleted
  const sortedDates = completionDates.sort().reverse();
  const lastCompleted = sortedDates.length > 0 ? new Date(sortedDates[0]).toISOString() : null;

  await db.habits.update(habitId, {
    lastCompleted,
    completionDates,
    updatedAt: new Date().toISOString(),
  });
}

// Hook to get habits completed today (for showing in Today view's completed section)
export function useHabitsCompletedToday() {
  const habits = useLiveQuery(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const allHabits = (await db.habits.toArray()).filter(h => !h.deletedAt);
    return allHabits.filter(habit =>
      habit.isActive && (habit.completionDates || []).includes(todayStr)
    );
  }, []);

  return habits || [];
}

// Create a new habit
export async function createHabit(habitData: {
  habitName: string;
  recurrence?: Habit['recurrence'];
  targetPerWeek?: number | null;
  notes?: string;
  icon?: string | null;
  isActive?: boolean;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const habit: Habit = {
    id,
    habitName: habitData.habitName,
    recurrence: habitData.recurrence || 'Daily',
    lastCompleted: null,
    targetPerWeek: habitData.targetPerWeek ?? null,
    completionDates: [],
    notes: habitData.notes || '',
    icon: habitData.icon ?? null,
    isActive: habitData.isActive ?? true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.habits.add(habit);
  return id;
}

// Update an existing habit
export async function updateHabitData(habitId: string, updates: Partial<Habit>): Promise<void> {
  await db.habits.update(habitId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// Delete a habit
export async function deleteHabit(habitId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.habits.update(habitId, { deletedAt: now, updatedAt: now });
}

// Toggle habit active/paused state
export async function toggleHabitActive(habitId: string): Promise<void> {
  const habit = await db.habits.get(habitId);
  if (habit) {
    await db.habits.update(habitId, {
      isActive: !habit.isActive,
      updatedAt: new Date().toISOString(),
    });
  }
}

import { addDays, addMonths, addYears } from 'date-fns';

import { clearAllOnServer, makeTable } from './store';
import { getTodayString, parseLocalDate, toDateString } from './dates';
import { BlockedByEntry } from '@/types';

// Database types - independent of external services
export interface Task {
  id: string;
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Planned' | 'Blocked' | 'Done' | 'Archived';
  // null means "not yet decided" - a task is only promoted out of Needs
  // Details once these are set. See isTaskComplete in lib/hooks.ts.
  taskPriority: '1 - Urgent' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Optional' | null;
  urgency: '1 - Critical' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Someday' | null;
  taskScore: number;
  importanceScore: number;
  urgencyScore: number;
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  lastCompleted: string | null;
  doneDate: string | null;
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  projectId: string | null;
  blockedBy: BlockedByEntry[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  status: 'Active' | 'Completed' | 'Archived';
  domainId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  id: string;
  name: string;
  icon: string | null;
  priority: '1 - Critical' | '2 - Important' | '3 - Maintenance';
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  color: string;
  filters: {
    priority?: string | string[];
    actionPoints?: string | string[];
    domain?: string | string[];
    recurrence?: string | string[];
    urgency?: string | string[];
    dueDate?: string | string[];
  };
  visible: boolean;
  isDefault: boolean;
  order: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  habitName: string;
  recurrence: 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  lastCompleted: string | null;
  targetPerWeek: number | null;
  completionDates: string[];
  // High water mark, carried forward. completionDates prune at 90 days, so a
  // best streak derived from them alone would quietly shrink over time.
  bestStreak: number | null;
  notes: string;
  icon: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  eventName: string;
  date: string;
  time: string | null;
  duration: number | null;
  actionPoints: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  lastCompleted: string | null;
  notes: string;
  domainId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Sync payload types
export interface SyncPayload {
  version: 2;
  tasks: Task[];
  domains: Domain[];
  habits: Habit[];
  events: Event[];
  projects?: Project[];
  filterPresets: FilterPreset[];
  preferences: Record<string, string>;
  exportedAt: string;
}

export const SYNCABLE_LOCALSTORAGE_KEYS = [
  'hideGetStarted',
  'domains-view-mode',
  'tasks-visible-columns',
  'tasks-sort-levels',
  'tasks-filters',
  'domains-visible-columns',
  'domains-sort-levels',
  'domains-filters',
  'plan-sort-levels',
  'plan-filters',
];

/**
 * Storage is the server; see lib/store.ts. These table objects expose the
 * slice of the old Dexie API the app used, so call sites did not change when
 * IndexedDB was retired. The local-first version is tagged
 * pre-server-migration if it is ever needed again.
 */
export const db = {
  tasks: makeTable<Task>('tasks'),
  domains: makeTable<Domain>('domains'),
  habits: makeTable<Habit>('habits'),
  events: makeTable<Event>('events'),
  projects: makeTable<Project>('projects'),
  filterPresets: makeTable<FilterPreset>('filterPresets'),
};

// Helper functions for common operations

export async function getAllTasks(): Promise<Task[]> {
  const all = await db.tasks.orderBy('taskScore').reverse().toArray();
  return all.filter(t => !t.deletedAt);
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.tasks.add({
    ...task,
    id,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  await db.tasks.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTask(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.tasks.update(id, { deletedAt: now, updatedAt: now });
}

export async function getAllDomains(): Promise<Domain[]> {
  const all = await db.domains.orderBy('priority').toArray();
  return all.filter(d => !d.deletedAt);
}

export async function getDomainById(id: string): Promise<Domain | undefined> {
  return db.domains.get(id);
}

export async function createDomain(domain: Omit<Domain, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.domains.add({
    ...domain,
    icon: domain.icon ?? null,
    id,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateDomain(id: string, updates: Partial<Domain>): Promise<void> {
  await db.domains.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDomain(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.domains.update(id, { deletedAt: now, updatedAt: now });
}

// Calculate task scores: importance, urgency, and combined
export function calculateTaskScores(
  task: Partial<Task>, domainPriority?: string
): { importanceScore: number; urgencyScore: number; combinedScore: number } {
  // Importance = task priority (10-50) + domain priority (10-30) → range 20-80
  const priorityScores: Record<string, number> = {
    '1 - Urgent': 50, '2 - High': 40, '3 - Normal': 30, '4 - Low': 20, '5 - Optional': 10,
  };
  const domainScores: Record<string, number> = {
    '1 - Critical': 30, '2 - Important': 20, '3 - Maintenance': 10,
  };
  const importanceScore = (priorityScores[task.taskPriority || '3 - Normal'] || 30)
    + (domainScores[domainPriority || '3 - Maintenance'] || 10);

  // Urgency = urgency field (10-50) + time pressure (0-70) → range 10-120.
  //
  // Time pressure answers "how much has the clock earned this task", and it
  // comes from one of two places:
  //
  //   a deadline    - how close (or how far past) the due date is
  //   neglect       - how long an undated task has sat untouched
  //
  // A real deadline outranks a vague intention, which is why the dated ladder
  // starts where it does and climbs higher. But neglect is its own kind of
  // deadline: something undated that has been ignored for three months is
  // more pressing than something due in three months, and without the second
  // ladder an undated task could never rise at all, however long it rotted.
  const urgencyFieldScores: Record<string, number> = {
    '1 - Critical': 50, '2 - High': 40, '3 - Normal': 30, '4 - Low': 20, '5 - Someday': 10,
  };

  let timePressure = 0;
  if (task.dueDate) {
    const days = Math.ceil((new Date(task.dueDate + 'T00:00:00').getTime() - new Date().getTime()) / 86400000);
    if (days < 0) {
      // Overdue escalates instead of saturating. A flat value meant a task a
      // day late and one three months late were indistinguishable, so nothing
      // ever visibly rotted.
      const late = -days;
      if (late === 1) timePressure = 50;
      else if (late === 2) timePressure = 53;
      else if (late === 3) timePressure = 56;
      else if (late === 4) timePressure = 59;
      else if (late === 5) timePressure = 62;
      else if (late <= 7) timePressure = 65;    // the rest of the first week
      else if (late <= 30) timePressure = 68;   // within the month
      else timePressure = 70;                   // over a month gone
    }
    else if (days === 0) timePressure = 45;
    else if (days === 1) timePressure = 40;
    else if (days === 2) timePressure = 35;
    else if (days <= 4) timePressure = 30;
    else if (days <= 7) timePressure = 25;
    else if (days <= 14) timePressure = 20;
    else if (days <= 30) timePressure = 15;
    else if (days <= 60) timePressure = 10;
    else timePressure = 5;
  } else {
    // No deadline: pressure accrues from neglect instead. Measured from the
    // last time the task was touched, not when it was created - editing or
    // rescheduling it means you are still engaged with it. The daily rescore
    // deliberately does not bump updatedAt, so this keeps accruing.
    const touched = task.updatedAt || task.createdAt;
    if (touched) {
      const age = Math.floor((new Date().getTime() - new Date(touched).getTime()) / 86400000);
      if (age >= 90) timePressure = 20;
      else if (age >= 60) timePressure = 15;
      else if (age >= 30) timePressure = 10;
      else if (age >= 14) timePressure = 5;
    }
  }

  const urgencyScore = (urgencyFieldScores[task.urgency || '3 - Normal'] || 30) + timePressure;

  const combinedScore = Math.round((importanceScore * urgencyScore) / 100);
  return { importanceScore, urgencyScore, combinedScore };
}

// Backward-compat wrapper
export function calculateTaskScore(task: Partial<Task>, domainPriority?: string): number {
  return calculateTaskScores(task, domainPriority).combinedScore;
}

/**
 * Move a date one recurrence interval past `from`.
 *
 * Anchored on when the task was actually completed rather than on its old
 * due date: a weekly task finished three days late recurs a week from the
 * finish, not a week from a date already in the past. Without this the reset
 * left the old dates untouched and the task came back permanently overdue.
 */
export function advanceDate(from: Date, recurrence: Task['recurrence']): Date | null {
  switch (recurrence) {
    case 'Daily': return addDays(from, 1);
    case 'Weekly': return addDays(from, 7);
    case 'Biweekly': return addDays(from, 14);
    case 'Monthly': return addMonths(from, 1);
    case 'Bimonthly': return addMonths(from, 2);
    case 'Quarterly': return addMonths(from, 3);
    case 'Half-Yearly': return addMonths(from, 6);
    case 'Yearly': return addYears(from, 1);
    default: return null;
  }
}

/**
 * The due/planned dates a recurring task should carry after it is completed.
 *
 * The gap between planning and deadline is part of how the task is set up -
 * "plan it Wednesday, it is due Friday" - so the two dates move together
 * rather than collapsing onto the same day.
 */
export function nextRecurrenceDates(
  task: Pick<Task, 'recurrence' | 'dueDate' | 'plannedDate' | 'lastCompleted'>,
): { dueDate: string | null; plannedDate: string | null } {
  const completedAt = task.lastCompleted ? new Date(task.lastCompleted) : new Date();
  const next = advanceDate(completedAt, task.recurrence);
  if (!next) return { dueDate: task.dueDate, plannedDate: task.plannedDate };

  const nextStr = toDateString(next);
  // Anchor on whichever date the task actually had; if it had both, keep the
  // number of days between them.
  if (task.dueDate && task.plannedDate) {
    const gap = Math.round(
      (parseLocalDate(task.dueDate).getTime() - parseLocalDate(task.plannedDate).getTime()) / 86400000,
    );
    return { dueDate: nextStr, plannedDate: toDateString(addDays(next, -gap)) };
  }
  return {
    dueDate: task.dueDate ? nextStr : null,
    plannedDate: task.plannedDate ? nextStr : null,
  };
}

// Check if a recurring task needs reset
export function checkNeedsReset(task: Task): boolean {
  if (task.recurrence === 'None' || task.status !== 'Done' || !task.lastCompleted) {
    return false;
  }

  const lastCompleted = new Date(task.lastCompleted);
  const now = new Date();

  switch (task.recurrence) {
    case 'Daily':
      return now.getTime() - lastCompleted.getTime() >= 24 * 60 * 60 * 1000;
    case 'Weekly':
      return now.getTime() - lastCompleted.getTime() >= 7 * 24 * 60 * 60 * 1000;
    case 'Biweekly':
      return now.getTime() - lastCompleted.getTime() >= 14 * 24 * 60 * 60 * 1000;
    case 'Monthly':
      return now.getMonth() !== lastCompleted.getMonth() || now.getFullYear() !== lastCompleted.getFullYear();
    case 'Bimonthly': {
      const diffMonths = (now.getFullYear() - lastCompleted.getFullYear()) * 12 + (now.getMonth() - lastCompleted.getMonth());
      return diffMonths >= 2;
    }
    case 'Quarterly': {
      const lastQ = Math.floor(lastCompleted.getMonth() / 3);
      const nowQ = Math.floor(now.getMonth() / 3);
      return nowQ !== lastQ || now.getFullYear() !== lastCompleted.getFullYear();
    }
    case 'Half-Yearly': {
      const diffMonthsHY = (now.getFullYear() - lastCompleted.getFullYear()) * 12 + (now.getMonth() - lastCompleted.getMonth());
      return diffMonthsHY >= 6;
    }
    case 'Yearly':
      return now.getFullYear() !== lastCompleted.getFullYear();
    default:
      return false;
  }
}

// Clear all data (for logout/reset)
export async function clearAllData(): Promise<void> {
  // One request, wiped inside a SQLite transaction. Clearing each collection
  // separately meant a failure part-way left the profile half-deleted.
  await clearAllOnServer();
}

// Filter Preset CRUD operations

export async function getAllFilterPresets(): Promise<FilterPreset[]> {
  const all = await db.filterPresets.orderBy('order').toArray();
  return all.filter(p => !p.deletedAt);
}

export async function getVisibleFilterPresets(): Promise<FilterPreset[]> {
  const all = await db.filterPresets.orderBy('order').toArray();
  return all.filter(p => p.visible && !p.deletedAt);
}

export async function getFilterPresetById(id: string): Promise<FilterPreset | undefined> {
  return db.filterPresets.get(id);
}

export async function createFilterPreset(preset: Omit<FilterPreset, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.filterPresets.add({
    ...preset,
    id,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateFilterPreset(id: string, updates: Partial<FilterPreset>): Promise<void> {
  await db.filterPresets.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteFilterPreset(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.filterPresets.update(id, { deletedAt: now, updatedAt: now });
}

export async function reorderFilterPresets(orderedIds: string[]): Promise<void> {
  // Was one HTTP request per preset; now a single bulk write.
  const now = new Date().toISOString();
  const byId = new Map((await db.filterPresets.toArray()).map((preset) => [preset.id, preset]));
  const updated = orderedIds
    .map((id, index) => {
      const preset = byId.get(id);
      return preset ? { ...preset, order: index, updatedAt: now } : null;
    })
    .filter((preset): preset is FilterPreset => preset !== null);
  await db.filterPresets.bulkPut(updated);
}

// Habit functions

// Get start of current week (Monday) as YYYY-MM-DD string
export function getStartOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust to Monday (day 0 = Sunday, so we go back 6 days; day 1 = Monday, go back 0 days, etc.)
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return toDateString(d);
}

// Count completions within the current week for a habit
export function getCompletionsThisWeek(habit: Habit): number {
  const weekStart = getStartOfWeek();
  return (habit.completionDates || []).filter(dateStr => dateStr >= weekStart).length;
}

// Check if a habit is due today (similar logic to checkNeedsReset but returns true when due)
export function isHabitDueToday(habit: Habit): boolean {
  if (!habit.isActive) {
    return false;
  }

  // Asked for at most once a day, whatever the cadence or quota. This used to
  // sit below the targetPerWeek branch, which returned purely on the weekly
  // count - so a habit completed today stayed in the due list and showed up
  // under "completed today" at the same time.
  if ((habit.completionDates || []).includes(getTodayString())) {
    return false;
  }

  // A weekly quota - "three times a week" - governs how often it is asked for
  // within the week, in place of the recurrence interval.
  if (habit.targetPerWeek && habit.targetPerWeek > 0) {
    return getCompletionsThisWeek(habit) < habit.targetPerWeek;
  }

  // If never completed, it's due
  if (!habit.lastCompleted) {
    return true;
  }

  const lastCompleted = new Date(habit.lastCompleted);
  const now = new Date();

  switch (habit.recurrence) {
    case 'Daily':
      // Due if last completed was not today
      return lastCompleted.toDateString() !== now.toDateString();
    case 'Weekly':
      return now.getTime() - lastCompleted.getTime() >= 7 * 24 * 60 * 60 * 1000;
    case 'Biweekly':
      return now.getTime() - lastCompleted.getTime() >= 14 * 24 * 60 * 60 * 1000;
    case 'Monthly':
      return now.getMonth() !== lastCompleted.getMonth() || now.getFullYear() !== lastCompleted.getFullYear();
    case 'Bimonthly': {
      const diffMonths = (now.getFullYear() - lastCompleted.getFullYear()) * 12 + (now.getMonth() - lastCompleted.getMonth());
      return diffMonths >= 2;
    }
    case 'Quarterly': {
      const lastQ = Math.floor(lastCompleted.getMonth() / 3);
      const nowQ = Math.floor(now.getMonth() / 3);
      return nowQ !== lastQ || now.getFullYear() !== lastCompleted.getFullYear();
    }
    case 'Half-Yearly': {
      const diffMonthsHY = (now.getFullYear() - lastCompleted.getFullYear()) * 12 + (now.getMonth() - lastCompleted.getMonth());
      return diffMonthsHY >= 6;
    }
    case 'Yearly':
      return now.getFullYear() !== lastCompleted.getFullYear();
    default:
      return false;
  }
}

export async function getAllHabits(): Promise<Habit[]> {
  const all = await db.habits.orderBy('habitName').toArray();
  return all.filter(h => !h.deletedAt);
}

export async function getHabitById(id: string): Promise<Habit | undefined> {
  return db.habits.get(id);
}

export async function createHabit(habit: Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.habits.add({
    ...habit,
    id,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateHabit(id: string, updates: Partial<Habit>): Promise<void> {
  await db.habits.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteHabit(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.habits.update(id, { deletedAt: now, updatedAt: now });
}

// Prune completionDates older than retentionDays to prevent unbounded growth
export function pruneCompletionDates(dates: string[], retentionDays: number = 90): string[] {
  const cutoff = toDateString(new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000));
  return dates.filter(d => d >= cutoff);
}

// Event CRUD operations

export async function getAllEvents(): Promise<Event[]> {
  const all = await db.events.toArray();
  return all.filter(e => !e.deletedAt);
}

export async function getEventById(id: string): Promise<Event | undefined> {
  return db.events.get(id);
}

export async function createEvent(event: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.events.add({
    ...event,
    id,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateEvent(id: string, updates: Partial<Event>): Promise<void> {
  await db.events.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.events.update(id, { deletedAt: now, updatedAt: now });
}

// Project CRUD operations

export async function getAllProjects(): Promise<Project[]> {
  const all = await db.projects.toArray();
  return all.filter(p => !p.deletedAt);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.projects.add({
    ...project,
    id,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  await db.projects.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteProject(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.projects.update(id, { deletedAt: now, updatedAt: now });
}

// Check if a recurring event needs reset (same logic as checkNeedsReset but for Event type)
/**
 * The date a recurring event should move to once its occurrence is done.
 *
 * Anchored on the event's own date rather than on when it was ticked off:
 * an event is an appointment, and a standing Monday meeting marked done on
 * Tuesday should still be next Monday, not drift a day each week. (Tasks use
 * the completion date instead - see nextRecurrenceDates.)
 */
export function nextEventDate(event: Pick<Event, 'date' | 'recurrence'>): string | null {
  const next = advanceDate(parseLocalDate(event.date), event.recurrence);
  return next ? toDateString(next) : null;
}

export function checkEventNeedsReset(event: Event): boolean {
  if (event.recurrence === 'None' || !event.lastCompleted) {
    return false;
  }

  const lastCompleted = new Date(event.lastCompleted);
  const now = new Date();

  switch (event.recurrence) {
    case 'Daily':
      return now.getTime() - lastCompleted.getTime() >= 24 * 60 * 60 * 1000;
    case 'Weekly':
      return now.getTime() - lastCompleted.getTime() >= 7 * 24 * 60 * 60 * 1000;
    case 'Biweekly':
      return now.getTime() - lastCompleted.getTime() >= 14 * 24 * 60 * 60 * 1000;
    case 'Monthly':
      return now.getMonth() !== lastCompleted.getMonth() || now.getFullYear() !== lastCompleted.getFullYear();
    case 'Bimonthly': {
      const diffMonths = (now.getFullYear() - lastCompleted.getFullYear()) * 12 + (now.getMonth() - lastCompleted.getMonth());
      return diffMonths >= 2;
    }
    case 'Quarterly': {
      const lastQ = Math.floor(lastCompleted.getMonth() / 3);
      const nowQ = Math.floor(now.getMonth() / 3);
      return nowQ !== lastQ || now.getFullYear() !== lastCompleted.getFullYear();
    }
    case 'Half-Yearly': {
      const diffMonthsHY = (now.getFullYear() - lastCompleted.getFullYear()) * 12 + (now.getMonth() - lastCompleted.getMonth());
      return diffMonthsHY >= 6;
    }
    case 'Yearly':
      return now.getFullYear() !== lastCompleted.getFullYear();
    default:
      return false;
  }
}

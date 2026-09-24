import { clearAllOnServer, makeTable } from './store';
import type { Task, Domain, Habit, Event, Project, Note } from '@/types';

// One definition of each record type, in types/index.ts; re-exported here
// because most of the app has always imported them from lib/db.
export type { Task, Domain, Habit, Event, Project, Note, ProgressEntry, ListItem, MilestoneRecord } from '@/types';

// The pure rules live in their own modules so the server can share them.
export {
  advanceDate, cycleDueDate, nextRecurrenceDates, followingOccurrence, nextOnDate, seriesEnded,
  checkNeedsReset, projectOccurrences, nextEventDate, currentEventDate, checkEventNeedsReset,
  previousEventDate, getStartOfWeek, getCompletionsThisWeek, isHabitDueOn, isHabitDueToday,
  pruneCompletionDates, localDay,
} from './recurrence';
export { calculateTaskScores, effectiveDueDate, isOverdue, isPressingBlocked } from './scoring';

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

// Sync payload types
export interface SyncPayload {
  version: 2;
  tasks: Task[];
  domains: Domain[];
  habits: Habit[];
  events: Event[];
  projects?: Project[];
  notes?: Note[];
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
  notes: makeTable<Note>('notes'),
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

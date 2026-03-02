import Dexie, { Table } from 'dexie';
import { toDateString } from './dates';
import { BlockedByEntry } from '@/types';

// Database types - independent of external services
export interface Task {
  id: string;
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Planned' | 'Blocked' | 'Done' | 'Archived';
  taskPriority: '1 - Urgent' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Optional';
  urgency: '1 - Critical' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Someday';
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

export interface SyncMetadata {
  id: string;
  lastSyncedAt: string | null;
  googleDriveFileId: string | null;
  userEmail: string | null;
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

// Dexie database class
class LifeOSDatabase extends Dexie {
  tasks!: Table<Task, string>;
  domains!: Table<Domain, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  filterPresets!: Table<FilterPreset, string>;
  habits!: Table<Habit, string>;
  events!: Table<Event, string>;
  projects!: Table<Project, string>;

  constructor() {
    super('LifeOSDatabase');

    this.version(1).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt',
      domains: 'id, name, priority, updatedAt',
      syncMetadata: 'id',
    });

    // Version 2: Add icon field to domains
    this.version(2).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt',
      domains: 'id, name, priority, updatedAt',
      syncMetadata: 'id',
    }).upgrade(tx => {
      // Add icon: null to all existing domains
      return tx.table('domains').toCollection().modify(domain => {
        if (domain.icon === undefined) {
          domain.icon = null;
        }
      });
    });

    // Version 3: Promote Backlog tasks with plannedDate to Planned status
    this.version(3).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt',
      domains: 'id, name, priority, updatedAt',
      syncMetadata: 'id',
    }).upgrade(tx => {
      return tx.table('tasks').toCollection().modify(task => {
        if (task.plannedDate && task.status === 'Backlog') {
          task.status = 'Planned';
          task.updatedAt = new Date().toISOString();
        }
      });
    });

    // Version 4: Add doneDate field to tasks
    this.version(4).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt',
      domains: 'id, name, priority, updatedAt',
      syncMetadata: 'id',
    }).upgrade(tx => {
      return tx.table('tasks').toCollection().modify(task => {
        if (task.doneDate === undefined) {
          task.doneDate = null;
        }
      });
    });

    // Version 5: Add filter presets table with default presets
    this.version(5).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt',
      domains: 'id, name, priority, updatedAt',
      syncMetadata: 'id',
      filterPresets: 'id, name, order',
    }).upgrade(async tx => {
      const now = new Date().toISOString();
      const defaultPresets: FilterPreset[] = [
        {
          id: 'preset-all',
          name: 'All',
          color: 'blue',
          filters: { priority: 'all', actionPoints: 'all' },
          visible: true,
          isDefault: true,
          order: 0,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'preset-urgent',
          name: 'Urgent',
          color: 'red',
          filters: { priority: '1 - Urgent', actionPoints: 'all' },
          visible: true,
          isDefault: true,
          order: 1,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'preset-low-ap',
          name: 'Low AP',
          color: 'green',
          filters: { priority: 'all', actionPoints: 'low' },
          visible: true,
          isDefault: true,
          order: 2,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'preset-med-ap',
          name: 'Med AP',
          color: 'yellow',
          filters: { priority: 'all', actionPoints: 'med' },
          visible: true,
          isDefault: true,
          order: 3,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'preset-high-ap',
          name: 'High AP',
          color: 'red',
          filters: { priority: 'all', actionPoints: 'high' },
          visible: true,
          isDefault: true,
          order: 4,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ];
      await tx.table('filterPresets').bulkAdd(defaultPresets);
    });

    // Version 6: Add habits table
    this.version(6).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt',
      domains: 'id, name, priority, updatedAt',
      syncMetadata: 'id',
      filterPresets: 'id, name, order',
      habits: 'id, habitName, recurrence, isActive, updatedAt',
    });

    // Version 7: Add targetPerWeek and completionDates to habits
    this.version(7).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt',
      domains: 'id, name, priority, updatedAt',
      syncMetadata: 'id',
      filterPresets: 'id, name, order',
      habits: 'id, habitName, recurrence, isActive, updatedAt',
    }).upgrade(tx => {
      return tx.table('habits').toCollection().modify(habit => {
        if (habit.targetPerWeek === undefined) {
          habit.targetPerWeek = null;
        }
        if (habit.completionDates === undefined) {
          habit.completionDates = [];
        }
      });
    });

    // Version 8: Add deletedAt for tombstone-based soft deletes
    this.version(8).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt, deletedAt',
      domains: 'id, name, priority, updatedAt, deletedAt',
      syncMetadata: 'id',
      filterPresets: 'id, name, order, deletedAt',
      habits: 'id, habitName, recurrence, isActive, updatedAt, deletedAt',
    }).upgrade(async tx => {
      await tx.table('tasks').toCollection().modify(task => {
        if (task.deletedAt === undefined) task.deletedAt = null;
      });
      await tx.table('domains').toCollection().modify(domain => {
        if (domain.deletedAt === undefined) domain.deletedAt = null;
      });
      await tx.table('filterPresets').toCollection().modify(preset => {
        if (preset.deletedAt === undefined) preset.deletedAt = null;
      });
      await tx.table('habits').toCollection().modify(habit => {
        if (habit.deletedAt === undefined) habit.deletedAt = null;
      });
    });

    // Version 9: Convert filter preset string values to arrays for multi-select
    this.version(9).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt, deletedAt',
      domains: 'id, name, priority, updatedAt, deletedAt',
      syncMetadata: 'id',
      filterPresets: 'id, name, order, deletedAt',
      habits: 'id, habitName, recurrence, isActive, updatedAt, deletedAt',
    }).upgrade(async tx => {
      await tx.table('filterPresets').toCollection().modify(preset => {
        for (const key of ['priority', 'actionPoints', 'domain', 'recurrence'] as const) {
          const val = preset.filters[key];
          if (typeof val === 'string') {
            preset.filters[key] = val === 'all' ? [] : [val];
          }
        }
      });
    });

    // Version 10: Add urgency + importance/urgency scores to tasks, add events table
    this.version(10).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, updatedAt, deletedAt',
      domains: 'id, name, priority, updatedAt, deletedAt',
      syncMetadata: 'id',
      filterPresets: 'id, name, order, deletedAt',
      habits: 'id, habitName, recurrence, isActive, updatedAt, deletedAt',
      events: 'id, eventName, date, domainId, updatedAt, deletedAt',
    }).upgrade(async tx => {
      const domains = await tx.table('domains').toArray();
      const domainMap = new Map(domains.map((d: Domain) => [d.id, d.priority]));
      await tx.table('tasks').toCollection().modify((task: Task) => {
        if (task.urgency === undefined) (task as unknown as Record<string, unknown>).urgency = '3 - Normal';
        const dp = task.domainId ? domainMap.get(task.domainId) : undefined;
        const scores = calculateTaskScores(task, dp);
        task.importanceScore = scores.importanceScore;
        task.urgencyScore = scores.urgencyScore;
        task.taskScore = scores.combinedScore;
      });
    });

    // Version 11: Add projects table, blockedBy + projectId to tasks
    this.version(11).stores({
      tasks: 'id, taskName, status, taskPriority, taskScore, dueDate, domainId, projectId, updatedAt, deletedAt',
      domains: 'id, name, priority, updatedAt, deletedAt',
      syncMetadata: 'id',
      filterPresets: 'id, name, order, deletedAt',
      habits: 'id, habitName, recurrence, isActive, updatedAt, deletedAt',
      events: 'id, eventName, date, domainId, updatedAt, deletedAt',
      projects: 'id, name, status, domainId, updatedAt, deletedAt',
    }).upgrade(async tx => {
      await tx.table('tasks').toCollection().modify(task => {
        if (task.blockedBy === undefined) task.blockedBy = [];
        if (task.projectId === undefined) task.projectId = null;
      });
    });
  }
}

// Create database instance
export const db = new LifeOSDatabase();

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

// Get sync metadata
export async function getSyncMetadata(): Promise<SyncMetadata | undefined> {
  return db.syncMetadata.get('main');
}

// Update sync metadata
export async function updateSyncMetadata(updates: Partial<SyncMetadata>): Promise<void> {
  const existing = await getSyncMetadata();
  if (existing) {
    await db.syncMetadata.update('main', updates);
  } else {
    await db.syncMetadata.add({
      id: 'main',
      lastSyncedAt: null,
      googleDriveFileId: null,
      userEmail: null,
      ...updates,
    });
  }
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

  // Urgency = urgency field (10-50) + due date proximity (0-50) → range 10-100
  const urgencyFieldScores: Record<string, number> = {
    '1 - Critical': 50, '2 - High': 40, '3 - Normal': 30, '4 - Low': 20, '5 - Someday': 10,
  };
  let dueDateBonus = 0;
  if (task.dueDate) {
    const days = Math.ceil((new Date(task.dueDate + 'T00:00:00').getTime() - new Date().getTime()) / 86400000);
    if (days < 0) dueDateBonus = 50;
    else if (days === 0) dueDateBonus = 45;
    else if (days === 1) dueDateBonus = 40;
    else if (days === 2) dueDateBonus = 35;
    else if (days <= 4) dueDateBonus = 30;
    else if (days <= 7) dueDateBonus = 25;
    else if (days <= 14) dueDateBonus = 20;
    else if (days <= 30) dueDateBonus = 15;
    else if (days <= 60) dueDateBonus = 10;
    else dueDateBonus = 5;
  }
  const urgencyScore = (urgencyFieldScores[task.urgency || '3 - Normal'] || 30) + dueDateBonus;

  const combinedScore = Math.round((importanceScore * urgencyScore) / 100);
  return { importanceScore, urgencyScore, combinedScore };
}

// Backward-compat wrapper
export function calculateTaskScore(task: Partial<Task>, domainPriority?: string): number {
  return calculateTaskScores(task, domainPriority).combinedScore;
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

// Export all data for sync (includes tombstones for deletion propagation)
export async function exportAllData(): Promise<SyncPayload> {
  const [tasks, domains, habits, events, projects, filterPresets] = await Promise.all([
    db.tasks.toArray(),
    db.domains.toArray(),
    db.habits.toArray(),
    db.events.toArray(),
    db.projects.toArray(),
    db.filterPresets.toArray(),
  ]);

  // Collect syncable localStorage preferences
  const preferences: Record<string, string> = {};
  for (const key of SYNCABLE_LOCALSTORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      preferences[key] = value;
    }
  }

  return {
    version: 2,
    tasks,
    domains,
    habits,
    events,
    projects,
    filterPresets,
    preferences,
    exportedAt: new Date().toISOString(),
  };
}

// Replace all local data with remote data (full replace, not merge)
export async function replaceAllData(data: SyncPayload | { tasks: Task[]; domains: Domain[]; habits?: Habit[]; events?: Event[]; projects?: Project[]; exportedAt: string }): Promise<void> {
  await db.transaction('rw', [db.tasks, db.domains, db.habits, db.events, db.projects, db.filterPresets], async () => {
    // Clear all tables
    await db.tasks.clear();
    await db.domains.clear();
    await db.habits.clear();
    await db.events.clear();
    await db.projects.clear();
    await db.filterPresets.clear();

    // Bulk insert all remote data (with deletedAt fallback for backward compat)
    await db.domains.bulkAdd(data.domains.map(d => ({ ...d, deletedAt: d.deletedAt ?? null })));
    await db.tasks.bulkAdd(data.tasks.map(t => ({ ...t, deletedAt: t.deletedAt ?? null, blockedBy: t.blockedBy ?? [], projectId: t.projectId ?? null })));

    if (data.habits) {
      await db.habits.bulkAdd(data.habits.map(h => ({ ...h, deletedAt: h.deletedAt ?? null })));
    }

    const events = 'events' in data ? data.events : undefined;
    if (events) {
      await db.events.bulkAdd(events.map(ev => ({ ...ev, deletedAt: ev.deletedAt ?? null })));
    }

    const projects = 'projects' in data ? data.projects : undefined;
    if (projects) {
      await db.projects.bulkAdd(projects.map(p => ({ ...p, deletedAt: p.deletedAt ?? null })));
    }

    if ('filterPresets' in data && data.filterPresets) {
      await db.filterPresets.bulkAdd(
        (data as SyncPayload).filterPresets.map(p => ({ ...p, deletedAt: p.deletedAt ?? null }))
      );
    }
  });

  // Replace localStorage preferences from payload
  if ('preferences' in data && data.preferences) {
    for (const key of SYNCABLE_LOCALSTORAGE_KEYS) {
      if (key in data.preferences) {
        localStorage.setItem(key, data.preferences[key]);
      } else {
        localStorage.removeItem(key);
      }
    }
    // Dispatch storage event so Sidebar/ViewControls listeners update
    window.dispatchEvent(new Event('storage'));
  }
}

// Check if there are unsaved local changes since last sync
export async function hasUnsavedChanges(): Promise<boolean> {
  const syncMeta = await getSyncMetadata();
  if (!syncMeta?.lastSyncedAt) return true; // Never synced = has changes

  const lastSynced = new Date(syncMeta.lastSyncedAt).getTime();

  const [tasks, domains, habits, events, projects, filterPresets] = await Promise.all([
    db.tasks.toArray(),
    db.domains.toArray(),
    db.habits.toArray(),
    db.events.toArray(),
    db.projects.toArray(),
    db.filterPresets.toArray(),
  ]);

  const allRecords = [...tasks, ...domains, ...habits, ...events, ...projects, ...filterPresets];
  return allRecords.some(r => new Date(r.updatedAt).getTime() > lastSynced);
}

// Hard-delete tombstones older than retention period
export async function compactTombstones(retentionDays: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;

  await db.transaction('rw', [db.tasks, db.domains, db.habits, db.events, db.projects, db.filterPresets], async () => {
    const tables = [db.tasks, db.domains, db.habits, db.events, db.projects, db.filterPresets] as Table<{ id: string; deletedAt: string | null }, string>[];
    for (const table of tables) {
      const tombstones = await table.filter(r => !!r.deletedAt && r.deletedAt < cutoff).toArray();
      for (const record of tombstones) {
        await table.delete(record.id);
        purged++;
      }
    }
  });

  return purged;
}

// Clear all data (for logout/reset)
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.tasks, db.domains, db.syncMetadata, db.habits, db.events, db.projects, db.filterPresets], async () => {
    await db.tasks.clear();
    await db.domains.clear();
    await db.syncMetadata.clear();
    await db.habits.clear();
    await db.events.clear();
    await db.projects.clear();
    await db.filterPresets.clear();
  });
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
  await db.transaction('rw', db.filterPresets, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.filterPresets.update(orderedIds[i], { order: i, updatedAt: new Date().toISOString() });
    }
  });
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

  // If targetPerWeek is set, check if weekly goal is met
  if (habit.targetPerWeek && habit.targetPerWeek > 0) {
    const completionsThisWeek = getCompletionsThisWeek(habit);
    return completionsThisWeek < habit.targetPerWeek;
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

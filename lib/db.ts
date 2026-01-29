import Dexie, { Table } from 'dexie';

// Database types - independent of external services
export interface Task {
  id: string;
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Planned' | 'Blocked' | 'Done' | 'Archived';
  taskPriority: '1 - Urgent' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Optional';
  taskScore: number;
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  lastCompleted: string | null;
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  id: string;
  name: string;
  icon: string | null;
  priority: '1 - Critical' | '2 - Important' | '3 - Maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface SyncMetadata {
  id: string;
  lastSyncedAt: string | null;
  googleDriveFileId: string | null;
  userEmail: string | null;
}

// Dexie database class
class LifeOSDatabase extends Dexie {
  tasks!: Table<Task, string>;
  domains!: Table<Domain, string>;
  syncMetadata!: Table<SyncMetadata, string>;

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
  }
}

// Create database instance
export const db = new LifeOSDatabase();

// Helper functions for common operations

export async function getAllTasks(): Promise<Task[]> {
  return db.tasks.orderBy('taskScore').reverse().toArray();
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.tasks.add({
    ...task,
    id,
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
  await db.tasks.delete(id);
}

export async function getAllDomains(): Promise<Domain[]> {
  return db.domains.orderBy('priority').toArray();
}

export async function getDomainById(id: string): Promise<Domain | undefined> {
  return db.domains.get(id);
}

export async function createDomain(domain: Omit<Domain, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.domains.add({
    ...domain,
    icon: domain.icon ?? null,
    id,
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
  await db.domains.delete(id);
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

// Calculate task score based on priority, domain, and due date
export function calculateTaskScore(task: Partial<Task>, domainPriority?: string): number {
  let score = 0;

  // Task priority contribution (higher priority = higher score)
  const priorityScores: Record<string, number> = {
    '1 - Urgent': 50,
    '2 - High': 40,
    '3 - Normal': 30,
    '4 - Low': 20,
    '5 - Optional': 10,
  };
  score += priorityScores[task.taskPriority || '3 - Normal'] || 30;

  // Domain priority contribution
  const domainScores: Record<string, number> = {
    '1 - Critical': 30,
    '2 - Important': 20,
    '3 - Maintenance': 10,
  };
  score += domainScores[domainPriority || '3 - Maintenance'] || 10;

  // Due date contribution (closer = higher score)
  if (task.dueDate) {
    const now = new Date();
    const due = new Date(task.dueDate);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      score += 25; // Overdue
    } else if (daysUntilDue === 0) {
      score += 20; // Due today
    } else if (daysUntilDue <= 7) {
      score += 15; // Due this week
    } else if (daysUntilDue <= 30) {
      score += 10; // Due this month
    }
  }

  return score;
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

// Export all data for sync
export async function exportAllData(): Promise<{ tasks: Task[]; domains: Domain[]; exportedAt: string }> {
  const [tasks, domains] = await Promise.all([
    db.tasks.toArray(),
    db.domains.toArray(),
  ]);
  return {
    tasks,
    domains,
    exportedAt: new Date().toISOString(),
  };
}

// Import data from sync (merges with existing)
export async function importData(data: { tasks: Task[]; domains: Domain[]; exportedAt: string }): Promise<void> {
  await db.transaction('rw', [db.tasks, db.domains], async () => {
    // Import domains first (tasks reference them)
    for (const domain of data.domains) {
      const existing = await db.domains.get(domain.id);
      if (!existing || new Date(domain.updatedAt) > new Date(existing.updatedAt)) {
        await db.domains.put(domain);
      }
    }

    // Import tasks
    for (const task of data.tasks) {
      const existing = await db.tasks.get(task.id);
      if (!existing || new Date(task.updatedAt) > new Date(existing.updatedAt)) {
        await db.tasks.put(task);
      }
    }
  });
}

// Clear all data (for logout/reset)
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.tasks, db.domains, db.syncMetadata], async () => {
    await db.tasks.clear();
    await db.domains.clear();
    await db.syncMetadata.clear();
  });
}

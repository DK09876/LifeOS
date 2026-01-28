'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task, Domain, checkNeedsReset, calculateTaskScore } from './db';

// Hook to get all tasks with computed fields
export function useTasks() {
  const tasks = useLiveQuery(async () => {
    const allTasks = await db.tasks.toArray();
    const domains = await db.domains.toArray();
    const domainMap = new Map(domains.map(d => [d.id, d]));

    // Add computed fields
    return allTasks.map(task => {
      const domain = task.domainId ? domainMap.get(task.domainId) : null;
      return {
        ...task,
        needsReset: checkNeedsReset(task),
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
    const allDomains = await db.domains.toArray();
    const allTasks = await db.tasks.toArray();

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
      needsReset: checkNeedsReset(task),
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
    updatedAt: now,
  });
}

export async function undoTaskDone(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  await db.tasks.update(taskId, {
    status: task?.plannedDate ? 'Planned' : 'Backlog',
    updatedAt: new Date().toISOString(),
  });
}

export async function resetTask(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  await db.tasks.update(taskId, {
    status: task?.plannedDate ? 'Planned' : 'Backlog',
    lastCompleted: null,
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
    actionPoints: taskData.actionPoints || null,
    notes: taskData.notes || '',
    domainId: taskData.domainId || null,
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
  await db.tasks.delete(taskId);
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
  // Clear domain reference from tasks
  const tasks = await db.tasks.where('domainId').equals(domainId).toArray();
  for (const task of tasks) {
    await db.tasks.update(task.id, {
      domainId: null,
      taskScore: calculateTaskScore(task, undefined),
      updatedAt: new Date().toISOString(),
    });
  }

  await db.domains.delete(domainId);
}

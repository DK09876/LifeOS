import { db, calculateTaskScores } from './db';
import type { Task, Domain } from './db';

// Import Notion JSON data
import notionDomains from '../notion-data/domains.json';
import notionTasks from '../notion-data/tasks.json';

// Map Notion numeric priorities to app string priorities
const DOMAIN_PRIORITY_MAP: Record<number, Domain['priority']> = {
  1: '1 - Critical',
  2: '2 - Important',
  3: '3 - Maintenance',
};

const TASK_PRIORITY_MAP: Record<number, Task['taskPriority']> = {
  1: '1 - Urgent',
  2: '2 - High',
  3: '3 - Normal',
  4: '4 - Low',
  5: '5 - Optional',
};

const RECURRENCE_MAP: Record<string, Task['recurrence']> = {
  'None': 'None',
  'Daily': 'Daily',
  'Weekly': 'Weekly',
  'Biweekly': 'Biweekly',
  'Monthly': 'Monthly',
  'Quarterly': 'Quarterly',
  'Yearly': 'Yearly',
};

interface NotionDomain {
  id: string;
  name: string;
  priority: number;
  icon: string | null;
}

interface NotionTask {
  id: string;
  name: string;
  status: string;
  priority: number;
  domainId: string | null;
  dueDate: string | null;
  recurrence: string | null;
  lastCompleted: string | null;
  actionPoints: number | null;
  notes: string | null;
}

export async function seedDatabase(): Promise<boolean> {
  // Check if database already has data
  const existingDomains = await db.domains.count();
  const existingTasks = await db.tasks.count();

  if (existingDomains > 0 || existingTasks > 0) {
    console.log('Database already has data, skipping seed');
    return false;
  }

  console.log('Seeding database from Notion JSON...');
  const now = new Date().toISOString();

  // Create domain map for task score calculation
  const domainPriorityMap = new Map<string, string>();

  // Seed domains first
  const domains: Domain[] = (notionDomains as NotionDomain[]).map((nd) => {
    const priority = DOMAIN_PRIORITY_MAP[nd.priority] || '3 - Maintenance';
    domainPriorityMap.set(nd.id, priority);

    return {
      id: nd.id,
      name: nd.name,
      icon: nd.icon,
      priority,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Seed tasks
  const tasks: Task[] = (notionTasks as NotionTask[]).map((nt) => {
    const taskPriority = TASK_PRIORITY_MAP[nt.priority] || '3 - Normal';
    const domainPriority = nt.domainId ? domainPriorityMap.get(nt.domainId) : undefined;
    const recurrence = RECURRENCE_MAP[nt.recurrence || 'None'] || 'None';

    const task: Task = {
      id: nt.id,
      taskName: nt.name,
      status: nt.status as Task['status'],
      taskPriority,
      urgency: '3 - Normal',
      taskScore: 0,
      importanceScore: 0,
      urgencyScore: 0,
      dueDate: nt.dueDate,
      plannedDate: null,
      recurrence,
      lastCompleted: nt.lastCompleted,
      doneDate: null,
      actionPoints: nt.actionPoints?.toString() || null,
      notes: nt.notes || '',
      domainId: nt.domainId,
      projectId: null,
      blockedBy: [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Calculate task scores
    const scores = calculateTaskScores(task, domainPriority);
    task.importanceScore = scores.importanceScore;
    task.urgencyScore = scores.urgencyScore;
    task.taskScore = scores.combinedScore;

    return task;
  });

  // Insert into database
  await db.transaction('rw', [db.domains, db.tasks], async () => {
    await db.domains.bulkAdd(domains);
    await db.tasks.bulkAdd(tasks);
  });

  console.log(`Seeded ${domains.length} domains and ${tasks.length} tasks`);
  return true;
}

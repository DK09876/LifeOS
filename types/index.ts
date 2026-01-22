// LifeOS Types - Independent of any external service

export interface Task {
  id: string;
  taskName: string;
  status: 'Needs Details' | 'Backlog' | 'Blocked' | 'Done' | 'Archived';
  taskPriority: '1 - Urgent' | '2 - High' | '3 - Normal' | '4 - Low' | '5 - Optional';
  taskScore: number;
  dueDate: string | null;
  plannedDate: string | null;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  lastCompleted: string | null;
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed fields (not stored, calculated at runtime)
  needsReset?: boolean;
  domain?: Domain | null;
  domainPriority?: string | null;
}

export interface Domain {
  id: string;
  name: string;
  priority: '1 - Critical' | '2 - Important' | '3 - Maintenance';
  createdAt: string;
  updatedAt: string;
  // Computed fields
  taskCount?: number;
}

export interface TaskFilter {
  status?: string[];
  priority?: string[];
  domain?: string[];
  dueDate?: 'overdue' | 'today' | 'week' | 'all';
}

export type TaskStatus = Task['status'];
export type TaskPriority = Task['taskPriority'];
export type DomainPriority = Domain['priority'];
export type RecurrenceType = Task['recurrence'];

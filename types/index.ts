// LifeOS Types - Independent of any external service

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
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed fields (not stored, calculated at runtime)
  domain?: Domain | null;
  domainPriority?: string | null;
}

export interface Domain {
  id: string;
  name: string;
  icon: string | null;
  priority: '1 - Critical' | '2 - Important' | '3 - Maintenance';
  deletedAt: string | null;
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

export interface Habit {
  id: string;
  habitName: string;
  recurrence: 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  lastCompleted: string | null;  // ISO timestamp of last completion
  targetPerWeek: number | null;  // If set, habit is due until completed this many times per week
  completionDates: string[];     // Array of ISO date strings (YYYY-MM-DD) for tracking weekly progress
  notes: string;
  icon: string | null;           // Optional emoji for quick identification
  isActive: boolean;             // Pause without deleting
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type HabitRecurrence = Habit['recurrence'];
export type TaskUrgency = Task['urgency'];

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
  // Computed fields
  domain?: Domain | null;
}

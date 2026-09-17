// LifeOS Types - Independent of any external service

export type BlockedByEntry =
  | { type: 'task'; taskId: string }
  | { type: 'note'; note: string };

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
  // How the next occurrence is dated. 'completion' (the default) counts the
  // interval from when you finished, which suits anything you just want to do
  // every so often. 'schedule' counts it from the previous due date, so a
  // period with a fixed deadline - a fortnightly return, rent - keeps its
  // dates however early or late you actually get to it.
  recurrenceAnchor: 'completion' | 'schedule' | null;
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
  // High water mark, carried forward. completionDates prune at 90 days, so a
  // best streak derived from them alone would quietly shrink over time.
  bestStreak: number | null;
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
  // Computed fields (not stored)
  domain?: Domain | null;
  tasks?: Task[];
  taskCount?: number;
  completedTaskCount?: number;
  totalAP?: number;
  completedAP?: number;
  completionPercent?: number;
}

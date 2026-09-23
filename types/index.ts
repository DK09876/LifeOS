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
  // Which days a Weekly task lands on, 0=Sunday. Empty or null means "a week
  // after the last one", the original behaviour. [1,2,3,4,5] is weekdays.
  recurrenceWeekdays: number[] | null;
  lastCompleted: string | null;
  doneDate: string | null;
  actionPoints: string | null;
  notes: string;
  domainId: string | null;
  projectId: string | null;
  blockedBy: BlockedByEntry[];
  // When to look at a blocked task again. Until then it stays quiet and stops
  // accruing neglect - nagging about something you cannot act on only teaches
  // you to ignore the nagging. On the day, it asks to be chased or deferred.
  followUpDate: string | null;
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
  // What this costs out of a day, 0-5. Zero is meaningful and common here:
  // brushing your teeth is a habit worth keeping but not worth budgeting for.
  actionPoints: string | null;
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

export interface ProgressEntry {
  date: string;    // YYYY-MM-DD, local
  amount: number;
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  status: 'Active' | 'Completed' | 'Archived';
  domainId: string | null;
  // A project is one of two shapes, and they measure progress differently.
  //
  // 'bundle' is a finite pile of work - "get the house clean", five tasks,
  // done when they are all done. Progress is completed action points.
  //
  // 'target' is a goal reached by repetition - "read a page 300 times". It is
  // not tied to a task or a habit at all: you log what you did and the count
  // goes up. A recurring task could never express this, because a recurring
  // task is Done only between finishing it and the next rollover, so the
  // progress bar swung between 0% and 100% instead of accumulating.
  kind: 'bundle' | 'target';
  targetCount: number | null;
  targetUnit: string | null;   // "pages", "sessions", "km" - shown beside the count
  progressLog: ProgressEntry[];

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
  progress?: import('@/lib/progress').Progress;
}

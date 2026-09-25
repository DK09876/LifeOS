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
  // When the neglect clock last started. Deliberately not updatedAt: renaming
  // a task or sliding its plan is not looking after it, and measuring rot from
  // the last edit let a plan slid every day stay fresh for ever. Null means
  // "since it was created". Restarted when the task is unblocked or recurs.
  rotSince?: string | null;
  // How many times a plan was missed and moved. Each slip adds pressure: a
  // plan you keep sliding is a plan that is not working.
  slipCount?: number | null;
  // A repeating task that stops: "read a page a day until the book is done".
  // The last date an occurrence may fall on; null repeats indefinitely.
  recurrenceEnd?: string | null;
  // Local days this task was completed on. A recurring task clears doneDate
  // when it comes back, so without this its completions vanished from every
  // record of what you did.
  completions?: string[] | null;
  // Plans for occurrences after the one in hand, keyed by the date each
  // falls due. Lets one day of a repeating task be moved or skipped without
  // touching the rest. Applied when the series reaches that occurrence.
  occurrencePlans?: OccurrencePlan[] | null;
  // In a goal project: how much each completion counts towards it
  // (1 page, 5 km). Null means 1.
  progressAmount?: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed fields (not stored, calculated at runtime)
  domain?: Domain | null;
  domainPriority?: string | null;
}

export interface OccurrencePlan {
  /** The date this occurrence falls due on its own schedule. */
  due: string;
  /** The day it is planned for, or null for "not planned yet". */
  plannedDate: string | null;
  /** Skipped: this occurrence is not happening. */
  skipped?: boolean;
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
  // Which days it is asked for, 0=Sunday. Null or empty means every day (or,
  // with targetPerWeek, every day until the week's quota is met).
  weekdays?: number[] | null;
  // Lifetime count. completionDates prune at 90 days, so totals and
  // milestones cannot be derived from them.
  totalCompletions?: number | null;
  // Milestones reached, with the day each was reached.
  milestones?: MilestoneRecord[] | null;
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

export interface MilestoneRecord {
  key: string;   // e.g. "streak:30", "total:100"
  date: string;  // YYYY-MM-DD
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
  // Optional finish-by date for a target. Only used to show the pace needed;
  // the app never nags about it.
  targetDate?: string | null;
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

/**
 * Something to remember or a checklist, with no deadline and no effort.
 *
 * Deliberately not a task: a shopping list or "the wifi password is on the
 * router" has nothing to prioritise, plan or finish, and putting them in the
 * backlog only made the backlog less honest.
 */
export interface ListItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  kind: 'note' | 'list';
  body: string;
  items: ListItem[];
  pinned: boolean;
  domainId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

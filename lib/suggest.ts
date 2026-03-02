import { Task, Event } from '@/types';
import { parseLocalDate, toDateString } from './dates';
import { startOfDay, differenceInCalendarDays } from 'date-fns';

// --- Types ---

export interface SuggestControls {
  dailyAPBudget: number;       // 1-15, default 8
  defaultAP: number;           // 1-3, default 2
  domainFocus: string[];       // domain IDs, empty = all
  scoreWeight: number;         // 0-1, default 0.4
  deadlineWeight: number;      // 0-1, default 0.3
  balanceWeight: number;       // 0-1, default 0.15
  efficiencyWeight: number;    // 0-1, default 0.15
}

export const DEFAULT_SUGGEST_CONTROLS: SuggestControls = {
  dailyAPBudget: 8,
  defaultAP: 2,
  domainFocus: [],
  scoreWeight: 0.4,
  deadlineWeight: 0.3,
  balanceWeight: 0.15,
  efficiencyWeight: 0.15,
};

export interface ScoringContext {
  targetDay: Date;
  scheduledDomainCounts: Map<string, number>;  // domainId -> count of scheduled tasks
  remainingAP: number;
}

// --- Helpers ---

function getTaskAP(task: Task, defaultAP: number): number {
  return parseInt(task.actionPoints || '0') || defaultAP;
}

function getEventAP(event: Event, defaultAP: number): number {
  return parseInt(event.actionPoints || '0') || defaultAP;
}

/** Normalize a value to 0-1 given min/max range */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** Normalize weights so they sum to 1 */
function normalizeWeights(controls: SuggestControls): { w_score: number; w_deadline: number; w_balance: number; w_efficiency: number } {
  const sum = controls.scoreWeight + controls.deadlineWeight + controls.balanceWeight + controls.efficiencyWeight;
  if (sum === 0) return { w_score: 0.25, w_deadline: 0.25, w_balance: 0.25, w_efficiency: 0.25 };
  return {
    w_score: controls.scoreWeight / sum,
    w_deadline: controls.deadlineWeight / sum,
    w_balance: controls.balanceWeight / sum,
    w_efficiency: controls.efficiencyWeight / sum,
  };
}

// --- Scoring Components ---

/** Deadline pressure: how urgently a task needs scheduling relative to target day */
function deadlinePressure(task: Task, targetDay: Date): number {
  if (!task.dueDate) return 0.1;
  const due = parseLocalDate(task.dueDate);
  const daysUntil = differenceInCalendarDays(due, targetDay);

  if (daysUntil < 0) return 1.0;    // overdue
  if (daysUntil === 0) return 0.95;  // today
  if (daysUntil === 1) return 0.85;  // tomorrow
  if (daysUntil <= 3) return 0.7;
  if (daysUntil <= 7) return 0.5;
  if (daysUntil <= 14) return 0.3;
  return 0.15;
}

/** Domain balance: boosts underrepresented domains */
function domainBalanceBonus(task: Task, scheduledDomainCounts: Map<string, number>): number {
  if (!task.domainId) return 0.5; // neutral for tasks with no domain
  const totalScheduled = Array.from(scheduledDomainCounts.values()).reduce((a, b) => a + b, 0);
  if (totalScheduled === 0) return 1.0; // no tasks scheduled yet, max bonus
  const domainCount = scheduledDomainCounts.get(task.domainId) || 0;
  const domainRatio = domainCount / totalScheduled;
  return 1.0 - domainRatio;
}

/** Effort match: does the task fit the remaining AP budget? */
function effortMatch(task: Task, remainingAP: number, defaultAP: number): number {
  const ap = getTaskAP(task, defaultAP);
  if (ap > remainingAP) return 0.0; // doesn't fit
  // Slightly favor smaller tasks to maximize completions (ratio of usage)
  return 1.0 - (ap / (remainingAP + 1)) * 0.3;
}

// --- Main Scoring Function ---

export function computeSuggestionScore(
  task: Task,
  controls: SuggestControls,
  context: ScoringContext,
): number {
  const weights = normalizeWeights(controls);

  const baseScore = normalize(task.taskScore, 2, 80);
  const deadline = deadlinePressure(task, context.targetDay);
  const balance = domainBalanceBonus(task, context.scheduledDomainCounts);
  const efficiency = effortMatch(task, context.remainingAP, controls.defaultAP);

  return (
    weights.w_score * baseScore +
    weights.w_deadline * deadline +
    weights.w_balance * balance +
    weights.w_efficiency * efficiency
  );
}

// --- Suggest Next Task ---

export function suggestNextTask(
  tasks: Task[],
  scheduledToday: Task[],
  eventsToday: Event[],
  controls: SuggestControls,
  skipIds: Set<string>,
): Task[] {
  const today = startOfDay(new Date());

  // Filter candidates: unscheduled, active, not skipped
  let candidates = tasks.filter(t =>
    !t.plannedDate &&
    t.status !== 'Done' &&
    t.status !== 'Archived' &&
    t.status !== 'Needs Details' &&
    t.status !== 'Blocked' &&
    !skipIds.has(t.id)
  );

  // Apply domain focus
  if (controls.domainFocus.length > 0) {
    candidates = candidates.filter(t =>
      t.domainId && controls.domainFocus.includes(t.domainId)
    );
  }

  // Build context
  const scheduledDomainCounts = new Map<string, number>();
  for (const t of scheduledToday) {
    if (t.domainId) {
      scheduledDomainCounts.set(t.domainId, (scheduledDomainCounts.get(t.domainId) || 0) + 1);
    }
  }

  const scheduledAP = scheduledToday.reduce((sum, t) => sum + getTaskAP(t, controls.defaultAP), 0);
  const eventsAP = eventsToday.reduce((sum, e) => sum + getEventAP(e, controls.defaultAP), 0);
  const remainingAP = Math.max(0, controls.dailyAPBudget - scheduledAP - eventsAP);

  const context: ScoringContext = {
    targetDay: today,
    scheduledDomainCounts,
    remainingAP,
  };

  // Score and sort
  const scored = candidates.map(task => ({
    task,
    score: computeSuggestionScore(task, controls, context),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.map(s => s.task);
}

// --- Suggest Week Schedule (Greedy Bin Packing) ---

export interface WeekDayInfo {
  date: Date;
  dateStr: string;
  existingTasks: Task[];
  events: Event[];
}

export function suggestWeekSchedule(
  tasks: Task[],
  weekDays: WeekDayInfo[],
  controls: SuggestControls,
  pinnedAssignments: Map<string, string>,  // taskId -> dateStr
  excludedPlacements?: Set<string>,        // "taskId:dateStr" pairs to skip
): Map<string, string> {  // taskId -> dateStr
  const assignments = new Map<string, string>();

  // Initialize remaining AP per day
  const remainingAP = new Map<string, number>();
  const dayDomainCounts = new Map<string, Map<string, number>>();  // dateStr -> (domainId -> count)

  for (const day of weekDays) {
    const existingAP = day.existingTasks.reduce((sum, t) => sum + getTaskAP(t, controls.defaultAP), 0);
    const eventsAP = day.events.reduce((sum, e) => sum + getEventAP(e, controls.defaultAP), 0);

    // Deduct pinned AP
    let pinnedAP = 0;
    for (const [taskId, dateStr] of pinnedAssignments) {
      if (dateStr === day.dateStr) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          pinnedAP += getTaskAP(task, controls.defaultAP);
          assignments.set(taskId, dateStr);
        }
      }
    }

    remainingAP.set(day.dateStr, Math.max(0, controls.dailyAPBudget - existingAP - eventsAP - pinnedAP));

    // Track domain counts from existing + pinned
    const domainCounts = new Map<string, number>();
    for (const t of day.existingTasks) {
      if (t.domainId) domainCounts.set(t.domainId, (domainCounts.get(t.domainId) || 0) + 1);
    }
    for (const [taskId, dateStr] of pinnedAssignments) {
      if (dateStr === day.dateStr) {
        const task = tasks.find(t => t.id === taskId);
        if (task?.domainId) domainCounts.set(task.domainId, (domainCounts.get(task.domainId) || 0) + 1);
      }
    }
    dayDomainCounts.set(day.dateStr, domainCounts);
  }

  // Get unscheduled, unassigned candidates
  const pinnedIds = new Set(pinnedAssignments.keys());
  const scheduledIds = new Set(
    weekDays.flatMap(d => d.existingTasks.map(t => t.id))
  );

  let candidates = tasks.filter(t =>
    !t.plannedDate &&
    t.status !== 'Done' &&
    t.status !== 'Archived' &&
    t.status !== 'Needs Details' &&
    t.status !== 'Blocked' &&
    !pinnedIds.has(t.id) &&
    !scheduledIds.has(t.id)
  );

  // Apply domain focus
  if (controls.domainFocus.length > 0) {
    candidates = candidates.filter(t =>
      t.domainId && controls.domainFocus.includes(t.domainId)
    );
  }

  // --- Pass 1: Deadline tasks (earliest deadline first) ---
  const deadlineTasks = candidates
    .filter(t => t.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const placedIds = new Set<string>();

  for (const task of deadlineTasks) {
    const ap = getTaskAP(task, controls.defaultAP);

    // Find best eligible day (must be <= due date, with capacity)
    let bestDay: string | null = null;
    let bestScore = -1;

    for (const day of weekDays) {
      const dayRemaining = remainingAP.get(day.dateStr) || 0;
      if (ap > dayRemaining) continue;

      // Must be on or before due date
      if (task.dueDate && day.dateStr > task.dueDate) continue;

      // Skip excluded placements (user removed this task from this day)
      if (excludedPlacements?.has(`${task.id}:${day.dateStr}`)) continue;

      const context: ScoringContext = {
        targetDay: day.date,
        scheduledDomainCounts: dayDomainCounts.get(day.dateStr) || new Map(),
        remainingAP: dayRemaining,
      };
      const score = computeSuggestionScore(task, controls, context);

      if (score > bestScore) {
        bestScore = score;
        bestDay = day.dateStr;
      }
    }

    if (bestDay) {
      assignments.set(task.id, bestDay);
      remainingAP.set(bestDay, (remainingAP.get(bestDay) || 0) - ap);
      if (task.domainId) {
        const dc = dayDomainCounts.get(bestDay)!;
        dc.set(task.domainId, (dc.get(task.domainId) || 0) + 1);
      }
      placedIds.add(task.id);
    }
  }

  // --- Pass 2: Flexible tasks (by score descending) ---
  const flexibleTasks = candidates.filter(t => !placedIds.has(t.id));

  // Pre-score each task against each day, pick best combo greedily
  // Sort by a rough score first (using first day as reference)
  const today = startOfDay(new Date());
  const roughContext: ScoringContext = {
    targetDay: today,
    scheduledDomainCounts: new Map(),
    remainingAP: controls.dailyAPBudget,
  };
  flexibleTasks.sort((a, b) =>
    computeSuggestionScore(b, controls, roughContext) -
    computeSuggestionScore(a, controls, roughContext)
  );

  for (const task of flexibleTasks) {
    const ap = getTaskAP(task, controls.defaultAP);

    let bestDay: string | null = null;
    let bestScore = -1;

    for (const day of weekDays) {
      const dayRemaining = remainingAP.get(day.dateStr) || 0;
      if (ap > dayRemaining) continue;

      // Skip excluded placements
      if (excludedPlacements?.has(`${task.id}:${day.dateStr}`)) continue;

      const context: ScoringContext = {
        targetDay: day.date,
        scheduledDomainCounts: dayDomainCounts.get(day.dateStr) || new Map(),
        remainingAP: dayRemaining,
      };
      const score = computeSuggestionScore(task, controls, context);

      if (score > bestScore) {
        bestScore = score;
        bestDay = day.dateStr;
      }
    }

    if (bestDay) {
      assignments.set(task.id, bestDay);
      remainingAP.set(bestDay, (remainingAP.get(bestDay) || 0) - ap);
      if (task.domainId) {
        const dc = dayDomainCounts.get(bestDay)!;
        dc.set(task.domainId, (dc.get(task.domainId) || 0) + 1);
      }
    }
  }

  return assignments;
}

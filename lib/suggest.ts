import { Task, Event } from '@/types';
import { getTodayString, parseLocalDate } from './dates';
import { startOfDay, differenceInCalendarDays } from 'date-fns';
import { cycleDueDate, liveOccurrenceDue, recurrenceKind, upcomingOccurrences } from './recurrence';

// --- Types ---

export type SuggestPreset = 'balanced' | 'deadlines' | 'quick-wins' | 'big-rocks' | 'custom';

export interface SuggestControls {
  dailyAPBudget: number;       // 1-15, default 8
  defaultAP: number;           // 1-3, default 2
  domainFocus: string[];       // domain IDs, empty = all
  preset: SuggestPreset;
  scoreWeight: number;         // 0-1, default 0.4
  deadlineWeight: number;      // 0-1, default 0.3
  balanceWeight: number;       // 0-1, default 0.15
  efficiencyWeight: number;    // 0-1, default 0.15
}

/**
 * Named ways of weighting the four factors.
 *
 * Four normalised sliders is a control surface for tuning an algorithm, not
 * for planning a week - nobody can say what "domain balance 0.15" ought to
 * be. These say what they do; the sliders stay for anyone who wants them.
 */
export const SUGGEST_PRESETS: Record<Exclude<SuggestPreset, 'custom'>, {
  label: string;
  description: string;
  weights: Pick<SuggestControls, 'scoreWeight' | 'deadlineWeight' | 'balanceWeight' | 'efficiencyWeight'>;
}> = {
  balanced: {
    label: 'Balanced',
    description: 'What matters most, tempered by what is due and a spread across life areas.',
    weights: { scoreWeight: 0.4, deadlineWeight: 0.3, balanceWeight: 0.15, efficiencyWeight: 0.15 },
  },
  deadlines: {
    label: 'Deadline-driven',
    description: 'Whatever is due soonest, first. For a week with real dates in it.',
    weights: { scoreWeight: 0.25, deadlineWeight: 0.55, balanceWeight: 0.1, efficiencyWeight: 0.1 },
  },
  'quick-wins': {
    label: 'Quick wins',
    description: 'Favours small tasks, to clear as many as possible off the list.',
    weights: { scoreWeight: 0.25, deadlineWeight: 0.2, balanceWeight: 0.1, efficiencyWeight: 0.45 },
  },
  'big-rocks': {
    label: 'Big rocks',
    description: 'The important things first, even when they take the whole day.',
    weights: { scoreWeight: 0.6, deadlineWeight: 0.25, balanceWeight: 0.1, efficiencyWeight: 0.05 },
  },
};

export function applyPreset(controls: SuggestControls, preset: SuggestPreset): SuggestControls {
  if (preset === 'custom') return { ...controls, preset };
  return { ...controls, preset, ...SUGGEST_PRESETS[preset].weights };
}

export const DEFAULT_SUGGEST_CONTROLS: SuggestControls = {
  dailyAPBudget: 8,
  defaultAP: 2,
  domainFocus: [],
  preset: 'balanced',
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

/**
 * The date a task has to be placed by, as far as the planner is concerned:
 * its deadline, else the end of its cycle, else - for a plan already missed -
 * the day that was missed, which is to say "as soon as possible".
 */
export function placeBy(task: Task, today = getTodayString()): string | null {
  if (task.dueDate) return task.dueDate;
  // A daily or named-day occurrence has its own day, not a deadline to race.
  if (recurrenceKind(task) === 'lapsing') return null;
  if (task.plannedDate && task.plannedDate < today) return task.plannedDate;
  return cycleDueDate(task);
}

/** Deadline pressure: how urgently a task needs scheduling relative to target day */
function deadlinePressure(task: Task, targetDay: Date, byOverride?: string | null): number {
  const by = byOverride !== undefined ? byOverride : placeBy(task);
  if (!by) return 0.1;
  const due = parseLocalDate(by);
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
  byOverride?: string | null,
): number {
  const weights = normalizeWeights(controls);

  const baseScore = normalize(task.taskScore, 2, 80);
  const deadline = deadlinePressure(task, context.targetDay, byOverride);
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

  // Filter candidates: unscheduled (or a plan already missed), active, not skipped
  const todayStr = getTodayString();
  let candidates = tasks.filter(t =>
    (!t.plannedDate || t.plannedDate < todayStr) &&
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
  /**
   * Effort already owed to habits on this day. Reserved, not scheduled:
   * habits are a floor under the week rather than something to place.
   */
  habitAP?: number;
  /**
   * Effort of later occurrences of recurring tasks that have been planned
   * onto this day. Unplanned occurrences cost nothing: effort is only taken
   * from a day once something is planned on it.
   */
  recurringAP?: number;
  /** This day's budget, when it differs from the default. */
  capacity?: number;
}

/**
 * Something the suggester can place: a task, or one occurrence of a
 * repeating task. `key` is the task id for the task itself, and
 * `${taskId}@${due}` for a later occurrence (see planOccurrence).
 */
interface Candidate {
  key: string;
  task: Task;
  /** The days it may go on. */
  allowed: (dateStr: string) => boolean;
  /** Date to place it by, or null for no deadline pressure. */
  by: string | null;
}

export function occurrenceKey(key: string): { taskId: string; due: string | null } {
  const at = key.indexOf('@');
  return at < 0 ? { taskId: key, due: null } : { taskId: key.slice(0, at), due: key.slice(at + 1) };
}

function buildCandidates(tasks: Task[], weekDays: WeekDayInfo[], taken: Set<string>, todayStr: string): Candidate[] {
  const first = weekDays[0]?.dateStr ?? todayStr;
  const last = weekDays[weekDays.length - 1]?.dateStr ?? todayStr;
  const out: Candidate[] = [];
  const workable = (t: Task) => t.status !== 'Archived' && t.status !== 'Needs Details' && t.status !== 'Blocked';

  for (const task of tasks) {
    if (task.deletedAt || !workable(task)) continue;
    const kind = recurrenceKind(task);

    // The task itself: unplanned, or a plan already missed.
    if (task.status !== 'Done' && (!task.plannedDate || task.plannedDate < todayStr) && !taken.has(task.id)) {
      if (kind === 'lapsing') {
        // Today's (or the next named day's) occurrence goes on its own day or not at all.
        const day = liveOccurrenceDue(task, todayStr);
        out.push({ key: task.id, task, allowed: (d) => d === day, by: null });
      } else {
        out.push({ key: task.id, task, allowed: () => true, by: placeBy(task, todayStr) });
      }
    }

    // Later occurrences that fall due inside the range and have no plan yet.
    if (kind === 'none') continue;
    for (const occ of upcomingOccurrences(task, last, todayStr)) {
      if (occ.skipped || occ.plannedDate || occ.due > last || occ.due < first || taken.has(occ.key)) continue;
      if (kind === 'lapsing') {
        out.push({ key: occ.key, task, allowed: (d) => d === occ.due, by: null });
      } else {
        // Anywhere in its window: after the one before it, by its due date.
        const from = occ.windowStart > todayStr ? occ.windowStart : todayStr;
        out.push({ key: occ.key, task, allowed: (d) => d >= from && d <= occ.due, by: occ.due });
      }
    }
  }
  return out;
}

export function suggestWeekSchedule(
  tasks: Task[],
  weekDays: WeekDayInfo[],
  controls: SuggestControls,
  pinnedAssignments: Map<string, string>,  // key -> dateStr
  excludedPlacements?: Set<string>,        // "key:dateStr" pairs to skip
): Map<string, string> {  // key -> dateStr
  const assignments = new Map<string, string>();
  const taskOf = (key: string) => tasks.find(t => t.id === occurrenceKey(key).taskId);

  const remainingAP = new Map<string, number>();
  const dayDomainCounts = new Map<string, Map<string, number>>();

  for (const day of weekDays) {
    const existingAP = day.existingTasks.reduce((sum, t) => sum + getTaskAP(t, controls.defaultAP), 0);
    const eventsAP = day.events.reduce((sum, e) => sum + getEventAP(e, controls.defaultAP), 0);
    const reserved = (day.habitAP ?? 0) + (day.recurringAP ?? 0);

    let pinnedAP = 0;
    const domainCounts = new Map<string, number>();
    for (const t of day.existingTasks) {
      if (t.domainId) domainCounts.set(t.domainId, (domainCounts.get(t.domainId) || 0) + 1);
    }
    for (const [key, dateStr] of pinnedAssignments) {
      if (dateStr !== day.dateStr) continue;
      const task = taskOf(key);
      if (!task) continue;
      pinnedAP += getTaskAP(task, controls.defaultAP);
      assignments.set(key, dateStr);
      if (task.domainId) domainCounts.set(task.domainId, (domainCounts.get(task.domainId) || 0) + 1);
    }

    const budget = day.capacity ?? controls.dailyAPBudget;
    remainingAP.set(day.dateStr, Math.max(0, budget - existingAP - eventsAP - reserved - pinnedAP));
    dayDomainCounts.set(day.dateStr, domainCounts);
  }

  const todayStr = getTodayString();
  const taken = new Set<string>([
    ...pinnedAssignments.keys(),
    ...weekDays.flatMap(d => d.existingTasks.map(t => t.id)),
  ]);
  let candidates = buildCandidates(tasks, weekDays, taken, todayStr);
  if (controls.domainFocus.length > 0) {
    candidates = candidates.filter(c => c.task.domainId && controls.domainFocus.includes(c.task.domainId));
  }

  const place = (c: Candidate, day: string) => {
    assignments.set(c.key, day);
    remainingAP.set(day, (remainingAP.get(day) || 0) - getTaskAP(c.task, controls.defaultAP));
    if (c.task.domainId) {
      const dc = dayDomainCounts.get(day)!;
      dc.set(c.task.domainId, (dc.get(c.task.domainId) || 0) + 1);
    }
  };
  const openDays = (c: Candidate) => weekDays.filter(day =>
    c.allowed(day.dateStr) &&
    getTaskAP(c.task, controls.defaultAP) <= (remainingAP.get(day.dateStr) || 0) &&
    !excludedPlacements?.has(`${c.key}:${day.dateStr}`));

  // --- Pass 1: anything with a date to meet, most pressing first ---
  //
  // Deadlines, recurring cycles and missed plans. Each goes on the earliest
  // day with room, and on the deadline day itself only if nothing earlier
  // fits: leaving a Friday deadline for Friday is how it gets missed the
  // moment Friday goes wrong. A deadline beyond the range is flexible work
  // this week, not a date to meet.
  const lastDay = weekDays[weekDays.length - 1]?.dateStr ?? todayStr;
  const dated = candidates
    .filter((c): c is Candidate & { by: string } => c.by !== null && c.by <= lastDay)
    .sort((a, b) => a.by.localeCompare(b.by) || b.task.taskScore - a.task.taskScore);
  const placed = new Set<string>();

  for (const c of dated) {
    const open = openDays(c);
    const late = c.by < (weekDays[0]?.dateStr ?? c.by);
    const before = open.find(day => day.dateStr < c.by);
    const onTheDay = open.find(day => day.dateStr === c.by);
    const best = (late ? open[0] : before ?? onTheDay)?.dateStr;
    if (best) { place(c, best); placed.add(c.key); }
  }

  // --- Pass 2: everything else, by score, each on its best allowed day ---
  const today = startOfDay(new Date());
  const roughContext: ScoringContext = { targetDay: today, scheduledDomainCounts: new Map(), remainingAP: controls.dailyAPBudget };
  const flexible = candidates.filter(c => !placed.has(c.key))
    .sort((a, b) => computeSuggestionScore(b.task, controls, roughContext, b.by) - computeSuggestionScore(a.task, controls, roughContext, a.by));

  for (const c of flexible) {
    let bestDay: string | null = null;
    let bestScore = -1;
    for (const day of openDays(c)) {
      const score = computeSuggestionScore(c.task, controls, {
        targetDay: day.date,
        scheduledDomainCounts: dayDomainCounts.get(day.dateStr) || new Map(),
        remainingAP: remainingAP.get(day.dateStr) || 0,
      }, c.by);
      if (score > bestScore) { bestScore = score; bestDay = day.dateStr; }
    }
    if (bestDay) place(c, bestDay);
  }

  return assignments;
}

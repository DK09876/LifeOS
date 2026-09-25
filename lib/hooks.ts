'use client';

import { useEffect } from 'react';
import { useLiveQuery } from './live-query';
import { useMemo } from 'react';
import { db, Task, Domain, Project, FilterPreset, Habit, Event, Note, checkNeedsReset, calculateTaskScores, isHabitDueToday, pruneCompletionDates, checkEventNeedsReset, currentEventDate, localDay } from './db';
import { comeBack, liveOccurrenceDue, recurrenceKind } from './recurrence';
import type { OccurrencePlan } from '@/types';
import { getTodayString, parseLocalDate } from './dates';
import { getPreference, savePreference } from './store';
import { bestStreakSoFar, currentStreak } from './streaks';
import { logProgress, projectProgress } from './progress';
import { CAPACITY_PREF, WEEKDAY_BUDGET_PREF, capacityFor, parseCapacityMap, parseWeekdayBudget } from './capacity';
import { HISTORY_PREF, parseHistory, pruneHistory, recentDays, spentOn } from './history';
import { DEFAULT_SUGGEST_CONTROLS, SuggestControls } from './suggest';
import { Milestone, newMilestones, recordMilestones, totalCompletions } from './milestones';

/** Per-profile marker for the last daily maintenance run. */
const RECURRENCE_LAST_RUN = 'recurrenceCheck.lastRun';
import { BlockedByEntry } from '@/types';

// Core recurrence check logic - resets recurring tasks that are due
async function runRecurrenceCheckCore(): Promise<{ tasksReset: number; tasksRescored: number }> {
  // Close the books on the days just gone *before* anything resets. Resetting
  // a recurring task clears its doneDate, and recording afterwards meant its
  // completion had already vanished from the day it happened on.
  await recordRecentDays();

  await migrateCycleStarts();

  const allTasks = await db.tasks.toArray();
  let tasksReset = 0;

  for (const task of allTasks) {
    if (task.deletedAt) continue;
    if (await resetIfDue(task)) tasksReset++;
    else await lapseIfPassed(task);
  }

  // Part of a task's score comes from how close its due date is, so a stored
  // score decays into nonsense as time passes: a task written a month before
  // it was due keeps that month-away score even once it is overdue. Since the
  // lists sort by taskScore, an overdue task could sit below a trivial one.
  // Recompute here, once a day, and write back only what actually moved.
  //
  // updatedAt is deliberately not bumped: the score is derived from fields
  // the user did not touch, and treating it as an edit would churn sync on
  // every device every day.
  const domains = await db.domains.toArray();
  const priorityByDomain = new Map(domains.map((domain) => [domain.id, domain.priority]));
  const rescored = await db.tasks.toArray();
  let tasksRescored = 0;

  for (const task of rescored) {
    if (task.deletedAt) continue;
    if (task.status === 'Done' || task.status === 'Archived') continue;

    const scores = calculateTaskScores(
      task,
      task.domainId ? priorityByDomain.get(task.domainId) : undefined,
    );
    if (
      scores.combinedScore === task.taskScore &&
      scores.importanceScore === task.importanceScore &&
      scores.urgencyScore === task.urgencyScore
    ) {
      continue;
    }
    await db.tasks.update(task.id, {
      importanceScore: scores.importanceScore,
      urgencyScore: scores.urgencyScore,
      taskScore: scores.combinedScore,
    });
    tasksRescored++;
  }

  // Recurring events move on to their next occurrence once the current one
  // has passed, attended or not: an appointment that has gone has gone, and
  // pinning a standing meeting to the one you skipped hid every later one.
  // lastCompleted is kept - it is the record of the day it was attended.
  const allEvents = await db.events.toArray();
  for (const event of allEvents) {
    if (event.deletedAt) continue;
    if (checkEventNeedsReset(event)) {
      await db.events.update(event.id, { date: currentEventDate(event), updatedAt: new Date().toISOString() });
    }
  }

  // Record when this ran, per profile, so it happens once a day rather than
  // on every page load.
  await savePreference(RECURRENCE_LAST_RUN, getTodayString());

  return { tasksReset, tasksRescored };
}

/**
 * Bring a finished recurring task back for its next occurrence, if it is time.
 * Returns whether it did.
 */
async function resetIfDue(task: Task, today = getTodayString()): Promise<boolean> {
  if (!checkNeedsReset(task, today)) return false;
  // Roll the dates forward as well as the status. Leaving them on the
  // previous occurrence brought the task back already overdue, planned for a
  // day that had passed, where it sat in Triage for good.
  // A task that counts towards a goal stops coming back once the goal is met.
  if (task.projectId) {
    const project = await db.projects.get(task.projectId);
    if (project && project.kind === 'target') {
      const progress = projectProgress(project, []);
      if (progress.complete) return false;
    }
  }
  // Plans made for this occurrence (moved, or skipped) are applied here.
  const { dueDate, plannedDate, occurrencePlans, rotSince } = comeBack(task);
  const domainPriority = task.domainId ? (await db.domains.get(task.domainId))?.priority : undefined;
  const status: Task['status'] = plannedDate ? 'Planned' : 'Backlog';
  const scores = calculateTaskScores({ ...task, status, dueDate, plannedDate, rotSince, slipCount: 0, lastCompleted: null }, domainPriority);
  await db.tasks.update(task.id, {
    status,
    dueDate,
    plannedDate,
    occurrencePlans,
    // The new cycle started when the last one was finished; its cycle
    // deadline and its neglect both count from there.
    rotSince,
    slipCount: 0,
    importanceScore: scores.importanceScore,
    urgencyScore: scores.urgencyScore,
    taskScore: scores.combinedScore,
    lastCompleted: null,
    doneDate: null,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * A daily or named-day task whose day went by undone: that occurrence lapses.
 * Its plan for the gone day is dropped (not a missed plan, not a slip) and
 * the plan for the occurrence now in hand, if one was made, takes its place.
 */
async function lapseIfPassed(task: Task, today = getTodayString()): Promise<void> {
  if (recurrenceKind(task) !== 'lapsing') return;
  if (task.status === 'Done' || task.status === 'Archived' || task.status === 'Blocked') return;
  const live = liveOccurrenceDue(task, today);
  const stalePlan = !!task.plannedDate && task.plannedDate < today;
  const stalePlans = (task.occurrencePlans ?? []).some(p => p.due <= (live ?? today));
  if (!stalePlan && !stalePlans) return;
  const current = (task.occurrencePlans ?? []).find(p => p.due === live);
  const plannedDate = current?.plannedDate ?? (stalePlan ? null : task.plannedDate);
  await db.tasks.update(task.id, {
    plannedDate,
    status: task.status === 'Needs Details' ? task.status : plannedDate ? 'Planned' : 'Backlog',
    occurrencePlans: (task.occurrencePlans ?? []).filter(p => live !== null && p.due > live),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Plan (or skip, or unplan) one occurrence of a repeating task.
 *
 * The occurrence in hand is the task itself, so planning it sets the task's
 * planned date as usual. Later ones are kept as plans on the series and
 * applied when it reaches them - one day moved without touching the rest.
 */
export async function planOccurrence(
  taskId: string,
  due: string,
  change: { plannedDate?: string | null; skipped?: boolean },
): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const live = liveOccurrenceDue(task);
  if (due === live && task.status !== 'Done') {
    if (!change.skipped) {
      await updateTaskData(taskId, { plannedDate: change.plannedDate ?? null });
      return;
    }
    // Skipping the occurrence in hand: the series moves straight on to the
    // next one, as if this one had been dealt with - without recording it
    // as done.
    const next = comeBack({ ...task, status: 'Done', lastCompleted: `${due}T12:00:00` });
    await db.tasks.update(taskId, {
      status: next.plannedDate ? 'Planned' : 'Backlog',
      dueDate: next.dueDate,
      plannedDate: next.plannedDate,
      occurrencePlans: next.occurrencePlans,
      rotSince: recurrenceKind(task) === 'lapsing' ? task.rotSince ?? null : `${due}T12:00:00`,
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  const others = (task.occurrencePlans ?? []).filter(p => p.due !== due);
  const plan: OccurrencePlan = { due, plannedDate: change.plannedDate ?? null, ...(change.skipped ? { skipped: true } : {}) };
  // A plan with nothing in it is the same as no plan.
  const keep = plan.skipped || plan.plannedDate ? [...others, plan] : others;
  await db.tasks.update(taskId, {
    occurrencePlans: keep.sort((a, b) => a.due.localeCompare(b.due)),
    updatedAt: new Date().toISOString(),
  });
}

const CYCLE_MIGRATION = 'migration.cycleStart';

/**
 * One-off, per profile. Recurring tasks that came back before rotSince
 * existed have no record of when their current cycle began, so their cycle
 * would be counted from when they were first written - weeks behind on
 * arrival. The reset stamped updatedAt, which is the best record there is.
 */
async function migrateCycleStarts(): Promise<void> {
  if (getPreference(CYCLE_MIGRATION)) return;
  for (const task of await db.tasks.toArray()) {
    if (task.deletedAt || task.recurrence === 'None' || task.status === 'Done') continue;
    if (task.lastCompleted || task.rotSince) continue;
    await db.tasks.update(task.id, { rotSince: task.updatedAt });
  }
  await savePreference(CYCLE_MIGRATION, getTodayString());
}

/** The energy settings as stored: defaults, per-weekday budgets, per-date overrides. */
export function readEnergySettings() {
  let controls: SuggestControls = DEFAULT_SUGGEST_CONTROLS;
  try {
    const stored = getPreference('suggest.settings');
    if (stored) controls = { ...DEFAULT_SUGGEST_CONTROLS, ...JSON.parse(stored) };
  } catch { /* fall back to the defaults */ }
  const capacityMap = parseCapacityMap(getPreference(CAPACITY_PREF));
  const weekdayBudget = parseWeekdayBudget(getPreference(WEEKDAY_BUDGET_PREF));
  return {
    controls,
    capacityMap,
    weekdayBudget,
    budgetFor: (date: string) => capacityFor(capacityMap, date, controls.dailyAPBudget, weekdayBudget),
  };
}

/** The same, reactive: re-reads whenever any of the three preferences change. */
export function useEnergySettings() {
  const suggest = useLiveQuery(() => getPreference('suggest.settings'), []);
  const capacity = useLiveQuery(() => getPreference(CAPACITY_PREF), []);
  const weekday = useLiveQuery(() => getPreference(WEEKDAY_BUDGET_PREF), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readEnergySettings(), [suggest, capacity, weekday]);
}

/**
 * Write what a day cost into the history.
 *
 * Only completions are recorded; what was planned for a past day cannot be
 * recovered afterwards, and a guess would make the record less trustworthy
 * than no record. `overwrite` is for corrections - ticking off yesterday
 * after the fact has to change yesterday's total.
 */
export async function recordDay(date: string, overwrite = false): Promise<void> {
  const history = pruneHistory(parseHistory(getPreference(HISTORY_PREF)));
  if (history[date] && !overwrite) return;

  const { controls, budgetFor } = readEnergySettings();
  const [tasks, events, habits] = await Promise.all([
    db.tasks.toArray(), db.events.toArray(), db.habits.toArray(),
  ]);
  const { spent, finished } = spentOn(date, tasks, events, habits, controls.defaultAP);

  // A day nobody touched is not evidence of anything, so it is not recorded.
  if (spent === 0 && finished === 0) {
    if (!history[date]) return;
    delete history[date];
  } else {
    history[date] = { capacity: budgetFor(date), spent, finished };
  }
  await savePreference(HISTORY_PREF, JSON.stringify(history));
}

/**
 * Record the last week's days that are not yet on record. The app is not
 * opened every day, and only closing "yesterday" left gaps after a weekend.
 */
async function recordRecentDays(): Promise<void> {
  for (const day of recentDays(7)) await recordDay(day);
}

// Hook to run daily auto-reset check for recurring tasks (runs once on app load)
export function useRecurrenceCheck() {
  useEffect(() => {
    (async () => {
      if (getPreference(RECURRENCE_LAST_RUN) === getTodayString()) return;
      await runRecurrenceCheckCore();
    })();
  }, []);
}

// Manual trigger for recurrence check - always runs regardless of last run time
export async function runRecurrenceCheck(): Promise<{ tasksReset: number; lastRun: string }> {
  const result = await runRecurrenceCheckCore();
  return {
    ...result,
    lastRun: new Date().toISOString(),
  };
}

// Get the last time recurrence check ran
export async function getRecurrenceCheckStatus(): Promise<{ lastRun: string | null }> {
  return { lastRun: getPreference(RECURRENCE_LAST_RUN) ?? null };
}

// Hook to get all tasks with computed fields
export function useTasks() {
  const tasks = useLiveQuery(async () => {
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    // Add computed fields
    return allTasks.map(task => {
      const domain = task.domainId ? domainMap.get(task.domainId) : null;
      return {
        ...task,
        domain: domain || null,
        domainPriority: domain?.priority || null,
      };
    }).sort((a, b) => b.taskScore - a.taskScore || a.taskName.localeCompare(b.taskName));
  }, []);

  return tasks || [];
}

// Hook to get all domains with task counts
export function useDomains() {
  const domains = useLiveQuery(async () => {
    const allDomains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);

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

    const allDomainTasks = await db.tasks.where('domainId').equals(id).toArray();
    const taskCount = allDomainTasks.filter(t => !t.deletedAt).length;
    return { ...domain, taskCount };
  }, [id]);
}

// Hook to get all filter presets
export function useFilterPresets() {
  const presets = useLiveQuery(async () => {
    const all = await db.filterPresets.orderBy('order').toArray();
    return all.filter(p => !p.deletedAt);
  }, []);

  return presets || [];
}

// Hook to get visible filter presets only
export function useVisibleFilterPresets() {
  const presets = useLiveQuery(async () => {
    const all = await db.filterPresets.orderBy('order').toArray();
    return all.filter(p => p.visible && !p.deletedAt);
  }, []);

  return presets || [];
}

// Filter preset actions
export async function createFilterPreset(presetData: {
  name: string;
  color: string;
  filters: FilterPreset['filters'];
  visible?: boolean;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Get max order (exclude tombstones)
  const allPresets = (await db.filterPresets.toArray()).filter(p => !p.deletedAt);
  const maxOrder = allPresets.length > 0 ? Math.max(...allPresets.map(p => p.order)) : -1;

  const preset: FilterPreset = {
    id,
    name: presetData.name,
    color: presetData.color,
    filters: presetData.filters,
    visible: presetData.visible ?? true,
    isDefault: false,
    order: maxOrder + 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.filterPresets.add(preset);
  return id;
}

export async function updateFilterPreset(presetId: string, updates: Partial<FilterPreset>): Promise<void> {
  await db.filterPresets.update(presetId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteFilterPreset(presetId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.filterPresets.update(presetId, { deletedAt: now, updatedAt: now });
}

export async function toggleFilterPresetVisibility(presetId: string): Promise<void> {
  const preset = await db.filterPresets.get(presetId);
  if (preset) {
    await db.filterPresets.update(presetId, {
      visible: !preset.visible,
      updatedAt: new Date().toISOString(),
    });
  }
}

// --- Blocked-by logic ---

// Check if adding targetBlockerId as a blocker of taskId would create a circular dependency
export function hasCircularDependency(taskId: string, targetBlockerId: string, allTasks: Task[]): boolean {
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const queue = [targetBlockerId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const task = taskMap.get(current);
    if (!task) continue;
    for (const entry of task.blockedBy || []) {
      if (entry.type === 'task') {
        queue.push(entry.taskId);
      }
    }
  }
  return false;
}

// Check a task's blockedBy entries and auto-unblock if all task-type blockers are resolved
async function checkAndAutoUnblock(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task || task.deletedAt || task.status !== 'Blocked') return;

  const blockedBy = task.blockedBy || [];
  if (blockedBy.length === 0) return;

  const remaining: BlockedByEntry[] = [];
  for (const entry of blockedBy) {
    if (entry.type === 'note') {
      remaining.push(entry);
    } else {
      const blocker = await db.tasks.get(entry.taskId);
      // Keep blocker if the referenced task still exists and is not Done/Archived/deleted
      if (blocker && !blocker.deletedAt && blocker.status !== 'Done' && blocker.status !== 'Archived') {
        remaining.push(entry);
      }
    }
  }

  if (remaining.length < blockedBy.length) {
    const updates: Partial<Task> = { blockedBy: remaining, updatedAt: new Date().toISOString() };
    if (remaining.length === 0) {
      // All blockers resolved — auto-unblock
      const newStatus = autoStatus({ ...task, status: task.plannedDate ? 'Planned' : 'Backlog', blockedBy: [] });
      updates.status = newStatus;
    }
    await db.tasks.update(taskId, updates);
  }
}

// Find all tasks blocked by the given taskId and check if they can be unblocked
async function checkDependentsOf(taskId: string): Promise<void> {
  const allTasks = await db.tasks.toArray();
  const dependents = allTasks.filter(t =>
    !t.deletedAt &&
    t.status === 'Blocked' &&
    (t.blockedBy || []).some(e => e.type === 'task' && e.taskId === taskId)
  );
  for (const dep of dependents) {
    await checkAndAutoUnblock(dep.id);
  }
}

// Check if a task has all required fields filled for auto-promotion
function isTaskComplete(task: Partial<Task>): boolean {
  return !!(
    task.taskName?.trim() &&
    task.taskPriority &&
    task.urgency &&
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

/** Days kept in a task's completion log - long enough for a yearly review. */
const COMPLETION_LOG_DAYS = 400;

/** A moment on a past day, for back-dated completions: midday, clear of any timezone edge. */
function momentOn(date: string): string {
  const d = parseLocalDate(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

// Task actions
/**
 * Finish a task - today, or on an earlier day you forgot to tick it off.
 *
 * A back-dated completion counts on the day it happened: in the history, the
 * review, and for a recurring task, the next occurrence is dated from it.
 */
export async function markTaskDone(taskId: string, onDate?: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const today = getTodayString();
  const day = onDate && onDate < today ? onDate : today;
  const moment = day === today ? new Date().toISOString() : momentOn(day);
  const completions = pruneCompletionDates(
    Array.from(new Set([...(task.completions ?? []), day])).sort(), COMPLETION_LOG_DAYS);
  await db.tasks.update(taskId, {
    status: 'Done',
    lastCompleted: moment,
    doneDate: moment,
    completions,
    updatedAt: new Date().toISOString(),
  });
  await checkDependentsOf(taskId);
  await logTowardsGoal(task, day, 1);

  // Finished on an earlier day, a recurring task may already be owed again:
  // a daily one ticked off for yesterday is due today. The daily check has
  // already run, so bring it back now rather than tomorrow.
  if (day !== today) {
    const updated = await db.tasks.get(taskId);
    if (updated) await resetIfDue(updated, today);
    await recordDay(day, true);
  }
}

/**
 * Take back a completion. With `onDate`, removes that day's entry even if the
 * task has since come back for its next occurrence.
 */
export async function undoTaskDone(taskId: string, onDate?: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const day = onDate ?? localDay(task.doneDate) ?? getTodayString();
  const wasLogged = (task.completions ?? []).includes(day) || (task.status === 'Done' && localDay(task.doneDate) === day);
  const completions = (task.completions ?? []).filter(d => d !== day);
  if (wasLogged) await logTowardsGoal(task, day, -1);
  const doneThatDay = task.status === 'Done' && localDay(task.doneDate) === day;
  if (!doneThatDay) {
    await db.tasks.update(taskId, { completions, updatedAt: new Date().toISOString() });
  } else {
    const baseStatus = task.plannedDate ? 'Planned' : 'Backlog';
    const restoredStatus = autoStatus({ ...task, status: baseStatus, doneDate: null });
    await db.tasks.update(taskId, {
      status: restoredStatus,
      doneDate: null,
      completions,
      updatedAt: new Date().toISOString(),
    });
  }
  if (day !== getTodayString()) await recordDay(day, true);
}

/**
 * A task in a goal project moves the goal when it is done: "read a page"
 * adds a page to "Read a Book". Undoing takes it back off.
 */
async function logTowardsGoal(task: Task, day: string, sign: 1 | -1): Promise<void> {
  if (!task.projectId) return;
  const project = await db.projects.get(task.projectId);
  if (!project || project.deletedAt || project.kind !== 'target') return;
  const amount = (task.progressAmount && task.progressAmount > 0 ? task.progressAmount : 1) * sign;
  await db.projects.update(project.id, {
    progressLog: logProgress(project.progressLog, amount, task.taskName, day),
    updatedAt: new Date().toISOString(),
  });
}

/** Local days a task was finished on, including any before the log existed. */
export function completionDaysOf(task: Pick<Task, 'completions' | 'doneDate' | 'status'>): string[] {
  const days = new Set(task.completions ?? []);
  const done = task.status === 'Done' ? localDay(task.doneDate) : null;
  if (done) days.add(done);
  return Array.from(days).sort();
}

export async function resetTask(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  await db.tasks.update(taskId, {
    status: task?.plannedDate ? 'Planned' : 'Backlog',
    lastCompleted: null,
    doneDate: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function createTask(taskData: {
  taskName: string;
  status?: Task['status'];
  taskPriority?: Task['taskPriority'];
  urgency?: Task['urgency'];
  dueDate?: string | null;
  plannedDate?: string | null;
  recurrence?: Task['recurrence'];
  recurrenceAnchor?: Task['recurrenceAnchor'];
  recurrenceWeekdays?: Task['recurrenceWeekdays'];
  actionPoints?: string | null;
  notes?: string;
  domainId?: string | null;
  projectId?: string | null;
  blockedBy?: BlockedByEntry[];
  followUpDate?: string | null;
  recurrenceEnd?: string | null;
  progressAmount?: number | null;
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
    taskPriority: taskData.taskPriority ?? null,
    urgency: taskData.urgency ?? null,
    taskScore: 0,
    importanceScore: 0,
    urgencyScore: 0,
    dueDate: taskData.dueDate || null,
    plannedDate: taskData.plannedDate || null,
    recurrence: taskData.recurrence || 'None',
    recurrenceAnchor: taskData.recurrenceAnchor ?? null,
    recurrenceWeekdays: taskData.recurrenceWeekdays ?? null,
    lastCompleted: null,
    doneDate: null,
    actionPoints: taskData.actionPoints || null,
    notes: taskData.notes || '',
    domainId: taskData.domainId || null,
    projectId: taskData.projectId ?? null,
    blockedBy: taskData.blockedBy ?? [],
    followUpDate: taskData.followUpDate ?? null,
    recurrenceEnd: taskData.recurrenceEnd ?? null,
    progressAmount: taskData.progressAmount ?? null,
    rotSince: null,
    slipCount: 0,
    completions: [],
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  // Auto-promote/demote based on required fields
  task.status = autoStatus(task);

  // Calculate scores
  const scores = calculateTaskScores(task, domainPriority);
  task.importanceScore = scores.importanceScore;
  task.urgencyScore = scores.urgencyScore;
  task.taskScore = scores.combinedScore;

  await db.tasks.add(task);
  return id;
}

/**
 * Whether an edit moves a plan whose day has already gone. That is a slip:
 * the plan did not happen and is being pushed on, which is exactly the
 * pattern that should get louder rather than quietly reset.
 */
export function isSlip(task: Pick<Task, 'plannedDate' | 'status'>, updates: Partial<Task>, today = getTodayString()): boolean {
  if (task.status === 'Done' || task.status === 'Archived') return false;
  if (updates.status === 'Done' || updates.status === 'Archived') return false;
  // A daily or named-day task's missed day lapses; moving it is not sliding it.
  if (recurrenceKind({ recurrence: (task as Task).recurrence ?? 'None', recurrenceAnchor: (task as Task).recurrenceAnchor ?? null,
    recurrenceWeekdays: (task as Task).recurrenceWeekdays ?? null, dueDate: (task as Task).dueDate ?? null }) === 'lapsing') return false;
  if (!task.plannedDate || task.plannedDate >= today) return false;
  return updates.plannedDate !== undefined && updates.plannedDate !== task.plannedDate;
}

export async function updateTaskData(taskId: string, updates: Partial<Task>): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  const extra: Partial<Task> = {};
  if (isSlip(task, updates)) extra.slipCount = (task.slipCount ?? 0) + 1;

  // Auto-promote/demote based on required fields
  const merged = { ...task, ...updates, ...extra };
  const newStatus = autoStatus(merged);
  const finalStatus = updates.status !== undefined ? autoStatus({ ...merged, status: updates.status }) : newStatus;

  // Coming off Blocked restarts the neglect clock: the time spent waiting on
  // someone else was not time you were ignoring it.
  if (task.status === 'Blocked' && finalStatus !== 'Blocked') extra.rotSince = new Date().toISOString();

  // Always rescore. Status, slips and the plan all feed the score now, and
  // a field-by-field guard is how a task ends up carrying a stale one.
  const domainId = updates.domainId !== undefined ? updates.domainId : task.domainId;
  const domainPriority = domainId ? (await db.domains.get(domainId))?.priority : undefined;
  const scores = calculateTaskScores({ ...merged, ...extra, status: finalStatus }, domainPriority);

  await db.tasks.update(taskId, {
    ...updates,
    ...extra,
    status: finalStatus,
    importanceScore: scores.importanceScore,
    urgencyScore: scores.urgencyScore,
    taskScore: scores.combinedScore,
    updatedAt: new Date().toISOString(),
  });

  // If status changed to Done or Archived, check dependents
  if ((finalStatus === 'Done' || finalStatus === 'Archived') && task.status !== finalStatus) {
    await checkDependentsOf(taskId);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.tasks.update(taskId, { deletedAt: now, updatedAt: now });
  await checkDependentsOf(taskId);
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
    deletedAt: null,
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
      const scores = calculateTaskScores(task, updates.priority);
      await db.tasks.update(task.id, {
        importanceScore: scores.importanceScore,
        urgencyScore: scores.urgencyScore,
        taskScore: scores.combinedScore,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function deleteDomain(domainId: string): Promise<void> {
  const now = new Date().toISOString();
  // Clear domain reference from non-deleted tasks
  const tasks = (await db.tasks.where('domainId').equals(domainId).toArray()).filter(t => !t.deletedAt);
  for (const task of tasks) {
    const scores = calculateTaskScores(task, undefined);
    await db.tasks.update(task.id, {
      domainId: null,
      importanceScore: scores.importanceScore,
      urgencyScore: scores.urgencyScore,
      taskScore: scores.combinedScore,
      updatedAt: now,
    });
  }

  await db.domains.update(domainId, { deletedAt: now, updatedAt: now });
}

// Habit hooks and actions

// Hook to get all habits
export function useHabits() {
  const habits = useLiveQuery(async () => {
    const all = await db.habits.orderBy('habitName').toArray();
    return all.filter(h => !h.deletedAt);
  }, []);

  return habits || [];
}

// Hook to get habits that are due today (active and need completion)
export function useHabitsDueToday() {
  const habits = useLiveQuery(async () => {
    const allHabits = (await db.habits.toArray()).filter(h => !h.deletedAt);
    return allHabits.filter(habit => isHabitDueToday(habit))
      .sort((a, b) => a.habitName.localeCompare(b.habitName));
  }, []);

  return habits || [];
}

/**
 * Mark a habit as done - today, or an earlier day you forgot to tick off.
 * Returns any milestones this completion reached, for the celebration.
 */
export async function markHabitDone(habitId: string, onDate?: string): Promise<Milestone[]> {
  const habit = await db.habits.get(habitId);
  if (!habit) return [];

  const todayStr = getTodayString();
  const day = onDate && onDate < todayStr ? onDate : todayStr;
  if ((habit.completionDates || []).includes(day)) return [];

  const completionDates = pruneCompletionDates([...(habit.completionDates || []), day]).sort();
  const latest = completionDates[completionDates.length - 1];
  const lastCompleted = latest === todayStr ? new Date().toISOString() : momentOn(latest);

  const { current } = currentStreak(completionDates, habit.targetPerWeek, todayStr);
  const total = totalCompletions(habit) + 1;
  const reached = newMilestones(habit, current, total);

  await db.habits.update(habitId, {
    lastCompleted,
    completionDates,
    totalCompletions: total,
    bestStreak: bestStreakSoFar(habit.bestStreak, current),
    milestones: reached.length ? recordMilestones(habit.milestones, reached, todayStr) : habit.milestones ?? [],
    updatedAt: new Date().toISOString(),
  });
  if (day !== todayStr) await recordDay(day, true);
  return reached;
}

// Undo a habit completion for today, or for the given day
export async function undoHabitDone(habitId: string, onDate?: string): Promise<void> {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  const day = onDate ?? getTodayString();
  if (!(habit.completionDates || []).includes(day)) return;
  const completionDates = (habit.completionDates || []).filter(d => d !== day);

  // Find the most recent remaining completion for lastCompleted
  const sortedDates = [...completionDates].sort().reverse();
  const lastCompleted = sortedDates.length > 0 ? momentOn(sortedDates[0]) : null;

  await db.habits.update(habitId, {
    lastCompleted,
    completionDates,
    totalCompletions: Math.max(0, totalCompletions(habit) - 1),
    updatedAt: new Date().toISOString(),
  });
  if (day !== getTodayString()) await recordDay(day, true);
}

// Hook to get habits completed today (for showing in Today view's completed section)
export function useHabitsCompletedToday() {
  const habits = useLiveQuery(async () => {
    const todayStr = getTodayString();
    const allHabits = (await db.habits.toArray()).filter(h => !h.deletedAt);
    return allHabits.filter(habit =>
      habit.isActive && (habit.completionDates || []).includes(todayStr)
    ).sort((a, b) => a.habitName.localeCompare(b.habitName));
  }, []);

  return habits || [];
}

// Create a new habit
export async function createHabit(habitData: {
  habitName: string;
  recurrence?: Habit['recurrence'];
  targetPerWeek?: number | null;
  weekdays?: number[] | null;
  actionPoints?: string | null;
  notes?: string;
  icon?: string | null;
  isActive?: boolean;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const habit: Habit = {
    id,
    habitName: habitData.habitName,
    recurrence: habitData.recurrence || 'Daily',
    lastCompleted: null,
    targetPerWeek: habitData.targetPerWeek ?? null,
    actionPoints: habitData.actionPoints ?? null,
    completionDates: [],
    weekdays: habitData.weekdays?.length ? habitData.weekdays : null,
    totalCompletions: 0,
    milestones: [],
    bestStreak: 0,
    notes: habitData.notes || '',
    icon: habitData.icon ?? null,
    isActive: habitData.isActive ?? true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.habits.add(habit);
  return id;
}

// Update an existing habit
export async function updateHabitData(habitId: string, updates: Partial<Habit>): Promise<void> {
  await db.habits.update(habitId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// Delete a habit
export async function deleteHabit(habitId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.habits.update(habitId, { deletedAt: now, updatedAt: now });
}

// Toggle habit active/paused state
export async function toggleHabitActive(habitId: string): Promise<void> {
  const habit = await db.habits.get(habitId);
  if (habit) {
    await db.habits.update(habitId, {
      isActive: !habit.isActive,
      updatedAt: new Date().toISOString(),
    });
  }
}

// Event hooks and actions

// Hook to get all events with computed domain
export function useEvents() {
  const events = useLiveQuery(async () => {
    const allEvents = (await db.events.toArray()).filter(e => !e.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allEvents.map(event => ({
      ...event,
      domain: event.domainId ? domainMap.get(event.domainId) || null : null,
    })).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = (a.time || '').localeCompare(b.time || '');
      if (timeCompare !== 0) return timeCompare;
      return a.eventName.localeCompare(b.eventName);
    });
  }, []);

  return events || [];
}

// Hook to get events for today (excludes completed ones)
export function useEventsToday() {
  const events = useLiveQuery(async () => {
    const todayStr = getTodayString();
    const allEvents = (await db.events.toArray()).filter(e => !e.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allEvents
      .filter(e => e.date === todayStr && e.lastCompleted !== todayStr)
      .map(event => ({
        ...event,
        domain: event.domainId ? domainMap.get(event.domainId) || null : null,
      }))
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.eventName.localeCompare(b.eventName));
  }, []);

  return events || [];
}

// Hook to get events completed today
export function useEventsCompletedToday() {
  const events = useLiveQuery(async () => {
    const todayStr = getTodayString();
    const allEvents = (await db.events.toArray()).filter(e => !e.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allEvents
      .filter(e => e.date === todayStr && e.lastCompleted === todayStr)
      .map(event => ({
        ...event,
        domain: event.domainId ? domainMap.get(event.domainId) || null : null,
      }))
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.eventName.localeCompare(b.eventName));
  }, []);

  return events || [];
}

// Create a new event
export async function createEvent(eventData: {
  eventName: string;
  date: string;
  time?: string | null;
  duration?: number | null;
  actionPoints?: string | null;
  recurrence?: Event['recurrence'];
  notes?: string;
  domainId?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const event: Event = {
    id,
    eventName: eventData.eventName,
    date: eventData.date,
    time: eventData.time ?? null,
    duration: eventData.duration ?? null,
    actionPoints: eventData.actionPoints ?? null,
    recurrence: eventData.recurrence || 'None',
    lastCompleted: null,
    notes: eventData.notes || '',
    domainId: eventData.domainId ?? null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.events.add(event);
  return id;
}

// Update an existing event
export async function updateEventData(eventId: string, updates: Partial<Event>): Promise<void> {
  await db.events.update(eventId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// Mark an event as attended - today, or on an earlier day
export async function markEventDone(eventId: string, onDate?: string): Promise<void> {
  const day = onDate ?? getTodayString();
  await db.events.update(eventId, {
    lastCompleted: day,
    updatedAt: new Date().toISOString(),
  });
  if (day !== getTodayString()) await recordDay(day, true);
}

// Undo marking an event as done
export async function undoEventDone(eventId: string, onDate?: string): Promise<void> {
  await db.events.update(eventId, {
    lastCompleted: null,
    updatedAt: new Date().toISOString(),
  });
  if (onDate && onDate !== getTodayString()) await recordDay(onDate, true);
}

// Delete an event
export async function deleteEvent(eventId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.events.update(eventId, { deletedAt: now, updatedAt: now });
}

// --- Project hooks and actions ---

const DEFAULT_AP = 2;

// Hook to get all projects with computed fields
export function useProjects() {
  const projects = useLiveQuery(async () => {
    const allProjects = (await db.projects.toArray()).filter(p => !p.deletedAt);
    const allTasks = (await db.tasks.toArray()).filter(t => !t.deletedAt);
    const domains = (await db.domains.toArray()).filter(d => !d.deletedAt);
    const domainMap = new Map(domains.map(d => [d.id, d]));

    return allProjects.map(project => {
      const projectTasks = allTasks.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'Done' || t.status === 'Archived');
      const totalAP = projectTasks.reduce((sum, t) => sum + (parseInt(t.actionPoints || '0') || DEFAULT_AP), 0);
      const completedAP = completedTasks.reduce((sum, t) => sum + (parseInt(t.actionPoints || '0') || DEFAULT_AP), 0);

      // A target project measures logged work, not the state of task rows.
      const progress = projectProgress(project, projectTasks);

      return {
        ...project,
        domain: project.domainId ? domainMap.get(project.domainId) || null : null,
        tasks: projectTasks,
        taskCount: projectTasks.length,
        completedTaskCount: completedTasks.length,
        totalAP,
        completedAP,
        progress,
        completionPercent: progress.percent,
      };
    }).sort((a, b) => {
      // Active first, then Completed, then Archived
      const statusOrder = { Active: 0, Completed: 1, Archived: 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });
  }, []);

  return projects || [];
}

/**
 * Record work against a target project.
 *
 * Deliberately not tied to completing a task or a habit: the point of a
 * target is that you log what you actually did - two pages, four, none - and
 * the count goes up by that much.
 */
export async function logProjectProgress(projectId: string, amount: number, note?: string, onDate?: string): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) return;
  await db.projects.update(projectId, {
    progressLog: logProgress(project.progressLog, amount, note, onDate),
    updatedAt: new Date().toISOString(),
  });
}

// Create a new project
export async function createProject(projectData: {
  name: string;
  description?: string;
  icon?: string | null;
  status?: Project['status'];
  domainId?: string | null;
  kind?: Project['kind'];
  targetCount?: number | null;
  targetUnit?: string | null;
  targetDate?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const project: Project = {
    id,
    name: projectData.name,
    description: projectData.description || '',
    icon: projectData.icon ?? null,
    status: projectData.status || 'Active',
    domainId: projectData.domainId ?? null,
    kind: projectData.kind ?? 'bundle',
    targetCount: projectData.targetCount ?? null,
    targetUnit: projectData.targetUnit ?? null,
    targetDate: projectData.targetDate ?? null,
    progressLog: [],
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.projects.add(project);
  return id;
}

// Update an existing project
export async function updateProjectData(projectId: string, updates: Partial<Project>): Promise<void> {
  await db.projects.update(projectId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// Delete a project (soft delete)
export async function deleteProject(projectId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.projects.update(projectId, { deletedAt: now, updatedAt: now });
}

// --- Notes and lists -------------------------------------------------------

export function useNotes() {
  const notes = useLiveQuery(async () => {
    const all = (await db.notes.toArray()).filter(n => !n.deletedAt);
    // Pinned first, then most recently touched.
    return all.sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, []);
  return notes || [];
}

export async function createNote(data: {
  title: string;
  kind: Note['kind'];
  body?: string;
  items?: Note['items'];
  pinned?: boolean;
  domainId?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.notes.add({
    id,
    title: data.title,
    kind: data.kind,
    body: data.body ?? '',
    items: data.items ?? [],
    pinned: data.pinned ?? false,
    domainId: data.domainId ?? null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateNote(noteId: string, updates: Partial<Note>): Promise<void> {
  await db.notes.update(noteId, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteNote(noteId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.notes.update(noteId, { deletedAt: now, updatedAt: now });
}

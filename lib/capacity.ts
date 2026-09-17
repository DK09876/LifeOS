/**
 * How much effort a day is allowed to cost, and how much it has cost so far.
 *
 * The AP budget used to exist only inside the suggester: it shaped what got
 * proposed and then vanished, so nothing tracked what the day actually took.
 * This is the same number made visible and adjustable on the day itself -
 * some days you have less in you than others, and the plan should be able to
 * say so.
 */

import { Task, Event } from './db';
import { getTodayString, parseLocalDateTime } from './dates';

/** Per-date overrides, keyed YYYY-MM-DD. Absent means "use the default". */
export type CapacityMap = Record<string, number>;

export const CAPACITY_PREF = 'ap.capacityByDate';

/** Overrides older than this are dropped; they are only useful while recent. */
const KEEP_DAYS = 60;

export function parseCapacityMap(raw: string | undefined): CapacityMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CapacityMap = {};
    for (const [date, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[date] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Drop overrides that have aged out, so the preference cannot grow forever. */
export function pruneCapacityMap(map: CapacityMap, today = getTodayString()): CapacityMap {
  const cutoff = new Date(new Date(today + 'T00:00:00').getTime() - KEEP_DAYS * 86400000);
  const out: CapacityMap = {};
  for (const [date, value] of Object.entries(map)) {
    if (new Date(date + 'T00:00:00') >= cutoff) out[date] = value;
  }
  return out;
}

export function capacityFor(map: CapacityMap, date: string, fallback: number): number {
  const override = map[date];
  return typeof override === 'number' ? override : fallback;
}

/** A task's effort, falling back to the configured default when unestimated. */
export function apOf(item: Pick<Task, 'actionPoints'> | Pick<Event, 'actionPoints'>, defaultAP: number): number {
  return parseInt(item.actionPoints || '0') || defaultAP;
}

export interface DayLoad {
  /** Effort already spent on things finished today. */
  done: number;
  /** Effort still committed for today but not finished. */
  planned: number;
  /** done + planned: what the day is on course to cost. */
  committed: number;
}

/**
 * What today has cost and is still going to cost.
 *
 * Events count against the budget as well as tasks - an hour at the dentist
 * takes the same capacity as an hour of work, and a day that ignores them
 * reads as emptier than it is.
 */
export function dayLoad(
  tasks: Task[],
  events: Event[],
  defaultAP: number,
  today = getTodayString(),
): DayLoad {
  let done = 0;
  let planned = 0;

  for (const task of tasks) {
    if (task.deletedAt) continue;
    if (task.status === 'Done') {
      // Finished today, whichever day it was scheduled for: the effort was
      // spent today and the day should account for it.
      if (task.doneDate && sameLocalDay(task.doneDate, today)) done += apOf(task, defaultAP);
      continue;
    }
    if (task.status === 'Archived') continue;
    if (task.plannedDate === today || task.dueDate === today) planned += apOf(task, defaultAP);
  }

  for (const event of events) {
    if (event.deletedAt || event.date !== today) continue;
    if (event.lastCompleted === today) done += apOf(event, defaultAP);
    else planned += apOf(event, defaultAP);
  }

  return { done, planned, committed: done + planned };
}

function sameLocalDay(stored: string, today: string): boolean {
  // doneDate is a timestamp from the web app and a date-only string from the
  // voice assistant; parseLocalDateTime reads both without shifting the day.
  const date = parseLocalDateTime(stored);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` === today;
}

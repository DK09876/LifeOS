/**
 * The worked examples on the "How it works" page, as tests.
 *
 * Every number the help page quotes comes from here. If a rule changes and
 * one of these fails, the page is now wrong - fix the page along with the
 * expectation, never just the expectation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Task } from '@/types';
import { calculateTaskScores, isMissedPlan, isPressingBlocked, isStrandedBlocked } from './scoring';
import { checkNeedsReset, comeBack, liveOccurrenceDue, upcomingOccurrences } from './recurrence';
import { suggestWeekSchedule, DEFAULT_SUGGEST_CONTROLS, WeekDayInfo } from './suggest';
import { capacityFor } from './capacity';
import { parseLocalDate } from './dates';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** importance / urgency / score on a given day, the way the lists see it. */
function on(day: string, t: Partial<Task>, domain: string) {
  vi.setSystemTime(new Date(`${day}T12:00:00`));
  const r = calculateTaskScores(t, domain, day);
  return [r.importanceScore, r.urgencyScore, r.combinedScore];
}
const noon = (d: string) => new Date(`${d}T12:00:00`).toISOString();
function task(over: Partial<Task>): Task {
  return {
    id: over.id ?? 't', taskName: 'T', status: 'Backlog', taskPriority: '3 - Normal', urgency: '3 - Normal',
    taskScore: 0, importanceScore: 0, urgencyScore: 0, dueDate: null, plannedDate: null, recurrence: 'None',
    recurrenceAnchor: null, recurrenceWeekdays: null, lastCompleted: null, doneDate: null, actionPoints: '2',
    notes: '', domainId: 'd', projectId: null, blockedBy: [], followUpDate: null, deletedAt: null,
    createdAt: noon('2026-09-01'), updatedAt: noon('2026-09-01'), ...over,
  };
}

describe('Pay the electricity bill — a one-off with a deadline', () => {
  const bill = { taskPriority: '2 - High' as const, urgency: '3 - Normal' as const, dueDate: '2026-10-09', createdAt: noon('2026-10-01') };
  it('climbs as the due date nears and keeps climbing once late', () => {
    expect(on('2026-10-05', bill, '2 - Important')).toEqual([50, 60, 30]); // Mon, due Fri: Schedule
    expect(on('2026-10-09', bill, '2 - Important')).toEqual([50, 75, 38]); // due today: Do Now
    expect(on('2026-10-10', bill, '2 - Important')).toEqual([50, 80, 40]); // a day late
    expect(on('2026-10-19', bill, '2 - Important')).toEqual([50, 98, 49]); // ten days late
  });
});

describe('Clean the garage — undated, left alone', () => {
  const garage = { createdAt: noon('2026-10-05') };
  it('rots slowly from when it was written', () => {
    expect(on('2026-10-05', garage, '3 - Maintenance')).toEqual([35, 30, 11]);
    expect(on('2026-10-19', garage, '3 - Maintenance')).toEqual([35, 35, 12]); // 2 weeks
    expect(on('2026-11-04', garage, '3 - Maintenance')).toEqual([35, 40, 14]); // a month
    expect(on('2027-01-05', garage, '3 - Maintenance')).toEqual([35, 50, 18]); // 3 months
  });
  it('stops rotting while planned for a day to come, and editing does not reset it', () => {
    expect(on('2027-01-05', { ...garage, plannedDate: '2027-01-09' }, '3 - Maintenance')).toEqual([35, 30, 11]);
    expect(on('2027-01-05', { ...garage, updatedAt: noon('2027-01-05') }, '3 - Maintenance')).toEqual([35, 50, 18]);
  });
});

describe('Email the landlord — planned, missed, slid', () => {
  const email = { createdAt: noon('2026-10-04') };
  it('gets louder each time the plan slides', () => {
    expect(on('2026-10-05', { ...email, plannedDate: '2026-10-05' }, '2 - Important')).toEqual([40, 30, 12]);
    expect(on('2026-10-06', { ...email, plannedDate: '2026-10-05' }, '2 - Important')).toEqual([40, 62, 25]); // missed
    expect(on('2026-10-06', { ...email, plannedDate: '2026-10-07', slipCount: 1 }, '2 - Important')).toEqual([40, 34, 14]); // moved to Wed
    expect(on('2026-10-08', { ...email, plannedDate: '2026-10-07', slipCount: 1 }, '2 - Important')).toEqual([40, 66, 26]); // missed again
    expect(on('2026-10-08', { ...email, plannedDate: '2026-10-10', slipCount: 2 }, '2 - Important')).toEqual([40, 38, 15]); // moved to Sat
  });
  it('is listed as a missed plan', () => {
    vi.setSystemTime(new Date('2026-10-06T12:00:00'));
    expect(isMissedPlan(task({ status: 'Planned', plannedDate: '2026-10-05' }), '2026-10-06')).toBe(true);
  });
});

describe('Reach out to James — blocked on another task', () => {
  it('scores only what you gave it while it waits', () => {
    const james = { taskPriority: '2 - High' as const, status: 'Blocked' as const, blockedBy: [{ type: 'task' as const, taskId: 'budget' }] };
    expect(on('2026-10-05', james, '2 - Important')).toEqual([50, 30, 15]);
  });
  it('needs a task to wait on or a day to chase, or it is stranded', () => {
    expect(isStrandedBlocked(task({ status: 'Blocked' }))).toBe(true);
    expect(isStrandedBlocked(task({ status: 'Blocked', blockedBy: [{ type: 'task', taskId: 'budget' }] }))).toBe(false);
  });
});

describe('Tax return docs — waiting on the accountant, chase Thursday, due the 16th', () => {
  const tax = { taskPriority: '2 - High' as const, urgency: '2 - High' as const, status: 'Blocked' as const,
    dueDate: '2026-10-16', followUpDate: '2026-10-08', blockedBy: [{ type: 'note' as const, note: 'accountant' }] };
  it('stays quiet, then the chase comes due and goes overdue', () => {
    expect(on('2026-10-05', tax, '2 - Important')).toEqual([50, 60, 30]);
    expect(on('2026-10-08', tax, '2 - Important')).toEqual([50, 85, 43]); // chase today
    expect(on('2026-10-09', tax, '2 - Important')).toEqual([50, 90, 45]); // chase a day overdue
    expect(on('2026-10-12', tax, '2 - Important')).toEqual([50, 99, 50]);
  });
  it('is flagged pressing once the deadline is a week away', () => {
    const t = task({ ...tax });
    expect(isPressingBlocked(t, '2026-10-08')).toBe(false);
    expect(isPressingBlocked(t, '2026-10-09')).toBe(true);
  });
});

describe('Read a page — daily, in the Read a Book goal', () => {
  const read = { urgency: '4 - Low' as const, recurrence: 'Daily' as const };
  it('never piles up, rots or goes missed', () => {
    expect(on('2026-10-05', read, '3 - Maintenance')).toEqual([35, 20, 7]);
    expect(on('2027-01-05', read, '3 - Maintenance')).toEqual([35, 20, 7]);
    expect(on('2026-10-05', { ...read, plannedDate: '2026-10-04' }, '3 - Maintenance')).toEqual([35, 20, 7]);
    expect(isMissedPlan(task({ ...read, status: 'Planned', plannedDate: '2026-10-04' }), '2026-10-05')).toBe(false);
  });
  it('comes back each day unplanned; each day is planned on its own', () => {
    vi.setSystemTime(new Date('2026-10-06T08:00:00'));
    const done = task({ ...read, status: 'Done', plannedDate: '2026-10-05', lastCompleted: noon('2026-10-05') });
    expect(checkNeedsReset(done, '2026-10-06')).toBe(true);
    expect(comeBack(done)).toMatchObject({ plannedDate: null, dueDate: null });
    const planned = { ...done, occurrencePlans: [{ due: '2026-10-06', plannedDate: '2026-10-06' }] };
    expect(comeBack(planned).plannedDate).toBe('2026-10-06');
  });
  it('can have one day skipped', () => {
    vi.setSystemTime(new Date('2026-10-06T08:00:00'));
    const t = task({ ...read, occurrencePlans: [{ due: '2026-10-06', plannedDate: null, skipped: true }] });
    expect(liveOccurrenceDue(t, '2026-10-06')).toBe('2026-10-07');
  });
});

describe('Water the plants — every 2 weeks from when you last did it', () => {
  const plants = { recurrence: 'Biweekly' as const, lastCompleted: noon('2026-10-05'), createdAt: noon('2026-09-01') };
  it('is calm mid-cycle, due on the 19th, then piles up below any real overdue', () => {
    expect(on('2026-10-05', plants, '2 - Important')).toEqual([40, 42, 17]);
    expect(on('2026-10-19', plants, '2 - Important')).toEqual([40, 62, 25]); // due today
    expect(on('2026-10-20', plants, '2 - Important')).toEqual([40, 66, 26]); // a day late
    expect(on('2026-10-26', plants, '2 - Important')).toEqual([40, 78, 31]); // a week late
    expect(on('2026-11-03', plants, '2 - Important')).toEqual([40, 79, 32]); // 2 behind — the cap
  });
  it('moves when done early', () => {
    vi.setSystemTime(new Date('2026-10-16T12:00:00'));
    const early = task({ ...plants, status: 'Done', lastCompleted: noon('2026-10-15') });
    const [next] = upcomingOccurrences(early, '2026-11-30', '2026-10-16');
    expect(next.due).toBe('2026-10-29');
  });
  it('is suggested on the earliest day with room before it is due', () => {
    // Last watered Fri Oct 2, so due Fri Oct 16. Planning Mon 12 – Sun 18 on the Sunday before:
    vi.setSystemTime(new Date('2026-10-11T18:00:00'));
    const t = task({ ...plants, lastCompleted: null, rotSince: noon('2026-10-02'), actionPoints: '1' });
    const week = (from: string) => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${from}T00:00:00`); d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: d, dateStr, existingTasks: [], events: [] } as WeekDayInfo;
    });
    expect(suggestWeekSchedule([t], week('2026-10-12'), DEFAULT_SUGGEST_CONTROLS, new Map()).get('t')).toBe('2026-10-12');
    // Monday already full: Tuesday.
    const full = week('2026-10-12').map((d, i) => (i === 0 ? { ...d, capacity: 0 } : d));
    expect(suggestWeekSchedule([t], full, DEFAULT_SUGGEST_CONTROLS, new Map()).get('t')).toBe('2026-10-13');
  });
});

describe('Pay rent — due the 1st, a fixed period', () => {
  const rent = { taskPriority: '1 - Urgent' as const, urgency: '2 - High' as const, recurrence: 'Monthly' as const,
    recurrenceAnchor: 'schedule' as const, dueDate: '2026-11-01' };
  it('is a real deadline', () => {
    expect(on('2026-10-05', rent, '1 - Critical')).toEqual([65, 55, 36]);
    expect(on('2026-10-30', rent, '1 - Critical')).toEqual([65, 75, 49]);
    expect(on('2026-11-02', rent, '1 - Critical')).toEqual([65, 90, 59]); // a day late
  });
  it('never moves when paid early, and reopens once the 1st has passed', () => {
    vi.setSystemTime(new Date('2026-10-29T12:00:00'));
    const paid = task({ ...rent, status: 'Done', lastCompleted: noon('2026-10-28') });
    expect(checkNeedsReset(paid, '2026-11-01')).toBe(false);
    expect(checkNeedsReset(paid, '2026-11-02')).toBe(true);
    expect(comeBack(paid).dueDate).toBe('2026-12-01');
  });
});

describe('Gym prep — Mon, Wed, Fri', () => {
  const gym = { recurrence: 'Weekly' as const, recurrenceWeekdays: [1, 3, 5], lastCompleted: noon('2026-09-30') };
  it('lets a missed Monday go', () => {
    expect(on('2026-10-06', gym, '2 - Important')).toEqual([40, 30, 12]);
    vi.setSystemTime(new Date('2026-10-06T12:00:00'));
    expect(liveOccurrenceDue(task({ ...gym }), '2026-10-06')).toBe('2026-10-07'); // next is Wednesday
  });
});

describe('Energy budgets', () => {
  it('uses a one-off change, then the weekday, then the default', () => {
    const weekdays = [null, 6, null, null, null, null, null]; // Mondays lighter
    expect(capacityFor({}, '2026-10-05', 9, weekdays)).toBe(6);   // Monday
    expect(capacityFor({}, '2026-10-06', 9, weekdays)).toBe(9);   // Tuesday
    expect(capacityFor({ '2026-10-06': 4 }, '2026-10-06', 9, weekdays)).toBe(4);
  });
});

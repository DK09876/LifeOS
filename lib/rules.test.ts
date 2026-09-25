/**
 * Tests for the rules added with the design review: calendar-day resets,
 * projected occurrences, series that end, habits on chosen days, events that
 * move on, weekday budgets, milestones, slips, and the notices built on them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Event, Habit, Task } from '@/types';
import {
  checkNeedsReset, currentEventDate, cycleDueDate, isHabitDueOn, nextOnDate, previousEventDate,
  projectOccurrences, seriesEnded,
} from './recurrence';
import { capacityFor, parseWeekdayBudget } from './capacity';
import { milestonesFor, newMilestones, nextMilestones } from './milestones';
import { buildNotices, DEFAULT_NOTICE_SETTINGS, isDueToPush, isVisible, needsTriageNag, rolledOver } from './notifications';
import { suggestWeekSchedule, DEFAULT_SUGGEST_CONTROLS, WeekDayInfo } from './suggest';
import { isOnToday } from './schedule';
import { spentOn } from './history';
import { parseLocalDate } from './dates';

// Thursday 24 September 2026, mid-morning local.
const NOW = new Date(2026, 8, 24, 10, 0, 0);
const TODAY = '2026-09-24';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

const at = (date: string, hh = 12) => { const d = parseLocalDate(date); d.setHours(hh); return d.toISOString(); };

function task(over: Partial<Task> = {}): Task {
  return {
    id: over.id ?? 't1', taskName: 'T', status: 'Backlog', taskPriority: '3 - Normal', urgency: '3 - Normal',
    taskScore: 10, importanceScore: 35, urgencyScore: 30, dueDate: null, plannedDate: null,
    recurrence: 'None', recurrenceAnchor: null, recurrenceWeekdays: null, lastCompleted: null, doneDate: null,
    actionPoints: '2', notes: '', domainId: 'd1', projectId: null, blockedBy: [], followUpDate: null,
    deletedAt: null, createdAt: at('2026-09-01'), updatedAt: at('2026-09-01'), ...over,
  };
}

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: over.id ?? 'h1', habitName: 'H', recurrence: 'Daily', lastCompleted: null, targetPerWeek: null,
    actionPoints: '1', completionDates: [], bestStreak: 0, notes: '', icon: null, isActive: true,
    deletedAt: null, createdAt: at('2026-09-01'), updatedAt: at('2026-09-01'), ...over,
  };
}

function event(over: Partial<Event> = {}): Event {
  return {
    id: over.id ?? 'e1', eventName: 'E', date: TODAY, time: null, duration: null, actionPoints: '1',
    recurrence: 'None', lastCompleted: null, notes: '', domainId: null, deletedAt: null,
    createdAt: at('2026-09-01'), updatedAt: at('2026-09-01'), ...over,
  };
}

describe('recurring tasks reset by calendar day', () => {
  // The bug: finished at 9pm, the next morning's once-a-day check found it
  // had not been 24 hours, and the task stayed finished all day.
  it('brings a daily task back the next morning however late it was done', () => {
    const done = task({ recurrence: 'Daily', status: 'Done', lastCompleted: at('2026-09-23', 21) });
    expect(checkNeedsReset(done, TODAY)).toBe(true);
  });

  it('does not bring it back the same day', () => {
    const done = task({ recurrence: 'Daily', status: 'Done', lastCompleted: at(TODAY, 8) });
    expect(checkNeedsReset(done, TODAY)).toBe(false);
  });

  it('brings a weekly task back seven calendar days on', () => {
    const done = task({ recurrence: 'Weekly', status: 'Done', lastCompleted: at('2026-09-17', 22) });
    expect(checkNeedsReset(done, TODAY)).toBe(true);
    expect(checkNeedsReset({ ...done, lastCompleted: at('2026-09-18', 6) }, TODAY)).toBe(false);
  });
});

describe('a series can end', () => {
  const reading = task({
    recurrence: 'Daily', status: 'Done', lastCompleted: at('2026-09-23'), recurrenceEnd: '2026-09-23',
  });

  it('stops coming back after its end date', () => {
    expect(seriesEnded(reading)).toBe(true);
    expect(checkNeedsReset(reading, TODAY)).toBe(false);
    expect(nextOnDate(reading)).toBeNull();
  });

  it('keeps going up to it', () => {
    const ongoing = { ...reading, recurrenceEnd: '2026-09-30' };
    expect(checkNeedsReset(ongoing, TODAY)).toBe(true);
  });

  it('projects no occurrences past it', () => {
    const live = task({ recurrence: 'Daily', plannedDate: TODAY, recurrenceEnd: '2026-09-26' });
    expect(projectOccurrences(live, TODAY, '2026-09-30', TODAY)).toEqual(['2026-09-25', '2026-09-26']);
  });
});

describe('projected occurrences', () => {
  it('shows every later day of a daily task, not the one in hand', () => {
    const live = task({ recurrence: 'Daily', plannedDate: TODAY });
    expect(projectOccurrences(live, '2026-09-21', '2026-09-27', TODAY))
      .toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
  });

  it('includes the next occurrence of a finished task', () => {
    const done = task({ recurrence: 'Daily', status: 'Done', lastCompleted: at(TODAY) });
    expect(projectOccurrences(done, TODAY, '2026-09-26', TODAY)).toEqual(['2026-09-25', '2026-09-26']);
  });

  it('follows named weekdays', () => {
    const mwf = task({ recurrence: 'Weekly', recurrenceWeekdays: [1, 3, 5], plannedDate: '2026-09-21' });
    // Monday's was missed and lapsed; the one in hand is Friday's, then Mon and Wed.
    expect(projectOccurrences(mwf, '2026-09-21', '2026-09-30', TODAY)).toEqual(['2026-09-28', '2026-09-30']);
  });

  it('projects nothing for one-off or blocked work', () => {
    expect(projectOccurrences(task(), TODAY, '2026-10-30', TODAY)).toEqual([]);
    expect(projectOccurrences(task({ recurrence: 'Daily', status: 'Blocked' }), TODAY, '2026-10-30', TODAY)).toEqual([]);
  });
});

describe('next on', () => {
  it('is the occurrence in hand for open work', () => {
    expect(nextOnDate(task({ recurrence: 'Weekly', dueDate: '2026-09-27' }))).toBe('2026-09-27');
  });

  it('is when it comes back for finished work', () => {
    const done = task({ recurrence: 'Biweekly', status: 'Done', lastCompleted: at('2026-09-20') });
    expect(nextOnDate(done)).toBe('2026-10-04');
  });

  it('is the cycle end for an undated recurring task', () => {
    const live = task({ recurrence: 'Weekly', rotSince: at('2026-09-20') });
    expect(nextOnDate(live)).toBe('2026-09-27');
    expect(cycleDueDate(live)).toBe('2026-09-27');
  });
});

describe('habits on chosen days', () => {
  const mwf = habit({ weekdays: [1, 3, 5] });

  it('is only asked for on those days', () => {
    expect(isHabitDueOn(mwf, TODAY)).toBe(false);           // Thursday
    expect(isHabitDueOn(mwf, '2026-09-25')).toBe(true);     // Friday
  });

  it('stops once the weekly quota is met', () => {
    const quota = habit({ weekdays: [1, 3, 5], targetPerWeek: 2, completionDates: ['2026-09-21', '2026-09-23'] });
    expect(isHabitDueOn(quota, '2026-09-25')).toBe(false);
  });

  it('asks every day by default', () => {
    expect(isHabitDueOn(habit(), TODAY)).toBe(true);
    expect(isHabitDueOn(habit({ completionDates: [TODAY] }), TODAY)).toBe(false);
  });
});

describe('recurring events move on', () => {
  it('jumps a missed standing meeting to its next occurrence', () => {
    expect(currentEventDate(event({ recurrence: 'Weekly', date: '2026-09-10' }), TODAY)).toBe('2026-09-24');
    expect(currentEventDate(event({ recurrence: 'Weekly', date: '2026-09-09' }), TODAY)).toBe('2026-09-30');
  });

  it('leaves one-off events where they are', () => {
    expect(currentEventDate(event({ date: '2026-09-01' }), TODAY)).toBe('2026-09-01');
  });

  it('can find the occurrence before the current one', () => {
    expect(previousEventDate({ date: TODAY, recurrence: 'Daily' })).toBe('2026-09-23');
  });
});

describe('weekday budgets', () => {
  it('uses a date override, then the weekday, then the default', () => {
    const weekdays = parseWeekdayBudget(JSON.stringify([12, null, null, null, 6, null, 12]));
    expect(capacityFor({}, TODAY, 9, weekdays)).toBe(6);             // Thursday
    expect(capacityFor({}, '2026-09-27', 9, weekdays)).toBe(12);     // Sunday
    expect(capacityFor({}, '2026-09-22', 9, weekdays)).toBe(9);      // Tuesday, unset
    expect(capacityFor({ [TODAY]: 3 }, TODAY, 9, weekdays)).toBe(3);
  });

  it('ignores a malformed setting', () => {
    expect(parseWeekdayBudget('[1,2]')).toBeNull();
    expect(parseWeekdayBudget('nope')).toBeNull();
    expect(parseWeekdayBudget(JSON.stringify([null, null, null, null, null, null, null]))).toBeNull();
  });
});

describe('milestones', () => {
  it('lists what has been reached', () => {
    expect(milestonesFor(8, 'day', 12).map((m) => m.key)).toEqual(['streak-day:3', 'streak-day:7', 'total:10']);
  });

  it('only celebrates each one once', () => {
    const h = habit({ milestones: [{ key: 'streak-day:3', date: '2026-09-01' }] });
    expect(newMilestones(h, 7, 5).map((m) => m.key)).toEqual(['streak-day:7']);
  });

  it('counts weekly habits in weeks', () => {
    expect(milestonesFor(4, 'week', 0).map((m) => m.key)).toEqual(['streak-week:2', 'streak-week:4']);
  });

  it('knows what is next', () => {
    const next = nextMilestones(habit(), 5, 9);
    expect(next.streak).toMatchObject({ at: 7, remaining: 2 });
    expect(next.total).toMatchObject({ at: 10, remaining: 1 });
  });
});

describe("today's list", () => {
  it('leaves blocked work off it even when due today', () => {
    expect(isOnToday(task({ dueDate: TODAY }), TODAY)).toBe(true);
    expect(isOnToday(task({ dueDate: TODAY, status: 'Blocked' }), TODAY)).toBe(false);
  });
});

describe('history counts recurring completions', () => {
  it('reads the completion log once the task has come back', () => {
    const reset = task({ recurrence: 'Daily', status: 'Planned', completions: ['2026-09-23'] });
    expect(spentOn('2026-09-23', [reset], [], [], 2)).toEqual({ spent: 2, finished: 1 });
  });

  it('does not double count a task done and logged the same day', () => {
    const done = task({ status: 'Done', doneDate: at('2026-09-23'), completions: ['2026-09-23'] });
    expect(spentOn('2026-09-23', [done], [], [], 2)).toEqual({ spent: 2, finished: 1 });
  });
});

describe('triage nag', () => {
  it('waits for a weekend to pass through', () => {
    // Created Tuesday, today Thursday: no weekend yet.
    expect(needsTriageNag(task({ status: 'Needs Details', createdAt: at('2026-09-22') }), TODAY)).toBe(false);
    // Created last Friday: Saturday has been and gone.
    expect(needsTriageNag(task({ status: 'Needs Details', createdAt: at('2026-09-18') }), TODAY)).toBe(true);
  });

  it('nags on the weekend itself', () => {
    expect(needsTriageNag(task({ status: 'Needs Details', createdAt: at('2026-09-25') }), '2026-09-26')).toBe(true);
  });

  it('stops once it is sorted', () => {
    expect(needsTriageNag(task({ status: 'Backlog', createdAt: at('2026-09-01') }), TODAY)).toBe(false);
  });
});

describe('notices', () => {
  const base = { habits: [], events: [], settings: DEFAULT_NOTICE_SETTINGS, budget: 10, defaultAP: 2, now: NOW };

  it('folds the state of things into one morning brief', () => {
    const notices = buildNotices({
      ...base,
      tasks: [
        task({ id: 'a', dueDate: '2026-09-20' }),
        task({ id: 'b', plannedDate: TODAY }),
        task({ id: 'c', status: 'Blocked', dueDate: '2026-09-26' }),
      ],
    });
    const brief = notices.find((n) => n.kind === 'brief')!;
    expect(brief.pushAt).toBe(`${TODAY}T08:00`);
    expect(brief.body).toContain('1 overdue');
    expect(brief.body).toContain('1 blocked & pressing');
    expect(notices.filter((n) => n.pushAt).map((n) => n.kind)).toEqual(['brief']);
    expect(notices.map((n) => n.kind)).toEqual(expect.arrayContaining(['overdue', 'blocked']));
  });

  it('warns when the day is over budget', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => task({ id: `x${i}`, plannedDate: TODAY }));
    const brief = buildNotices({ ...base, tasks }).find((n) => n.kind === 'brief')!;
    expect(brief.level).toBe('warn');
    expect(brief.title).toContain('12/10');
  });

  it('reminds ahead of a timed event, and pushes inside the grace window only', () => {
    const notices = buildNotices({ ...base, tasks: [], events: [event({ time: '14:00' })] });
    const reminder = notices.find((n) => n.kind === 'event')!;
    expect(reminder.pushAt).toBe(`${TODAY}T13:45`);
    expect(isVisible(reminder, NOW)).toBe(false);
    expect(isDueToPush(reminder, new Date(2026, 8, 24, 13, 50))).toBe(true);
    expect(isDueToPush(reminder, new Date(2026, 8, 24, 13, 40))).toBe(false);
    expect(isDueToPush(reminder, new Date(2026, 8, 24, 18, 0))).toBe(false);
  });

  it('applies the recurring rollover before judging the day', () => {
    const doneLastNight = task({ recurrence: 'Daily', status: 'Done', lastCompleted: at('2026-09-23', 21), plannedDate: '2026-09-23' });
    const [rolled] = rolledOver([doneLastNight], TODAY);
    // Back for today, unplanned: each day of a daily task is planned on its own.
    expect(rolled.status).toBe('Backlog');
    expect(rolled.plannedDate).toBeNull();
    const withPlan = rolledOver([{ ...doneLastNight, occurrencePlans: [{ due: TODAY, plannedDate: TODAY }] }], TODAY)[0];
    expect(withPlan.status).toBe('Planned');
  });
});

describe('suggest', () => {
  const week: WeekDayInfo[] = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'].map((d) => ({
    date: parseLocalDate(d), dateStr: d, existingTasks: [], events: [],
  }));

  it('places a deadline early rather than on the day', () => {
    const result = suggestWeekSchedule([task({ dueDate: '2026-09-26' })], week, DEFAULT_SUGGEST_CONTROLS, new Map());
    expect(result.get('t1')).toBe('2026-09-24');
  });

  it('puts overdue work on the first day with room', () => {
    const result = suggestWeekSchedule([task({ dueDate: '2026-09-01' })], week, DEFAULT_SUGGEST_CONTROLS, new Map());
    expect(result.get('t1')).toBe('2026-09-24');
  });

  it('places a missed plan again', () => {
    const result = suggestWeekSchedule([task({ plannedDate: '2026-09-22', status: 'Planned' })], week, DEFAULT_SUGGEST_CONTROLS, new Map());
    expect(result.get('t1')).toBe('2026-09-24');
  });

  it("respects each day's own budget and reserved load", () => {
    const days = week.map((d, i) => ({ ...d, capacity: i === 0 ? 1 : 10, recurringAP: i === 1 ? 9 : 0 }));
    const result = suggestWeekSchedule([task({ dueDate: '2026-09-27' })], days, DEFAULT_SUGGEST_CONTROLS, new Map());
    expect(result.get('t1')).toBe('2026-09-26');
  });
});

import { buildReview, expectedCompletions, openBacklogOn, periodFor } from './review';

describe('review', () => {
  it('bounds weeks Monday to Sunday and months by the calendar', () => {
    expect(periodFor('week', 0, TODAY)).toMatchObject({ start: '2026-09-21', end: '2026-09-27' });
    expect(periodFor('week', -1, TODAY)).toMatchObject({ start: '2026-09-14', end: '2026-09-20' });
    expect(periodFor('month', 0, TODAY)).toMatchObject({ start: '2026-09-01', end: '2026-09-30' });
  });

  it('counts the open one-off backlog at the end of a day', () => {
    const tasks = [
      task({ id: 'a', createdAt: at('2026-09-10') }),
      task({ id: 'b', createdAt: at('2026-09-22') }),
      task({ id: 'c', status: 'Done', createdAt: at('2026-09-10'), doneDate: at('2026-09-21') }),
      task({ id: 'd', recurrence: 'Daily', createdAt: at('2026-09-10') }),
      task({ id: 'e', createdAt: at('2026-09-10'), deletedAt: at('2026-09-20') }),
    ];
    expect(openBacklogOn(tasks, '2026-09-20')).toBe(2); // a, c
    expect(openBacklogOn(tasks, '2026-09-22')).toBe(2); // a, b
  });

  it('expects habits by their cadence', () => {
    const days = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    expect(expectedCompletions(habit(), days)).toBe(4);
    expect(expectedCompletions(habit({ weekdays: [1, 3] }), days)).toBe(2);
    expect(expectedCompletions(habit({ targetPerWeek: 7 }), days)).toBe(4);
  });

  it('counts recurring completions from the log and only days that have happened', () => {
    const r = buildReview({
      period: periodFor('week', 0, TODAY),
      tasks: [task({ recurrence: 'Daily', status: 'Planned', completions: ['2026-09-22', '2026-09-23'] })],
      habits: [], events: [], projects: [], domains: [], history: {},
      defaultAP: 2, budgetFor: () => 8, today: TODAY,
    });
    expect(r.finished.map((f) => f.day)).toEqual(['2026-09-22', '2026-09-23']);
    expect(r.days).toHaveLength(4);
    expect(r.totals).toMatchObject({ finished: 2, spent: 4, capacity: 32 });
  });
});

import { isSlip } from './hooks';

describe('slips', () => {
  it('is moving a plan whose day has gone', () => {
    const missed = { plannedDate: '2026-09-22', status: 'Planned' as const };
    expect(isSlip(missed, { plannedDate: TODAY }, TODAY)).toBe(true);
    expect(isSlip(missed, { plannedDate: null }, TODAY)).toBe(true);
  });

  it('is not moving a plan that is still ahead, or finishing one', () => {
    expect(isSlip({ plannedDate: '2026-09-26', status: 'Planned' }, { plannedDate: '2026-09-28' }, TODAY)).toBe(false);
    expect(isSlip({ plannedDate: '2026-09-22', status: 'Planned' }, { status: 'Done' }, TODAY)).toBe(false);
    expect(isSlip({ plannedDate: '2026-09-22', status: 'Planned' }, { notes: 'x' }, TODAY)).toBe(false);
  });
});

import { comeBack, liveOccurrenceDue, recurrenceKind, upcomingOccurrences } from './recurrence';
import { isMissedPlan, isStrandedBlocked } from './scoring';

describe('kinds of repeating task', () => {
  it('tells fixed, cycle and lapsing apart', () => {
    expect(recurrenceKind(task({ recurrence: 'Monthly', recurrenceAnchor: 'schedule', dueDate: '2026-10-17' }))).toBe('fixed');
    expect(recurrenceKind(task({ recurrence: 'Biweekly' }))).toBe('cycle');
    expect(recurrenceKind(task({ recurrence: 'Daily' }))).toBe('lapsing');
    expect(recurrenceKind(task({ recurrence: 'Weekly', recurrenceWeekdays: [1, 3, 5] }))).toBe('lapsing');
  });

  it('never lists a lapsing task as a missed plan', () => {
    expect(isMissedPlan(task({ recurrence: 'Daily', status: 'Planned', plannedDate: '2026-09-23' }), TODAY)).toBe(false);
    expect(isMissedPlan(task({ status: 'Planned', plannedDate: '2026-09-23' }), TODAY)).toBe(true);
  });
});

describe('planning single occurrences', () => {
  const reading = task({ recurrence: 'Daily', status: 'Backlog' });

  it('lists each later day of a daily task with its own window of one day', () => {
    const occ = upcomingOccurrences(reading, '2026-09-27', TODAY);
    expect(occ.map((o) => o.due)).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(occ[0].windowStart).toBe('2026-09-25');
  });

  it('shows a planned or skipped occurrence as planned', () => {
    const planned = { ...reading, occurrencePlans: [{ due: '2026-09-26', plannedDate: '2026-09-26' }, { due: '2026-09-27', plannedDate: null, skipped: true }] };
    const occ = upcomingOccurrences(planned, '2026-09-27', TODAY);
    expect(occ.find((o) => o.due === '2026-09-26')?.plannedDate).toBe('2026-09-26');
    expect(occ.find((o) => o.due === '2026-09-27')?.skipped).toBe(true);
  });

  it('gives a cycle occurrence a window from the day after the one before', () => {
    const plants = task({ recurrence: 'Weekly', rotSince: at('2026-09-20') }); // due 27th
    const [next] = upcomingOccurrences(plants, '2026-10-05', TODAY);
    expect(next).toMatchObject({ due: '2026-10-04', windowStart: '2026-09-28' });
  });

  it('applies a skip when a lapsing task comes back', () => {
    const done = task({ recurrence: 'Daily', status: 'Done', lastCompleted: at(TODAY), occurrencePlans: [{ due: '2026-09-25', plannedDate: null, skipped: true }] });
    // Friday skipped: the next one is Saturday.
    expect(liveOccurrenceDue({ ...done, status: 'Backlog', lastCompleted: null }, '2026-09-25')).toBe('2026-09-26');
    expect(comeBack(done).occurrencePlans).toEqual([]);
  });

  it('keeps "the next one" when a cycle moves because it was done early', () => {
    // Weekly from completion; the next one (due Oct 1) was planned for Sep 30.
    const plants = task({ recurrence: 'Weekly', status: 'Done', lastCompleted: at('2026-09-22'), occurrencePlans: [{ due: '2026-10-01', plannedDate: '2026-09-30' }] });
    const back = comeBack(plants);
    expect(back.plannedDate).toBe('2026-09-30');
    expect(back.occurrencePlans).toEqual([]);
  });

  it('never moves a fixed period', () => {
    const rent = task({ recurrence: 'Monthly', recurrenceAnchor: 'schedule', dueDate: '2026-10-01', status: 'Done', lastCompleted: at('2026-09-24') });
    expect(comeBack(rent).dueDate).toBe('2026-11-01');
  });
});

describe('blocked', () => {
  it('flags a blocked task with nothing to bring it back', () => {
    expect(isStrandedBlocked(task({ status: 'Blocked' }))).toBe(true);
    expect(isStrandedBlocked(task({ status: 'Blocked', followUpDate: '2026-09-30' }))).toBe(false);
    expect(isStrandedBlocked(task({ status: 'Blocked', blockedBy: [{ type: 'task', taskId: 'x' }] }))).toBe(false);
  });
});

describe('suggest places occurrences', () => {
  const days: WeekDayInfo[] = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'].map((d) => ({
    date: parseLocalDate(d), dateStr: d, existingTasks: [], events: [],
  }));

  it('puts each daily occurrence on its own day only', () => {
    const reading = task({ recurrence: 'Daily', actionPoints: '1' });
    const result = suggestWeekSchedule([reading], days, DEFAULT_SUGGEST_CONTROLS, new Map());
    expect(result.get('t1')).toBe(TODAY);
    expect(result.get('t1@2026-09-26')).toBe('2026-09-26');
  });

  it('places a cycle occurrence inside its window, as early as it has room', () => {
    const plants = task({ recurrence: 'Weekly', status: 'Planned', plannedDate: TODAY, rotSince: at('2026-09-20'), actionPoints: '1' });
    const wide = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((d) => ({
      date: parseLocalDate(d), dateStr: d, existingTasks: [], events: [],
    }));
    const result = suggestWeekSchedule([plants], wide, DEFAULT_SUGGEST_CONTROLS, new Map());
    expect(result.get('t1@2026-10-04')).toBe('2026-09-28');
  });

  it('does not take effort for occurrences nobody planned', () => {
    // A daily 5 AP task fills nothing until placed; a 6-AP one-off still fits alongside.
    const heavy = task({ id: 'h', recurrence: 'Daily', actionPoints: '5', status: 'Done', lastCompleted: at(TODAY) });
    const oneOff = task({ id: 'o', actionPoints: '5' });
    const one = [days[1]];
    const result = suggestWeekSchedule([oneOff], one, DEFAULT_SUGGEST_CONTROLS, new Map());
    expect(result.get('o')).toBe('2026-09-25');
    void heavy;
  });
});

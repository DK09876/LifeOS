/**
 * Tests for recurrence roll-forward and the two-format doneDate parse.
 *
 * Both of these failed silently in ways that only showed up days later: a
 * weekly task that came back already overdue, and a task completed by voice
 * that was reported as completed the day before. Neither threw, so the guard
 * has to be a test.
 */

import { describe, expect, it } from 'vitest';

import { advanceDate, nextEventDate, nextRecurrenceDates } from './db';
import { parseLocalDate, parseLocalDateTime, toDateString } from './dates';

const at = (d: string) => toDateString(advanceDate(parseLocalDate(d), 'Weekly')!);

describe('advanceDate', () => {
  it('moves by the right interval for each recurrence', () => {
    const from = parseLocalDate('2026-09-10');
    const on = (r: Parameters<typeof advanceDate>[1]) => toDateString(advanceDate(from, r)!);
    expect(on('Daily')).toBe('2026-09-11');
    expect(on('Weekly')).toBe('2026-09-17');
    expect(on('Biweekly')).toBe('2026-09-24');
    expect(on('Monthly')).toBe('2026-10-10');
    expect(on('Bimonthly')).toBe('2026-11-10');
    expect(on('Quarterly')).toBe('2026-12-10');
    expect(on('Half-Yearly')).toBe('2027-03-10');
    expect(on('Yearly')).toBe('2027-09-10');
  });

  it('returns null for a non-recurring task', () => {
    expect(advanceDate(parseLocalDate('2026-09-10'), 'None')).toBeNull();
  });

  // A week later must stay the same weekday even across a DST boundary;
  // adding 7 * 86400000 ms would land an hour off and shift the date.
  it('keeps the weekday across a DST change', () => {
    expect(at('2026-10-30')).toBe('2026-11-06');
    expect(parseLocalDate(at('2026-10-30')).getDay()).toBe(parseLocalDate('2026-10-30').getDay());
  });
});

describe('nextRecurrenceDates', () => {
  const task = (extra: Record<string, unknown> = {}) => ({
    recurrence: 'Weekly' as const,
    dueDate: null as string | null,
    plannedDate: null as string | null,
    lastCompleted: '2026-09-10T12:00:00.000Z',
    ...extra,
  });

  // The whole point of the change: anchor on the completion, not on the old
  // due date, so finishing late does not bring the task back overdue.
  it('anchors on when the task was completed, not its old due date', () => {
    const next = nextRecurrenceDates(task({ dueDate: '2026-09-01' }));
    expect(next.dueDate).toBe('2026-09-17');
  });

  it('keeps the gap between planned and due', () => {
    const next = nextRecurrenceDates(task({ plannedDate: '2026-09-09', dueDate: '2026-09-11' }));
    expect(next.dueDate).toBe('2026-09-17');
    expect(next.plannedDate).toBe('2026-09-15');
  });

  it('leaves a date null when the task never had one', () => {
    expect(nextRecurrenceDates(task({ dueDate: '2026-09-11' })).plannedDate).toBeNull();
    expect(nextRecurrenceDates(task({ plannedDate: '2026-09-09' })).dueDate).toBeNull();
  });

  it('leaves both dates alone when the task does not recur', () => {
    const next = nextRecurrenceDates(task({ recurrence: 'None', dueDate: '2026-09-01' }));
    expect(next.dueDate).toBe('2026-09-01');
  });
});

describe('parseLocalDateTime', () => {
  // The voice assistant writes YYYY-MM-DD; the web app writes a full ISO
  // timestamp. Read as UTC, the date-only form lands on the previous evening
  // in any western timezone, so "completed today" missed it.
  it('reads a date-only value as local midnight, not UTC midnight', () => {
    const d = parseLocalDateTime('2026-09-17');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(0);
  });

  it('still reads a full timestamp as an exact moment', () => {
    expect(parseLocalDateTime('2026-09-17T15:00:00.000Z').toISOString())
      .toBe('2026-09-17T15:00:00.000Z');
  });
});

describe('nextEventDate', () => {
  // Events are appointments, so they step from their own date. Anchoring on
  // the completion, the way tasks do, would walk a standing Monday meeting
  // forward a day every time it was ticked off late.
  it('steps from the event date, not from when it was marked done', () => {
    expect(nextEventDate({ date: '2026-09-14', recurrence: 'Weekly' })).toBe('2026-09-21');
  });

  it('keeps the weekday across a DST change', () => {
    expect(nextEventDate({ date: '2026-10-30', recurrence: 'Weekly' })).toBe('2026-11-06');
  });

  it('returns null when the event does not recur', () => {
    expect(nextEventDate({ date: '2026-09-14', recurrence: 'None' })).toBeNull();
  });
});

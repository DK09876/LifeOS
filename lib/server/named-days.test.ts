/**
 * A named-day task ("every Sunday") end to end against a throwaway database:
 * missed Sundays stay open, done settles it, and a skip clears the backlog.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dir: string;
const U = 'dk';
// Wednesday 14 October 2026. The call was last due Sunday 27 September.
const TODAY = '2026-10-14';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
  dir = mkdtempSync(join(tmpdir(), 'lifeos-named-'));
  vi.resetModules();
  process.env.LIFEOS_DB_PATH = join(dir, 'test.db');
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.LIFEOS_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

async function setup() {
  const store = await import('./store');
  const { serverDb, serverPreferences } = await import('./db');
  const { createActions } = await import('../actions');
  const prefs = serverPreferences(U);
  const actions = createActions({ db: serverDb(U), ...prefs });
  store.putRecord(U, 'tasks', {
    id: 'call', taskName: 'Call GrandParents', status: 'Backlog', taskPriority: '2 - High', urgency: '3 - Normal',
    taskScore: 0, importanceScore: 0, urgencyScore: 0, dueDate: null, plannedDate: null, recurrence: 'Weekly',
    recurrenceAnchor: null, recurrenceWeekdays: [0], lastCompleted: null, doneDate: null, actionPoints: '2', notes: '',
    domainId: null, projectId: null, blockedBy: [], followUpDate: null, deletedAt: null,
    rotSince: '2026-09-23T12:00:00', createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z',
  } as never);
  const read = () => store.readRecord(U, 'tasks', 'call') as unknown as Record<string, unknown>;
  return { actions, read };
}

describe('named days end to end', () => {
  it('skipping a missed Sunday picks up at the coming one', async () => {
    const { actions, read } = await setup();
    const { liveOccurrenceDue } = await import('../recurrence');
    expect(liveOccurrenceDue(read() as never, TODAY)).toBe('2026-09-27');
    await actions.planOccurrence('call', '2026-09-27', { skipped: true });
    expect(liveOccurrenceDue(read() as never, TODAY)).toBe('2026-10-18');
    expect(read().urgencyScore).toBe(30 + 20); // due in four days, no longer behind
  });

  it('done late today, it comes back tomorrow for Sunday', async () => {
    const { actions, read } = await setup();
    await actions.markTaskDone('call');
    expect(read().status).toBe('Done');
    vi.setSystemTime(new Date('2026-10-15T09:00:00'));
    await actions.runRecurrenceCheckCore();
    const { liveOccurrenceDue } = await import('../recurrence');
    expect(read().status).toBe('Backlog');
    expect(liveOccurrenceDue(read() as never, '2026-10-15')).toBe('2026-10-18');
  });
});

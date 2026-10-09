/**
 * The voice assistant's intents, end to end against a throwaway database.
 *
 * These are what Siri and the Pi's microphone end up calling, so each test
 * is a sentence someone would say and what LifeOS should then look like.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Store = typeof import('./store');
type Assistant = typeof import('./assistant');

let dir: string;
let store: Store;
let assistant: Assistant;
const U = 'dk';

// Friday 9 October 2026, mid-morning.
const TODAY = '2026-10-09';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
  dir = mkdtempSync(join(tmpdir(), 'lifeos-assistant-'));
  vi.resetModules();
  process.env.LIFEOS_DB_PATH = join(dir, 'test.db');
  store = await import('./store');
  assistant = await import('./assistant');
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.LIFEOS_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

const now = () => new Date().toISOString();
function task(id: string, over: Record<string, unknown> = {}) {
  return {
    id, taskName: id, status: 'Backlog', taskPriority: '3 - Normal', urgency: '3 - Normal', taskScore: 10,
    importanceScore: 35, urgencyScore: 30, dueDate: null, plannedDate: null, recurrence: 'None', recurrenceAnchor: null,
    recurrenceWeekdays: null, lastCompleted: null, doneDate: null, actionPoints: '2', notes: '', domainId: 'home',
    projectId: null, blockedBy: [], followUpDate: null, deletedAt: null, createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z', ...over,
  };
}
function habit(id: string, over: Record<string, unknown> = {}) {
  return {
    id, habitName: id, recurrence: 'Daily', lastCompleted: null, targetPerWeek: null, actionPoints: '1',
    completionDates: [], bestStreak: 0, notes: '', icon: null, isActive: true, deletedAt: null,
    createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z', ...over,
  };
}
const put = (collection: Parameters<Store['putRecord']>[1], record: Record<string, unknown>) =>
  store.putRecord(U, collection, record as never);
const get = (collection: Parameters<Store['readRecord']>[1], id: string) => store.readRecord(U, collection, id) as Record<string, unknown>;
const say = async (intent: string, args: Record<string, unknown> = {}) => assistant.runAssistant(U, intent, args);

beforeEach(() => {
  put('domains', { id: 'home', name: 'Home', icon: null, priority: '2 - Important', deletedAt: null, createdAt: now(), updatedAt: now() });
});

describe('what is on', () => {
  it('reads today: tasks, habits left, events and energy', async () => {
    put('tasks', task('Write report', { status: 'Planned', plannedDate: TODAY, actionPoints: '3' }));
    put('tasks', task('Fix bike', { dueDate: '2026-10-20' }));
    put('habits', habit('Meditate'));
    put('events', { id: 'e', eventName: 'Dentist', date: TODAY, time: '14:00', duration: 30, actionPoints: '1', recurrence: 'None', lastCompleted: null, notes: '', domainId: null, deletedAt: null, createdAt: now(), updatedAt: now() });
    const r = await say('today');
    expect(r.say).toContain('1 task: Write report');
    expect(r.say).toContain('habits left: Meditate');
    expect(r.say).toContain('Dentist at 14:00');
    expect(r.say).toMatch(/5 of 8 AP planned/);
  });

  it('suggests the best next thing that fits', async () => {
    put('tasks', task('Small', { status: 'Planned', plannedDate: TODAY, taskScore: 20, actionPoints: '1' }));
    put('tasks', task('Big', { status: 'Planned', plannedDate: TODAY, taskScore: 30, actionPoints: '3' }));
    expect((await say('next')).say).toMatch(/^Big\./);
  });

  it('lists overdue work and missed plans', async () => {
    put('tasks', task('Pay bill', { dueDate: '2026-10-05' }));
    put('tasks', task('Email landlord', { status: 'Planned', plannedDate: '2026-10-07' }));
    const r = await say('overdue');
    expect(r.say).toContain('Overdue: Pay bill');
    expect(r.say).toContain('Missed plans: Email landlord');
  });
});

describe('capturing', () => {
  it('adds a task with only what was said, so it waits for details', async () => {
    const r = await say('add_task', { name: 'Call mom', day: 'tomorrow' });
    expect(r.say).toBe('Added Call mom for tomorrow.');
    const created = store.readCollection(U, 'tasks').find((t) => t.taskName === 'Call mom') as Record<string, unknown>;
    expect(created).toMatchObject({ status: 'Needs Details', plannedDate: '2026-10-10', urgency: null, actionPoints: null });
  });

  it('promotes it when everything was said', async () => {
    await say('add_task', { name: 'Taxes', due: 'the 30th', domain: 'home', priority: 'high', urgency: 'high', effort: 3 });
    const created = store.readCollection(U, 'tasks').find((t) => t.taskName === 'Taxes') as Record<string, unknown>;
    expect(created).toMatchObject({ status: 'Backlog', dueDate: '2026-10-30', taskPriority: '2 - High', domainId: 'home', actionPoints: '3' });
  });

  it('keeps lists and notes', async () => {
    expect((await say('list_add', { items: 'eggs, milk' })).say).toBe('Added eggs and milk to Shopping.');
    expect((await say('list_read')).say).toBe('Shopping: eggs and milk.');
    expect((await say('list_tick', { item: 'the eggs' })).say).toBe('Ticked eggs off Shopping.');
    expect((await say('list_read')).say).toBe('Shopping: milk.');
    await say('add_note', { text: 'The wifi code is 4471' });
    expect((await say('find_note', { query: 'wifi code' })).say).toContain('4471');
  });
});

describe('planning', () => {
  it('plans a task for a named day', async () => {
    put('tasks', task('Laundry'));
    expect((await say('plan', { name: 'laundry', day: 'Saturday' })).say).toBe('Laundry is on tomorrow.');
    expect(get('tasks', 'Laundry')).toMatchObject({ plannedDate: '2026-10-10', status: 'Planned' });
  });

  it('pushes a missed plan to tomorrow, counting the slip', async () => {
    put('tasks', task('Email', { status: 'Planned', plannedDate: '2026-10-08' }));
    await say('push', { name: 'email' });
    expect(get('tasks', 'Email')).toMatchObject({ plannedDate: '2026-10-10', slipCount: 1 });
  });

  it('reopens a do-again chore onto today', async () => {
    put('tasks', task('Dishes', { status: 'Done', repeatable: true, doneDate: '2026-10-06T19:00:00.000Z', completions: ['2026-10-06'] }));
    put('tasks', task('Dishes unloaded', { status: 'Done', repeatable: true, completions: ['2026-10-07'] }));
    expect((await say('do_again', { name: 'dishes' })).say).toBe('Dishes is back on today.');
    expect(get('tasks', 'Dishes')).toMatchObject({ status: 'Planned', plannedDate: TODAY, completions: ['2026-10-06'] });
  });

  it('asks when a name could be two things', async () => {
    put('tasks', task('Call mom'));
    put('tasks', task('Call dad'));
    expect((await say('plan', { name: 'call', day: 'today' })).say).toMatch(/^Did you mean "Call (mom|dad)" or "Call (mom|dad)"\?$/);
  });
});

describe('doing', () => {
  it('completes a task, yesterday if told', async () => {
    put('tasks', task('Laundry', { status: 'Planned', plannedDate: '2026-10-08' }));
    expect((await say('complete', { name: 'laundry', day: 'yesterday' })).say).toBe('Marked Laundry done for yesterday.');
    expect(get('tasks', 'Laundry')).toMatchObject({ status: 'Done', completions: ['2026-10-08'] });
  });

  it('adds to the goal when a goal task is done', async () => {
    put('projects', { id: 'book', name: 'Read a Book', description: '', icon: null, status: 'Active', domainId: null, kind: 'target', targetCount: 300, targetUnit: 'pages', progressLog: [{ date: '2026-10-01', amount: 20 }], deletedAt: null, createdAt: now(), updatedAt: now() });
    put('tasks', task('Read a page', { recurrence: 'Daily', projectId: 'book' }));
    await say('complete', { name: 'read a page' });
    const log = get('projects', 'book').progressLog as Array<{ amount: number }>;
    expect(log.reduce((n, e) => n + e.amount, 0)).toBe(21);
  });

  it('ticks a habit, and falls through to habits from "I did …"', async () => {
    put('habits', habit('Meditate', { completionDates: ['2026-10-07', '2026-10-08'] }));
    expect((await say('complete', { name: 'meditate' })).say).toBe("Ticked Meditate. 3 days running. That's a 3-day streak!");
    expect(get('habits', 'Meditate').completionDates).toContain(TODAY);
  });

  it('logs progress on the only active goal', async () => {
    put('projects', { id: 'book', name: 'Read a Book', description: '', icon: null, status: 'Active', domainId: null, kind: 'target', targetCount: 300, targetUnit: 'pages', progressLog: [], deletedAt: null, createdAt: now(), updatedAt: now() });
    expect((await say('log_progress', { amount: 12 })).say).toBe('Logged 12 pages to Read a Book. 12 of 300 so far.');
  });
});

describe('energy', () => {
  it('reports and changes today', async () => {
    put('tasks', task('Write report', { status: 'Planned', plannedDate: TODAY, actionPoints: '3' }));
    expect((await say('energy')).say).toBe('0 AP done, 3 still planned, out of 8. 5 AP free.');
    expect((await say('set_energy', { ap: 5 })).say).toBe("Today's budget is 5 AP.");
    expect((await say('energy')).say).toBe('0 AP done, 3 still planned, out of 5. 2 AP free.');
  });
});

describe('waiting', () => {
  it('blocks with a chase day, and lists what is waiting', async () => {
    put('tasks', task('Tax docs'));
    expect((await say('block', { name: 'tax docs', waiting_on: 'the accountant', chase: 'Thursday' })).say)
      .toBe("Tax docs is waiting on the accountant. I'll remind you Thursday.");
    expect(get('tasks', 'Tax docs')).toMatchObject({ status: 'Blocked', followUpDate: '2026-10-15' });
    expect((await say('waiting')).say).toBe('Waiting: Tax docs on the accountant, chase Thursday.');
  });
});

describe('looking back', () => {
  it('gives a habit streak', async () => {
    put('habits', habit('Meditate', { completionDates: ['2026-10-07', '2026-10-08', TODAY], bestStreak: 5 }));
    expect((await say('streak', { name: 'meditation' })).say).toBe('Meditate: 3 days running, best 5.');
  });
});

describe('undo', () => {
  it('puts back the last change', async () => {
    put('tasks', task('Laundry', { status: 'Planned', plannedDate: TODAY }));
    await say('complete', { name: 'laundry' });
    expect(get('tasks', 'Laundry').status).toBe('Done');
    expect((await say('undo')).say).toBe('Undone: complete Laundry.');
    expect(get('tasks', 'Laundry')).toMatchObject({ status: 'Planned', plannedDate: TODAY });
  });

  it('removes something it just created', async () => {
    await say('add_task', { name: 'Oops' });
    await say('undo');
    const t = store.readCollection(U, 'tasks').find((x) => x.taskName === 'Oops') as Record<string, unknown>;
    expect(t.deletedAt).toBeTruthy();
  });

  it('has nothing to undo after reads only', async () => {
    await say('today');
    expect((await say('undo')).say).toBe("There's nothing of mine to undo.");
  });
});

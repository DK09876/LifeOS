/**
 * The notifier on the Pi pushes your own reminders at their time, once.
 * Pushing itself is stubbed: no device is contacted.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const pushToProfile = vi.fn(async () => ({ sent: 1, failed: 0 }));
vi.mock('./push', () => ({ pushToProfile }));

let dir: string;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  dir = mkdtempSync(join(tmpdir(), 'lifeos-notifier-'));
  vi.resetModules();
  pushToProfile.mockClear();
  process.env.LIFEOS_DB_PATH = join(dir, 'test.db');
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.LIFEOS_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

it('pushes a reminder at its time, and only once', async () => {
  vi.setSystemTime(new Date('2026-10-15T08:00:00'));
  const store = await import('./store');
  const { tick } = await import('./notifier');
  store.savePushSubscription('dk', 'https://push.example/1', '{}', 'iPhone');
  store.setPreference('dk', 'notifications.settings', JSON.stringify({ push: { brief: false, midday: false, event: false, habits: false, tomorrow: false, review: false } }));
  store.setPreference('dk', 'reminders.custom', JSON.stringify([{
    id: 'bins', title: 'Take the bins out', note: '', time: '19:00', repeat: 'days', date: null, weekdays: [4],
    enabled: true, createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
  }]));

  await tick(new Date('2026-10-15T18:59:00'));
  expect(pushToProfile).not.toHaveBeenCalled();
  await tick(new Date('2026-10-15T19:00:00'));
  expect(pushToProfile).toHaveBeenCalledWith('dk', expect.objectContaining({ title: '⏰ Take the bins out', url: '/reminders' }));
  await tick(new Date('2026-10-15T19:01:00'));
  expect(pushToProfile).toHaveBeenCalledTimes(1);
});

it('sends everything due at the same minute as one push', async () => {
  vi.setSystemTime(new Date('2026-10-15T08:00:00'));
  const store = await import('./store');
  const { tick } = await import('./notifier');
  store.savePushSubscription('dk', 'https://push.example/1', '{}', 'iPhone');
  store.setPreference('dk', 'notifications.settings', JSON.stringify({ push: { brief: false, midday: true, event: false, habits: false, tomorrow: false, review: false } }));
  store.setPreference('dk', 'reminders.custom', JSON.stringify([{
    id: 'meds', title: 'Take meds', note: '', time: '12:00', repeat: 'daily', date: null, weekdays: [],
    enabled: true, createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
  }]));
  store.putRecord('dk', 'tasks', {
    id: 'email', taskName: 'Email', status: 'Planned', plannedDate: '2026-10-15', dueDate: null, recurrence: 'None',
    actionPoints: '2', deletedAt: null, createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
  } as never);

  await tick(new Date('2026-10-15T12:00:00'));
  expect(pushToProfile).toHaveBeenCalledTimes(1);
  expect(pushToProfile).toHaveBeenCalledWith('dk', expect.objectContaining({ title: '⏰ Take meds · 1 task left today' }));
  await tick(new Date('2026-10-15T12:01:00'));
  expect(pushToProfile).toHaveBeenCalledTimes(1);
});

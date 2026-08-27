/**
 * Tests for the server store - where the data actually lives.
 *
 * The properties worth guarding here are the ones whose failure is silent
 * and permanent: one profile seeing another's rows, and a bulk operation
 * leaving half its work behind.
 *
 * Each test gets its own database file. DB_PATH is captured when the module
 * loads and the connection is a singleton, so the env var must be set before
 * the dynamic import and the module registry reset between tests.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Store = typeof import('./store');

let dir: string;
let store: Store;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'lifeos-test-'));
  vi.resetModules();
  process.env.LIFEOS_DB_PATH = join(dir, 'test.db');
  store = await import('./store');
});

afterEach(() => {
  delete process.env.LIFEOS_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

const task = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  taskName: `Task ${id}`,
  status: 'Backlog',
  updatedAt: '2026-08-01T00:00:00.000Z',
  deletedAt: null,
  ...extra,
});

describe('users', () => {
  it('issues a distinct token per user and resolves it back', () => {
    const dk = store.createUser('dk', 'DK');
    const haley = store.createUser('haley', 'Haley');

    expect(dk.token).not.toBe(haley.token);
    expect(store.userForToken(dk.token)?.id).toBe('dk');
    expect(store.userForToken('not-a-real-token')).toBeNull();
  });

  it('lists users without leaking their tokens', () => {
    store.createUser('dk', 'DK');
    const listed = store.listUsers();
    expect(listed).toEqual([{ id: 'dk', name: 'DK' }]);
    expect(JSON.stringify(listed)).not.toContain('token');
  });
});

describe('records', () => {
  beforeEach(() => {
    store.createUser('dk', 'DK');
    store.createUser('haley', 'Haley');
  });

  it('round-trips a record with fields the columns do not cover', () => {
    store.putRecord('dk', 'tasks', task('t1', { blockedBy: ['x'], notes: 'keep me' }));
    const [saved] = store.readPayload('dk').tasks ?? [];
    expect(saved.blockedBy).toEqual(['x']);
    expect(saved.notes).toBe('keep me');
  });

  it('overwrites rather than duplicating on the same id', () => {
    store.putRecord('dk', 'tasks', task('t1', { taskName: 'first' }));
    store.putRecord('dk', 'tasks', task('t1', { taskName: 'second' }));
    const tasks = store.readPayload('dk').tasks ?? [];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskName).toBe('second');
  });

  // The property that matters most: profiles must not see each other.
  it('keeps profiles isolated', () => {
    store.putRecord('dk', 'tasks', task('mine'));
    store.putRecord('haley', 'tasks', task('hers'));

    expect((store.readPayload('dk').tasks ?? []).map((t) => t.id)).toEqual(['mine']);
    expect((store.readPayload('haley').tasks ?? []).map((t) => t.id)).toEqual(['hers']);
  });

  it('deletes only the row asked for', () => {
    store.putRecords('dk', 'tasks', [task('a'), task('b')]);
    store.deleteRecord('dk', 'tasks', 'a');
    expect((store.readPayload('dk').tasks ?? []).map((t) => t.id)).toEqual(['b']);
  });
});

describe('clearAllForUser', () => {
  beforeEach(() => {
    store.createUser('dk', 'DK');
    store.createUser('haley', 'Haley');
  });

  it('removes every collection and preference for that profile only', () => {
    store.putRecord('dk', 'tasks', task('t1'));
    store.putRecord('dk', 'domains', { id: 'd1', name: 'Health' });
    store.setPreference('dk', 'theme', 'dark');
    store.putRecord('haley', 'tasks', task('hers'));

    store.clearAllForUser('dk');

    expect(store.readPayload('dk').tasks ?? []).toHaveLength(0);
    expect(store.readPayload('dk').domains ?? []).toHaveLength(0);
    expect(store.getPreferences('dk')).toEqual({});
    // Haley is untouched.
    expect(store.readPayload('haley').tasks ?? []).toHaveLength(1);
  });
});

describe('replaceAllForUser', () => {
  beforeEach(() => {
    store.createUser('dk', 'DK');
    store.createUser('haley', 'Haley');
  });

  it('swaps the dataset and leaves other profiles alone', () => {
    store.putRecord('dk', 'tasks', task('old'));
    store.putRecord('haley', 'tasks', task('hers'));

    store.replaceAllForUser('dk', { tasks: [task('new1'), task('new2')] });

    expect((store.readPayload('dk').tasks ?? []).map((t) => t.id).sort()).toEqual(['new1', 'new2']);
    expect((store.readPayload('haley').tasks ?? []).map((t) => t.id)).toEqual(['hers']);
  });

  // Without a transaction the delete would land and the insert would not,
  // leaving the profile with nothing at all.
  it('rolls back completely when a record cannot be written', () => {
    store.putRecord('dk', 'tasks', task('original'));

    const circular: Record<string, unknown> = { id: 'bad' };
    circular.self = circular; // JSON.stringify throws on this

    expect(() => store.replaceAllForUser('dk', {
      tasks: [task('good'), circular as never],
    })).toThrow();

    // The original data must still be there.
    expect((store.readPayload('dk').tasks ?? []).map((t) => t.id)).toEqual(['original']);
  });
});

describe('preferences', () => {
  beforeEach(() => store.createUser('dk', 'DK'));

  it('upserts by key and keeps profiles separate', () => {
    store.createUser('haley', 'Haley');
    store.setPreference('dk', 'theme', 'dark');
    store.setPreference('dk', 'theme', 'light');
    store.setPreference('haley', 'theme', 'dark');

    expect(store.getPreferences('dk')).toEqual({ theme: 'light' });
    expect(store.getPreferences('haley')).toEqual({ theme: 'dark' });
  });

  // The backup reminder stores its timestamp against a reserved id that has
  // no row in users, so it must not surface as a profile.
  it('stores a _system value that never appears as a profile', () => {
    store.setPreference('_system', 'backup.lastConfirmedAt', '2026-08-01T00:00:00.000Z');
    expect(store.getPreferences('_system')['backup.lastConfirmedAt']).toBe('2026-08-01T00:00:00.000Z');
    expect(store.listUsers().map((u) => u.id)).not.toContain('_system');
  });
});

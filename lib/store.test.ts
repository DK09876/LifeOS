/**
 * Tests for the client data layer.
 *
 * The behaviour worth pinning is what happens when the server says no. The
 * UI applies a change immediately so it feels instant; if that change is
 * then rejected and the local copy is not put back, the screen shows data
 * the Pi does not have - and the user has no idea.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Store = typeof import('./store');

let store: Store;
let fetchMock: ReturnType<typeof vi.fn>;

/**
 * The store guards reads with `typeof window === 'undefined'` so it stays
 * inert during server rendering, which means a browser-like global has to
 * exist here as well as localStorage itself.
 */
function stubBrowser() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
}

const ok = (body: unknown = { ok: true }) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

const failure = (status = 500) =>
  ({ ok: false, status, json: async () => ({ error: 'nope' }) }) as Response;

/** A hydrate response containing the given tasks. */
const payload = (tasks: unknown[]) => ok({
  tasks, domains: [], habits: [], events: [], projects: [],
  filterPresets: [], preferences: {},
});

beforeEach(async () => {
  vi.resetModules();
  stubBrowser();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  store = await import('./store');

  // Select a profile and load one existing task.
  fetchMock.mockResolvedValueOnce(payload([{ id: 'existing', taskName: 'Original' }]));
  await store.setProfile('dk');
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe('reads', () => {
  it('serves queries from the hydrated copy without hitting the network', async () => {
    const tasks = store.makeTable<{ id: string; taskName: string }>('tasks');
    expect(await tasks.toArray()).toHaveLength(1);
    expect((await tasks.get('existing'))?.taskName).toBe('Original');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filters and sorts locally', async () => {
    const tasks = store.makeTable<{ id: string; order?: number }>('tasks');
    fetchMock.mockResolvedValueOnce(ok());
    await tasks.bulkPut([{ id: 'b', order: 2 }, { id: 'a', order: 1 }]);

    // Rows missing the sort field go last rather than sorting as zero, so a
    // record without the field never displaces one that has it.
    const sorted = await tasks.orderBy('order').toArray();
    expect(sorted.map((t) => t.id)).toEqual(['a', 'b', 'existing']);
    expect((await tasks.orderBy('order').reverse().toArray())[0].id).toBe('existing');
  });
});

describe('optimistic writes', () => {
  it('shows the change before the server has answered', async () => {
    const tasks = store.makeTable<{ id: string; taskName: string }>('tasks');
    let release: (value: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { release = resolve; }));

    const pending = tasks.add({ id: 'new', taskName: 'Added' });

    // The request is still in flight, but the row is already visible.
    expect(await tasks.toArray()).toHaveLength(2);
    release(ok());
    await pending;
    expect(await tasks.toArray()).toHaveLength(2);
  });

  it('puts the previous data back when the server rejects the write', async () => {
    const tasks = store.makeTable<{ id: string; taskName: string }>('tasks');
    fetchMock.mockResolvedValueOnce(failure(500));

    await expect(tasks.add({ id: 'doomed', taskName: 'Nope' })).rejects.toThrow(/Save failed/);

    const remaining = await tasks.toArray();
    expect(remaining.map((t) => t.id)).toEqual(['existing']);
  });

  it('puts the previous data back when the request itself fails', async () => {
    const tasks = store.makeTable<{ id: string; taskName: string }>('tasks');
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    await expect(tasks.add({ id: 'doomed', taskName: 'Nope' })).rejects.toThrow('offline');
    expect((await tasks.toArray()).map((t) => t.id)).toEqual(['existing']);
  });

  it('restores the original values when an update is rejected', async () => {
    const tasks = store.makeTable<{ id: string; taskName: string }>('tasks');
    fetchMock.mockResolvedValueOnce(failure(500));

    await expect(tasks.update('existing', { taskName: 'Changed' })).rejects.toThrow();
    expect((await tasks.get('existing'))?.taskName).toBe('Original');
  });

  it('restores the row when a delete is rejected', async () => {
    const tasks = store.makeTable<{ id: string }>('tasks');
    fetchMock.mockResolvedValueOnce(failure(500));

    await expect(tasks.delete('existing')).rejects.toThrow(/Delete failed/);
    expect(await tasks.toArray()).toHaveLength(1);
  });
});

describe('subscribers', () => {
  it('notifies on a successful write and again on a rollback', async () => {
    const tasks = store.makeTable<{ id: string }>('tasks');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    fetchMock.mockResolvedValueOnce(ok());
    await tasks.add({ id: 'fine' });
    expect(listener).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(failure(500));
    await expect(tasks.add({ id: 'bad' })).rejects.toThrow();
    // Once applying optimistically, once undoing it.
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    fetchMock.mockResolvedValueOnce(ok());
    await tasks.add({ id: 'after' });
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('profiles', () => {
  it('remembers the choice and reloads data on switch', async () => {
    expect(store.getProfile()).toBe('dk');

    fetchMock.mockResolvedValueOnce(payload([{ id: 'hers', taskName: 'Haley task' }]));
    await store.setProfile('haley');

    expect(store.getProfile()).toBe('haley');
    const tasks = await store.makeTable<{ id: string }>('tasks').toArray();
    expect(tasks.map((t) => t.id)).toEqual(['hers']);
  });

  it('refuses to write with no profile selected', async () => {
    localStorage.removeItem('lifeos-profile');
    vi.resetModules();
    const fresh = await import('./store');
    await expect(fresh.makeTable<{ id: string }>('tasks').add({ id: 'x' }))
      .rejects.toThrow(/No profile selected/);
  });
});

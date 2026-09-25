/**
 * Client data layer. The Pi is the only source of truth.
 *
 * A collection is fetched once and held in memory; reads are served from
 * there and writes go straight to the server, then refresh the cache. There
 * is no query language over HTTP on purpose - the dataset is a few hundred
 * rows and the app already filtered arrays in JavaScript.
 *
 * The table objects mimic the slice of the Dexie API the app actually used
 * (toArray, get, add, put, update, bulkAdd, clear, count, orderBy, where),
 * so call sites did not have to change when IndexedDB was retired.
 */

'use client';

export const COLLECTIONS = [
  'tasks', 'domains', 'habits', 'events', 'projects', 'filterPresets', 'notes',
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

interface Row { id: string; [key: string]: unknown }

/** Records only need an id; the rest is opaque to the store. */
type HasId = { id: string }

const PROFILE_KEY = 'lifeos-profile';

let cache: Record<string, Row[]> = {};
let preferences: Record<string, string> = {};
let hydrated = false;
const listeners = new Set<() => void>();

// The raw body of the last hydrate. Polling compares against this so an
// unchanged poll costs nothing beyond the request - no parse, no re-render.
let lastBody = '';
// Writes are optimistic, so a poll landing mid-write would briefly show the
// server's older state and undo the change on screen.
let writesInFlight = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// --- profile -------------------------------------------------------------

export function getProfile(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(PROFILE_KEY) ?? '';
}

export async function setProfile(id: string): Promise<void> {
  localStorage.setItem(PROFILE_KEY, id);
  cache = {};
  preferences = {};
  hydrated = false;
  lastBody = '';
  await hydrate();
}

export interface Profile { id: string; name: string }

export async function listProfiles(): Promise<Profile[]> {
  const response = await fetch('/api/profiles', { cache: 'no-store' });
  if (!response.ok) return [];
  const body = (await response.json()) as { profiles: Profile[] };
  return body.profiles ?? [];
}

// --- reactivity ----------------------------------------------------------

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

export function isHydrated() {
  return hydrated;
}

// --- server io -----------------------------------------------------------

/**
 * Whether two payloads say the same thing.
 *
 * The server stamps every read with the time it was read, so a plain string
 * comparison found a difference on every single poll - which defeated the
 * check entirely and re-rendered the whole app twice a second. Everything
 * else in the body is content, so ignoring that one field is enough.
 */
function unchanged(a: string, b: string): boolean {
  return withoutReadTime(a) === withoutReadTime(b);
}

function withoutReadTime(body: string): string {
  return body.replace(/,?"exportedAt":"[^"]*"/, '');
}

export async function hydrate(): Promise<void> {
  const profile = getProfile();
  if (!profile) return;
  const response = await fetch(`/api/data?profile=${encodeURIComponent(profile)}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not load data (HTTP ${response.status})`);

  const text = await response.text();
  if (hydrated && unchanged(text, lastBody)) return; // nothing moved
  lastBody = text;

  const body = JSON.parse(text) as Record<string, unknown>;
  cache = {};
  for (const collection of COLLECTIONS) {
    cache[collection] = (body[collection] as Row[]) ?? [];
  }
  preferences = (body.preferences as Record<string, string>) ?? {};
  hydrated = true;
  notify();
}

/**
 * Watch the server for changes made elsewhere - another device, or the voice
 * assistant writing straight to the database.
 *
 * Polling rather than SSE on purpose: a dropped stream needs reconnect and
 * backoff logic, and this has to keep working unattended. An unchanged poll
 * is a single request whose body matches the last one, so it costs one
 * round trip and nothing else.
 */
let onVisible: (() => void) | null = null;

export function startLiveUpdates(intervalMs = 2000): () => void {
  stopLiveUpdates();
  // Coming back to the app - especially a phone waking the Home Screen app -
  // refresh at once. Waiting for the next tick left a window where a tap was
  // acted on against whatever the screen showed when it went to sleep.
  if (typeof document !== 'undefined') {
    onVisible = () => { if (!document.hidden && writesInFlight === 0) hydrate().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
  }
  pollTimer = setInterval(() => {
    // Skip while hidden (nobody is looking) or mid-write (the optimistic
    // change is newer than anything the server can tell us).
    if (typeof document !== 'undefined' && document.hidden) return;
    if (writesInFlight > 0) return;
    hydrate().catch(() => {});
  }, intervalMs);
  return stopLiveUpdates;
}

export function stopLiveUpdates() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (onVisible && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('pageshow', onVisible);
    onVisible = null;
  }
}

async function writeRecords(collection: CollectionName, records: Row[], clear = false) {
  const profile = getProfile();
  if (!profile) throw new Error('No profile selected');

  // Show the change immediately and undo it if the server refuses. Waiting
  // for the round trip made every checkbox feel laggy over Tailscale, and
  // the server stores records verbatim so the local copy matches what it
  // will hold.
  const previous = cache[collection] ? [...cache[collection]] : [];
  applyLocally(collection, records, clear);

  writesInFlight++;
  let response: Response;
  try {
    response = await fetch(`/api/data?profile=${encodeURIComponent(profile)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection, records, clear }),
    });
  } catch (error) {
    cache[collection] = previous;
    notify();
    throw error;
  } finally {
    writesInFlight--;
  }
  if (!response.ok) {
    cache[collection] = previous;
    notify();
    throw new Error(`Save failed (HTTP ${response.status})`);
  }
  // The next poll must not restore the pre-write body from cache.
  lastBody = '';
}

/** A save refused because the record changed on another device first. */
export class StaleCopyError extends Error {
  constructor() {
    super('That changed on another device — refreshed, please try again.');
    this.name = 'StaleCopyError';
  }
}

/**
 * Send only what changed, against the version this device last saw.
 *
 * See patchRecord on the server: a whole-record write from an out-of-date
 * copy used to silently undo changes made elsewhere. On a conflict the copy
 * is refreshed and the caller told, rather than guessing whose change wins.
 */
async function patchRecordOnServer(collection: CollectionName, existing: Row, changes: Record<string, unknown>) {
  const profile = getProfile();
  if (!profile) throw new Error('No profile selected');

  const previous = cache[collection] ? [...cache[collection]] : [];
  applyLocally(collection, [{ ...existing, ...changes } as Row], false);

  writesInFlight++;
  let response: Response;
  try {
    response = await fetch(`/api/data?profile=${encodeURIComponent(profile)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        patch: { id: existing.id, changes, base: (existing.updatedAt as string | null | undefined) ?? null },
      }),
    });
  } catch (error) {
    cache[collection] = previous;
    notify();
    throw error;
  } finally {
    writesInFlight--;
  }
  if (response.status === 409) {
    cache[collection] = previous;
    lastBody = '';
    await hydrate().catch(() => {});
    notify();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('lifeos:stale'));
    throw new StaleCopyError();
  }
  if (!response.ok) {
    cache[collection] = previous;
    notify();
    throw new Error(`Save failed (HTTP ${response.status})`);
  }
  // The next poll must not restore the pre-write body from cache.
  lastBody = '';
}

/** Mirror a successful write into the in-memory copy and wake the UI. */
function applyLocally(collection: CollectionName, records: Row[], clear: boolean) {
  const current = clear ? [] : [...(cache[collection] ?? [])];
  for (const record of records) {
    const index = current.findIndex((row) => row.id === record.id);
    if (index >= 0) current[index] = record;
    else current.push(record);
  }
  cache[collection] = current;
  notify();
}

/** Wipe every collection for the active profile, atomically, server-side. */
export async function clearAllOnServer(): Promise<void> {
  const profile = getProfile();
  if (!profile) throw new Error('No profile selected');
  const response = await fetch(`/api/data?profile=${encodeURIComponent(profile)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clearAll: true }),
  });
  if (!response.ok) throw new Error(`Clear failed (HTTP ${response.status})`);
  for (const collection of COLLECTIONS) cache[collection] = [];
  preferences = {};
  notify();
}

/** Swap the whole dataset for the active profile, atomically. */
export async function replaceAllOnServer(
  collections: Partial<Record<CollectionName, Row[]>>,
): Promise<void> {
  const profile = getProfile();
  if (!profile) throw new Error('No profile selected');
  const response = await fetch(`/api/data?profile=${encodeURIComponent(profile)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replaceAll: collections }),
  });
  if (!response.ok) throw new Error(`Import failed (HTTP ${response.status})`);
  await hydrate();
}

export async function savePreference(key: string, value: string) {
  const profile = getProfile();
  if (!profile) return;
  await fetch(`/api/data?profile=${encodeURIComponent(profile)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences: { [key]: value } }),
  });
  preferences[key] = value;
}

export function getPreference(key: string): string | undefined {
  return preferences[key];
}

// --- table shim ----------------------------------------------------------

function sortBy<T extends HasId>(rows: T[], field: string): T[] {
  return [...rows].sort((a, b) => {
    const left = (a as unknown as Row)[field] as string | number | null;
    const right = (b as unknown as Row)[field] as string | number | null;
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    return left < right ? -1 : 1;
  });
}

export interface Table<T extends HasId> {
  toArray(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  add(item: T): Promise<string>;
  put(item: T): Promise<string>;
  update(id: string, changes: Partial<T>): Promise<number>;
  delete(id: string): Promise<void>;
  bulkAdd(items: T[]): Promise<void>;
  bulkPut(items: T[]): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
  orderBy(field: string): {
    toArray(): Promise<T[]>;
    reverse(): { toArray(): Promise<T[]> };
  };
  where(field: string): {
    equals(value: unknown): { toArray(): Promise<T[]>; count(): Promise<number> };
  };
}

export function makeTable<T extends HasId>(collection: CollectionName): Table<T> {
  const rows = () => (cache[collection] ?? []) as unknown as T[];

  return {
    async toArray() { return rows(); },
    async get(id) { return rows().find((row) => row.id === id); },
    async add(item) { await writeRecords(collection, [item as unknown as Row]); return item.id; },
    async put(item) { await writeRecords(collection, [item as unknown as Row]); return item.id; },
    async update(id, changes) {
      const existing = rows().find((row) => row.id === id);
      if (!existing) return 0;
      await patchRecordOnServer(collection, existing as unknown as Row, changes as Record<string, unknown>);
      return 1;
    },
    async delete(id) {
      const profile = getProfile();
      const response = await fetch(
        `/api/data?profile=${encodeURIComponent(profile)}&collection=${collection}&id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error(`Delete failed (HTTP ${response.status})`);
      cache[collection] = (cache[collection] ?? []).filter((row) => row.id !== id);
      notify();
    },
    async bulkAdd(items) { if (items.length) await writeRecords(collection, items as unknown as Row[]); },
    async bulkPut(items) { if (items.length) await writeRecords(collection, items as unknown as Row[]); },
    async clear() { await writeRecords(collection, [], true); },
    async count() { return rows().length; },
    orderBy(field) {
      return {
        async toArray() { return sortBy(rows(), field); },
        reverse() {
          return { async toArray() { return sortBy(rows(), field).reverse(); } };
        },
      };
    },
    where(field) {
      return {
        equals(value) {
          const matching = () => rows().filter((row) => (row as unknown as Row)[field] === value);
          return {
            async toArray() { return matching(); },
            async count() { return matching().length; },
          };
        },
      };
    },
  };
}

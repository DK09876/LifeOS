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
  'tasks', 'domains', 'habits', 'events', 'projects', 'filterPresets',
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

export async function hydrate(): Promise<void> {
  const profile = getProfile();
  if (!profile) return;
  const response = await fetch(`/api/data?profile=${encodeURIComponent(profile)}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not load data (HTTP ${response.status})`);
  const body = (await response.json()) as Record<string, unknown>;
  cache = {};
  for (const collection of COLLECTIONS) {
    cache[collection] = (body[collection] as Row[]) ?? [];
  }
  preferences = (body.preferences as Record<string, string>) ?? {};
  hydrated = true;
  notify();
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
  }
  if (!response.ok) {
    cache[collection] = previous;
    notify();
    throw new Error(`Save failed (HTTP ${response.status})`);
  }
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
      // Whole-record write: the server replaces rows, so send the merge.
      await writeRecords(collection, [{ ...existing, ...changes } as unknown as Row]);
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

/**
 * The app's data tables, backed by the Pi's database instead of a browser
 * cache - so lib/actions.ts can run on the server unchanged.
 *
 * Every write can be recorded: the voice assistant keeps what each record
 * looked like before it changed it, which is what "undo that" restores.
 */

import type { Db } from '@/lib/actions';
import type { Table } from '@/lib/store';
import {
  clearCollection, deleteRecord, getPreferences, putRecord, readCollection, readRecord, setPreference,
  type Collection, type StoredRecord,
} from './store';

/** Before-images of everything changed, in order. */
export interface ChangeLog {
  records: Array<{ collection: Collection; id: string; before: StoredRecord | null }>;
  preferences: Array<{ key: string; before: string | null }>;
}

function table<T extends { id: string }>(userId: string, collection: Collection, log?: ChangeLog): Table<T> {
  const rows = () => readCollection(userId, collection) as unknown as T[];
  const remember = (id: string) => {
    if (!log || log.records.some((r) => r.collection === collection && r.id === id)) return;
    log.records.push({ collection, id, before: readRecord(userId, collection, id) ?? null });
  };
  const write = (item: T) => {
    remember(item.id);
    putRecord(userId, collection, item as unknown as StoredRecord);
  };
  const sortBy = (field: string) => [...rows()].sort((a, b) => {
    const x = (a as Record<string, unknown>)[field] as string | number;
    const y = (b as Record<string, unknown>)[field] as string | number;
    return x < y ? -1 : x > y ? 1 : 0;
  });

  return {
    async toArray() { return rows(); },
    async get(id) { return readRecord(userId, collection, id) as unknown as T | undefined; },
    async add(item) { write(item); return item.id; },
    async put(item) { write(item); return item.id; },
    async update(id, changes) {
      const existing = readRecord(userId, collection, id);
      if (!existing) return 0;
      write({ ...(existing as unknown as T), ...changes });
      return 1;
    },
    async delete(id) { remember(id); deleteRecord(userId, collection, id); },
    async bulkAdd(items) { items.forEach(write); },
    async bulkPut(items) { items.forEach(write); },
    async clear() { clearCollection(userId, collection); },
    async count() { return rows().length; },
    orderBy(field) {
      return {
        async toArray() { return sortBy(field); },
        reverse() { return { async toArray() { return sortBy(field).reverse(); } }; },
      };
    },
    where(field) {
      return {
        equals(value) {
          const match = () => rows().filter((r) => (r as Record<string, unknown>)[field] === value);
          return { async toArray() { return match(); }, async count() { return match().length; } };
        },
      };
    },
  };
}

export function serverDb(userId: string, log?: ChangeLog): Db {
  return {
    tasks: table(userId, 'tasks', log),
    domains: table(userId, 'domains', log),
    habits: table(userId, 'habits', log),
    events: table(userId, 'events', log),
    projects: table(userId, 'projects', log),
    filterPresets: table(userId, 'filterPresets', log),
    notes: table(userId, 'notes', log),
  };
}

export function serverPreferences(userId: string, log?: ChangeLog) {
  return {
    getPreference: (key: string) => getPreferences(userId)[key],
    async savePreference(key: string, value: string) {
      if (log && !log.preferences.some((p) => p.key === key)) {
        log.preferences.push({ key, before: getPreferences(userId)[key] ?? null });
      }
      setPreference(userId, key, value);
    },
  };
}

/**
 * Server-side store. The Pi holds the authoritative copy; browsers keep an
 * IndexedDB cache that syncs against this.
 *
 * Records are kept as one row per item with the queryable fields projected
 * into columns and full fidelity preserved in a JSON blob. That keeps the
 * server tolerant of schema changes in the app while still letting other
 * processes on the box - the voice assistant - run real queries like
 * "tasks due today" without parsing every row.
 *
 * WASM SQLite, not a native addon: better-sqlite3 segfaults on this
 * platform (Debian 13 aarch64 / Node 20), prebuilt and from source alike.
 */

import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

import { Database } from 'node-sqlite3-wasm';

export const COLLECTIONS = [
  'tasks',
  'domains',
  'habits',
  'events',
  'projects',
  'filterPresets',
] as const;

export type Collection = (typeof COLLECTIONS)[number];

export interface StoredRecord {
  id: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  [key: string]: unknown;
}

const DB_PATH = process.env.LIFEOS_DB_PATH || `${process.cwd()}/data/lifeos.db`;

let db: Database | null = null;

function connect(): Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(conn: Database) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      token     TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      userId     TEXT NOT NULL,
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      name       TEXT,
      status     TEXT,
      dueDate    TEXT,
      domainId   TEXT,
      updatedAt  TEXT,
      deletedAt  TEXT,
      data       TEXT NOT NULL,
      PRIMARY KEY (userId, collection, id)
    );

    CREATE INDEX IF NOT EXISTS idx_records_live
      ON records (userId, collection, deletedAt);
    CREATE INDEX IF NOT EXISTS idx_records_due
      ON records (userId, collection, dueDate);

    CREATE TABLE IF NOT EXISTS preferences (
      userId TEXT NOT NULL,
      key    TEXT NOT NULL,
      value  TEXT NOT NULL,
      PRIMARY KEY (userId, key)
    );
  `);
}

/** Projected columns differ per collection; this normalises the names. */
function project(collection: Collection, record: StoredRecord) {
  const asString = (value: unknown) =>
    typeof value === 'string' ? value : null;
  return {
    name:
      asString(record.taskName) ??
      asString(record.habitName) ??
      asString(record.eventName) ??
      asString(record.name),
    status: asString(record.status),
    dueDate: asString(record.dueDate) ?? asString(record.date),
    domainId: asString(record.domainId),
    updatedAt: asString(record.updatedAt),
    deletedAt: asString(record.deletedAt),
  };
}

// --- users ---------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  token: string;
}

export function userForToken(token: string): User | null {
  if (!token) return null;
  const row = connect().get('SELECT id, name, token FROM users WHERE token = ?', [
    token,
  ]);
  return (row as unknown as User) ?? null;
}

export function listUsers(): Array<{ id: string; name: string }> {
  return connect().all('SELECT id, name FROM users ORDER BY createdAt') as never;
}

export function createUser(id: string, name: string): User {
  const token = randomBytes(24).toString('base64url');
  connect().run(
    'INSERT INTO users (id, name, token, createdAt) VALUES (?, ?, ?, ?)',
    [id, name, token, new Date().toISOString()],
  );
  return { id, name, token };
}

// --- sync ----------------------------------------------------------------

export type Payload = Partial<Record<Collection, StoredRecord[]>> & {
  preferences?: Record<string, string>;
};

/**
 * Merge an incoming payload, per record, newest `updatedAt` wins.
 *
 * Deliberately not a wholesale replace. Google Drive sync round-trips the
 * entire dataset as one file, so two devices pushing near-simultaneously
 * means the loser's whole set of changes disappears. Merging per record
 * narrows that to a single field-level conflict.
 */
export function mergePayload(userId: string, payload: Payload): { applied: number } {
  const conn = connect();
  let applied = 0;

  conn.run('BEGIN');
  try {
    for (const collection of COLLECTIONS) {
      for (const record of payload[collection] ?? []) {
        if (!record?.id) continue;
        const existing = conn.get(
          'SELECT updatedAt FROM records WHERE userId=? AND collection=? AND id=?',
          [userId, collection, record.id],
        ) as { updatedAt: string | null } | undefined;

        const incoming = typeof record.updatedAt === 'string' ? record.updatedAt : '';
        if (existing && (existing.updatedAt ?? '') > incoming) continue;

        const columns = project(collection, record);
        conn.run(
          `INSERT INTO records
             (userId, collection, id, name, status, dueDate, domainId, updatedAt, deletedAt, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (userId, collection, id) DO UPDATE SET
             name=excluded.name, status=excluded.status, dueDate=excluded.dueDate,
             domainId=excluded.domainId, updatedAt=excluded.updatedAt,
             deletedAt=excluded.deletedAt, data=excluded.data`,
          [
            userId, collection, record.id,
            columns.name, columns.status, columns.dueDate, columns.domainId,
            columns.updatedAt, columns.deletedAt, JSON.stringify(record),
          ],
        );
        applied++;
      }
    }

    for (const [key, value] of Object.entries(payload.preferences ?? {})) {
      conn.run(
        `INSERT INTO preferences (userId, key, value) VALUES (?, ?, ?)
         ON CONFLICT (userId, key) DO UPDATE SET value=excluded.value`,
        [userId, key, value],
      );
    }
    conn.run('COMMIT');
  } catch (error) {
    conn.run('ROLLBACK');
    throw error;
  }
  return { applied };
}

/** Upsert one record. Whole-record write: callers send the complete object. */
export function putRecord(userId: string, collection: Collection, record: StoredRecord) {
  const conn = connect();
  const columns = project(collection, record);
  conn.run(
    `INSERT INTO records
       (userId, collection, id, name, status, dueDate, domainId, updatedAt, deletedAt, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (userId, collection, id) DO UPDATE SET
       name=excluded.name, status=excluded.status, dueDate=excluded.dueDate,
       domainId=excluded.domainId, updatedAt=excluded.updatedAt,
       deletedAt=excluded.deletedAt, data=excluded.data`,
    [
      userId, collection, record.id,
      columns.name, columns.status, columns.dueDate, columns.domainId,
      columns.updatedAt, columns.deletedAt, JSON.stringify(record),
    ],
  );
}

/** Upsert many records in one transaction. */
export function putRecords(userId: string, collection: Collection, records: StoredRecord[]) {
  const conn = connect();
  conn.run('BEGIN');
  try {
    for (const record of records) if (record?.id) putRecord(userId, collection, record);
    conn.run('COMMIT');
  } catch (error) {
    conn.run('ROLLBACK');
    throw error;
  }
}

/** Hard-delete. Soft deletion is done by writing a record with deletedAt set. */
export function deleteRecord(userId: string, collection: Collection, id: string) {
  connect().run('DELETE FROM records WHERE userId=? AND collection=? AND id=?',
    [userId, collection, id]);
}

export function clearCollection(userId: string, collection: Collection) {
  connect().run('DELETE FROM records WHERE userId=? AND collection=?', [userId, collection]);
}

export function setPreference(userId: string, key: string, value: string) {
  connect().run(
    `INSERT INTO preferences (userId, key, value) VALUES (?, ?, ?)
     ON CONFLICT (userId, key) DO UPDATE SET value=excluded.value`,
    [userId, key, value],
  );
}

/** The user's full dataset, in the shape the client's SyncPayload expects. */
export function readPayload(userId: string): Payload & { exportedAt: string } {
  const conn = connect();
  const result: Payload = {};

  for (const collection of COLLECTIONS) {
    const rows = conn.all(
      'SELECT data FROM records WHERE userId=? AND collection=?',
      [userId, collection],
    ) as unknown as Array<{ data: string }>;
    result[collection] = rows.map((row) => JSON.parse(row.data) as StoredRecord);
  }

  const preferences: Record<string, string> = {};
  const rows = conn.all('SELECT key, value FROM preferences WHERE userId=?', [
    userId,
  ]) as unknown as Array<{ key: string; value: string }>;
  for (const row of rows) preferences[row.key] = row.value;

  return { ...result, preferences, exportedAt: new Date().toISOString() };
}

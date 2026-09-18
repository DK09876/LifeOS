/**
 * Taking your data off the Pi, and putting it back.
 *
 * The app has been telling people to back up since the server move while
 * offering no way to do it - the only route was ssh and a copy of the SQLite
 * file. A backup you cannot restore is not a backup, so import is here too.
 */

import { COLLECTIONS, CollectionName } from './store';

export const BACKUP_VERSION = 3;

export interface BackupFile {
  version: number;
  exportedAt: string;
  profile: string;
  collections: Partial<Record<CollectionName, unknown[]>>;
  preferences?: Record<string, string>;
}

export function buildBackup(
  profile: string,
  payload: Record<string, unknown>,
): BackupFile {
  const collections: Partial<Record<CollectionName, unknown[]>> = {};
  for (const name of COLLECTIONS) {
    const rows = payload[name];
    if (Array.isArray(rows)) collections[name] = rows;
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    collections,
    preferences: (payload.preferences as Record<string, string>) ?? {},
  };
}

/** A filename that sorts chronologically and says whose data it is. */
export function backupFilename(profile: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `lifeos-${profile}-${stamp}.json`;
}

export interface ParsedBackup {
  collections: Partial<Record<CollectionName, unknown[]>>;
  preferences: Record<string, string>;
  counts: Record<string, number>;
}

/**
 * Read a backup file, rejecting anything that is not one.
 *
 * Import replaces everything for the profile, so a wrong or truncated file
 * would destroy the data it was meant to protect. Better to refuse than to
 * import half of something.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('That file is not a LifeOS backup.');
  }
  const body = raw as Partial<BackupFile>;
  if (typeof body.version !== 'number' || !body.collections || typeof body.collections !== 'object') {
    throw new Error('That file is not a LifeOS backup.');
  }
  if (body.version > BACKUP_VERSION) {
    throw new Error(`That backup was written by a newer version (v${body.version}).`);
  }

  const collections: Partial<Record<CollectionName, unknown[]>> = {};
  const counts: Record<string, number> = {};
  for (const name of COLLECTIONS) {
    const rows = (body.collections as Record<string, unknown>)[name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`The "${name}" section of that file is malformed.`);
    collections[name] = rows;
    counts[name] = rows.length;
  }
  if (!Object.keys(collections).length) {
    throw new Error('That backup contains no data.');
  }

  const preferences: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.preferences ?? {})) {
    if (typeof value === 'string') preferences[key] = value;
  }
  return { collections, preferences, counts };
}

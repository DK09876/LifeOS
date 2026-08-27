/**
 * Tests for scripts/backup.sh.
 *
 * Runs the real script against a throwaway database. The behaviours that
 * matter are the ones that keep the SD card from filling: not writing a new
 * snapshot when nothing changed, and pruning when it does.
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, '../scripts/backup.sh');

let dir: string;
let db: string;
let dest: string;

function sqlite(sql: string) {
  execFileSync('sqlite3', [db, sql]);
}

function backup(args: string[] = [], keep = '14'): string {
  return execFileSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LIFEOS_DB_PATH: db,
      LIFEOS_BACKUP_DIR: dest,
      LIFEOS_BACKUP_KEEP: keep,
    },
  });
}

const snapshots = () => readdirSync(dest).filter((f) => f.endsWith('.db.gz'));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lifeos-backup-'));
  db = join(dir, 'lifeos.db');
  dest = join(dir, 'backups');
  sqlite('CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, token TEXT, createdAt TEXT)');
  sqlite('CREATE TABLE records (userId TEXT, collection TEXT, id TEXT, data TEXT)');
  sqlite("INSERT INTO users VALUES ('dk','DK','tok','2026-01-01')");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('scripts/backup.sh', () => {
  it('creates a snapshot and verifies it opens', () => {
    const output = backup(['--verify']);
    expect(snapshots()).toHaveLength(1);
    expect(output).toContain('integrity=ok');
    expect(output).toContain('users=1');
  });

  // The reason a quiet fortnight used to leave fourteen identical files.
  it('does not write a second snapshot when nothing has changed', () => {
    backup();
    const output = backup();
    expect(output).toContain('unchanged');
    expect(snapshots()).toHaveLength(1);
  });

  it('writes a new snapshot once the data actually changes', () => {
    backup();
    sqlite("INSERT INTO records VALUES ('dk','tasks','t1','{}')");
    backup();
    expect(snapshots()).toHaveLength(2);
  });

  it('snapshots anyway when forced', () => {
    backup();
    backup(['--force']);
    expect(snapshots()).toHaveLength(2);
  });

  it('prunes to the retention limit, keeping the newest', () => {
    for (let i = 0; i < 5; i++) {
      sqlite(`INSERT INTO records VALUES ('dk','tasks','t${i}','{}')`);
      backup([], '3');
    }
    const kept = snapshots().sort();
    expect(kept).toHaveLength(3);

    // The survivors must be the most recent ones.
    const all = readdirSync(dest).filter((f) => f.endsWith('.db.gz')).sort();
    expect(all[all.length - 1]).toBe(kept[kept.length - 1]);
  });

  it('fails loudly when the database is missing', () => {
    rmSync(db);
    expect(() => backup()).toThrow();
  });

  it('leaves a hash marker so the next run can compare', () => {
    backup();
    expect(existsSync(join(dest, '.last-hash'))).toBe(true);
  });
});

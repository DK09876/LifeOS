#!/usr/bin/env node
/**
 * Manage LifeOS server accounts.
 *
 *   node scripts/user.cjs list
 *   node scripts/user.cjs add <id> "<display name>"
 *   node scripts/user.cjs token <id>          reissue a token
 *
 * Tokens are the only credential; treat them like passwords.
 */

const { randomBytes } = require('crypto');
const { mkdirSync } = require('fs');
const { dirname, join } = require('path');
const { Database } = require('node-sqlite3-wasm');

const DB_PATH = process.env.LIFEOS_DB_PATH || join(process.cwd(), 'data', 'lifeos.db');
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS records (
    userId TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL,
    name TEXT, status TEXT, dueDate TEXT, domainId TEXT,
    updatedAt TEXT, deletedAt TEXT, data TEXT NOT NULL,
    PRIMARY KEY (userId, collection, id)
  );
  CREATE INDEX IF NOT EXISTS idx_records_live ON records (userId, collection, deletedAt);
  CREATE INDEX IF NOT EXISTS idx_records_due  ON records (userId, collection, dueDate);
  CREATE TABLE IF NOT EXISTS preferences (
    userId TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
    PRIMARY KEY (userId, key)
  );
`);

const [command, id, name] = process.argv.slice(2);

if (command === 'list') {
  const rows = db.all('SELECT id, name, token, createdAt FROM users ORDER BY createdAt');
  if (!rows.length) { console.log('No users. Add one with: node scripts/user.cjs add <id> "<name>"'); }
  for (const row of rows) {
    const counts = db.get(
      "SELECT count(*) c FROM records WHERE userId=? AND collection='tasks' AND deletedAt IS NULL", [row.id]);
    console.log(`${row.id.padEnd(10)} ${String(row.name).padEnd(16)} tasks:${String(counts.c).padEnd(5)} ${row.token}`);
  }
} else if (command === 'add') {
  if (!id || !name) { console.error('usage: add <id> "<display name>"'); process.exit(1); }
  const token = randomBytes(24).toString('base64url');
  db.run('INSERT INTO users (id, name, token, createdAt) VALUES (?,?,?,?)',
         [id, name, token, new Date().toISOString()]);
  console.log(`created ${id}`);
  console.log(`token:  ${token}`);
} else if (command === 'token') {
  if (!id) { console.error('usage: token <id>'); process.exit(1); }
  const token = randomBytes(24).toString('base64url');
  db.run('UPDATE users SET token=? WHERE id=?', [token, id]);
  console.log(`new token for ${id}: ${token}`);
} else {
  console.log('usage: list | add <id> "<name>" | token <id>');
}
db.close();

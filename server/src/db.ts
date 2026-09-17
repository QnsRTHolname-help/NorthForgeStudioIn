import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';
import { SCHEMA_SQL } from './schema';

fs.mkdirSync(path.dirname(env.databaseFile), { recursive: true });

export const db = new Database(env.databaseFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(SCHEMA_SQL);

/**
 * Forward-only column migrations.
 *
 * `CREATE TABLE IF NOT EXISTS` never alters an existing table, so a database
 * created before a column existed would stay incompatible forever. Each
 * statement is idempotent and safe to run on every boot.
 */
const COLUMN_MIGRATIONS: { table: string; column: string; definition: string }[] = [
  { table: 'users', column: 'is_demo', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'clients', column: 'is_demo', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'users', column: 'totp_secret', definition: 'TEXT' },
  { table: 'users', column: 'totp_enabled', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'users', column: 'email_confirmed_at', definition: 'TEXT' },
];

for (const migration of COLUMN_MIGRATIONS) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${migration.table})`).all() as { name: string }[];
    if (!columns.some((column) => column.name === migration.column)) {
      db.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.definition}`);
    }
  } catch {
    /* Table does not exist yet — the schema above will create it. */
  }
}

/** Generates prefixed, sortable ids: `ld_lz4k9x2q0ab1`. */
export function newId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}

export function nowIso() {
  return new Date().toISOString();
}

/** SQLite has no booleans — normalise both directions. */
export const toBool = (v: unknown) => Boolean(Number(v));
export const fromBool = (v: boolean) => (v ? 1 : 0);

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

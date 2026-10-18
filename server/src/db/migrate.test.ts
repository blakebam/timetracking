import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from './connection';
import { runMigrations } from './migrate';
import { migrations } from './migrations';

const tempDirs: string[] = [];
function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-db-'));
  tempDirs.push(dir);
  return path.join(dir, 'nested', 'timetracking.db');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const tableNames = (db: Database.Database) =>
  db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all()
    .map((r) => r.name);

describe('openDb', () => {
  it('creates the file, schema and settings row on first open', () => {
    const file = tempDbPath();
    const db = openDb(file);

    expect(fs.existsSync(file)).toBe(true);
    expect(tableNames(db)).toEqual(['invoice_lines', 'invoices', 'settings', 'time_entries']);
    expect(db.pragma('user_version', { simple: true })).toBe(migrations.length);
    expect(db.prepare('SELECT COUNT(*) AS n FROM settings').get()).toEqual({ n: 1 });
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });

  it('does not re-run migrations when reopened', () => {
    const file = tempDbPath();
    const first = openDb(file);
    first.prepare("UPDATE settings SET biller_name = 'Kept'").run();
    first.close();

    const second = openDb(file);
    expect(second.prepare('SELECT COUNT(*) AS n FROM settings').get()).toEqual({ n: 1 });
    expect(second.prepare('SELECT biller_name FROM settings').get()).toEqual({
      biller_name: 'Kept',
    });
    second.close();
  });

  it('refuses to open a database from a newer app version', () => {
    const file = tempDbPath();
    openDb(file).close();
    const raw = new Database(file);
    raw.pragma('user_version = 99');
    raw.close();

    expect(() => openDb(file)).toThrow(/version 99 is newer than this app supports/);
  });
});

describe('runMigrations', () => {
  it('rolls back a failing migration and leaves user_version unchanged', () => {
    const db = openDb(':memory:');
    const broken = [
      ...migrations,
      {
        version: migrations.length + 1,
        sql: 'CREATE TABLE half_done (a); INSERT INTO no_such_table VALUES (1);',
      },
    ];

    expect(() => runMigrations(db, broken)).toThrow(/no such table/);
    expect(db.pragma('user_version', { simple: true })).toBe(migrations.length);
    expect(tableNames(db)).not.toContain('half_done');
  });

  it('rejects migrations that are not numbered sequentially', () => {
    const db = new Database(':memory:');
    expect(() => runMigrations(db, [{ version: 2, sql: '' }])).toThrow(/numbered/);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate';
import { migrations } from './migrations';

export type Db = Database.Database;

/** Opens (creating if needed) the SQLite database and brings its schema up to date. */
export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 3000');
    // Single-file journal: a backup is a plain copy of the .db file while the server is stopped.
    db.pragma('journal_mode = DELETE');
    runMigrations(db, migrations);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

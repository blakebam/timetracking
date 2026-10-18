import type { Db } from './connection';

export interface Migration {
  version: number;
  sql: string;
}

/**
 * Applies every migration newer than the database's `user_version`, each in its own
 * transaction together with the version bump, so a failure leaves the DB untouched.
 */
export function runMigrations(db: Db, migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(
        `Migrations must be numbered 1, 2, 3…; found version ${m.version} at position ${i + 1}`,
      );
    }
  });

  const current = db.pragma('user_version', { simple: true }) as number;
  const latest = migrations.length;
  if (current > latest) {
    throw new Error(
      `Database schema version ${current} is newer than this app supports (${latest}). ` +
        'Update the app, or restore a backup made with this version.',
    );
  }

  for (const migration of migrations.slice(current)) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}

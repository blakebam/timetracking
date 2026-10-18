import Database from 'better-sqlite3';

/** Raised when a write would make two entries on the same day overlap. */
export class OverlapError extends Error {
  constructor() {
    super('Entry overlaps an existing entry on the same day');
    this.name = 'OverlapError';
  }
}

/** Runs a write, translating the overlap trigger's abort into an OverlapError. */
export function withOverlapCheck<T>(write: () => T): T {
  try {
    return write();
  } catch (err) {
    if (err instanceof Database.SqliteError && err.message === 'overlap') throw new OverlapError();
    throw err;
  }
}

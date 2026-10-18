import type { EndTime, IsoDate, StartTime, TimeEntry, TimeEntryInput } from '@tt/shared';
import type { Db } from './connection';
import { withOverlapCheck } from './errors';

interface EntryRow {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  task_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Rows are trusted: the DB only ever receives validated values.
const toEntry = (r: EntryRow): TimeEntry => ({
  id: r.id,
  date: r.date as IsoDate,
  startTime: r.start_time as StartTime,
  endTime: r.end_time as EndTime,
  taskName: r.task_name,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function entriesRepo(db: Db) {
  const stmts = {
    listByRange: db.prepare<[string, string], EntryRow>(
      'SELECT * FROM time_entries WHERE date BETWEEN ? AND ? ORDER BY date, start_time',
    ),
    getById: db.prepare<[number], EntryRow>('SELECT * FROM time_entries WHERE id = ?'),
    insert: db.prepare<[TimeEntryInput], EntryRow>(
      `INSERT INTO time_entries (date, start_time, end_time, task_name, notes)
       VALUES (@date, @startTime, @endTime, @taskName, @notes)
       RETURNING *`,
    ),
    update: db.prepare<[TimeEntryInput & { id: number }], EntryRow>(
      `UPDATE time_entries
       SET date = @date, start_time = @startTime, end_time = @endTime,
           task_name = @taskName, notes = @notes,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = @id
       RETURNING *`,
    ),
    remove: db.prepare<[number]>('DELETE FROM time_entries WHERE id = ?'),
    findOverlapping: db.prepare<
      [{ date: string; start: string; end: string; excludeId: number | null }],
      EntryRow
    >(
      `SELECT * FROM time_entries
       WHERE date = @date AND start_time < @end AND end_time > @start AND id IS NOT @excludeId
       ORDER BY start_time`,
    ),
    // One row per case-insensitive name, keeping the spelling from its most recent entry.
    taskNames: db.prepare<[{ prefix: string | null; limit: number }], { task_name: string }>(
      `SELECT task_name FROM (
         SELECT task_name, date, start_time,
                ROW_NUMBER() OVER (
                  PARTITION BY lower(task_name)
                  ORDER BY date DESC, start_time DESC, id DESC
                ) AS rn
         FROM time_entries
         WHERE @prefix IS NULL OR task_name LIKE @prefix || '%' ESCAPE '\\'
       )
       WHERE rn = 1
       ORDER BY date DESC, start_time DESC
       LIMIT @limit`,
    ),
  };

  return {
    /** Entries with `from <= date <= to`, ordered by date then start time. */
    listByRange(from: IsoDate, to: IsoDate): TimeEntry[] {
      return stmts.listByRange.all(from, to).map(toEntry);
    },

    getById(id: number): TimeEntry | undefined {
      const row = stmts.getById.get(id);
      return row && toEntry(row);
    },

    /** @throws OverlapError if the entry overlaps another on the same day. */
    create(input: TimeEntryInput): TimeEntry {
      return toEntry(withOverlapCheck(() => stmts.insert.get(input)!));
    },

    /** Full replace. Returns undefined if no entry has this id. @throws OverlapError */
    update(id: number, input: TimeEntryInput): TimeEntry | undefined {
      const row = withOverlapCheck(() => stmts.update.get({ ...input, id }));
      return row && toEntry(row);
    },

    remove(id: number): boolean {
      return stmts.remove.run(id).changes > 0;
    },

    /** Entries on `date` that overlap [start, end). Touching edges do not count. */
    findOverlapping(
      date: IsoDate,
      start: StartTime,
      end: EndTime,
      excludeId?: number,
    ): TimeEntry[] {
      return stmts.findOverlapping
        .all({ date, start, end, excludeId: excludeId ?? null })
        .map(toEntry);
    },

    /** Distinct task names (case-insensitive), most recently used first. */
    taskNames(prefix?: string, limit = 20): string[] {
      const p = prefix?.trim() ? escapeLike(prefix.trim()) : null;
      return stmts.taskNames.all({ prefix: p, limit }).map((r) => r.task_name);
    },
  };
}

export type EntriesRepo = ReturnType<typeof entriesRepo>;

import { isoDate, type EndTime, type StartTime, type TimeEntryInput } from '@tt/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './connection';
import { entriesRepo, type EntriesRepo } from './entriesRepo';
import { OverlapError } from './errors';

const entry = (
  date: string,
  startTime: StartTime,
  endTime: EndTime,
  taskName = 'Work',
  notes: string | null = null,
): TimeEntryInput => ({ date: isoDate(date), startTime, endTime, taskName, notes });

let db: Db;
let repo: EntriesRepo;

beforeEach(() => {
  db = openDb(':memory:');
  repo = entriesRepo(db);
});

describe('CRUD', () => {
  it('creates, reads, updates and deletes an entry', () => {
    const created = repo.create(entry('2026-10-17', '09:00', '10:30', 'Meeting', 'Standup'));
    expect(created).toMatchObject({
      date: '2026-10-17',
      startTime: '09:00',
      endTime: '10:30',
      taskName: 'Meeting',
      notes: 'Standup',
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

    expect(repo.getById(created.id)).toEqual(created);

    const updated = repo.update(created.id, entry('2026-10-18', '13:00', '24:00', 'Review'));
    expect(updated).toMatchObject({
      id: created.id,
      date: '2026-10-18',
      startTime: '13:00',
      endTime: '24:00',
      taskName: 'Review',
      notes: null,
    });

    expect(repo.remove(created.id)).toBe(true);
    expect(repo.getById(created.id)).toBeUndefined();
    expect(repo.remove(created.id)).toBe(false);
  });

  it('returns undefined when updating a missing entry', () => {
    expect(repo.update(999, entry('2026-10-17', '09:00', '10:00'))).toBeUndefined();
  });
});

describe('listByRange', () => {
  it('is inclusive at both ends and sorted by date then start', () => {
    repo.create(entry('2026-10-01', '09:00', '10:00', 'before'));
    repo.create(entry('2026-10-05', '13:00', '14:00', 'last-start'));
    repo.create(entry('2026-10-05', '08:00', '09:00', 'to-boundary'));
    repo.create(entry('2026-10-02', '10:00', '11:00', 'from-boundary'));
    repo.create(entry('2026-10-06', '09:00', '10:00', 'after'));

    const names = repo
      .listByRange(isoDate('2026-10-02'), isoDate('2026-10-05'))
      .map((e) => e.taskName);
    expect(names).toEqual(['from-boundary', 'to-boundary', 'last-start']);
  });
});

describe('findOverlapping', () => {
  let existingId: number;
  beforeEach(() => {
    existingId = repo.create(entry('2026-10-17', '10:00', '11:00')).id;
  });

  it('does not count touching edges', () => {
    expect(repo.findOverlapping(isoDate('2026-10-17'), '11:00', '12:00')).toEqual([]);
    expect(repo.findOverlapping(isoDate('2026-10-17'), '09:00', '10:00')).toEqual([]);
  });

  it('finds partial, nested and enclosing overlaps', () => {
    const d = isoDate('2026-10-17');
    expect(repo.findOverlapping(d, '10:30', '11:30')).toHaveLength(1);
    expect(repo.findOverlapping(d, '09:30', '10:15')).toHaveLength(1);
    expect(repo.findOverlapping(d, '10:15', '10:45')).toHaveLength(1);
    expect(repo.findOverlapping(d, '08:00', '12:00')).toHaveLength(1);
  });

  it('ignores other days and the excluded entry', () => {
    expect(repo.findOverlapping(isoDate('2026-10-18'), '10:00', '11:00')).toEqual([]);
    expect(repo.findOverlapping(isoDate('2026-10-17'), '10:00', '11:00', existingId)).toEqual([]);
  });
});

describe('overlap triggers', () => {
  beforeEach(() => {
    repo.create(entry('2026-10-17', '10:00', '11:00'));
  });

  it('rejects an overlapping insert', () => {
    expect(() => repo.create(entry('2026-10-17', '10:30', '11:30'))).toThrow(OverlapError);
  });

  it('allows a touching insert', () => {
    expect(() => repo.create(entry('2026-10-17', '11:00', '12:00'))).not.toThrow();
  });

  it('rejects an update that would overlap, leaving the entry unchanged', () => {
    const other = repo.create(entry('2026-10-17', '13:00', '14:00'));
    expect(() => repo.update(other.id, entry('2026-10-17', '10:45', '14:00'))).toThrow(
      OverlapError,
    );
    expect(repo.getById(other.id)).toEqual(other);
  });

  it('allows updating an entry in place with its own times', () => {
    const [existing] = repo.listByRange(isoDate('2026-10-17'), isoDate('2026-10-17'));
    expect(() =>
      repo.update(existing!.id, entry('2026-10-17', '10:00', '11:00', 'Renamed')),
    ).not.toThrow();
  });
});

describe('DB constraints', () => {
  it('rejects end_time <= start_time even when bypassing the repo', () => {
    const insert = db.prepare(
      "INSERT INTO time_entries (date, start_time, end_time, task_name) VALUES ('2026-10-17', ?, ?, 'x')",
    );
    expect(() => insert.run('10:00', '10:00')).toThrow(/CHECK constraint/);
    expect(() => insert.run('10:00', '09:00')).toThrow(/CHECK constraint/);
  });
});

describe('taskNames', () => {
  it('dedupes case-insensitively, keeping the most recent spelling, newest first', () => {
    repo.create(entry('2026-10-01', '09:00', '10:00', 'meeting'));
    repo.create(entry('2026-10-02', '09:00', '10:00', 'Report Writing'));
    repo.create(entry('2026-10-03', '09:00', '10:00', 'Meeting'));

    expect(repo.taskNames()).toEqual(['Meeting', 'Report Writing']);
  });

  it('filters by a case-insensitive prefix and respects the limit', () => {
    repo.create(entry('2026-10-01', '09:00', '10:00', 'Research'));
    repo.create(entry('2026-10-02', '09:00', '10:00', 'Report Writing'));
    repo.create(entry('2026-10-03', '09:00', '10:00', 'Meetings'));

    expect(repo.taskNames('r')).toEqual(['Report Writing', 'Research']);
    expect(repo.taskNames('RES')).toEqual(['Research']);
    expect(repo.taskNames(undefined, 1)).toEqual(['Meetings']);
  });

  it('treats LIKE wildcards in the prefix literally', () => {
    repo.create(entry('2026-10-01', '09:00', '10:00', '100% done'));
    repo.create(entry('2026-10-02', '09:00', '10:00', '1000 items'));

    expect(repo.taskNames('100%')).toEqual(['100% done']);
    expect(repo.taskNames('_')).toEqual([]);
  });
});

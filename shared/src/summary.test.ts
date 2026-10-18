import { describe, expect, it } from 'vitest';
import { isoDate, type EndTime, type StartTime } from './primitives';
import { byFirstWorked, summarize } from './summary';
import type { TimeEntry } from './types';

let nextId = 1;
function entry(date: string, startTime: StartTime, endTime: EndTime, taskName: string): TimeEntry {
  return {
    id: nextId++,
    date: isoDate(date),
    startTime,
    endTime,
    taskName,
    notes: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

const FROM = isoDate('2026-10-26');
const TO = isoDate('2026-10-31');

describe('summarize', () => {
  it('returns zero totals and every day for no entries', () => {
    const s = summarize([], FROM, TO);
    expect(s).toMatchObject({ from: FROM, to: TO, totalMinutes: 0, tasks: [] });
    expect(s.days.map((d) => d.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
    expect(s.days.every((d) => d.minutes === 0 && d.tasks.length === 0)).toBe(true);
  });

  it('merges case and whitespace variants, named after the most recent spelling', () => {
    const s = summarize(
      [
        entry('2026-10-26', '09:00', '10:00', 'meeting'),
        entry('2026-10-28', '13:00', '13:30', 'Team  Meeting'),
        entry('2026-10-28', '09:00', '09:30', 'MEETING'),
        entry('2026-10-28', '10:00', '10:30', 'Meeting'), // the latest "meeting" spelling
        entry('2026-10-27', '09:00', '10:00', 'team meeting'),
      ],
      FROM,
      TO,
    );
    expect(s.tasks.map((t) => [t.taskName, t.minutes])).toEqual([
      ['Meeting', 120],
      ['Team  Meeting', 90],
    ]);
    // Day rows use the same display name as the whole range.
    expect(s.days[0]!.tasks[0]!.taskName).toBe('Meeting');
  });

  it('sorts by minutes desc, then name asc', () => {
    const s = summarize(
      [
        entry('2026-10-26', '09:00', '10:00', 'Charlie'),
        entry('2026-10-26', '10:00', '12:00', 'Bravo'),
        entry('2026-10-26', '12:00', '13:00', 'Alpha'),
      ],
      FROM,
      TO,
    );
    expect(s.tasks.map((t) => t.taskName)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(s.days[0]!.tasks.map((t) => t.taskName)).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });

  it('records the earliest entry as firstWorked, and byFirstWorked orders by it', () => {
    const s = summarize(
      [
        entry('2026-10-29', '08:00', '12:00', 'API refactor'),
        entry('2026-10-27', '14:00', '15:00', 'Review'),
        entry('2026-10-27', '09:00', '09:15', 'Meeting'),
        entry('2026-10-28', '08:00', '09:00', 'Review'),
        entry('2026-10-27', '13:00', '14:00', 'API refactor'),
      ],
      FROM,
      TO,
    );
    const first = Object.fromEntries(s.tasks.map((t) => [t.taskName, t.firstWorked]));
    expect(first).toEqual({
      'API refactor': { date: '2026-10-27', startTime: '13:00' },
      Review: { date: '2026-10-27', startTime: '14:00' },
      Meeting: { date: '2026-10-27', startTime: '09:00' },
    });
    expect(byFirstWorked(s.tasks).map((t) => t.taskName)).toEqual([
      'Meeting',
      'API refactor',
      'Review',
    ]);
    // The input keeps its largest-first order.
    expect(s.tasks.map((t) => t.taskName)).toEqual(['API refactor', 'Review', 'Meeting']);
  });

  it('breaks each day down by task', () => {
    const s = summarize(
      [
        entry('2026-10-26', '09:00', '13:00', 'API refactor'),
        entry('2026-10-26', '13:00', '14:00', 'Meeting'),
        entry('2026-10-27', '09:00', '15:30', 'API refactor'),
        entry('2026-10-27', '15:30', '16:00', 'Meeting'),
        entry('2026-10-28', '10:00', '11:00', 'Meeting'),
      ],
      FROM,
      TO,
    );
    const byDay = s.days.map((d) => [d.minutes, d.tasks.map((t) => `${t.taskName}=${t.minutes}`)]);
    expect(byDay).toEqual([
      [300, ['API refactor=240', 'Meeting=60']],
      [420, ['API refactor=390', 'Meeting=30']],
      [60, ['Meeting=60']],
      [0, []],
      [0, []],
      [0, []],
    ]);
    expect(s.days[1]!.tasks[1]!.firstWorked).toEqual({ date: '2026-10-27', startTime: '15:30' });
  });

  it('ignores entries outside the range', () => {
    const s = summarize(
      [
        entry('2026-10-25', '09:00', '10:00', 'Before'),
        entry('2026-10-26', '09:00', '10:00', 'Inside'),
        entry('2026-11-01', '09:00', '10:00', 'After'),
      ],
      FROM,
      TO,
    );
    expect(s.tasks.map((t) => t.taskName)).toEqual(['Inside']);
    expect(s.totalMinutes).toBe(60);
    expect(s.days).toHaveLength(6);
  });

  it('keeps day, task and grand totals consistent', () => {
    const s = summarize(
      [
        entry('2026-10-26', '00:00', '24:00', 'All day'),
        entry('2026-10-27', '09:15', '10:45', 'b'),
        entry('2026-10-27', '11:00', '11:15', 'B'),
        entry('2026-10-30', '13:45', '17:00', 'c'),
        entry('2026-10-31', '08:00', '08:15', 'All  day'),
      ],
      FROM,
      TO,
    );
    const sum = (xs: { minutes: number }[]) => xs.reduce((n, x) => n + x.minutes, 0);
    expect(s.totalMinutes).toBe(1440 + 90 + 15 + 195 + 15);
    expect(sum(s.days)).toBe(s.totalMinutes);
    expect(sum(s.tasks)).toBe(s.totalMinutes);
    for (const d of s.days) expect(sum(d.tasks)).toBe(d.minutes);
  });
});

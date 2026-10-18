import {
  calendarGridRange,
  isoDate,
  summarize,
  timesheetPeriods,
  type EndTime,
  type StartTime,
  type TaskTotal,
  type TimeEntry,
} from '@tt/shared';
import { describe, expect, it } from 'vitest';
import {
  buildWeeks,
  monthParam,
  monthTotal,
  parseMonthParam,
  periodTotals,
  shiftMonth,
  topTasks,
} from './calendarLogic';

let nextId = 1;
const entry = (
  date: string,
  startTime: StartTime,
  endTime: EndTime,
  taskName = 'Task',
): TimeEntry => ({
  id: nextId++,
  date: isoDate(date),
  startTime,
  endTime,
  taskName,
  notes: null,
  createdAt: '',
  updatedAt: '',
});

describe('parseMonthParam', () => {
  it('accepts YYYY-MM', () => {
    expect(parseMonthParam('2026-02')).toEqual({ year: 2026, month: 2 });
    expect(parseMonthParam('2026-12')).toEqual({ year: 2026, month: 12 });
  });

  it.each(['2026-13', '2026-00', 'abc', '2026-2', '2026-02-01', '', null])('rejects %o', (s) => {
    expect(parseMonthParam(s)).toBeNull();
  });

  it('round-trips through monthParam', () => {
    expect(monthParam({ year: 2026, month: 2 })).toBe('2026-02');
    expect(parseMonthParam(monthParam({ year: 2026, month: 11 }))).toEqual({
      year: 2026,
      month: 11,
    });
  });
});

describe('shiftMonth', () => {
  it('moves within a year', () => {
    expect(shiftMonth({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
    expect(shiftMonth({ year: 2026, month: 10 }, -1)).toEqual({ year: 2026, month: 9 });
  });

  it('crosses a year boundary', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
});

describe('buildWeeks', () => {
  it.each([
    [2026, 2, 4], // starts on a Sunday, 28 days
    [2026, 10, 5],
    [2026, 8, 6], // starts on a Saturday, 31 days
  ])('%i-%i has %i rows of 7, each starting on a Sunday', (year, month, rows) => {
    const weeks = buildWeeks(calendarGridRange(year, month), []);
    expect(weeks).toHaveLength(rows);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
      expect(new Date(`${week[0]!.date}T12:00`).getDay()).toBe(0);
    }
  });

  it('fills days missing from the summary with nothing logged', () => {
    const range = calendarGridRange(2026, 10);
    const summary = summarize([entry('2026-10-01', '09:00', '17:00')], range.from, range.to);
    const weeks = buildWeeks(
      range,
      summary.days.filter((d) => d.minutes > 0),
    );
    expect(weeks[0]!.map((d) => [d.date, d.minutes])).toEqual([
      ['2026-09-27', 0],
      ['2026-09-28', 0],
      ['2026-09-29', 0],
      ['2026-09-30', 0],
      ['2026-10-01', 480],
      ['2026-10-02', 0],
      ['2026-10-03', 0],
    ]);
    expect(weeks[0]![0]!.tasks).toEqual([]);
  });
});

describe('monthTotal and periodTotals', () => {
  const range = calendarGridRange(2026, 10); // Sun Sep 27 – Sat Nov 7
  const { days } = summarize(
    [
      entry('2026-09-28', '09:00', '17:00'), // spill-over, before
      entry('2026-10-01', '09:00', '17:00'),
      entry('2026-10-04', '10:00', '12:15'),
      entry('2026-10-05', '09:00', '10:30'),
      entry('2026-10-31', '13:00', '14:00'),
      entry('2026-11-02', '09:00', '17:00'), // spill-over, after
    ],
    range.from,
    range.to,
  );

  it('monthTotal counts only in-month days', () => {
    expect(monthTotal(days, 2026, 10)).toBe(480 + 135 + 90 + 60);
  });

  it('periodTotals covers the month and sums to the month total', () => {
    const totals = periodTotals(timesheetPeriods(2026, 10), days);
    expect(totals.map((t) => [t.period.from, t.period.to, t.minutes])).toEqual([
      ['2026-10-01', '2026-10-04', 615],
      ['2026-10-05', '2026-10-11', 90],
      ['2026-10-12', '2026-10-18', 0],
      ['2026-10-19', '2026-10-25', 0],
      ['2026-10-26', '2026-10-31', 60],
    ]);
    expect(totals.reduce((sum, t) => sum + t.minutes, 0)).toBe(monthTotal(days, 2026, 10));
  });
});

describe('topTasks', () => {
  const tasks = (n: number): TaskTotal[] =>
    Array.from({ length: n }, (_, i) => ({
      taskName: `Task ${i + 1}`,
      minutes: 60 * (n - i),
      firstWorked: { date: isoDate('2026-10-01'), startTime: '09:00' },
    }));

  it('handles no tasks', () => {
    expect(topTasks([], 2)).toEqual({ shown: [], moreCount: 0 });
  });

  it('shows two tasks with nothing more', () => {
    const two = tasks(2);
    expect(topTasks(two, 2)).toEqual({ shown: two, moreCount: 0 });
  });

  it('shows the two largest of five and counts the rest', () => {
    const five = tasks(5);
    expect(topTasks(five, 2)).toEqual({ shown: five.slice(0, 2), moreCount: 3 });
  });
});

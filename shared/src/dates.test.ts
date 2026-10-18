import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarGridRange,
  eachDay,
  formatInvoiceDate,
  formatLongDate,
  formatMonthYear,
  formatPeriod,
  formatShortRange,
  monthRange,
  parseIsoLocal,
  startOfWeekIso,
  timesheetPeriod,
  timesheetPeriods,
  todayIso,
  weekRange,
  type Period,
} from './dates';
import { isoDate, isoDateSchema } from './primitives';

it('runs in the US Central time zone (see vitest.config.ts)', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Chicago');
});

describe('addDays', () => {
  it.each([
    ['2026-10-17', 1, '2026-10-18'],
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-11-01', -1, '2026-10-31'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-03-07', 1, '2026-03-08'], // spring forward is 2026-03-08
    ['2026-03-08', 1, '2026-03-09'],
    ['2026-10-31', 2, '2026-11-02'], // fall back is 2026-11-01
    ['2026-11-01', 1, '2026-11-02'],
    ['2026-10-17', 0, '2026-10-17'],
    ['2026-10-17', -365, '2025-10-17'],
  ])('%s %+i → %s', (from, n, to) => {
    expect(addDays(isoDate(from), n)).toBe(to);
  });
});

describe('parseIsoLocal', () => {
  it.each(['2026-10-17', '2026-03-08', '2026-11-01'])('returns local midnight for %s', (s) => {
    const d = parseIsoLocal(isoDate(s));
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual(s.split('-').map(Number));
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});

describe('todayIso / formatLongDate', () => {
  it('returns a valid date', () => {
    expect(isoDateSchema.safeParse(todayIso()).success).toBe(true);
  });

  it('formats long dates', () => {
    expect(formatLongDate(isoDate('2026-10-17'))).toBe('Saturday, October 17, 2026');
  });
});

const period = (from: string, to: string): Period => ({ from: isoDate(from), to: isoDate(to) });

describe('startOfWeekIso / weekRange', () => {
  it.each([
    ['2026-10-26', '2026-10-26'], // Monday → itself
    ['2026-11-01', '2026-10-26'], // Sunday → the previous Monday
    ['2026-10-28', '2026-10-26'],
    ['2026-10-31', '2026-10-26'],
    ['2027-01-01', '2026-12-28'], // across a year
    ['2026-03-08', '2026-03-02'], // spring forward
  ])('%s → %s', (d, monday) => {
    expect(startOfWeekIso(isoDate(d))).toBe(monday);
  });

  it('runs Monday through Sunday', () => {
    expect(weekRange(isoDate('2026-10-28'))).toEqual(period('2026-10-26', '2026-11-01'));
  });
});

describe('monthRange', () => {
  it.each([
    [2026, 2, '2026-02-01', '2026-02-28'],
    [2028, 2, '2028-02-01', '2028-02-29'],
    [2026, 12, '2026-12-01', '2026-12-31'],
    [2026, 4, '2026-04-01', '2026-04-30'],
  ])('%i-%i → %s … %s', (y, m, from, to) => {
    expect(monthRange(y, m)).toEqual(period(from, to));
  });
});

describe('calendarGridRange', () => {
  it('starts on a Sunday and ends on a Saturday', () => {
    expect(calendarGridRange(2026, 10)).toEqual(period('2026-09-27', '2026-10-31'));
    expect(calendarGridRange(2026, 11)).toEqual(period('2026-11-01', '2026-12-05'));
  });
});

describe('timesheetPeriod', () => {
  it.each([
    ['2026-11-01', '2026-11-01', '2026-11-01'], // a Sunday that starts a month
    ['2026-10-28', '2026-10-26', '2026-10-31'], // cut at month end
    ['2026-10-14', '2026-10-12', '2026-10-18'], // a whole week
    ['2026-10-02', '2026-10-01', '2026-10-04'], // cut at month start
  ])('%s → %s … %s', (d, from, to) => {
    expect(timesheetPeriod(isoDate(d))).toEqual(period(from, to));
  });
});

describe('timesheetPeriods', () => {
  const days = (ps: Period[]) => ps.map((p) => `${+p.from.slice(8)}–${+p.to.slice(8)}`);

  it('cuts weeks at month boundaries', () => {
    expect(days(timesheetPeriods(2026, 10))).toEqual(['1–4', '5–11', '12–18', '19–25', '26–31']);
    expect(days(timesheetPeriods(2026, 11))).toEqual([
      '1–1',
      '2–8',
      '9–15',
      '16–22',
      '23–29',
      '30–30',
    ]);
  });

  it('tiles every month of 2026–2028 with no gaps or overlaps', () => {
    for (let year = 2026; year <= 2028; year++) {
      for (let month = 1; month <= 12; month++) {
        const { from, to } = monthRange(year, month);
        const periods = timesheetPeriods(year, month);
        expect(periods[0]!.from).toBe(from);
        expect(periods.at(-1)!.to).toBe(to);
        periods.forEach((p, i) => {
          expect(p.from <= p.to).toBe(true);
          expect(p).toEqual(timesheetPeriod(p.from));
          if (i > 0) expect(p.from).toBe(addDays(periods[i - 1]!.to, 1));
        });
        expect(periods.flatMap((p) => eachDay(p.from, p.to))).toEqual(eachDay(from, to));
      }
    }
  });
});

describe('eachDay', () => {
  it('is inclusive and crosses month and DST boundaries', () => {
    expect(eachDay(isoDate('2026-10-31'), isoDate('2026-11-02'))).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(eachDay(isoDate('2026-10-17'), isoDate('2026-10-17'))).toEqual(['2026-10-17']);
    expect(eachDay(isoDate('2026-10-18'), isoDate('2026-10-17'))).toEqual([]);
  });
});

describe('formatPeriod', () => {
  it.each([
    ['2026-10-26', '2026-10-31', 'Mon Oct 26 – Sat Oct 31, 2026'],
    ['2026-11-01', '2026-11-01', 'Sun Nov 1, 2026'],
    ['2026-10-26', '2026-11-01', 'Mon Oct 26 – Sun Nov 1, 2026'],
    ['2026-12-28', '2027-01-03', 'Mon Dec 28, 2026 – Sun Jan 3, 2027'],
  ])('%s … %s → %s', (from, to, label) => {
    expect(formatPeriod(period(from, to))).toBe(label);
  });
});

describe('formatMonthYear', () => {
  it.each([
    [2026, 9, 'September 2026'],
    [2027, 1, 'January 2027'],
    [2026, 12, 'December 2026'],
  ])('%i-%i → %s', (year, month, label) => {
    expect(formatMonthYear(year, month)).toBe(label);
  });
});

describe('formatShortRange', () => {
  it.each([
    ['2026-09-01', '2026-09-06', '9/1-9/6'],
    ['2026-09-28', '2026-09-30', '9/28-9/30'],
    ['2026-10-26', '2026-10-31', '10/26-10/31'],
    ['2026-11-01', '2026-11-01', '11/1'],
  ])('%s … %s → %s', (from, to, label) => {
    expect(formatShortRange(isoDate(from), isoDate(to))).toBe(label);
  });
});

describe('formatInvoiceDate', () => {
  it.each([
    ['2026-10-01', 'October 1, 2026'],
    ['2027-01-31', 'January 31, 2027'],
    ['2026-03-08', 'March 8, 2026'],
  ])('%s → %s', (d, label) => {
    expect(formatInvoiceDate(isoDate(d))).toBe(label);
  });
});

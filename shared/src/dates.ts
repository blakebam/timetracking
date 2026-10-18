import { toIsoDate, type IsoDate } from './primitives';

const splitIso = (d: IsoDate) => d.split('-').map(Number) as [number, number, number];

/**
 * The date at local midnight. Never use `new Date("YYYY-MM-DD")`, which parses as UTC
 * and can land on the previous day in negative-offset time zones.
 */
export function parseIsoLocal(d: IsoDate): Date {
  const [y, m, day] = splitIso(d);
  return new Date(y, m - 1, day);
}

/** Today's local calendar date. */
export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

/** `d` moved by `n` calendar days. Uses UTC arithmetic, so DST changes can't skip or repeat a day. */
export function addDays(d: IsoDate, n: number): IsoDate {
  const [y, m, day] = splitIso(d);
  const shifted = new Date(Date.UTC(y, m - 1, day + n));
  return shifted.toISOString().slice(0, 10) as IsoDate;
}

/** Whole calendar days from `a` to `b` (negative if `b` is earlier). DST-safe. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const toUtcDays = (d: IsoDate) => {
    const [y, m, day] = splitIso(d);
    return Date.UTC(y, m - 1, day) / 86_400_000;
  };
  return toUtcDays(b) - toUtcDays(a);
}

const shortDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** "Sat, Oct 17" */
export function formatShortDate(d: IsoDate): string {
  return shortDate.format(parseIsoLocal(d));
}

/** "Saturday, October 17, 2026" */
export function formatLongDate(d: IsoDate): string {
  return longDate.format(parseIsoLocal(d));
}

/** An inclusive date range. */
export interface Period {
  from: IsoDate;
  to: IsoDate;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Day 0 is allowed and means the last day of the previous month (as in `Date.UTC`). */
function ymd(year: number, month: number, day: number): IsoDate {
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` as IsoDate;
}

/** 0 = Sunday … 6 = Saturday. */
function weekday(d: IsoDate): number {
  const [y, m, day] = splitIso(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

const laterOf = (a: IsoDate, b: IsoDate) => (a > b ? a : b);
const earlierOf = (a: IsoDate, b: IsoDate) => (a < b ? a : b);

/** The Monday on or before `d`: the start of its billing week. */
export function startOfWeekIso(d: IsoDate): IsoDate {
  return addDays(d, -((weekday(d) + 6) % 7));
}

/** The Monday–Sunday billing week containing `d`. */
export function weekRange(d: IsoDate): Period {
  const from = startOfWeekIso(d);
  return { from, to: addDays(from, 6) };
}

/** The 1st through the last day of `month` (1–12). */
export function monthRange(year: number, month: number): Period {
  return { from: ymd(year, month, 1), to: ymd(year, month + 1, 0) };
}

/** The month containing `d`. */
export function monthOf(d: IsoDate): { year: number; month: number } {
  const [year, month] = splitIso(d);
  return { year, month };
}

/** Sunday on/before the 1st through Saturday on/after the last day. Display only (calendar). */
export function calendarGridRange(year: number, month: number): Period {
  const { from, to } = monthRange(year, month);
  return { from: addDays(from, -weekday(from)), to: addDays(to, 6 - weekday(to)) };
}

/** The billing week containing `d`, cut to the month containing `d`. */
export function timesheetPeriod(d: IsoDate): Period {
  const week = weekRange(d);
  const { year, month } = monthOf(d);
  const inMonth = monthRange(year, month);
  return { from: laterOf(week.from, inMonth.from), to: earlierOf(week.to, inMonth.to) };
}

/** Every timesheet period in the month, in order. Together they cover the month exactly. */
export function timesheetPeriods(year: number, month: number): Period[] {
  const { from, to } = monthRange(year, month);
  const periods: Period[] = [];
  for (let d = from; d <= to; d = addDays(periods.at(-1)!.to, 1)) {
    periods.push(timesheetPeriod(d));
  }
  return periods;
}

/** Every date from `from` to `to`, inclusive. Empty if `to` is before `from`. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  return Array.from({ length: Math.max(0, daysBetween(from, to) + 1) }, (_, i) => addDays(from, i));
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "September"; `month` is 1–12. */
export function monthName(month: number): string {
  return MONTH_LONG[month - 1]!;
}

/** "September 2026"; `month` is 1–12. */
export function formatMonthYear(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

/** "October 1, 2026", the invoice date. */
export function formatInvoiceDate(d: IsoDate): string {
  const [y, m, day] = splitIso(d);
  return `${monthName(m)} ${day}, ${y}`;
}

/** "9/1-9/6", the timesheet title; a one-day period is just "11/1". No years. */
export function formatShortRange(from: IsoDate, to: IsoDate): string {
  const label = (d: IsoDate) => {
    const [, m, day] = splitIso(d);
    return `${m}/${day}`;
  };
  return from === to ? label(from) : `${label(from)}-${label(to)}`;
}

/**
 * "Mon Oct 26 – Sat Oct 31, 2026"; a single day is "Sun Nov 1, 2026", and a range across years
 * gives both years: "Mon Dec 28, 2026 – Sun Jan 3, 2027".
 */
export function formatPeriod({ from, to }: Period): string {
  const label = (d: IsoDate) => {
    const [, m, day] = splitIso(d);
    return `${WEEKDAY_SHORT[weekday(d)]} ${MONTH_SHORT[m - 1]} ${day}`;
  };
  const [fromYear] = splitIso(from);
  const [toYear] = splitIso(to);
  if (from === to) return `${label(from)}, ${fromYear}`;
  const start = fromYear === toYear ? label(from) : `${label(from)}, ${fromYear}`;
  return `${start} – ${label(to)}, ${toYear}`;
}

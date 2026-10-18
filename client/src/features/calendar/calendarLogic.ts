import {
  eachDay,
  monthRange,
  type DayTotal,
  type IsoDate,
  type Period,
  type TaskTotal,
} from '@tt/shared';

/** A calendar month; `month` is 1–12. */
export interface YearMonth {
  year: number;
  month: number;
}

/** Reads `?month=YYYY-MM`. Null when missing or invalid. */
export function parseMonthParam(s: string | null): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(s ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

/** "2026-10", the value of `?month=`. */
export function monthParam({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** The month before or after. */
export function shiftMonth({ year, month }: YearMonth, direction: -1 | 1): YearMonth {
  const index = year * 12 + (month - 1) + direction;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Whether `d` falls in the month. */
export const inMonth = (d: IsoDate, ym: YearMonth) => d.slice(0, 7) === monthParam(ym);

/**
 * Every day of `range` (a `calendarGridRange`, so Sunday through Saturday) in rows of 7.
 * Days missing from `days` are filled in with nothing logged.
 */
export function buildWeeks(range: Period, days: readonly DayTotal[]): DayTotal[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const all = eachDay(range.from, range.to).map(
    (date) => byDate.get(date) ?? { date, minutes: 0, tasks: [] },
  );
  const weeks: DayTotal[][] = [];
  for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
  return weeks;
}

const sumMinutes = (days: readonly DayTotal[], { from, to }: Period) =>
  days.reduce((sum, d) => (d.date >= from && d.date <= to ? sum + d.minutes : sum), 0);

/** The minutes logged in each period. */
export function periodTotals(
  periods: readonly Period[],
  days: readonly DayTotal[],
): { period: Period; minutes: number }[] {
  return periods.map((period) => ({ period, minutes: sumMinutes(days, period) }));
}

/** Minutes logged in the month itself; spill-over days in the grid are left out. */
export function monthTotal(days: readonly DayTotal[], year: number, month: number): number {
  return sumMinutes(days, monthRange(year, month));
}

/** The first `n` tasks (a day's tasks are already largest first) and how many are left over. */
export function topTasks(
  dayTasks: readonly TaskTotal[],
  n: number,
): { shown: TaskTotal[]; moreCount: number } {
  return { shown: dayTasks.slice(0, n), moreCount: Math.max(0, dayTasks.length - n) };
}

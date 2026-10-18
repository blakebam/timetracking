import {
  addDays,
  isoDateSchema,
  startOfWeekIso,
  timesheetPeriod,
  weekRange,
  type IsoDate,
  type Period,
} from '@tt/shared';

export type WeekMode = 'timesheet' | 'full';

export interface WeekLocation {
  mode: WeekMode;
  /** The first day shown: the period's start (timesheet) or the week's Monday (full). */
  start: IsoDate;
}

/** The days shown for `anchor`: its timesheet period, or its whole Mon–Sun week. */
export function rangeFor(mode: WeekMode, anchor: IsoDate): Period {
  return mode === 'timesheet' ? timesheetPeriod(anchor) : weekRange(anchor);
}

/** The location that shows `anchor` in `mode`. */
export function locationFor(mode: WeekMode, anchor: IsoDate): WeekLocation {
  return { mode, start: rangeFor(mode, anchor).from };
}

/**
 * Reads `?start=&mode=`. A missing or invalid mode means timesheet; a missing or invalid start
 * means today. `canonical` is false when the URL should be replaced with `weekSearch(location)`.
 */
export function parseWeekSearch(
  params: URLSearchParams,
  today: IsoDate,
): { location: WeekLocation; canonical: boolean } {
  const rawMode = params.get('mode');
  const mode: WeekMode = rawMode === 'full' ? 'full' : 'timesheet';
  const parsedStart = isoDateSchema.safeParse(params.get('start'));
  const location = locationFor(mode, parsedStart.success ? parsedStart.data : today);
  const canonical =
    parsedStart.success &&
    parsedStart.data === location.start &&
    (rawMode === null || rawMode === mode);
  return { location, canonical };
}

/** The query string for a location. Timesheet is the default, so it is left out. */
export function weekSearch({ mode, start }: WeekLocation): string {
  const params = new URLSearchParams({ start });
  if (mode === 'full') params.set('mode', 'full');
  return `?${params}`;
}

/** The adjacent location: the next or previous timesheet period, or the week 7 days away. */
export function stepLocation({ mode, start }: WeekLocation, direction: -1 | 1): WeekLocation {
  if (mode === 'full') return { mode, start: addDays(start, 7 * direction) };
  const { from, to } = timesheetPeriod(start);
  return locationFor(mode, direction === 1 ? addDays(to, 1) : addDays(from, -1));
}

/** The same anchor date shown in the other mode. */
export function switchMode(location: WeekLocation, mode: WeekMode): WeekLocation {
  return locationFor(mode, location.start);
}

/**
 * For a timesheet period cut by a month boundary, the other half of its billing week:
 * `after` when the week continues into the next month, `before` when it began in the previous
 * one. Null for a period that is a whole week.
 */
export function otherHalf(period: Period): { side: 'before' | 'after'; period: Period } | null {
  const week = weekRange(period.from);
  if (period.to < week.to) return { side: 'after', period: timesheetPeriod(addDays(period.to, 1)) };
  if (period.from > week.from) return { side: 'before', period: timesheetPeriod(week.from) };
  return null;
}

/** Whether two consecutive days are in different months. */
export const startsNewMonth = (prev: IsoDate, d: IsoDate) => prev.slice(0, 7) !== d.slice(0, 7);

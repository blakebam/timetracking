import {
  durationMinutes,
  END_TIMES,
  fromMinutes,
  toMinutes,
  type EndTime,
  type StartTime,
  type TimeEntry,
  type TimeOfDay,
  type ValidationIssue,
} from '@tt/shared';

export interface TimeDefaults {
  start: StartTime;
  end: EndTime;
}

/** `start + 1 h`, capped at the end of the day. */
export function defaultEnd(start: StartTime): EndTime {
  return fromMinutes(Math.min(toMinutes(start) + 60, 1440)) as EndTime;
}

/** The unlogged stretches of the day, in minutes since midnight, earliest first. */
function freeGaps(entries: readonly TimeEntry[]): { from: number; to: number }[] {
  const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const gaps: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const e of sorted) {
    const start = toMinutes(e.startTime);
    if (start > cursor) gaps.push({ from: cursor, to: start });
    cursor = Math.max(cursor, toMinutes(e.endTime));
  }
  if (cursor < 1440) gaps.push({ from: cursor, to: 1440 });
  return gaps;
}

/**
 * The next entry starts where the day's latest entry ends, or at `defaultStartTime` on an
 * empty day. When the latest entry runs to midnight, it starts in the first free gap at or
 * after `defaultStartTime` (else the earliest gap), and ends no later than the gap does.
 * Null only when the whole day is logged.
 */
export function smartDefaults(
  entries: readonly TimeEntry[],
  defaultStartTime: StartTime,
): TimeDefaults | null {
  const latestEnd = entries.reduce<EndTime | null>(
    (max, e) => (max === null || e.endTime > max ? e.endTime : max),
    null,
  );
  if (latestEnd !== '24:00') {
    const start = (latestEnd ?? defaultStartTime) as StartTime;
    return { start, end: defaultEnd(start) };
  }

  const gaps = freeGaps(entries);
  if (gaps.length === 0) return null;
  const preferred = toMinutes(defaultStartTime);
  const later = gaps.find((g) => g.to > preferred);
  const gap = later ?? gaps[0]!;
  const start = later ? Math.max(gap.from, preferred) : gap.from;
  return {
    start: fromMinutes(start) as StartTime,
    end: fromMinutes(Math.min(start + 60, gap.to)) as EndTime,
  };
}

/** End times strictly after `start` (all of them when there's no valid start yet). */
export function endOptionsAfter(start: TimeOfDay | null): EndTime[] {
  return start === null ? [...END_TIMES] : END_TIMES.filter((t) => t > start);
}

export function totalMinutes(entries: readonly TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + durationMinutes(e.startTime, e.endTime), 0);
}

export const FORM_FIELDS = ['startTime', 'endTime', 'taskName', 'notes'] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export type FieldErrors = Partial<Record<FormField, string>>;

/** Splits validation issues into per-field errors (first one wins) and the rest, for the banner. */
export function splitIssues(issues: readonly ValidationIssue[]): {
  fieldErrors: FieldErrors;
  other: string[];
} {
  const fieldErrors: FieldErrors = {};
  const other: string[] = [];
  for (const issue of issues) {
    const field = FORM_FIELDS.find((f) => f === issue.path);
    if (field) fieldErrors[field] ??= issue.message;
    else other.push(issue.message);
  }
  return { fieldErrors, other };
}

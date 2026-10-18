import { z } from 'zod';

type Hour =
  | '00'
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'
  | '21'
  | '22'
  | '23';
type Quarter = '00' | '15' | '30' | '45';

/** Exact set of 97 allowed times: 00:00 … 23:45, plus 24:00 (end of day). */
export type TimeOfDay = `${Hour}:${Quarter}` | '24:00';
export type StartTime = Exclude<TimeOfDay, '24:00'>;
export type EndTime = Exclude<TimeOfDay, '00:00'>;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** All valid times in order: 00:00, 00:15, …, 23:45, 24:00. */
export const TIMES_OF_DAY: readonly TimeOfDay[] = Array.from(
  { length: 97 },
  (_, i) => `${pad2(Math.floor(i / 4))}:${pad2((i % 4) * 15)}` as TimeOfDay,
);
export const START_TIMES: readonly StartTime[] = TIMES_OF_DAY.filter(
  (t): t is StartTime => t !== '24:00',
);
export const END_TIMES: readonly EndTime[] = TIMES_OF_DAY.filter(
  (t): t is EndTime => t !== '00:00',
);

const TIME_SET: ReadonlySet<string> = new Set(TIMES_OF_DAY);

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === 'string' && TIME_SET.has(value);
}

export const startTimeSchema = z.custom<StartTime>(
  (v) => isTimeOfDay(v) && v !== '24:00',
  'Start time must be HH:MM in 15-minute steps, from 00:00 to 23:45',
);

export const endTimeSchema = z.custom<EndTime>(
  (v) => isTimeOfDay(v) && v !== '00:00',
  'End time must be HH:MM in 15-minute steps, from 00:15 to 24:00',
);

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(s: string): boolean {
  const match = ISO_DATE_RE.exec(s);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1900) return false; // Date.UTC maps years 0–99 to 1900–1999
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** A validated, real calendar date 'YYYY-MM-DD'. Only obtainable via isoDateSchema / isoDate(). */
export const isoDateSchema = z
  .string('Date must be YYYY-MM-DD')
  .regex(ISO_DATE_RE, 'Date must be YYYY-MM-DD')
  .refine(isRealDate, 'Not a real calendar date')
  .brand<'IsoDate'>();
export type IsoDate = z.infer<typeof isoDateSchema>;

/** Parse-or-throw constructor for code and tests. */
export function isoDate(s: string): IsoDate {
  const result = isoDateSchema.safeParse(s);
  if (!result.success) throw new RangeError(`Invalid date: "${s}"`);
  return result.data;
}

/** The local calendar date of a JS Date. */
export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` as IsoDate;
}

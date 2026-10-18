import { describe, expect, it } from 'vitest';
import {
  END_TIMES,
  START_TIMES,
  TIMES_OF_DAY,
  endTimeSchema,
  isoDate,
  isoDateSchema,
  startTimeSchema,
  toIsoDate,
  type IsoDate,
  type StartTime,
  type EndTime,
} from './primitives';

describe('time lists', () => {
  it('covers 00:00 to 24:00 in 15-minute steps', () => {
    expect(TIMES_OF_DAY).toHaveLength(97);
    expect(TIMES_OF_DAY[0]).toBe('00:00');
    expect(TIMES_OF_DAY[1]).toBe('00:15');
    expect(TIMES_OF_DAY.at(-2)).toBe('23:45');
    expect(TIMES_OF_DAY.at(-1)).toBe('24:00');
  });

  it('excludes 24:00 from start times and 00:00 from end times', () => {
    expect(START_TIMES).toHaveLength(96);
    expect(START_TIMES).not.toContain('24:00');
    expect(END_TIMES).toHaveLength(96);
    expect(END_TIMES).not.toContain('00:00');
  });
});

describe('time schemas', () => {
  it.each(['00:00', '09:15', '23:45'])('accepts start %s', (t) => {
    expect(startTimeSchema.safeParse(t).success).toBe(true);
  });

  it.each(['24:00', '08:10', '8:00', '25:00', '', 900, null])('rejects start %s', (t) => {
    expect(startTimeSchema.safeParse(t).success).toBe(false);
  });

  it.each(['00:15', '12:30', '24:00'])('accepts end %s', (t) => {
    expect(endTimeSchema.safeParse(t).success).toBe(true);
  });

  it.each(['00:00', '24:15', '10:05'])('rejects end %s', (t) => {
    expect(endTimeSchema.safeParse(t).success).toBe(false);
  });
});

describe('isoDate', () => {
  it('accepts real dates, including leap days', () => {
    expect(isoDate('2026-10-17')).toBe('2026-10-17');
    expect(isoDate('2028-02-29')).toBe('2028-02-29');
  });

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-1-5',
    '0099-01-01',
    'abc',
  ])('rejects %s', (s) => {
    expect(() => isoDate(s)).toThrow(RangeError);
    expect(isoDateSchema.safeParse(s).success).toBe(false);
  });

  it('formats a local Date as its local calendar date', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

// Type-level checks: these lines must fail to compile (verified by `npm run typecheck`).
describe('type-level guarantees', () => {
  it('compiles only valid values', () => {
    // @ts-expect-error 08:10 is not on the 15-minute grid
    const badGrid: StartTime = '08:10';
    // @ts-expect-error 24:00 is only valid as an end time
    const badStart: StartTime = '24:00';
    // @ts-expect-error 00:00 is only valid as a start time
    const badEnd: EndTime = '00:00';
    // @ts-expect-error a plain string is not an IsoDate; it must go through isoDate()
    const badDate: IsoDate = '2026-10-17';

    const okStart: StartTime = '23:45';
    const okEnd: EndTime = '24:00';
    expect([badGrid, badStart, badEnd, badDate, okStart, okEnd]).toHaveLength(6);
  });
});

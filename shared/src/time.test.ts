import { describe, expect, it } from 'vitest';
import { TIMES_OF_DAY } from './primitives';
import {
  durationMinutes,
  formatHours,
  formatHoursCompact,
  formatRange12,
  formatTime12,
  fromMinutes,
  toMinutes,
} from './time';

describe('toMinutes / fromMinutes', () => {
  it('round-trips every valid time', () => {
    for (const t of TIMES_OF_DAY) expect(fromMinutes(toMinutes(t))).toBe(t);
  });

  it('maps the day boundaries', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('24:00')).toBe(1440);
  });

  it.each([10, -15, 1455, 7.5])('rejects %s minutes', (n) => {
    expect(() => fromMinutes(n)).toThrow(RangeError);
  });
});

describe('durationMinutes', () => {
  it('measures to the end of the day', () => {
    expect(durationMinutes('23:45', '24:00')).toBe(15);
    expect(durationMinutes('09:00', '17:30')).toBe(510);
  });
});

describe('formatHours', () => {
  it.each([
    [0, '0.00'],
    [15, '0.25'],
    [90, '1.50'],
    [1890, '31.50'],
  ])('%i minutes → %s', (min, out) => {
    expect(formatHours(min)).toBe(out);
  });
});

describe('formatHoursCompact', () => {
  it.each([
    [0, '0'],
    [15, '0.25'],
    [30, '0.5'],
    [45, '0.75'],
    [60, '1'],
    [990, '16.5'],
    [1905, '31.75'],
    [2940, '49'],
    [60_000, '1000'],
  ])('%i minutes → %s', (min, out) => {
    expect(formatHoursCompact(min)).toBe(out);
  });
});

describe('formatTime12', () => {
  it.each([
    ['00:00', '12:00 AM'],
    ['00:15', '12:15 AM'],
    ['09:15', '9:15 AM'],
    ['11:45', '11:45 AM'],
    ['12:00', '12:00 PM'],
    ['12:15', '12:15 PM'],
    ['13:30', '1:30 PM'],
    ['23:45', '11:45 PM'],
    ['24:00', '12:00 AM'],
  ] as const)('%s → %s', (t, out) => {
    expect(formatTime12(t)).toBe(out);
  });

  it('formats ranges', () => {
    expect(formatRange12('09:00', '10:30')).toBe('9:00 AM – 10:30 AM');
  });
});

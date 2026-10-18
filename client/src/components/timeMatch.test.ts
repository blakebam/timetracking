import { END_TIMES, START_TIMES, type EndTime, type TimeOfDay } from '@tt/shared';
import { describe, expect, it } from 'vitest';
import { matchTimes } from './timeMatch';

const endOptionsAfter = (start: TimeOfDay): EndTime[] => END_TIMES.filter((t) => t > start);

const best = (
  input: string,
  reference: TimeOfDay = '11:00',
  options: readonly TimeOfDay[] = START_TIMES,
) => matchTimes(input, options, reference)[0];

describe('matchTimes', () => {
  it.each([
    ['110', '11:00'],
    ['110p', '23:00'],
    ['130', '13:30'],
    ['1:1', '13:15'],
    ['9', '09:00'],
    ['1245', '12:45'],
    ['12', '12:00'],
    ['12a', '00:00'],
    ['1', '13:00'],
    ['11:30 AM', '11:30'],
    ['3pm', '15:00'],
    ['  2 : 4 5 p ', '14:45'],
  ])('%o → %s (reference 11:00 AM)', (input, expected) => {
    expect(best(input)).toBe(expected);
  });

  it('uses the end options when matching an End time', () => {
    const options = endOptionsAfter('09:00');
    expect(best('5', '09:00', options)).toBe('17:00');
    expect(matchTimes('5', options, '09:00')).not.toContain('05:00');
  });

  it('matches the end of day as 12:00 AM', () => {
    const options = endOptionsAfter('22:00');
    expect(best('12', '22:00', options)).toBe('24:00');
  });

  it.each(['99', '14:', '1:7', 'abc', '1::0', 'x1'])('finds nothing for %o', (input) => {
    expect(matchTimes(input, START_TIMES, '11:00')).toEqual([]);
  });

  it('returns every option for an empty input, nearest the reference first', () => {
    const result = matchTimes('', START_TIMES, '11:00');
    expect(result).toHaveLength(START_TIMES.length);
    expect(result.slice(0, 5)).toEqual(['11:00', '11:15', '10:45', '11:30', '10:30']);
  });

  it('never offers end times at or before the start', () => {
    for (const start of START_TIMES) {
      const options = endOptionsAfter(start);
      expect(options.every((t) => t > start)).toBe(true);
      expect(matchTimes('', options, start).every((t) => t > start)).toBe(true);
    }
  });
});

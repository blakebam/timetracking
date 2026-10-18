import type { EndTime, IsoDate, StartTime, TimeEntry } from '@tt/shared';
import { describe, expect, it } from 'vitest';
import { defaultEnd, endOptionsAfter, smartDefaults, splitIssues, totalMinutes } from './dayLogic';

let nextId = 1;
const entry = (startTime: StartTime, endTime: EndTime): TimeEntry => ({
  id: nextId++,
  date: '2026-10-17' as IsoDate,
  startTime,
  endTime,
  taskName: 'Task',
  notes: null,
  createdAt: '',
  updatedAt: '',
});

describe('smartDefaults', () => {
  it('uses defaultStartTime on an empty day', () => {
    expect(smartDefaults([], '11:00')).toEqual({ start: '11:00', end: '12:00' });
    expect(smartDefaults([], '08:30')).toEqual({ start: '08:30', end: '09:30' });
  });

  it('starts where the latest entry ends, whatever the input order', () => {
    const entries = [entry('13:00', '14:30'), entry('09:00', '10:00'), entry('10:00', '12:00')];
    expect(smartDefaults(entries, '11:00')).toEqual({ start: '14:30', end: '15:30' });
  });

  it('caps the end at 24:00', () => {
    expect(smartDefaults([entry('20:00', '23:30')], '11:00')).toEqual({
      start: '23:30',
      end: '24:00',
    });
    expect(defaultEnd('23:45')).toBe('24:00');
  });

  it('uses a free gap when the latest entry ends at midnight', () => {
    // The default start is free: use it.
    expect(smartDefaults([entry('09:00', '10:00'), entry('22:00', '24:00')], '11:00')).toEqual({
      start: '11:00',
      end: '12:00',
    });
    // The default start is taken: the next gap after it, ending where the gap ends.
    expect(
      smartDefaults(
        [entry('10:00', '11:30'), entry('11:45', '24:00'), entry('08:00', '09:00')],
        '11:00',
      ),
    ).toEqual({ start: '11:30', end: '11:45' });
    // Nothing free at or after the default start: the earliest gap.
    expect(smartDefaults([entry('06:00', '24:00')], '11:00')).toEqual({
      start: '00:00',
      end: '01:00',
    });
  });

  it('is null when the whole day is logged', () => {
    expect(smartDefaults([entry('00:00', '12:00'), entry('12:00', '24:00')], '11:00')).toBeNull();
  });
});

describe('endOptionsAfter', () => {
  it('offers only later times', () => {
    expect(endOptionsAfter('23:00')).toEqual(['23:15', '23:30', '23:45', '24:00']);
    expect(endOptionsAfter(null)).toHaveLength(96);
  });
});

describe('totalMinutes', () => {
  it('sums durations', () => {
    expect(totalMinutes([])).toBe(0);
    expect(totalMinutes([entry('09:00', '10:00'), entry('12:00', '14:30')])).toBe(210);
  });
});

describe('splitIssues', () => {
  it('maps known fields and leaves the rest for the banner', () => {
    expect(
      splitIssues([
        { path: 'endTime', message: 'End time must be after start time' },
        { path: 'endTime', message: 'second' },
        { path: 'date', message: 'Not a real calendar date' },
        { path: '', message: 'Request body is not valid JSON' },
      ]),
    ).toEqual({
      fieldErrors: { endTime: 'End time must be after start time' },
      other: ['Not a real calendar date', 'Request body is not valid JSON'],
    });
  });
});

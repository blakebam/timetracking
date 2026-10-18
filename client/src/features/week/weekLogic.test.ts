import { isoDate } from '@tt/shared';
import { describe, expect, it } from 'vitest';
import {
  otherHalf,
  parseWeekSearch,
  rangeFor,
  stepLocation,
  switchMode,
  weekSearch,
  type WeekLocation,
} from './weekLogic';

const TODAY = isoDate('2026-10-28'); // a Wednesday

const parse = (search: string) => parseWeekSearch(new URLSearchParams(search), TODAY);
const loc = (mode: WeekLocation['mode'], start: string): WeekLocation => ({
  mode,
  start: isoDate(start),
});

describe('parseWeekSearch', () => {
  it.each([
    // timesheet: the period's first day (the Monday, or the 1st when the week began last month)
    ['?start=2026-10-28', loc('timesheet', '2026-10-26'), false],
    ['?start=2026-10-26', loc('timesheet', '2026-10-26'), true],
    ['?start=2026-11-01', loc('timesheet', '2026-11-01'), true],
    ['?start=2026-11-04', loc('timesheet', '2026-11-02'), false],
    ['?start=2026-10-02', loc('timesheet', '2026-10-01'), false],
    ['?start=2026-10-26&mode=timesheet', loc('timesheet', '2026-10-26'), true],
    // full: the Monday, even in the previous month
    ['?start=2026-11-01&mode=full', loc('full', '2026-10-26'), false],
    ['?start=2026-10-26&mode=full', loc('full', '2026-10-26'), true],
    // missing or invalid values
    ['', loc('timesheet', '2026-10-26'), false],
    ['?mode=full', loc('full', '2026-10-26'), false],
    ['?start=2026-02-30', loc('timesheet', '2026-10-26'), false],
    ['?start=2026-10-26&mode=monthly', loc('timesheet', '2026-10-26'), false],
  ])('%s → %o (canonical: %s)', (search, location, canonical) => {
    expect(parse(search)).toEqual({ location, canonical });
  });

  it('round-trips through weekSearch', () => {
    for (const l of [loc('timesheet', '2026-11-01'), loc('full', '2026-10-26')]) {
      expect(parse(weekSearch(l))).toEqual({ location: l, canonical: true });
    }
    expect(weekSearch(loc('timesheet', '2026-11-01'))).toBe('?start=2026-11-01');
    expect(weekSearch(loc('full', '2026-10-26'))).toBe('?start=2026-10-26&mode=full');
  });
});

describe('stepLocation', () => {
  it('walks timesheet periods across a month boundary', () => {
    const steps = [loc('timesheet', '2026-10-26')];
    for (let i = 0; i < 2; i++) steps.push(stepLocation(steps.at(-1)!, 1));
    expect(steps.map((l) => rangeFor(l.mode, l.start))).toEqual([
      { from: '2026-10-26', to: '2026-10-31' },
      { from: '2026-11-01', to: '2026-11-01' },
      { from: '2026-11-02', to: '2026-11-08' },
    ]);
    expect(stepLocation(steps[2]!, -1)).toEqual(steps[1]);
    expect(stepLocation(steps[1]!, -1)).toEqual(steps[0]);
  });

  it('moves a full week by 7 days', () => {
    expect(stepLocation(loc('full', '2026-10-26'), 1)).toEqual(loc('full', '2026-11-02'));
    expect(stepLocation(loc('full', '2026-10-26'), -1)).toEqual(loc('full', '2026-10-19'));
  });
});

describe('switchMode', () => {
  it('keeps the anchor date', () => {
    expect(switchMode(loc('timesheet', '2026-11-01'), 'full')).toEqual(loc('full', '2026-10-26'));
    expect(switchMode(loc('full', '2026-10-26'), 'timesheet')).toEqual(
      loc('timesheet', '2026-10-26'),
    );
    expect(switchMode(loc('timesheet', '2026-11-02'), 'full')).toEqual(loc('full', '2026-11-02'));
  });
});

describe('otherHalf', () => {
  const p = (from: string, to: string) => ({ from: isoDate(from), to: isoDate(to) });

  it('links the two halves of a split week', () => {
    expect(otherHalf(p('2026-10-26', '2026-10-31'))).toEqual({
      side: 'after',
      period: p('2026-11-01', '2026-11-01'),
    });
    expect(otherHalf(p('2026-11-01', '2026-11-01'))).toEqual({
      side: 'before',
      period: p('2026-10-26', '2026-10-31'),
    });
  });

  it('is null for a whole week', () => {
    expect(otherHalf(p('2026-11-02', '2026-11-08'))).toBeNull();
  });
});

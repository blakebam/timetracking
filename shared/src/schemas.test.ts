import { describe, expect, it } from 'vitest';
import { daysBetween, formatShortDate } from './dates';
import { isoDate } from './primitives';
import {
  entryInputSchema,
  idParamSchema,
  rangeQuerySchema,
  settingsInputSchema,
  taskNamesQuerySchema,
} from './schemas';

const valid = {
  date: '2026-10-17',
  startTime: '09:00',
  endTime: '10:00',
  taskName: 'Meeting',
  notes: 'Standup',
};

const issuesFor = (input: unknown) => {
  const result = entryInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('entryInputSchema', () => {
  it('accepts a valid entry', () => {
    expect(entryInputSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ['startTime', { startTime: '08:10' }],
    ['startTime', { startTime: '24:00' }],
    ['endTime', { endTime: '24:15' }],
    ['endTime', { startTime: '00:00', endTime: '00:00' }],
    ['endTime', { endTime: '09:00' }],
    ['endTime', { endTime: '08:45' }],
    ['taskName', { taskName: '   ' }],
    ['taskName', { taskName: undefined }],
    ['taskName', { taskName: 'x'.repeat(101) }],
    ['date', { date: '2026-13-01' }],
    ['date', { date: '2026-02-29' }],
    ['notes', { notes: 'x'.repeat(1001) }],
  ])('rejects bad %s: %o', (field, override) => {
    expect(issuesFor({ ...valid, ...override })).toContain(field);
  });

  it('explains why the end time is wrong', () => {
    const result = entryInputSchema.safeParse({ ...valid, endTime: '08:00' });
    expect(result.error?.issues[0]?.message).toBe('End time must be after start time');
  });

  it('accepts the last slot of the day and leap days', () => {
    expect(
      entryInputSchema.safeParse({
        ...valid,
        date: '2028-02-29',
        startTime: '23:45',
        endTime: '24:00',
      }).success,
    ).toBe(true);
  });

  it('normalizes whitespace in the task name', () => {
    expect(entryInputSchema.parse({ ...valid, taskName: '  Team   meeting ' }).taskName).toBe(
      'Team meeting',
    );
  });

  it.each([undefined, null, '', '   '])('turns notes %o into null', (notes) => {
    expect(entryInputSchema.parse({ ...valid, notes }).notes).toBeNull();
  });
});

describe('rangeQuerySchema', () => {
  it('accepts a single day and a full year', () => {
    expect(rangeQuerySchema.safeParse({ from: '2026-10-17', to: '2026-10-17' }).success).toBe(true);
    expect(rangeQuerySchema.safeParse({ from: '2028-01-01', to: '2028-12-31' }).success).toBe(true);
  });

  it('rejects reversed and over-long ranges', () => {
    expect(rangeQuerySchema.safeParse({ from: '2026-10-18', to: '2026-10-17' }).success).toBe(
      false,
    );
    expect(rangeQuerySchema.safeParse({ from: '2026-01-01', to: '2027-01-02' }).success).toBe(
      false,
    );
  });
});

describe('idParamSchema', () => {
  it('coerces numeric strings and rejects others', () => {
    expect(idParamSchema.parse({ id: '42' })).toEqual({ id: 42 });
    for (const id of ['abc', '0', '-1', '1.5']) {
      expect(idParamSchema.safeParse({ id }).success).toBe(false);
    }
  });
});

describe('taskNamesQuerySchema', () => {
  it('defaults and bounds the limit', () => {
    expect(taskNamesQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(taskNamesQuerySchema.parse({ q: 'me', limit: '5' })).toEqual({ q: 'me', limit: 5 });
    expect(taskNamesQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });
});

describe('date helpers', () => {
  it('counts days across DST changes', () => {
    expect(daysBetween(isoDate('2026-03-07'), isoDate('2026-03-09'))).toBe(2);
    expect(daysBetween(isoDate('2026-10-31'), isoDate('2026-11-02'))).toBe(2);
  });

  it('formats short dates', () => {
    expect(formatShortDate(isoDate('2026-10-17'))).toBe('Sat, Oct 17');
  });
});

describe('settingsInputSchema', () => {
  const settings = {
    billerName: 'Jane Doe',
    billerAddress: '123 Main St\nSpringfield TX\n75000',
    billerPhone: '555-555-5555',
    billerEmail: 'jane@example.com',
    companyName: 'Acme LLC',
    companyAddress: '',
    hourlyRateCents: 1000,
    paymentTerms: 'On Receipt',
    nextInvoiceNumber: 26,
    defaultStartTime: '11:00',
  };

  const settingsIssues = (override: Record<string, unknown>) => {
    const result = settingsInputSchema.safeParse({ ...settings, ...override });
    return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
  };

  it('accepts valid settings, and blanks where allowed', () => {
    expect(settingsInputSchema.parse(settings)).toEqual(settings);
    expect(
      settingsIssues({ billerName: '', billerEmail: '', companyName: '', hourlyRateCents: 0 }),
    ).toEqual([]);
  });

  it.each([
    ['billerEmail', { billerEmail: 'jane@' }],
    ['billerName', { billerName: 'x'.repeat(101) }],
    ['billerAddress', { billerAddress: 'x'.repeat(501) }],
    ['billerPhone', { billerPhone: 'x'.repeat(51) }],
    ['defaultStartTime', { defaultStartTime: '08:10' }],
    ['defaultStartTime', { defaultStartTime: '24:00' }],
    ['hourlyRateCents', { hourlyRateCents: -1 }],
    ['hourlyRateCents', { hourlyRateCents: 1_000_001 }],
    ['hourlyRateCents', { hourlyRateCents: 35.5 }],
    ['paymentTerms', { paymentTerms: '   ' }],
    ['nextInvoiceNumber', { nextInvoiceNumber: 0 }],
    ['nextInvoiceNumber', { nextInvoiceNumber: '26' }],
  ])('rejects bad %s: %o', (field, override) => {
    expect(settingsIssues(override)).toContain(field);
  });

  it('trims fields and normalizes address line endings', () => {
    const parsed = settingsInputSchema.parse({
      ...settings,
      billerEmail: ' jane@example.com ',
      billerAddress: '  123 Main St  \r\nSpringfield TX\r\n',
    });
    expect(parsed.billerEmail).toBe('jane@example.com');
    expect(parsed.billerAddress).toBe('123 Main St\nSpringfield TX');
  });
});

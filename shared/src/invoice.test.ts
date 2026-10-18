import { describe, expect, it } from 'vitest';
import { monthRange } from './dates';
import { SEPTEMBER_2026_ENTRIES, SEPTEMBER_2026_SETTINGS } from './fixtures/september2026';
import {
  buildInvoiceDraft,
  defaultInvoiceDate,
  formatInvoiceNumber,
  invoiceProblems,
  lineAmountCents,
} from './invoice';
import { formatUsd } from './money';
import { isoDate } from './primitives';
import { summarize } from './summary';
import type { Settings, TimeEntry } from './types';

const settings: Settings = { ...SEPTEMBER_2026_SETTINGS, updatedAt: '2026-10-01T00:00:00Z' };

const entries: TimeEntry[] = SEPTEMBER_2026_ENTRIES.map((e, i) => ({
  ...e,
  id: i + 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}));

const september = monthRange(2026, 9);
const summary = summarize(entries, september.from, september.to);
const OCT_1 = isoDate('2026-10-01');

describe('buildInvoiceDraft', () => {
  it('reproduces the September 2026 example invoice', () => {
    const draft = buildInvoiceDraft(summary, settings, OCT_1);
    expect(draft.lines.map((l) => [l.taskName, l.minutes / 60, formatUsd(l.amountCents)])).toEqual([
      ['Meetings', 3, '$30.00'],
      ['Report Writing', 31.5, '$315.00'],
      ['Data Entry', 2.5, '$25.00'],
      ['Research', 5, '$50.00'],
      ['Planning', 2, '$20.00'],
      ['Design Review', 4, '$40.00'],
      ['Email Support', 1, '$10.00'],
    ]);
    expect(draft.lines.every((l) => l.rateCents === 1000)).toBe(true);
    expect(draft).toMatchObject({
      invoiceNumber: 25,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      invoiceDate: '2026-10-01',
      totalMinutes: 49 * 60,
      amountCents: 49_000,
      biller: { name: 'Jane Doe', email: 'jane.doe@example.com' },
      company: { name: 'Example Company LLC' },
      paymentTerms: 'On Receipt',
    });
  });

  it('makes the line amounts add up to the total, even when lines round', () => {
    for (const rate of [1001, 3333, 4999, 1, 12_345]) {
      const draft = buildInvoiceDraft(summary, { ...settings, hourlyRateCents: rate }, OCT_1);
      const sum = draft.lines.reduce((s, l) => s + l.amountCents, 0);
      expect(draft.amountCents).toBe(sum);
      expect(draft.lines.every((l) => Number.isInteger(l.amountCents))).toBe(true);
    }
  });

  it('has no lines for an empty month', () => {
    const empty = summarize([], september.from, september.to);
    const draft = buildInvoiceDraft(empty, settings, OCT_1);
    expect(draft).toMatchObject({ lines: [], totalMinutes: 0, amountCents: 0 });
  });
});

describe('lineAmountCents', () => {
  it.each([
    [15, 1001, 250], // 250.25 → 250
    [45, 1001, 751], // 750.75 → 751
    [30, 1001, 501], // 500.5 → 501 (half up)
    [60, 1000, 1000],
    [1890, 1000, 31_500],
  ])('%i min at %i¢/h → %i¢', (minutes, rate, cents) => {
    expect(lineAmountCents(minutes, rate)).toBe(cents);
  });
});

describe('formatInvoiceNumber', () => {
  it.each([
    [1, 'INV0001'],
    [25, 'INV0025'],
    [9999, 'INV9999'],
    [12345, 'INV12345'],
  ])('%i → %s', (n, label) => {
    expect(formatInvoiceNumber(n)).toBe(label);
  });
});

describe('defaultInvoiceDate', () => {
  it('is the 1st of the following month', () => {
    expect(defaultInvoiceDate(2026, 9)).toBe('2026-10-01');
    expect(defaultInvoiceDate(2026, 12)).toBe('2027-01-01');
  });
});

describe('invoiceProblems', () => {
  const draft = buildInvoiceDraft(summary, settings, OCT_1);

  it('is empty when the invoice can be issued', () => {
    expect(invoiceProblems(draft, settings, null)).toEqual([]);
  });

  it('reports every reason the invoice cannot be issued', () => {
    const blank = { ...settings, billerName: '', companyName: '', hourlyRateCents: 0 };
    const emptyDraft = buildInvoiceDraft(summarize([], september.from, september.to), blank, OCT_1);
    expect(invoiceProblems(emptyDraft, blank, { invoiceNumber: 25 })).toEqual([
      'Set your name in Settings',
      'Set the company name in Settings',
      'Set an hourly rate in Settings',
      'No time logged in September 2026',
      'September 2026 was already invoiced as INV0025',
    ]);
  });
});

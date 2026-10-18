import {
  buildInvoiceDraft,
  isoDate,
  summarize,
  timesheetPeriods,
  type InvoiceDraft,
  type TimeEntry,
} from '@tt/shared';
import { SEPTEMBER_2026_ENTRIES, SEPTEMBER_2026_SETTINGS } from '@tt/shared/fixtures/september2026';
import { describe, expect, it } from 'vitest';
import { pdfText } from './pdfText';
import { invoiceFilename, renderInvoice, renderTimesheet, timesheetFilename } from './render';

const entries: TimeEntry[] = SEPTEMBER_2026_ENTRIES.map((e, i) => ({
  ...e,
  id: i + 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}));

const september = (from = '2026-09-01', to = '2026-09-30') =>
  summarize(entries, isoDate(from), isoDate(to));

const exampleInvoice = (): InvoiceDraft =>
  buildInvoiceDraft(
    september(),
    { ...SEPTEMBER_2026_SETTINGS, updatedAt: '' },
    isoDate('2026-10-01'),
  );

/** The text of the reference timesheets, which these must reproduce exactly. */
const EXAMPLE_TIMESHEETS = [
  '9/1-9/6 Weekly Timesheet Items Hours Meetings 1 Report Writing 16.5 Data Entry 0.5 Total 18',
  '9/7-9/13 Weekly Timesheet Items Hours Meetings 0.5 Report Writing 9 Data Entry 2 ' +
    'Research 1 Planning 2 Total 14.5',
  '9/14-9/20 Weekly Timesheet Items Hours Total 0',
  '9/21-9/27 Weekly Timesheet Items Hours Total 0',
  '9/28-9/30 Weekly Timesheet Items Hours Meetings 1.5 Research 4 Design Review 4 ' +
    'Email Support 1 Report Writing 6 Total 16.5',
];

/**
 * September_Invoice.pdf's text with the placeholder biller and company, in reading order, and with
 * the deliberate differences: every amount has 2 decimals.
 */
const EXAMPLE_INVOICE =
  'Jane Doe 123 Main St Springfield, TX 75000 555-555-0100 jane.doe@example.com ' +
  'INVOICE INV0025 DATE October 1, 2026 DUE On Receipt BALANCE DUE USD $490.00 ' +
  'BILL TO Example Company LLC 456 Commerce Ave Springfield, TX 75001 ' +
  'Items Worked RATE QTY AMOUNT ' +
  'Meetings $10.00 3 $30.00 ' +
  'Report Writing $10.00 31.5 $315.00 ' +
  'Data Entry $10.00 2.5 $25.00 ' +
  'Research $10.00 5 $50.00 ' +
  'Planning $10.00 2 $20.00 ' +
  'Design Review $10.00 4 $40.00 ' +
  'Email Support $10.00 1 $10.00 ' +
  'TOTAL 49 Hours USD $490.00';

describe('renderTimesheet', () => {
  it.each(timesheetPeriods(2026, 9).map((p, i) => [p.from, p.to, EXAMPLE_TIMESHEETS[i]!]))(
    'reproduces the example timesheet for %s … %s',
    async (from, to, text) => {
      expect(await pdfText(await renderTimesheet(september(from, to)))).toEqual([text]);
    },
  );

  it('continues a long list onto another page, repeating the header', async () => {
    const many: TimeEntry[] = Array.from({ length: 40 }, (_, i) => ({
      ...entries[0]!,
      id: i + 1,
      date: isoDate(`2026-09-0${1 + (i % 6)}`),
      startTime: `${String(6 + Math.floor(i / 6)).padStart(2, '0')}:00` as TimeEntry['startTime'],
      endTime: `${String(6 + Math.floor(i / 6)).padStart(2, '0')}:45` as TimeEntry['endTime'],
      taskName: `Task ${i + 1}`,
    }));
    const pages = await pdfText(
      await renderTimesheet(summarize(many, isoDate('2026-09-01'), isoDate('2026-09-06'))),
    );
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]).toMatch(/^9\/1-9\/6 Weekly Timesheet Items Hours Task 1 0\.75/);
    expect(pages.at(-1)).toMatch(/^Items Hours .* Total 30$/);
    expect(pages.join(' ').match(/Task \d+ 0\.75/g)).toHaveLength(40);
  });
});

describe('renderInvoice', () => {
  it('reproduces the example invoice', async () => {
    expect(await pdfText(await renderInvoice(exampleInvoice()))).toEqual([EXAMPLE_INVOICE]);
  });

  it('watermarks a draft', async () => {
    expect(await pdfText(await renderInvoice(exampleInvoice(), { draft: true }))).toEqual([
      `DRAFT ${EXAMPLE_INVOICE}`,
    ]);
  });

  it('skips empty biller fields and says "1 Hour" for exactly one', async () => {
    const invoice: InvoiceDraft = {
      ...exampleInvoice(),
      lines: [{ taskName: 'Meetings', minutes: 60, rateCents: 1000, amountCents: 1000 }],
      totalMinutes: 60,
      amountCents: 1000,
      biller: { name: 'Jane Doe', address: '', phone: '', email: 'jane.doe@example.com' },
      company: { name: 'Example Company LLC', address: '' },
    };
    const [text] = await pdfText(await renderInvoice(invoice));
    expect(text).toMatch(/^Jane Doe jane\.doe@example\.com INVOICE /);
    expect(text).toContain('BILL TO Example Company LLC Items Worked');
    expect(text).toMatch(/TOTAL 1 Hour USD \$10\.00$/);
  });
});

describe('filenames', () => {
  it.each([
    ['2026-09-01', '2026-09-06', '09-01_09-06_Timesheet.pdf'],
    ['2026-09-14', '2026-09-20', '09-14_09-20_Timesheet.pdf'],
    ['2026-11-01', '2026-11-01', '11-01_11-01_Timesheet.pdf'],
  ])('names the %s … %s timesheet %s', (from, to, name) => {
    expect(timesheetFilename({ from: isoDate(from), to: isoDate(to) })).toBe(name);
  });

  it('names an invoice by its month and year', () => {
    expect(invoiceFilename({ periodStart: isoDate('2026-09-01') })).toBe(
      'September_2026_Invoice.pdf',
    );
  });
});

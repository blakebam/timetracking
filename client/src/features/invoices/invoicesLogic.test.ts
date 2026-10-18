import { isoDate, type Invoice, type InvoiceDraft } from '@tt/shared';
import { describe, expect, it } from 'vitest';
import {
  changedSinceIssued,
  defaultInvoiceMonth,
  formatNumericDate,
  issueConfirmText,
  periodLabel,
  shortPeriodLabel,
} from './invoicesLogic';

const draft: InvoiceDraft = {
  invoiceNumber: 26,
  periodStart: isoDate('2026-09-01'),
  periodEnd: isoDate('2026-09-30'),
  invoiceDate: isoDate('2026-10-01'),
  lines: [{ taskName: 'Meetings', minutes: 2940, rateCents: 1000, amountCents: 49_000 }],
  totalMinutes: 2940,
  amountCents: 49_000,
  biller: { name: 'Jane Doe', address: '', phone: '', email: '' },
  company: { name: 'Acme', address: '' },
  paymentTerms: 'On Receipt',
};

const issued: Invoice = { ...draft, invoiceNumber: 25, id: 1, issuedAt: '2026-10-01T12:00:00Z' };

describe('defaultInvoiceMonth', () => {
  it('is the month before today', () => {
    expect(defaultInvoiceMonth(isoDate('2026-10-17'))).toEqual({ year: 2026, month: 9 });
    expect(defaultInvoiceMonth(isoDate('2027-01-01'))).toEqual({ year: 2026, month: 12 });
  });
});

describe('labels', () => {
  it('formats months and dates', () => {
    expect(periodLabel(draft)).toBe('September 2026');
    expect(shortPeriodLabel(isoDate('2026-08-01'))).toBe('Aug 2026');
    expect(formatNumericDate(isoDate('2026-09-01'))).toBe('9/1/2026');
  });
});

describe('issueConfirmText', () => {
  it('names the number, month and amount', () => {
    expect(issueConfirmText(draft)).toBe(
      'Issue INV0026 for September 2026 ($490.00)? The number is assigned permanently.',
    );
  });
});

describe('changedSinceIssued', () => {
  it('is null while the live hours match the invoice', () => {
    expect(changedSinceIssued(draft, issued)).toBeNull();
  });

  it('describes the difference once they no longer match', () => {
    expect(changedSinceIssued({ ...draft, totalMinutes: 3000 }, issued)).toBe(
      'Entries for September changed after INV0025 was issued (now 50.00 h, invoiced 49.00 h).',
    );
  });
});

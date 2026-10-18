import {
  formatHours,
  formatInvoiceNumber,
  formatMonthYear,
  formatUsd,
  monthOf,
  parseIsoLocal,
  type Invoice,
  type InvoiceDraft,
  type IsoDate,
} from '@tt/shared';
import { shiftMonth, type YearMonth } from '../calendar/calendarLogic';

/** Invoices are written after a month ends, so the page opens on the month before `today`. */
export const defaultInvoiceMonth = (today: IsoDate): YearMonth => shiftMonth(monthOf(today), -1);

/** "September 2026" for an invoice or draft. */
export function periodLabel(invoice: Pick<InvoiceDraft, 'periodStart'>): string {
  const { year, month } = monthOf(invoice.periodStart);
  return formatMonthYear(year, month);
}

const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const longMonth = new Intl.DateTimeFormat('en-US', { month: 'long' });
const numericDate = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
});

/** "Sep 2026" */
export const shortPeriodLabel = (periodStart: IsoDate) =>
  shortMonth.format(parseIsoLocal(periodStart));

/** "10/1/2026" */
export const formatNumericDate = (d: IsoDate) => numericDate.format(parseIsoLocal(d));

/** The question asked before issuing, which assigns the number for good. */
export function issueConfirmText(draft: InvoiceDraft): string {
  return (
    `Issue ${formatInvoiceNumber(draft.invoiceNumber)} for ${periodLabel(draft)} ` +
    `(${formatUsd(draft.amountCents)})? The number is assigned permanently.`
  );
}

/**
 * A warning when the month's live hours (from `draft`) no longer match what was invoiced,
 * or null if they still match.
 */
export function changedSinceIssued(draft: InvoiceDraft, issued: Invoice): string | null {
  if (draft.totalMinutes === issued.totalMinutes) return null;
  return (
    `Entries for ${longMonth.format(parseIsoLocal(issued.periodStart))} changed after ` +
    `${formatInvoiceNumber(issued.invoiceNumber)} was issued ` +
    `(now ${formatHours(draft.totalMinutes)} h, invoiced ${formatHours(issued.totalMinutes)} h).`
  );
}

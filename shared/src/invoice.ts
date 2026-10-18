import { formatMonthYear, monthOf, monthRange } from './dates';
import type { IsoDate } from './primitives';
import { byFirstWorked, type Summary } from './summary';
import type { Settings } from './types';

export interface InvoiceLine {
  taskName: string;
  minutes: number;
  rateCents: number;
  amountCents: number;
}

export interface InvoiceDraft {
  /** settings.nextInvoiceNumber for a draft; the assigned number once issued. */
  invoiceNumber: number;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  /** The date printed on the invoice. */
  invoiceDate: IsoDate;
  lines: InvoiceLine[];
  totalMinutes: number;
  /** The sum of the line amounts, so the printed lines always add up to the printed total. */
  amountCents: number;
  biller: { name: string; address: string; phone: string; email: string };
  company: { name: string; address: string };
  paymentTerms: string;
}

/** An issued invoice: a snapshot that never changes with later edits to entries or settings. */
export type Invoice = InvoiceDraft & { id: number; issuedAt: string };

/** A row of `GET /api/invoices`. */
export type InvoiceListItem = Pick<
  Invoice,
  | 'id'
  | 'invoiceNumber'
  | 'periodStart'
  | 'periodEnd'
  | 'invoiceDate'
  | 'totalMinutes'
  | 'amountCents'
>;

/** `GET /api/invoices/draft`. `problems` are the reasons the draft can't be issued yet. */
export interface InvoiceDraftResponse {
  draft: InvoiceDraft;
  problems: string[];
  /** The invoice already issued for this month, if any. */
  issued: Invoice | null;
}

/** Integer cents, rounded half up. Only matters when the rate isn't a multiple of 4 cents. */
export function lineAmountCents(minutes: number, rateCents: number): number {
  return Math.round((minutes * rateCents) / 60);
}

/** 25 → "INV0025"; numbers past 9999 just get longer. */
export function formatInvoiceNumber(n: number): string {
  return `INV${String(n).padStart(4, '0')}`;
}

/** The 1st of the month after the period: September 2026 → 2026-10-01. */
export function defaultInvoiceDate(year: number, month: number): IsoDate {
  return monthRange(year, month + 1).from;
}

/**
 * The invoice for `summary` (a calendar month): one line per task in first-worked order, every
 * line at the settings rate.
 */
export function buildInvoiceDraft(
  summary: Summary,
  settings: Settings,
  invoiceDate: IsoDate,
): InvoiceDraft {
  const rateCents = settings.hourlyRateCents;
  const lines = byFirstWorked(summary.tasks).map((t): InvoiceLine => ({
    taskName: t.taskName,
    minutes: t.minutes,
    rateCents,
    amountCents: lineAmountCents(t.minutes, rateCents),
  }));
  return {
    invoiceNumber: settings.nextInvoiceNumber,
    periodStart: summary.from,
    periodEnd: summary.to,
    invoiceDate,
    lines,
    totalMinutes: lines.reduce((sum, l) => sum + l.minutes, 0),
    amountCents: lines.reduce((sum, l) => sum + l.amountCents, 0),
    biller: {
      name: settings.billerName,
      address: settings.billerAddress,
      phone: settings.billerPhone,
      email: settings.billerEmail,
    },
    company: { name: settings.companyName, address: settings.companyAddress },
    paymentTerms: settings.paymentTerms,
  };
}

/** Human-readable reasons `draft` can't be issued, given the invoice already issued for its month. */
export function invoiceProblems(
  draft: InvoiceDraft,
  settings: Settings,
  issued: Pick<Invoice, 'invoiceNumber'> | null,
): string[] {
  const { year, month } = monthOf(draft.periodStart);
  const monthLabel = formatMonthYear(year, month);
  const problems: string[] = [];
  if (!settings.billerName) problems.push('Set your name in Settings');
  if (!settings.companyName) problems.push('Set the company name in Settings');
  if (settings.hourlyRateCents <= 0) problems.push('Set an hourly rate in Settings');
  if (draft.totalMinutes === 0) problems.push(`No time logged in ${monthLabel}`);
  if (issued) {
    problems.push(
      `${monthLabel} was already invoiced as ${formatInvoiceNumber(issued.invoiceNumber)}`,
    );
  }
  return problems;
}

import path from 'node:path';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { monthName, monthOf, type InvoiceDraft, type Period, type Summary } from '@tt/shared';
import { config } from '../config';
import { InvoicePdf } from './InvoicePdf';
import { fontFamily, fontWeight } from './theme';
import { TimesheetPdf } from './TimesheetPdf';

Font.register({
  family: fontFamily,
  fonts: [
    { src: path.join(config.fontsDir, 'Inter-Regular.ttf'), fontWeight: fontWeight.regular },
    { src: path.join(config.fontsDir, 'Inter-Medium.ttf'), fontWeight: fontWeight.medium },
  ],
});
// Task names and addresses are never broken across lines mid-word.
Font.registerHyphenationCallback((word) => [word]);

// The documents are called as plain functions (they use no hooks) so the result is typed as the
// <Document> element that renderToBuffer expects.

/** The timesheet for one period (a `summarize` over exactly that period). */
export function renderTimesheet(summary: Summary): Promise<Buffer> {
  return renderToBuffer(TimesheetPdf({ summary }));
}

/** An issued invoice, or with `draft` a preview with a DRAFT watermark. */
export function renderInvoice(invoice: InvoiceDraft, { draft = false } = {}): Promise<Buffer> {
  return renderToBuffer(InvoicePdf({ invoice, draft }));
}

const mmdd = (d: string) => `${d.slice(5, 7)}-${d.slice(8, 10)}`;

/** "09-01_09-06_Timesheet.pdf" */
export const timesheetFilename = ({ from, to }: Period) =>
  `${mmdd(from)}_${mmdd(to)}_Timesheet.pdf`;

/** "September_2026_Invoice.pdf"; the year keeps next September's file from overwriting it. */
export function invoiceFilename(invoice: Pick<InvoiceDraft, 'periodStart'>): string {
  const { year, month } = monthOf(invoice.periodStart);
  return `${monthName(month)}_${year}_Invoice.pdf`;
}

import type { IsoDate } from '@tt/shared';

// Server-rendered PDFs. They download (Content-Disposition: attachment) unless asked for inline.

/** The timesheet for the period starting `start`. */
export const timesheetPdfUrl = (start: IsoDate) =>
  `/api/reports/timesheet.pdf?${new URLSearchParams({ start })}`;

/** An issued invoice. */
export const invoicePdfUrl = (id: number) => `/api/invoices/${id}/pdf`;

/** The watermarked draft for `month` ("YYYY-MM"), shown in the browser rather than downloaded. */
export const draftInvoicePdfUrl = (month: string, invoiceDate: IsoDate) =>
  `/api/invoices/draft.pdf?${new URLSearchParams({ month, invoiceDate, inline: '1' })}`;

/** Downloads `url` without leaving the page; the server's Content-Disposition names the file. */
export function downloadFile(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.click();
}

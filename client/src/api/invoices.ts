import type { Invoice, InvoiceDraftResponse, InvoiceListItem, IsoDate } from '@tt/shared';
import { apiFetch } from './client';

export const listInvoices = (signal?: AbortSignal) =>
  apiFetch<InvoiceListItem[]>('/invoices', { signal });

/** `month` is "YYYY-MM". */
export const getInvoiceDraft = (month: string, signal?: AbortSignal) =>
  apiFetch<InvoiceDraftResponse>(`/invoices/draft?${new URLSearchParams({ month })}`, { signal });

export const getInvoice = (id: number) => apiFetch<Invoice>(`/invoices/${id}`);

export const issueInvoice = (month: string, invoiceDate: IsoDate) =>
  apiFetch<Invoice>('/invoices', { method: 'POST', json: { month, invoiceDate } });

export const deleteInvoice = (id: number) =>
  apiFetch<void>(`/invoices/${id}`, { method: 'DELETE' });

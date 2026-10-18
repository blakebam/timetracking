import {
  buildInvoiceDraft,
  defaultInvoiceDate,
  draftPdfQuerySchema,
  formatInvoiceNumber,
  idParamSchema,
  invoiceDraftQuerySchema,
  invoiceProblems,
  issueInvoiceSchema,
  monthRange,
  pdfQuerySchema,
  summarize,
  type InvoiceDraftResponse,
  type IsoDate,
} from '@tt/shared';
import { Router } from 'express';
import type { Db } from '../db/connection';
import type { EntriesRepo } from '../db/entriesRepo';
import type { InvoicesRepo } from '../db/invoicesRepo';
import type { SettingsRepo } from '../db/settingsRepo';
import { HttpError, notFound } from '../httpError';
import { parse } from '../middleware/validate';
import { invoiceFilename, renderInvoice } from '../pdf/render';
import { sendPdf } from './sendPdf';

interface InvoicesDeps {
  db: Db;
  invoices: InvoicesRepo;
  settings: SettingsRepo;
  entries: EntriesRepo;
}

export function invoicesRouter({ db, invoices, settings, entries }: InvoicesDeps) {
  const router = Router();

  /** The month's draft from live entries and settings, and the invoice already issued for it. */
  function draftFor(year: number, month: number, invoiceDate?: IsoDate) {
    const { from, to } = monthRange(year, month);
    const current = settings.get();
    const draft = buildInvoiceDraft(
      summarize(entries.listByRange(from, to), from, to),
      current,
      invoiceDate ?? defaultInvoiceDate(year, month),
    );
    const issued = invoices.getByPeriod(from, to) ?? null;
    return { draft, issued, problems: invoiceProblems(draft, current, issued), current };
  }

  /** Everything behind the draft's `problems` is re-checked inside the same transaction. */
  const issue = db.transaction((year: number, month: number, invoiceDate: IsoDate) => {
    const { draft, issued, problems, current } = draftFor(year, month, invoiceDate);
    if (issued) throw new HttpError(409, { error: 'invoice_exists', invoice: issued });
    if (problems.length > 0) {
      throw new HttpError(400, {
        error: 'validation',
        issues: problems.map((message) => ({ path: '', message })),
      });
    }
    const invoice = invoices.insert(draft, current.hourlyRateCents);
    settings.setNextInvoiceNumber(draft.invoiceNumber + 1);
    return invoice;
  });

  /** Only the latest invoice can go, and its number is handed back so no gap is left. */
  const remove = db.transaction((id: number) => {
    const invoice = invoices.getById(id);
    if (!invoice) throw notFound();
    const highest = invoices.highestNumber()!;
    if (invoice.invoiceNumber !== highest) {
      throw new HttpError(409, {
        error: 'not_latest',
        message: `Only the most recent invoice (${formatInvoiceNumber(highest)}) can be deleted.`,
      });
    }
    invoices.remove(id);
    settings.setNextInvoiceNumber(invoice.invoiceNumber);
  });

  router.get('/', (_req, res) => {
    res.json(invoices.list());
  });

  router.get('/draft', (req, res) => {
    const { month, invoiceDate } = parse(invoiceDraftQuerySchema, req.query);
    const { draft, issued, problems } = draftFor(month.year, month.month, invoiceDate);
    res.json({ draft, problems, issued } satisfies InvoiceDraftResponse);
  });

  /** The draft with a DRAFT watermark. Works even when `problems` would block issuing. */
  router.get('/draft.pdf', async (req, res) => {
    const { month, invoiceDate, inline } = parse(draftPdfQuerySchema, req.query);
    const { draft } = draftFor(month.year, month.month, invoiceDate);
    sendPdf(res, await renderInvoice(draft, { draft: true }), invoiceFilename(draft), inline);
  });

  router.post('/', (req, res) => {
    const { month, invoiceDate } = parse(issueInvoiceSchema, req.body);
    res.status(201).json(issue(month.year, month.month, invoiceDate));
  });

  router.get('/:id', (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const invoice = invoices.getById(id);
    if (!invoice) throw notFound();
    res.json(invoice);
  });

  /** An issued invoice, rendered from its snapshot. */
  router.get('/:id/pdf', async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const { inline } = parse(pdfQuerySchema, req.query);
    const invoice = invoices.getById(id);
    if (!invoice) throw notFound();
    sendPdf(res, await renderInvoice(invoice), invoiceFilename(invoice), inline);
  });

  router.delete('/:id', (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    remove(id);
    res.status(204).end();
  });

  return router;
}

import type { Invoice, InvoiceDraft, InvoiceLine, InvoiceListItem, IsoDate } from '@tt/shared';
import type { Db } from './connection';

interface InvoiceRow {
  id: number;
  invoice_number: number;
  period_start: string;
  period_end: string;
  invoice_date: string;
  total_minutes: number;
  hourly_rate_cents: number;
  amount_cents: number;
  biller_name: string;
  biller_address: string;
  biller_phone: string;
  biller_email: string;
  company_name: string;
  company_address: string;
  payment_terms: string;
  issued_at: string;
}

interface LineRow {
  task_name: string;
  minutes: number;
  rate_cents: number;
  amount_cents: number;
}

type ListRow = Pick<
  InvoiceRow,
  | 'id'
  | 'invoice_number'
  | 'period_start'
  | 'period_end'
  | 'invoice_date'
  | 'total_minutes'
  | 'amount_cents'
>;

interface InsertParams {
  invoiceNumber: number;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  invoiceDate: IsoDate;
  totalMinutes: number;
  hourlyRateCents: number;
  amountCents: number;
  billerName: string;
  billerAddress: string;
  billerPhone: string;
  billerEmail: string;
  companyName: string;
  companyAddress: string;
  paymentTerms: string;
}

// Rows are trusted: the DB only ever receives validated values.
const toListItem = (r: ListRow): InvoiceListItem => ({
  id: r.id,
  invoiceNumber: r.invoice_number,
  periodStart: r.period_start as IsoDate,
  periodEnd: r.period_end as IsoDate,
  invoiceDate: r.invoice_date as IsoDate,
  totalMinutes: r.total_minutes,
  amountCents: r.amount_cents,
});

const toLine = (r: LineRow): InvoiceLine => ({
  taskName: r.task_name,
  minutes: r.minutes,
  rateCents: r.rate_cents,
  amountCents: r.amount_cents,
});

const toInvoice = (r: InvoiceRow, lines: LineRow[]): Invoice => ({
  ...toListItem(r),
  lines: lines.map(toLine),
  biller: {
    name: r.biller_name,
    address: r.biller_address,
    phone: r.biller_phone,
    email: r.biller_email,
  },
  company: { name: r.company_name, address: r.company_address },
  paymentTerms: r.payment_terms,
  issuedAt: r.issued_at,
});

export function invoicesRepo(db: Db) {
  const stmts = {
    list: db.prepare<[], ListRow>(
      `SELECT id, invoice_number, period_start, period_end, invoice_date, total_minutes,
              amount_cents
       FROM invoices ORDER BY invoice_number DESC`,
    ),
    getById: db.prepare<[number], InvoiceRow>('SELECT * FROM invoices WHERE id = ?'),
    getByPeriod: db.prepare<[string, string], InvoiceRow>(
      'SELECT * FROM invoices WHERE period_start = ? AND period_end = ?',
    ),
    lines: db.prepare<[number], LineRow>(
      `SELECT task_name, minutes, rate_cents, amount_cents
       FROM invoice_lines WHERE invoice_id = ? ORDER BY position`,
    ),
    highestNumber: db.prepare<[], { n: number | null }>(
      'SELECT MAX(invoice_number) AS n FROM invoices',
    ),
    insert: db.prepare<[InsertParams], InvoiceRow>(
      `INSERT INTO invoices (
         invoice_number, period_start, period_end, invoice_date, total_minutes,
         hourly_rate_cents, amount_cents, biller_name, biller_address, biller_phone,
         biller_email, company_name, company_address, payment_terms)
       VALUES (
         @invoiceNumber, @periodStart, @periodEnd, @invoiceDate, @totalMinutes,
         @hourlyRateCents, @amountCents, @billerName, @billerAddress, @billerPhone,
         @billerEmail, @companyName, @companyAddress, @paymentTerms)
       RETURNING *`,
    ),
    insertLine: db.prepare<[{ invoiceId: number; position: number } & InvoiceLine]>(
      `INSERT INTO invoice_lines (invoice_id, position, task_name, minutes, rate_cents, amount_cents)
       VALUES (@invoiceId, @position, @taskName, @minutes, @rateCents, @amountCents)`,
    ),
    remove: db.prepare<[number]>('DELETE FROM invoices WHERE id = ?'),
  };

  const withLines = (row: InvoiceRow) => toInvoice(row, stmts.lines.all(row.id));

  return {
    /** Newest (highest number) first. */
    list(): InvoiceListItem[] {
      return stmts.list.all().map(toListItem);
    },

    getById(id: number): Invoice | undefined {
      const row = stmts.getById.get(id);
      return row && withLines(row);
    },

    /** The invoice for exactly this period, if one was issued. */
    getByPeriod(from: IsoDate, to: IsoDate): Invoice | undefined {
      const row = stmts.getByPeriod.get(from, to);
      return row && withLines(row);
    },

    /** The highest invoice number issued so far, or null if there are none. */
    highestNumber(): number | null {
      return stmts.highestNumber.get()!.n;
    },

    /** Stores `draft` as an issued invoice with its lines, all or nothing. */
    insert: db.transaction((draft: InvoiceDraft, hourlyRateCents: number): Invoice => {
      const row = stmts.insert.get({
        invoiceNumber: draft.invoiceNumber,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        invoiceDate: draft.invoiceDate,
        totalMinutes: draft.totalMinutes,
        hourlyRateCents,
        amountCents: draft.amountCents,
        billerName: draft.biller.name,
        billerAddress: draft.biller.address,
        billerPhone: draft.biller.phone,
        billerEmail: draft.biller.email,
        companyName: draft.company.name,
        companyAddress: draft.company.address,
        paymentTerms: draft.paymentTerms,
      })!;
      draft.lines.forEach((line, i) => {
        stmts.insertLine.run({ invoiceId: row.id, position: i + 1, ...line });
      });
      return withLines(row);
    }),

    /** Deletes the invoice and its lines. */
    remove(id: number): boolean {
      return stmts.remove.run(id).changes > 0;
    },
  };
}

export type InvoicesRepo = ReturnType<typeof invoicesRepo>;

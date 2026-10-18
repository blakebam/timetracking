import {
  formatHours,
  formatInvoiceNumber,
  formatRate,
  formatUsd,
  isoDateSchema,
  type InvoiceDraft,
  type InvoiceDraftResponse,
  type IsoDate,
} from '@tt/shared';
import { useId, useState } from 'react';
import { downloadFile, draftInvoicePdfUrl, invoicePdfUrl } from '../../api/pdf';
import styles from './DraftPanel.module.css';
import { changedSinceIssued, formatNumericDate } from './invoicesLogic';

interface DraftPanelProps {
  data: InvoiceDraftResponse;
  busy: boolean;
  onIssue: (draft: InvoiceDraft, invoiceDate: IsoDate) => void;
}

/**
 * The month's invoice: the issued snapshot (read-only) if there is one, otherwise the live draft
 * with an editable invoice date and the Issue button.
 */
export function DraftPanel({ data, busy, onIssue }: DraftPanelProps) {
  return data.issued ? (
    <IssuedView data={data} />
  ) : (
    <DraftView data={data} busy={busy} onIssue={onIssue} />
  );
}

function DraftView({ data, busy, onIssue }: DraftPanelProps) {
  const id = useId();
  const { draft, problems } = data;
  // Starts at the server's default (the 1st of the next month); the page remounts this per month.
  const [invoiceDate, setInvoiceDate] = useState<string>(draft.invoiceDate);
  const parsedDate = isoDateSchema.safeParse(invoiceDate);
  const number = formatInvoiceNumber(draft.invoiceNumber);
  const canIssue = problems.length === 0 && parsedDate.success && !busy;

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        Draft — {number}
      </h2>
      <div className={styles.meta}>
        <label className={styles.dateField}>
          Invoice date
          <input
            type="date"
            value={invoiceDate}
            required
            aria-invalid={parsedDate.success ? undefined : true}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
        <span>Terms: {draft.paymentTerms}</span>
      </div>

      <InvoiceTable invoice={draft} />

      {problems.length > 0 && (
        <ul className={styles.problems} aria-label="Why this can’t be issued yet">
          {problems.map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          disabled={!parsedDate.success}
          onClick={() =>
            parsedDate.success &&
            window.open(
              draftInvoicePdfUrl(draft.periodStart.slice(0, 7), parsedDate.data),
              '_blank',
            )
          }
        >
          Preview PDF
        </button>
        <button
          type="button"
          className={styles.submit}
          disabled={!canIssue}
          onClick={() => parsedDate.success && onIssue(draft, parsedDate.data)}
        >
          {busy ? 'Issuing…' : `Issue ${number}`}
        </button>
      </div>
    </section>
  );
}

function IssuedView({ data }: { data: InvoiceDraftResponse }) {
  const id = useId();
  const issued = data.issued!;
  const warning = changedSinceIssued(data.draft, issued);

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        {formatInvoiceNumber(issued.invoiceNumber)} — issued
      </h2>
      <div className={styles.meta}>
        <span>Invoice date {formatNumericDate(issued.invoiceDate)}</span>
        <span>Terms: {issued.paymentTerms}</span>
        <span>Bill to: {issued.company.name}</span>
      </div>

      <InvoiceTable invoice={issued} />

      {warning && (
        <p className={styles.warning} role="status">
          ⚠ {warning} To re-issue it, delete the invoice (if it is the latest) and issue it again.
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" onClick={() => downloadFile(invoicePdfUrl(issued.id))}>
          PDF
        </button>
      </div>
    </section>
  );
}

/** Task lines with rate, hours and amount, then the total. */
function InvoiceTable({ invoice }: { invoice: InvoiceDraft }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Task</th>
          <th scope="col" className={styles.num}>
            Rate
          </th>
          <th scope="col" className={styles.num}>
            Hours
          </th>
          <th scope="col" className={styles.num}>
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {invoice.lines.length === 0 ? (
          <tr>
            <td colSpan={4} className={styles.empty}>
              No time logged this month.
            </td>
          </tr>
        ) : (
          invoice.lines.map((line) => (
            <tr key={line.taskName}>
              <td>{line.taskName}</td>
              <td className={styles.num}>{formatRate(line.rateCents)}</td>
              <td className={styles.num}>{formatHours(line.minutes)}</td>
              <td className={styles.num}>{formatUsd(line.amountCents)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td />
          <td className={styles.num}>{formatHours(invoice.totalMinutes)}</td>
          <td className={styles.num}>{formatUsd(invoice.amountCents)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

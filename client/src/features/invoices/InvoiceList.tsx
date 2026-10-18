import { formatHours, formatInvoiceNumber, formatUsd, type InvoiceListItem } from '@tt/shared';
import { Link } from 'react-router';
import { downloadFile, invoicePdfUrl } from '../../api/pdf';
import styles from './InvoiceList.module.css';
import { formatNumericDate, shortPeriodLabel } from './invoicesLogic';

interface InvoiceListProps {
  /** Newest first; null while loading. */
  invoices: InvoiceListItem[] | null;
  busy: boolean;
  onDelete: (invoice: InvoiceListItem) => void;
}

/** Issued invoices. Only the latest (first) one can be deleted. */
export function InvoiceList({ invoices, busy, onDelete }: InvoiceListProps) {
  let body;
  if (!invoices) body = <p className={styles.muted}>Loading…</p>;
  else if (invoices.length === 0) body = <p className={styles.muted}>No invoices issued yet.</p>;
  else {
    body = (
      <ul className={styles.list}>
        {invoices.map((inv, i) => {
          const number = formatInvoiceNumber(inv.invoiceNumber);
          return (
            <li key={inv.id} className={styles.row}>
              <span className={styles.number}>{number}</span>
              <Link to={`/invoices?month=${inv.periodStart.slice(0, 7)}`}>
                {shortPeriodLabel(inv.periodStart)}
              </Link>
              <span className={styles.muted}>dated {formatNumericDate(inv.invoiceDate)}</span>
              <span className={styles.num}>{formatHours(inv.totalMinutes)} h</span>
              <span className={styles.num}>{formatUsd(inv.amountCents)}</span>
              <span className={styles.actions}>
                <button
                  type="button"
                  aria-label={`Download ${number} PDF`}
                  onClick={() => downloadFile(invoicePdfUrl(inv.id))}
                >
                  PDF
                </button>
                {i === 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Delete ${number}`}
                    onClick={() => onDelete(inv)}
                  >
                    Delete
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="issued-heading">
      <h2 id="issued-heading" className={styles.heading}>
        Issued invoices
      </h2>
      {body}
    </section>
  );
}

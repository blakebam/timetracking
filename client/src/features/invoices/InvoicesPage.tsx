import {
  formatInvoiceNumber,
  formatMonthYear,
  todayIso,
  type InvoiceDraft,
  type InvoiceListItem,
  type IsoDate,
} from '@tt/shared';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { apiErrorBody, describeError } from '../../api/client';
import { deleteInvoice, issueInvoice } from '../../api/invoices';
import { downloadFile, invoicePdfUrl } from '../../api/pdf';
import { useInvoiceDraft, useInvoiceList } from '../../hooks/useInvoices';
import { useSettings } from '../../hooks/useSettings';
import { monthParam, parseMonthParam, shiftMonth, type YearMonth } from '../calendar/calendarLogic';
import { DraftPanel } from './DraftPanel';
import { InvoiceList } from './InvoiceList';
import styles from './InvoicesPage.module.css';
import { defaultInvoiceMonth, issueConfirmText, shortPeriodLabel } from './invoicesLogic';

const href = (ym: YearMonth) => `/invoices?month=${monthParam(ym)}`;

/** Route component for `/invoices?month=YYYY-MM`; a missing or invalid month means last month. */
export function InvoicesPage() {
  const [params] = useSearchParams();
  const ym = parseMonthParam(params.get('month'));
  if (!ym) return <Navigate to={href(defaultInvoiceMonth(todayIso()))} replace />;
  return <InvoicesView ym={ym} />;
}

function InvoicesView({ ym }: { ym: YearMonth }) {
  const navigate = useNavigate();
  const month = monthParam(ym);
  const draft = useInvoiceDraft(month);
  const list = useInvoiceList();
  // Issuing and deleting change settings.nextInvoiceNumber, so the shared settings cache is dropped.
  const { invalidate: invalidateSettings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Runs an issue/delete request, then refreshes everything it can have changed. */
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      const body = apiErrorBody(err);
      if (body?.error === 'validation') setActionError(body.issues.map((i) => i.message).join(' '));
      else if (body?.error === 'not_latest') setActionError(body.message);
      else if (body?.error === 'invoice_exists') {
        setActionError(
          `${formatMonthYear(ym.year, ym.month)} was already invoiced as ` +
            `${formatInvoiceNumber(body.invoice.invoiceNumber)}.`,
        );
      } else setActionError(describeError(err));
    } finally {
      setBusy(false);
      draft.reload();
      list.reload();
      invalidateSettings();
    }
  }

  function issue(d: InvoiceDraft, invoiceDate: IsoDate) {
    if (busy || !window.confirm(issueConfirmText({ ...d, invoiceDate }))) return;
    void run(async () => {
      const invoice = await issueInvoice(month, invoiceDate);
      downloadFile(invoicePdfUrl(invoice.id));
    });
  }

  function remove(inv: InvoiceListItem) {
    const number = formatInvoiceNumber(inv.invoiceNumber);
    const prompt =
      `Delete ${number} (${shortPeriodLabel(inv.periodStart)})? ` +
      `The next invoice you issue will reuse ${number}.`;
    if (busy || !window.confirm(prompt)) return;
    void run(() => deleteInvoice(inv.id));
  }

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Invoices</h1>
        <div className={styles.nav}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => navigate(href(shiftMonth(ym, -1)))}
          >
            ◀
          </button>
          <h2 className={styles.month}>{formatMonthYear(ym.year, ym.month)}</h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => navigate(href(shiftMonth(ym, 1)))}
          >
            ▶
          </button>
        </div>
      </header>

      {actionError && (
        <p className={styles.banner} role="alert">
          ⚠ {actionError}
        </p>
      )}

      {draft.error ? (
        <p className={styles.banner} role="alert">
          ⚠ {describeError(draft.error)}{' '}
          <button type="button" onClick={draft.reload}>
            Retry
          </button>
        </p>
      ) : draft.draft ? (
        // Keyed by month so the invoice date resets to the new month's default.
        <DraftPanel key={month} data={draft.draft} busy={busy} onIssue={issue} />
      ) : (
        <p className={styles.muted}>Loading…</p>
      )}

      {list.error ? (
        <p className={`${styles.banner} ${styles.listError}`} role="alert">
          ⚠ {describeError(list.error)}{' '}
          <button type="button" onClick={list.reload}>
            Retry
          </button>
        </p>
      ) : (
        <InvoiceList invoices={list.invoices} busy={busy} onDelete={remove} />
      )}
    </>
  );
}

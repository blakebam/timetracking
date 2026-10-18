import type { InvoiceDraftResponse, InvoiceListItem } from '@tt/shared';
import { useCallback, useEffect, useState } from 'react';
import { getInvoiceDraft, listInvoices } from '../api/invoices';

interface LoadState<T> {
  data: T | null;
  /** The key `data` was loaded for. */
  key: string | null;
  loading: boolean;
  error: unknown;
}

/**
 * Runs `load` when `key` changes and on reload(). `load` must depend only on `key`.
 * `data` is null until the current key has loaded, so data for a previous key is never shown.
 */
function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({
    data: null,
    key: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    load(controller.signal).then(
      (data) => setState({ data, key, loading: false, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, loading: false, error }));
      },
    );
    return () => controller.abort();
  }, [key, version]); // `load` is left out: it depends only on `key`

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const data = state.key === key ? state.data : null;
  return { data, loading: state.loading, error: state.error, reload };
}

/** The draft (and any invoice already issued) for `month`, "YYYY-MM". */
export function useInvoiceDraft(month: string) {
  const { data, ...rest } = useLoad<InvoiceDraftResponse>(month, (signal) =>
    getInvoiceDraft(month, signal),
  );
  return { draft: data, ...rest };
}

/** Every issued invoice, newest first. */
export function useInvoiceList() {
  const { data, ...rest } = useLoad<InvoiceListItem[]>('all', listInvoices);
  return { invoices: data, ...rest };
}

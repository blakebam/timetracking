import type { IsoDate, Summary } from '@tt/shared';
import { useCallback, useEffect, useState } from 'react';
import { getSummary } from '../api/summary';

interface SummaryState {
  summary: Summary | null;
  loading: boolean;
  error: unknown;
}

/**
 * The summary of an inclusive date range. Refetches when the range changes or on reload().
 * `summary` is null until the current range has loaded, so a previous range is never shown.
 */
export function useSummary(from: IsoDate, to: IsoDate) {
  const [state, setState] = useState<SummaryState>({ summary: null, loading: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    getSummary(from, to, controller.signal).then(
      (summary) => setState({ summary, loading: false, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, loading: false, error }));
      },
    );
    return () => controller.abort();
  }, [from, to, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = state.summary?.from === from && state.summary.to === to;
  return { ...state, summary: current ? state.summary : null, reload };
}

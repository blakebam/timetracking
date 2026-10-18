import type { IsoDate, TimeEntry } from '@tt/shared';
import { useCallback, useEffect, useState } from 'react';
import { listEntries } from '../api/entries';

interface EntriesState {
  entries: TimeEntry[];
  loading: boolean;
  error: unknown;
}

/** Entries for an inclusive date range. Refetches when the range changes or on reload(). */
export function useEntries(from: IsoDate, to: IsoDate) {
  const [state, setState] = useState<EntriesState>({ entries: [], loading: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    listEntries(from, to, controller.signal).then(
      (entries) => setState({ entries, loading: false, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, loading: false, error }));
      },
    );
    return () => controller.abort();
  }, [from, to, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

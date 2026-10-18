import type { Settings } from '@tt/shared';
import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '../api/settings';

/** Fetched once per page load and shared by every caller. */
let cached: Promise<Settings> | null = null;

function loadSettings(): Promise<Settings> {
  cached ??= getSettings().catch((err: unknown) => {
    cached = null; // let the next caller retry
    throw err;
  });
  return cached;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then(
      (s) => !cancelled && setSettings(s),
      (err: unknown) => !cancelled && setError(err),
    );
    return () => {
      cancelled = true;
    };
  }, [version]);

  /**
   * Drops the shared cache so every later caller sees fresh settings. Pass the settings a save
   * returned to use them directly instead of refetching.
   */
  const invalidate = useCallback((next?: Settings) => {
    cached = next ? Promise.resolve(next) : null;
    setError(null);
    setVersion((v) => v + 1);
  }, []);

  return { settings, error, invalidate };
}

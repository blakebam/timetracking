import { useEffect, useState } from 'react';
import styles from './ServerStatus.module.css';

type Status = 'checking' | 'connected' | 'unreachable';

const POLL_MS = 15_000;

export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/health');
        if (!cancelled) setStatus(res.ok ? 'connected' : 'unreachable');
      } catch {
        if (!cancelled) setStatus('unreachable');
      }
    }

    void check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const label = {
    checking: 'Checking server…',
    connected: 'Connected',
    unreachable: 'Server unreachable',
  }[status];

  return (
    <span className={`${styles.status} ${styles[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}

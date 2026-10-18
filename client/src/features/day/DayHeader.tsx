import {
  addDays,
  formatHours,
  formatLongDate,
  isoDateSchema,
  todayIso,
  type IsoDate,
} from '@tt/shared';
import { useEffect } from 'react';
import styles from './DayHeader.module.css';

interface DayHeaderProps {
  date: IsoDate;
  totalMinutes: number;
  onNavigate: (date: IsoDate) => void;
}

const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function DayHeader({ date, totalMinutes, onNavigate }: DayHeaderProps) {
  // Alt+←/→ move a day, unless the user is typing somewhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || isTextField(e.target)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate(addDays(date, e.key === 'ArrowLeft' ? -1 : 1));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [date, onNavigate]);

  const today = todayIso();

  return (
    <header className={styles.header}>
      <div className={styles.nav}>
        <button
          type="button"
          aria-label="Previous day"
          title="Previous day (Alt+←)"
          onClick={() => onNavigate(addDays(date, -1))}
        >
          ◀
        </button>
        <h1 className={styles.title}>{formatLongDate(date)}</h1>
        <button
          type="button"
          aria-label="Next day"
          title="Next day (Alt+→)"
          onClick={() => onNavigate(addDays(date, 1))}
        >
          ▶
        </button>
        <button type="button" disabled={date === today} onClick={() => onNavigate(today)}>
          Today
        </button>
        <input
          type="date"
          aria-label="Go to date"
          value={date}
          onChange={(e) => {
            const picked = isoDateSchema.safeParse(e.target.value);
            if (picked.success) onNavigate(picked.data);
          }}
        />
      </div>
      <div className={styles.total}>
        Day total: <strong>{formatHours(totalMinutes)} h</strong>
      </div>
    </header>
  );
}

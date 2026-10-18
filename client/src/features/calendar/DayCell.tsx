import { formatHours, parseIsoLocal, type DayTotal } from '@tt/shared';
import { Link } from 'react-router';
import { topTasks } from './calendarLogic';
import styles from './DayCell.module.css';

const longDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** "Thursday October 1, 8.00 hours" (Intl adds a comma after the weekday; the spec has none). */
function label(day: DayTotal, today: boolean): string {
  const date = longDay.format(parseIsoLocal(day.date)).replace(',', '');
  const worked = day.minutes > 0 ? `${formatHours(day.minutes)} hours` : 'nothing logged';
  return `${date}, ${worked}${today ? ', today' : ''}`;
}

/** One day of the month grid: a link to its Day view with the total and its largest tasks. */
export function DayCell({ day, muted, today }: { day: DayTotal; muted: boolean; today: boolean }) {
  const { shown, moreCount } = topTasks(day.tasks, 2);
  const className = [styles.cell, muted && styles.muted, today && styles.today]
    .filter(Boolean)
    .join(' ');

  return (
    <td role="gridcell" aria-current={today ? 'date' : undefined}>
      <Link to={`/day/${day.date}`} className={className} aria-label={label(day, today)} data-day>
        <span className={styles.number}>{Number(day.date.slice(8))}</span>
        {day.minutes > 0 && (
          <>
            <span className={styles.hours}>{formatHours(day.minutes)} h</span>
            {shown.map((t) => (
              <span key={t.taskName} className={styles.task} title={t.taskName}>
                {t.taskName}
              </span>
            ))}
            {moreCount > 0 && <span className={styles.more}>+{moreCount} more</span>}
          </>
        )}
      </Link>
    </td>
  );
}

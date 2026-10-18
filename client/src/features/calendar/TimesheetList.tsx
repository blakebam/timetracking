import { formatHours, parseIsoLocal, type IsoDate, type Period } from '@tt/shared';
import { Link } from 'react-router';
import { timesheetPdfUrl } from '../../api/pdf';
import styles from './TimesheetList.module.css';

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** "Thu Oct 1" */
const dayLabel = (d: IsoDate) => {
  const date = parseIsoLocal(d);
  return `${weekday.format(date)} ${monthDay.format(date)}`;
};

/** "Thu Oct 1 – Sun Oct 4", or "Sun Nov 1" for a one-day period. The heading gives the year. */
const periodLabel = ({ from, to }: Period) =>
  from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;

/** A download arrow. */
const DownloadIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d="M8 2v8m-3.5-3.5L8 10l3.5-3.5M3 13h10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** The month's timesheet periods with their totals, each linking to its timesheet and its PDF. */
export function TimesheetList({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: { period: Period; minutes: number }[];
  loading: boolean;
}) {
  const total = rows.reduce((sum, r) => sum + r.minutes, 0);
  const hours = (minutes: number) => (loading ? '—' : `${formatHours(minutes)} h`);

  return (
    <section className={styles.section} aria-labelledby="timesheets-heading">
      <h2 id="timesheets-heading" className={styles.heading}>
        {title}
      </h2>
      <ul className={styles.list}>
        {rows.map(({ period, minutes }) => (
          <li key={period.from} className={styles.item}>
            <Link to={`/week?start=${period.from}&mode=timesheet`} className={styles.row}>
              <span>{periodLabel(period)}</span>
              <span className={styles.hours}>{hours(minutes)}</span>
              <span aria-hidden="true">›</span>
            </Link>
            <a
              href={timesheetPdfUrl(period.from)}
              download
              className={styles.download}
              aria-label={`Download ${periodLabel(period)} timesheet PDF`}
              title="Download PDF"
            >
              <DownloadIcon />
            </a>
          </li>
        ))}
      </ul>
      <p className={`${styles.row} ${styles.total}`}>
        <span>Total</span>
        <span className={styles.hours}>{hours(total)}</span>
        <span aria-hidden="true" />
      </p>
    </section>
  );
}

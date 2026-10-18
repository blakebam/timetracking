import { formatPeriod, parseIsoLocal, todayIso, type Period } from '@tt/shared';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { describeError } from '../../api/client';
import { downloadFile, timesheetPdfUrl } from '../../api/pdf';
import { useSummary } from '../../hooks/useSummary';
import styles from './WeekPage.module.css';
import {
  locationFor,
  otherHalf,
  parseWeekSearch,
  rangeFor,
  stepLocation,
  switchMode,
  weekSearch,
  type WeekLocation,
  type WeekMode,
} from './weekLogic';
import { WeekTable } from './WeekTable';

const MODES: { mode: WeekMode; label: string }[] = [
  { mode: 'timesheet', label: 'Timesheet' },
  { mode: 'full', label: 'Full week' },
];

const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long' });
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** "Nov 1" or "Oct 26–31". A timesheet period never spans two months. */
function shortPeriod({ from, to }: Period): string {
  const start = monthDay.format(parseIsoLocal(from));
  return from === to ? start : `${start}–${Number(to.slice(8))}`;
}

const href = (location: WeekLocation) => `/week${weekSearch(location)}`;

/** Route component for `/week?start=&mode=`; the URL is normalized to the period's first day. */
export function WeekPage() {
  const [params] = useSearchParams();
  const { location, canonical } = parseWeekSearch(params, todayIso());
  if (!canonical) return <Navigate to={href(location)} replace />;
  return <WeekView location={location} />;
}

function WeekView({ location }: { location: WeekLocation }) {
  const navigate = useNavigate();
  const { mode } = location;
  const range = rangeFor(mode, location.start);
  const { summary, error, reload } = useSummary(range.from, range.to);

  const today = todayIso();
  const showsToday = range.from <= today && today <= range.to;
  const split = mode === 'timesheet' ? otherHalf(range) : null;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.nav}>
          <button
            type="button"
            aria-label={mode === 'timesheet' ? 'Previous timesheet' : 'Previous week'}
            onClick={() => navigate(href(stepLocation(location, -1)))}
          >
            ◀
          </button>
          <h1 className={styles.title}>
            {mode === 'timesheet' ? 'Timesheet' : 'Week'}: {formatPeriod(range)}
          </h1>
          <button
            type="button"
            aria-label={mode === 'timesheet' ? 'Next timesheet' : 'Next week'}
            onClick={() => navigate(href(stepLocation(location, 1)))}
          >
            ▶
          </button>
          <button
            type="button"
            disabled={showsToday}
            onClick={() => navigate(href(locationFor(mode, today)))}
          >
            This week
          </button>
        </div>
        <div className={styles.tools}>
          <div className={styles.modes} role="radiogroup" aria-label="View">
            {MODES.map((m) => (
              <label key={m.mode} className={styles.mode}>
                <input
                  type="radio"
                  name="week-mode"
                  checked={mode === m.mode}
                  onChange={() => navigate(href(switchMode(location, m.mode)))}
                />
                {m.label}
              </label>
            ))}
          </div>
          {mode === 'timesheet' ? (
            <button type="button" onClick={() => downloadFile(timesheetPdfUrl(range.from))}>
              Export PDF
            </button>
          ) : (
            // A disabled button gets no hover events in every browser, so the wrapper holds the tooltip.
            <span title="Switch to Timesheet to export">
              <button type="button" disabled>
                Export PDF
              </button>
            </span>
          )}
        </div>
      </header>

      {error ? (
        <p className={styles.banner} role="alert">
          ⚠ {describeError(error)}{' '}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      ) : summary ? (
        <WeekTable summary={summary} />
      ) : (
        <p className={styles.muted}>Loading…</p>
      )}

      {split && (
        <p className={styles.note}>
          ℹ{' '}
          {split.side === 'after' ? (
            <>
              This week continues into {monthLong.format(parseIsoLocal(split.period.from))} →{' '}
              <Link to={href(locationFor('timesheet', split.period.from))}>
                {shortPeriod(split.period)} timesheet ›
              </Link>
            </>
          ) : (
            <>
              This week began in {monthLong.format(parseIsoLocal(split.period.from))} →{' '}
              <Link to={href(locationFor('timesheet', split.period.from))}>
                ‹ {shortPeriod(split.period)} timesheet
              </Link>
            </>
          )}
        </p>
      )}
    </>
  );
}

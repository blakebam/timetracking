import { calendarGridRange, formatHours, monthOf, todayIso, timesheetPeriods } from '@tt/shared';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { describeError } from '../../api/client';
import { useSummary } from '../../hooks/useSummary';
import styles from './CalendarPage.module.css';
import {
  buildWeeks,
  monthParam,
  monthTotal,
  parseMonthParam,
  periodTotals,
  shiftMonth,
  type YearMonth,
} from './calendarLogic';
import { MonthGrid } from './MonthGrid';
import { TimesheetList } from './TimesheetList';

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

/** "October 2026" */
export const formatMonth = ({ year, month }: YearMonth) =>
  monthYear.format(new Date(year, month - 1, 1));

const href = (ym: YearMonth) => `/calendar?month=${monthParam(ym)}`;

/** Route component for `/calendar?month=YYYY-MM`; a missing or invalid month means this month. */
export function CalendarPage() {
  const [params] = useSearchParams();
  const ym = parseMonthParam(params.get('month'));
  if (!ym) return <Navigate to={href(monthOf(todayIso()))} replace />;
  return <CalendarView ym={ym} />;
}

function CalendarView({ ym }: { ym: YearMonth }) {
  const navigate = useNavigate();
  const { year, month } = ym;
  const range = calendarGridRange(year, month);
  // One request for the whole grid; the in-month totals are taken from the same days.
  const { summary, error, reload } = useSummary(range.from, range.to);
  const days = summary?.days ?? [];

  const thisMonth = monthOf(todayIso());
  const showsThisMonth = thisMonth.year === year && thisMonth.month === month;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.nav}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => navigate(href(shiftMonth(ym, -1)))}
          >
            ◀
          </button>
          <h1 className={styles.title}>{formatMonth(ym)}</h1>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => navigate(href(shiftMonth(ym, 1)))}
          >
            ▶
          </button>
          <button type="button" disabled={showsThisMonth} onClick={() => navigate(href(thisMonth))}>
            This month
          </button>
        </div>
        <p className={styles.total}>
          Month total:{' '}
          <strong>{summary ? `${formatHours(monthTotal(days, year, month))} h` : '—'}</strong>
        </p>
      </header>

      {error && (
        <p className={styles.banner} role="alert">
          ⚠ {describeError(error)}{' '}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      )}

      <MonthGrid ym={ym} weeks={buildWeeks(range, days)} loading={!summary} />

      <TimesheetList
        title={`Timesheets — ${formatMonth(ym)}`}
        rows={periodTotals(timesheetPeriods(year, month), days)}
        loading={!summary}
      />
    </>
  );
}

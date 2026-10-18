import { todayIso, type DayTotal } from '@tt/shared';
import type { KeyboardEvent } from 'react';
import { inMonth, type YearMonth } from './calendarLogic';
import { DayCell } from './DayCell';
import styles from './MonthGrid.module.css';

const WEEKDAYS = [
  ['Sun', 'Sunday'],
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
] as const;

/** Arrow keys move focus by a day or a week, as a grid should. */
const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

function moveFocus(e: KeyboardEvent<HTMLTableElement>) {
  const step = STEP[e.key];
  if (step === undefined) return;
  const links = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>('a[data-day]')];
  const target = links[links.indexOf(document.activeElement as HTMLAnchorElement) + step];
  if (!target) return;
  e.preventDefault();
  target.focus();
}

/** The Sunday-first month grid. While loading, the frame shows with no data in the cells. */
export function MonthGrid({
  ym,
  weeks,
  loading,
}: {
  ym: YearMonth;
  weeks: DayTotal[][];
  loading: boolean;
}) {
  const today = todayIso();
  return (
    <table className={styles.grid} role="grid" aria-busy={loading} onKeyDown={moveFocus}>
      <thead>
        <tr>
          {WEEKDAYS.map(([short, long]) => (
            <th key={short} scope="col" abbr={long}>
              {short}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]!.date}>
            {week.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                muted={!inMonth(day.date, ym)}
                today={day.date === today}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

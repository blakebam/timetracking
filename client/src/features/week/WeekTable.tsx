import { formatHours, parseIsoLocal, todayIso, type DayTotal, type Summary } from '@tt/shared';
import { Link } from 'react-router';
import { startsNewMonth } from './weekLogic';
import styles from './WeekTable.module.css';

const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const monthDayFormat = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' });

/** Blank for zero, so empty cells stay empty. */
const hours = (minutes: number) => (minutes > 0 ? formatHours(minutes) : '');

export function WeekTable({ summary }: { summary: Summary }) {
  const today = todayIso();
  const { days, tasks } = summary;

  // A thicker left border where a new month begins (only possible in full-week mode).
  const dayClass = (i: number) =>
    [
      styles.num,
      i > 0 && startsNewMonth(days[i - 1]!.date, days[i]!.date) && styles.monthStart,
      days[i]!.date === today && styles.today,
    ]
      .filter(Boolean)
      .join(' ');

  const minutesOn = (day: DayTotal, taskName: string) =>
    day.tasks.find((t) => t.taskName === taskName)?.minutes ?? 0;

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.task}>
              Task
            </th>
            {days.map((day, i) => {
              const d = parseIsoLocal(day.date);
              return (
                <th key={day.date} scope="col" className={dayClass(i)}>
                  <Link to={`/day/${day.date}`} className={styles.dayLink}>
                    <span>{weekdayFormat.format(d)}</span>
                    <span className={styles.date}>{monthDayFormat.format(d)}</span>
                  </Link>
                </th>
              );
            })}
            <th scope="col" className={styles.num}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={days.length + 2} className={styles.empty}>
                No time logged in this period.
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr key={task.taskName}>
                <th scope="row" className={styles.task}>
                  {task.taskName}
                </th>
                {days.map((day, i) => (
                  <td key={day.date} className={dayClass(i)}>
                    {hours(minutesOn(day, task.taskName))}
                  </td>
                ))}
                <td className={`${styles.num} ${styles.rowTotal}`}>{formatHours(task.minutes)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={styles.task}>
              Daily total
            </th>
            {days.map((day, i) => (
              <td key={day.date} className={dayClass(i)}>
                {hours(day.minutes)}
              </td>
            ))}
            <td className={`${styles.num} ${styles.rowTotal}`}>
              {formatHours(summary.totalMinutes)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

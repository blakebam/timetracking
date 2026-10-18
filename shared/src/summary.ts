import { eachDay } from './dates';
import type { IsoDate, StartTime } from './primitives';
import { durationMinutes } from './time';
import type { TimeEntry } from './types';

export interface TaskTotal {
  taskName: string;
  minutes: number;
  /** The earliest entry for this task in the range (or in the day, inside `DayTotal.tasks`). */
  firstWorked: { date: IsoDate; startTime: StartTime };
}

export interface DayTotal {
  date: IsoDate;
  minutes: number;
  tasks: TaskTotal[];
}

export interface Summary {
  from: IsoDate;
  to: IsoDate;
  totalMinutes: number;
  /** Whole range, largest first, then by name. */
  tasks: TaskTotal[];
  /** One per day in [from, to], including days with nothing logged, in date order. */
  days: DayTotal[];
}

/** Tasks match ignoring case and runs of whitespace. */
const taskKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Sort key for "when": date, then start time. Both are fixed-width, so strings compare. */
const when = (e: Pick<TimeEntry, 'date' | 'startTime'>) => `${e.date} ${e.startTime}`;

/** Minutes desc, then name asc. The UI order. */
function byLargest(a: TaskTotal, b: TaskTotal): number {
  return b.minutes - a.minutes || a.taskName.localeCompare(b.taskName);
}

/** Chronological by first entry. The order used by PDFs and invoices. */
export function byFirstWorked(tasks: readonly TaskTotal[]): TaskTotal[] {
  return [...tasks].sort(
    (a, b) => when(a.firstWorked).localeCompare(when(b.firstWorked)) || byLargest(a, b),
  );
}

interface Group {
  minutes: number;
  first: TimeEntry;
}

function addTo(groups: Map<string, Group>, key: string, entry: TimeEntry) {
  const minutes = durationMinutes(entry.startTime, entry.endTime);
  const group = groups.get(key);
  if (!group) groups.set(key, { minutes, first: entry });
  else {
    group.minutes += minutes;
    if (when(entry) < when(group.first)) group.first = entry;
  }
}

/**
 * Totals per task and per day for entries in [from, to]; anything outside is ignored. Every
 * screen and document gets its hours from here. All math is in integer minutes.
 */
export function summarize(entries: readonly TimeEntry[], from: IsoDate, to: IsoDate): Summary {
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);

  // Display name: the spelling on the most recent entry of each task.
  const displayName = new Map<string, { name: string; at: string }>();
  for (const e of inRange) {
    const key = taskKey(e.taskName);
    const seen = displayName.get(key);
    if (!seen || when(e) >= seen.at) displayName.set(key, { name: e.taskName, at: when(e) });
  }

  const toTotals = (groups: Map<string, Group>): TaskTotal[] =>
    [...groups]
      .map(([key, g]) => ({
        taskName: displayName.get(key)!.name,
        minutes: g.minutes,
        firstWorked: { date: g.first.date, startTime: g.first.startTime },
      }))
      .sort(byLargest);

  const rangeGroups = new Map<string, Group>();
  const dayGroups = new Map<IsoDate, Map<string, Group>>();
  for (const e of inRange) {
    const key = taskKey(e.taskName);
    addTo(rangeGroups, key, e);
    let day = dayGroups.get(e.date);
    if (!day) dayGroups.set(e.date, (day = new Map()));
    addTo(day, key, e);
  }

  const tasks = toTotals(rangeGroups);
  const days = eachDay(from, to).map((date): DayTotal => {
    const dayTasks = toTotals(dayGroups.get(date) ?? new Map());
    return { date, minutes: dayTasks.reduce((sum, t) => sum + t.minutes, 0), tasks: dayTasks };
  });

  return {
    from,
    to,
    totalMinutes: tasks.reduce((sum, t) => sum + t.minutes, 0),
    tasks,
    days,
  };
}

import type { EndTime, StartTime, TimeOfDay } from './primitives';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Minutes since midnight. `24:00` → 1440. */
export function toMinutes(t: TimeOfDay): number {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}

/** Inverse of toMinutes. Throws unless `n` is on the 15-minute grid within 0–1440. */
export function fromMinutes(n: number): TimeOfDay {
  if (!Number.isInteger(n) || n < 0 || n > 1440 || n % 15 !== 0) {
    throw new RangeError(`${n} minutes is not a valid 15-minute time of day`);
  }
  return `${pad2(Math.floor(n / 60))}:${pad2(n % 60)}` as TimeOfDay;
}

export function durationMinutes(start: StartTime, end: EndTime): number {
  return toMinutes(end) - toMinutes(start);
}

/** Decimal hours with 2 dp, as used in the UI: 90 → "1.50". */
export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/**
 * Decimal hours without trailing zeros, as on the PDFs: 0 → "0", 30 → "0.5", 990 → "16.5",
 * 1905 → "31.75". The UI keeps formatHours.
 */
export function formatHoursCompact(minutes: number): string {
  return String(Number((minutes / 60).toFixed(2)));
}

/** The only way times are shown to the user: "13:30" → "1:30 PM", "24:00" → "12:00 AM". */
export function formatTime12(t: TimeOfDay): string {
  const total = toMinutes(t) % 1440;
  const h24 = Math.floor(total / 60);
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad2(total % 60)} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "9:00 AM – 10:30 AM" */
export function formatRange12(start: TimeOfDay, end: TimeOfDay): string {
  return `${formatTime12(start)} – ${formatTime12(end)}`;
}

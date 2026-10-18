import { isoDate } from '../primitives';
import type { SettingsInput, TimeEntryInput } from '../types';

/**
 * The September 2026 example: its per-period, per-task totals match the reference timesheets,
 * and its invoice is the reference invoice (7 lines, 49 hours, $490.00). The biller details are
 * placeholders.
 *
 *   9/1–9/6    Meetings 1 · Report Writing 16.5 · Data Entry 0.5
 *   9/7–9/13   Meetings 0.5 · Report Writing 9 · Data Entry 2 · Research 1 ·
 *              Planning 2
 *   9/14–9/27  (nothing)
 *   9/28–9/30  Meetings 1.5 · Research 4 · Design Review 4 · Email Support 1 ·
 *              Report Writing 6
 */
export const SEPTEMBER_2026_ENTRIES: TimeEntryInput[] = (
  [
    ['2026-09-01', '11:00', '12:00', 'Meetings'],
    ['2026-09-01', '12:00', '16:00', 'Report Writing'],
    ['2026-09-02', '11:00', '15:30', 'Report Writing'],
    ['2026-09-03', '11:00', '15:00', 'Report Writing'],
    ['2026-09-03', '15:00', '15:30', 'Data Entry'],
    ['2026-09-04', '11:00', '15:00', 'Report Writing'],

    ['2026-09-08', '11:00', '11:30', 'Meetings'],
    ['2026-09-08', '11:30', '16:00', 'Report Writing'],
    ['2026-09-09', '11:00', '15:30', 'Report Writing'],
    ['2026-09-09', '15:30', '17:30', 'Data Entry'],
    ['2026-09-10', '11:00', '12:00', 'Research'],
    ['2026-09-10', '12:00', '14:00', 'Planning'],

    ['2026-09-28', '11:00', '12:30', 'Meetings'],
    ['2026-09-28', '12:30', '16:30', 'Research'],
    ['2026-09-29', '11:00', '15:00', 'Design Review'],
    ['2026-09-29', '15:00', '16:00', 'Email Support'],
    ['2026-09-30', '11:00', '17:00', 'Report Writing'],
  ] as const
).map(([date, startTime, endTime, taskName]) => ({
  date: isoDate(date),
  startTime,
  endTime,
  taskName,
  notes: null,
}));

export const SEPTEMBER_2026_SETTINGS: SettingsInput = {
  billerName: 'Jane Doe',
  billerAddress: '123 Main St\nSpringfield, TX 75000',
  billerPhone: '555-555-0100',
  billerEmail: 'jane.doe@example.com',
  companyName: 'Example Company LLC',
  companyAddress: '456 Commerce Ave\nSpringfield, TX 75001',
  hourlyRateCents: 1000,
  paymentTerms: 'On Receipt',
  nextInvoiceNumber: 25,
  defaultStartTime: '11:00',
};

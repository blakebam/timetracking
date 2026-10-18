import type { EndTime, IsoDate, StartTime } from './primitives';

export interface TimeEntry {
  id: number;
  date: IsoDate;
  startTime: StartTime;
  endTime: EndTime;
  taskName: string;
  notes: string | null;
  /** UTC ISO audit timestamp, not billing data. */
  createdAt: string;
  updatedAt: string;
}

export type TimeEntryInput = Pick<
  TimeEntry,
  'date' | 'startTime' | 'endTime' | 'taskName' | 'notes'
>;

export interface Settings {
  billerName: string;
  billerAddress: string;
  billerPhone: string;
  billerEmail: string;
  companyName: string;
  companyAddress: string;
  hourlyRateCents: number;
  paymentTerms: string;
  nextInvoiceNumber: number;
  defaultStartTime: StartTime;
  updatedAt: string;
}

export type SettingsInput = Omit<Settings, 'updatedAt'>;

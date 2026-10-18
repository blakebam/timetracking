import type { Invoice } from './invoice';
import type { TimeEntry } from './types';

export interface ValidationIssue {
  /** Dot-separated field path, e.g. "endTime"; empty for whole-request problems. */
  path: string;
  message: string;
}

/** Every non-2xx JSON response body from the API. */
export type ApiError =
  | { error: 'validation'; issues: ValidationIssue[] } // 400
  | { error: 'overlap'; message: string; conflicts: TimeEntry[] } // 409
  | { error: 'invoice_exists'; invoice: Invoice } // 409: the month was already invoiced
  | { error: 'not_latest'; message: string } // 409: only the latest invoice can be deleted
  | { error: 'not_found' } // 404
  | { error: 'internal' }; // 500

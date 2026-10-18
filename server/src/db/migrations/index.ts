import type { Migration } from '../migrate';
import m001 from './001_initial';
import m002 from './002_invoices';

/** Append-only. Never edit a shipped migration; add a new one. */
export const migrations: readonly Migration[] = [
  { version: 1, sql: m001 },
  { version: 2, sql: m002 },
];

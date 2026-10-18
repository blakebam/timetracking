import type { IsoDate, TimeEntry, TimeEntryInput } from '@tt/shared';
import { apiFetch } from './client';

export const listEntries = (from: IsoDate, to: IsoDate, signal?: AbortSignal) =>
  apiFetch<TimeEntry[]>(`/entries?${new URLSearchParams({ from, to })}`, { signal });

export const getEntry = (id: number) => apiFetch<TimeEntry>(`/entries/${id}`);

export const createEntry = (input: TimeEntryInput) =>
  apiFetch<TimeEntry>('/entries', { method: 'POST', json: input });

export const updateEntry = (id: number, input: TimeEntryInput) =>
  apiFetch<TimeEntry>(`/entries/${id}`, { method: 'PUT', json: input });

export const deleteEntry = (id: number) => apiFetch<void>(`/entries/${id}`, { method: 'DELETE' });

export const taskNames = (q: string, signal?: AbortSignal) =>
  apiFetch<string[]>(`/tasks/names?${new URLSearchParams({ q })}`, { signal });

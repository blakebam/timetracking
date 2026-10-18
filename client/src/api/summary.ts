import type { IsoDate, Summary } from '@tt/shared';
import { apiFetch } from './client';

export const getSummary = (from: IsoDate, to: IsoDate, signal?: AbortSignal) =>
  apiFetch<Summary>(`/summary?${new URLSearchParams({ from, to })}`, { signal });

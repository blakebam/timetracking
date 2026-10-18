import type { Settings, SettingsInput } from '@tt/shared';
import { apiFetch } from './client';

export const getSettings = () => apiFetch<Settings>('/settings');

export const putSettings = (input: SettingsInput) =>
  apiFetch<Settings>('/settings', { method: 'PUT', json: input });

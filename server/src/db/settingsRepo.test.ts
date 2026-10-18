import type { SettingsInput } from '@tt/shared';
import { describe, expect, it } from 'vitest';
import { openDb } from './connection';
import { settingsRepo } from './settingsRepo';

describe('settingsRepo', () => {
  it('returns the defaults on a fresh database', () => {
    const repo = settingsRepo(openDb(':memory:'));
    expect(repo.get()).toMatchObject({
      billerName: '',
      companyName: '',
      hourlyRateCents: 0,
      paymentTerms: 'On Receipt',
      nextInvoiceNumber: 1,
      defaultStartTime: '11:00',
    });
  });

  it('round-trips a full update', () => {
    const repo = settingsRepo(openDb(':memory:'));
    const input: SettingsInput = {
      billerName: 'Jane Doe',
      billerAddress: '123 Main St\nSpringfield TX\n75000',
      billerPhone: '555-555-5555',
      billerEmail: 'jane@example.com',
      companyName: 'Acme LLC',
      companyAddress: '',
      hourlyRateCents: 1000,
      paymentTerms: 'Net 15',
      nextInvoiceNumber: 26,
      defaultStartTime: '08:30',
    };

    const updated = repo.update(input);
    expect(updated).toMatchObject(input);
    expect(repo.get()).toEqual(updated);
  });
});

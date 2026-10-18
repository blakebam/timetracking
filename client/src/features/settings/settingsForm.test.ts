import type { Settings } from '@tt/shared';
import { describe, expect, it } from 'vitest';
import {
  fieldForPath,
  isDirty,
  normalizeRateInput,
  parseInvoiceNumber,
  splitSettingsIssues,
  toForm,
  validateForm,
} from './settingsForm';

const settings: Settings = {
  billerName: 'Jane Doe',
  billerAddress: '123 Main St\nSpringfield TX\n75000',
  billerPhone: '555-555-5555',
  billerEmail: 'jane@example.com',
  companyName: 'Acme LLC',
  companyAddress: '',
  hourlyRateCents: 1000,
  paymentTerms: 'On Receipt',
  nextInvoiceNumber: 26,
  defaultStartTime: '11:00',
  updatedAt: '',
};

describe('toForm', () => {
  it('formats the rate as an amount without the dollar sign', () => {
    expect(toForm(settings).hourlyRate).toBe('10.00');
    expect(toForm({ ...settings, hourlyRateCents: 123456 }).hourlyRate).toBe('1,234.56');
    expect(toForm(settings).nextInvoiceNumber).toBe('26');
  });
});

describe('normalizeRateInput', () => {
  it('reformats parseable amounts and leaves junk alone', () => {
    expect(normalizeRateInput('10')).toBe('10.00');
    expect(normalizeRateInput('$1234.5')).toBe('1,234.50');
    expect(normalizeRateInput('abc')).toBe('abc');
  });
});

describe('parseInvoiceNumber', () => {
  it('accepts plain whole numbers only', () => {
    expect(parseInvoiceNumber(' 26 ')).toBe(26);
    expect(parseInvoiceNumber('2.5')).toBeNull();
    expect(parseInvoiceNumber('')).toBeNull();
  });
});

describe('isDirty', () => {
  const initial = toForm(settings);

  it('is false for the loaded values', () => {
    expect(isDirty({ ...initial }, initial)).toBe(false);
  });

  it('compares numbers by value', () => {
    expect(isDirty({ ...initial, hourlyRate: '10' }, initial)).toBe(false);
    expect(isDirty({ ...initial, nextInvoiceNumber: '026' }, initial)).toBe(false);
    expect(isDirty({ ...initial, hourlyRate: '36' }, initial)).toBe(true);
    expect(isDirty({ ...initial, hourlyRate: 'abc' }, initial)).toBe(true);
  });

  it('notices text and time changes', () => {
    expect(isDirty({ ...initial, companyName: 'Acme Inc' }, initial)).toBe(true);
    expect(isDirty({ ...initial, defaultStartTime: '09:00' }, initial)).toBe(true);
    expect(isDirty({ ...initial, defaultStartTime: null }, initial)).toBe(true);
  });
});

describe('fieldForPath / splitSettingsIssues', () => {
  it('maps hourlyRateCents to the rate input', () => {
    expect(fieldForPath('hourlyRateCents')).toBe('hourlyRate');
    expect(fieldForPath('billerEmail')).toBe('billerEmail');
    expect(fieldForPath('')).toBeNull();
  });

  it('keeps the first issue per field and collects the rest', () => {
    const result = splitSettingsIssues([
      { path: 'nextInvoiceNumber', message: 'Too low' },
      { path: 'nextInvoiceNumber', message: 'Second' },
      { path: '', message: 'Body must be an object' },
    ]);
    expect(result.fieldErrors).toEqual({ nextInvoiceNumber: 'Too low' });
    expect(result.other).toEqual(['Body must be an object']);
  });
});

describe('validateForm', () => {
  it('builds a trimmed API body', () => {
    const result = validateForm({ ...toForm(settings), billerName: '  Jane  ', hourlyRate: '40' });
    expect(result).toEqual({
      ok: true,
      input: {
        billerName: 'Jane',
        billerAddress: settings.billerAddress,
        billerPhone: settings.billerPhone,
        billerEmail: settings.billerEmail,
        companyName: settings.companyName,
        companyAddress: '',
        hourlyRateCents: 4000,
        paymentTerms: 'On Receipt',
        nextInvoiceNumber: 26,
        defaultStartTime: '11:00',
      },
    });
  });

  it('reports field errors', () => {
    const result = validateForm({
      ...toForm(settings),
      billerEmail: 'not-an-email',
      hourlyRate: '10.555',
      nextInvoiceNumber: '0',
      paymentTerms: ' ',
      defaultStartTime: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toMatchObject({
      billerEmail: 'Enter a valid email address',
      hourlyRate: 'Enter an amount like 10.00',
      nextInvoiceNumber: expect.any(String),
      paymentTerms: 'Payment terms are required',
      defaultStartTime: expect.any(String),
    });
  });

  it('uses the schema message for an amount out of range', () => {
    const result = validateForm({ ...toForm(settings), hourlyRate: '10,000.01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.hourlyRate).toMatch(/between \$0\.00 and/);
  });
});

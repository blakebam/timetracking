import { describe, expect, it } from 'vitest';
import { formatRate, formatUsd, parseUsdToCents } from './money';

describe('parseUsdToCents', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.50', 1050],
    ['$1,234.56', 123456],
    ['  0.05 ', 5],
    ['1234', 123400],
  ])('parses %o → %i', (input, cents) => {
    expect(parseUsdToCents(input)).toBe(cents);
  });

  it.each(['10.555', '-1', 'abc', '', '$', '10.', '.5', '1,23', '12,34.00', '1e3', '$-5'])(
    'rejects %o',
    (input) => {
      expect(parseUsdToCents(input)).toBeNull();
    },
  );
});

describe('formatUsd', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [87500, '$875.00'],
    [49000, '$490.00'],
    [123456789, '$1,234,567.89'],
  ])('formats %i → %s', (cents, text) => {
    expect(formatUsd(cents)).toBe(text);
  });

  it('round-trips with parseUsdToCents', () => {
    for (const cents of [0, 1, 99, 1050, 49000]) {
      expect(parseUsdToCents(formatUsd(cents))).toBe(cents);
    }
  });

  it('formats rates the same way', () => {
    expect(formatRate(1000)).toBe('$10.00');
  });
});

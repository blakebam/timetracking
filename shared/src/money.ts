/** "35", "35.5", "$1,234.56"; commas must group thousands correctly. */
const USD_RE = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a dollar amount typed by the user into integer cents, without float math.
 * Returns null for negatives, more than 2 decimal places, or anything else unparseable.
 */
export function parseUsdToCents(s: string): number | null {
  const match = USD_RE.exec(s.trim());
  if (!match) return null;
  const dollars = Number(match[1]!.replaceAll(',', ''));
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  const total = dollars * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

/** 123456 → "$1,234.56". Always 2 decimals, with thousands separators. */
export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+$)/g, ',');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

/** The hourly rate column. Same as formatUsd today; separate so it can change on its own. */
export const formatRate = formatUsd;

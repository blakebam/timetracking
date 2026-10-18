import {
  formatUsd,
  parseUsdToCents,
  settingsInputSchema,
  type Settings,
  type SettingsInput,
  type StartTime,
  type ValidationIssue,
} from '@tt/shared';

/** What the inputs hold: numbers are kept as typed text until save. */
export interface SettingsForm {
  billerName: string;
  billerAddress: string;
  billerPhone: string;
  billerEmail: string;
  companyName: string;
  companyAddress: string;
  hourlyRate: string;
  paymentTerms: string;
  nextInvoiceNumber: string;
  /** Null while the time picker holds text that isn't a time. */
  defaultStartTime: StartTime | null;
}

export type SettingsField = keyof SettingsForm;
export type SettingsFieldErrors = Partial<Record<SettingsField, string>>;

const SETTINGS_FIELDS: readonly SettingsField[] = [
  'billerName',
  'billerAddress',
  'billerPhone',
  'billerEmail',
  'companyName',
  'companyAddress',
  'hourlyRate',
  'paymentTerms',
  'nextInvoiceNumber',
  'defaultStartTime',
];

const RATE_INVALID = 'Enter an amount like 10.00';

/** 1000 → "10.00"; 123456 → "1,234.56". */
export function formatRateInput(cents: number): string {
  return formatUsd(cents).slice(1);
}

/** Reformats a parseable rate ("10" → "10.00"); leaves anything else as typed. */
export function normalizeRateInput(text: string): string {
  const cents = parseUsdToCents(text);
  return cents === null ? text : formatRateInput(cents);
}

/** "26" → 26; anything that isn't a plain whole number → null. */
export function parseInvoiceNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function toForm(s: Settings): SettingsForm {
  return {
    billerName: s.billerName,
    billerAddress: s.billerAddress,
    billerPhone: s.billerPhone,
    billerEmail: s.billerEmail,
    companyName: s.companyName,
    companyAddress: s.companyAddress,
    hourlyRate: formatRateInput(s.hourlyRateCents),
    paymentTerms: s.paymentTerms,
    nextInvoiceNumber: String(s.nextInvoiceNumber),
    defaultStartTime: s.defaultStartTime,
  };
}

/** True when the form differs from what was loaded. Numbers compare by value, so "10" = "10.00". */
export function isDirty(form: SettingsForm, initial: SettingsForm): boolean {
  return SETTINGS_FIELDS.some((key) => {
    if (form[key] === initial[key]) return false;
    if (key === 'hourlyRate') {
      const cents = parseUsdToCents(form.hourlyRate);
      return cents === null || cents !== parseUsdToCents(initial.hourlyRate);
    }
    if (key === 'nextInvoiceNumber') {
      const n = parseInvoiceNumber(form.nextInvoiceNumber);
      return n === null || n !== parseInvoiceNumber(initial.nextInvoiceNumber);
    }
    return true;
  });
}

/** Maps an API/schema issue path to the input that shows it; null for whole-request issues. */
export function fieldForPath(path: string): SettingsField | null {
  if (path === 'hourlyRateCents') return 'hourlyRate';
  return SETTINGS_FIELDS.find((f) => f === path) ?? null;
}

/** Splits validation issues into per-field errors (first one wins) and the rest, for the banner. */
export function splitSettingsIssues(issues: readonly ValidationIssue[]): {
  fieldErrors: SettingsFieldErrors;
  other: string[];
} {
  const fieldErrors: SettingsFieldErrors = {};
  const other: string[] = [];
  for (const issue of issues) {
    const field = fieldForPath(issue.path);
    if (field) fieldErrors[field] ??= issue.message;
    else other.push(issue.message);
  }
  return { fieldErrors, other };
}

export type FormValidation =
  { ok: true; input: SettingsInput } | { ok: false; fieldErrors: SettingsFieldErrors };

/** Converts the form to an API body, validated with the shared schema. */
export function validateForm(form: SettingsForm): FormValidation {
  const cents = parseUsdToCents(form.hourlyRate);
  const parsed = settingsInputSchema.safeParse({
    ...form,
    hourlyRate: undefined,
    // NaN fails the schema's number check with its own message.
    hourlyRateCents: cents ?? NaN,
    nextInvoiceNumber: parseInvoiceNumber(form.nextInvoiceNumber) ?? NaN,
  });

  if (parsed.success) return { ok: true, input: parsed.data };

  const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const { fieldErrors } = splitSettingsIssues(issues);
  // The schema's range message doesn't fit text that isn't an amount at all.
  if (cents === null) fieldErrors.hourlyRate = RATE_INVALID;
  return { ok: false, fieldErrors };
}

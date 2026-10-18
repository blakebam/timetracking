import { z } from 'zod';
import { daysBetween } from './dates';
import { formatUsd } from './money';
import { endTimeSchema, isoDateSchema, startTimeSchema } from './primitives';

const MAX_RANGE_DAYS = 366;

/** Trimmed, with internal runs of whitespace collapsed to one space. */
export const taskNameSchema = z
  .string('Task is required')
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Task is required').max(100, 'Task must be 100 characters or fewer'));

/** Optional; blank becomes null. */
export const notesSchema = z
  .string('Notes must be text')
  .trim()
  .max(1000, 'Notes must be 1000 characters or fewer')
  .nullish()
  .transform((s) => s || null);

export const entryInputSchema = z
  .object({
    date: isoDateSchema,
    startTime: startTimeSchema,
    endTime: endTimeSchema,
    taskName: taskNameSchema,
    notes: notesSchema,
  })
  .refine((e) => e.endTime > e.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export const rangeQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((r) => r.from <= r.to, {
    message: '"from" must be on or before "to"',
    path: ['to'],
  })
  .refine((r) => daysBetween(r.from, r.to) < MAX_RANGE_DAYS, {
    message: `Date range can cover at most ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  });

const ID_MESSAGE = 'Id must be a positive whole number';
export const idParamSchema = z.object({
  id: z.coerce.number(ID_MESSAGE).int(ID_MESSAGE).positive(ID_MESSAGE),
});

export const taskNamesQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce
    .number('Limit must be a number')
    .int('Limit must be a whole number')
    .min(1, 'Limit must be between 1 and 50')
    .max(50, 'Limit must be between 1 and 50')
    .default(20),
});

/** Trimmed free text; blank is allowed. */
const textField = (label: string, max: number) =>
  z.string(`${label} must be text`).trim().max(max, `${label} must be ${max} characters or fewer`);

/** Multi-line text; line endings normalized to \n and trailing spaces on each line removed. */
const multilineField = (label: string, max: number) =>
  z
    .string(`${label} must be text`)
    .transform((s) =>
      s
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim(),
    )
    .pipe(z.string().max(max, `${label} must be ${max} characters or fewer`));

const integerField = (message: string) => z.number(message).int(message);

export const MAX_HOURLY_RATE_CENTS = 1_000_000;
const RATE_MESSAGE = `Hourly rate must be between $0.00 and ${formatUsd(MAX_HOURLY_RATE_CENTS)}`;
const INVOICE_NUMBER_MESSAGE = 'Next invoice number must be a whole number, 1 or higher';

export const settingsInputSchema = z.object({
  billerName: textField('Name', 100),
  billerAddress: multilineField('Address', 500),
  billerPhone: textField('Phone', 50),
  billerEmail: textField('Email', 254).refine(
    (s) => s === '' || z.email().safeParse(s).success,
    'Enter a valid email address',
  ),
  companyName: textField('Company', 100),
  companyAddress: multilineField('Company address', 500),
  hourlyRateCents: integerField(RATE_MESSAGE)
    .min(0, RATE_MESSAGE)
    .max(MAX_HOURLY_RATE_CENTS, RATE_MESSAGE),
  paymentTerms: textField('Payment terms', 50).min(1, 'Payment terms are required'),
  nextInvoiceNumber: integerField(INVOICE_NUMBER_MESSAGE).min(1, INVOICE_NUMBER_MESSAGE),
  defaultStartTime: startTimeSchema,
});

const MONTH_MESSAGE = 'Month must be YYYY-MM';

/** "2026-09" → { year: 2026, month: 9 }. */
export const monthSchema = z
  .string(MONTH_MESSAGE)
  .regex(/^(19|[2-9]\d)\d\d-(0[1-9]|1[0-2])$/, MONTH_MESSAGE)
  .transform((s) => ({ year: Number(s.slice(0, 4)), month: Number(s.slice(5, 7)) }));

export const monthParamSchema = z.object({ month: monthSchema });

/** `GET /api/invoices/draft`; the invoice date defaults to the 1st of the next month. */
export const invoiceDraftQuerySchema = monthParamSchema.extend({
  invoiceDate: isoDateSchema.optional(),
});

/** `?inline=1` opens a PDF in the browser instead of downloading it. */
const inlineFlag = z
  .enum(['0', '1'], 'Inline must be 0 or 1')
  .optional()
  .transform((v) => v === '1');

export const pdfQuerySchema = z.object({ inline: inlineFlag });

/** `GET /api/reports/timesheet.pdf`: the timesheet period containing `start`. */
export const timesheetPdfQuerySchema = pdfQuerySchema.extend({ start: isoDateSchema });

/** `GET /api/invoices/draft.pdf` */
export const draftPdfQuerySchema = invoiceDraftQuerySchema.extend({ inline: inlineFlag });

export const issueInvoiceSchema = z.object({ month: monthSchema, invoiceDate: isoDateSchema });

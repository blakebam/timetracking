import type { Settings, SettingsInput, StartTime } from '@tt/shared';
import type { Db } from './connection';

interface SettingsRow {
  biller_name: string;
  biller_address: string;
  biller_phone: string;
  biller_email: string;
  company_name: string;
  company_address: string;
  hourly_rate_cents: number;
  payment_terms: string;
  next_invoice_number: number;
  default_start_time: string;
  updated_at: string;
}

const toSettings = (r: SettingsRow): Settings => ({
  billerName: r.biller_name,
  billerAddress: r.biller_address,
  billerPhone: r.biller_phone,
  billerEmail: r.biller_email,
  companyName: r.company_name,
  companyAddress: r.company_address,
  hourlyRateCents: r.hourly_rate_cents,
  paymentTerms: r.payment_terms,
  nextInvoiceNumber: r.next_invoice_number,
  defaultStartTime: r.default_start_time as StartTime,
  updatedAt: r.updated_at,
});

export function settingsRepo(db: Db) {
  const stmts = {
    get: db.prepare<[], SettingsRow>('SELECT * FROM settings WHERE id = 1'),
    update: db.prepare<[SettingsInput], SettingsRow>(
      `UPDATE settings
       SET biller_name = @billerName, biller_address = @billerAddress,
           biller_phone = @billerPhone, biller_email = @billerEmail,
           company_name = @companyName, company_address = @companyAddress,
           hourly_rate_cents = @hourlyRateCents, payment_terms = @paymentTerms,
           next_invoice_number = @nextInvoiceNumber, default_start_time = @defaultStartTime,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = 1
       RETURNING *`,
    ),
    setNextInvoiceNumber: db.prepare<[number]>(
      `UPDATE settings
       SET next_invoice_number = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id = 1`,
    ),
  };

  return {
    /** The settings row always exists (seeded by migration 001). */
    get(): Settings {
      return toSettings(stmts.get.get()!);
    },

    /** Full replace. */
    update(input: SettingsInput): Settings {
      return toSettings(stmts.update.get(input)!);
    },

    /** Used when an invoice is issued or deleted. */
    setNextInvoiceNumber(n: number): void {
      stmts.setNextInvoiceNumber.run(n);
    },
  };
}

export type SettingsRepo = ReturnType<typeof settingsRepo>;

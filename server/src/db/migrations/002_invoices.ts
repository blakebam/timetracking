export default /* sql */ `
CREATE TABLE invoices (
  id                 INTEGER PRIMARY KEY,
  invoice_number     INTEGER NOT NULL UNIQUE CHECK (invoice_number >= 1),
  period_start       TEXT    NOT NULL,              -- first day of month
  period_end         TEXT    NOT NULL,              -- last day of month
  invoice_date       TEXT    NOT NULL,              -- date printed on the invoice
  total_minutes      INTEGER NOT NULL CHECK (total_minutes > 0),
  hourly_rate_cents  INTEGER NOT NULL CHECK (hourly_rate_cents > 0),
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  -- snapshot of settings at issue time
  biller_name        TEXT    NOT NULL,
  biller_address     TEXT    NOT NULL,
  biller_phone       TEXT    NOT NULL,
  biller_email       TEXT    NOT NULL,
  company_name       TEXT    NOT NULL,
  company_address    TEXT    NOT NULL,
  payment_terms      TEXT    NOT NULL,
  issued_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (period_start, period_end)                 -- one invoice per month
);

CREATE TABLE invoice_lines (
  id            INTEGER PRIMARY KEY,
  invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  task_name     TEXT    NOT NULL,
  minutes       INTEGER NOT NULL CHECK (minutes > 0),
  rate_cents    INTEGER NOT NULL,
  amount_cents  INTEGER NOT NULL,
  UNIQUE (invoice_id, position)
);
`;

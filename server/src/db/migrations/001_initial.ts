export default /* sql */ `
CREATE TABLE time_entries (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  start_time  TEXT NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  end_time    TEXT NOT NULL CHECK (end_time   GLOB '[0-2][0-9]:[0-5][0-9]'),
  task_name   TEXT NOT NULL CHECK (length(trim(task_name)) > 0),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (end_time > start_time)  -- zero-padded HH:MM compares correctly as text
);
CREATE INDEX idx_entries_date ON time_entries (date, start_time);
CREATE INDEX idx_entries_task ON time_entries (task_name COLLATE NOCASE);

-- Backstop: overlapping entries on the same day are never allowed.
-- (The API checks first to return a friendly 409; these triggers catch anything that slips past.)
CREATE TRIGGER trg_entries_no_overlap_insert
BEFORE INSERT ON time_entries
WHEN EXISTS (SELECT 1 FROM time_entries
             WHERE date = NEW.date AND start_time < NEW.end_time AND end_time > NEW.start_time)
BEGIN SELECT RAISE(ABORT, 'overlap'); END;

CREATE TRIGGER trg_entries_no_overlap_update
BEFORE UPDATE OF date, start_time, end_time ON time_entries
WHEN EXISTS (SELECT 1 FROM time_entries
             WHERE id <> NEW.id AND date = NEW.date
               AND start_time < NEW.end_time AND end_time > NEW.start_time)
BEGIN SELECT RAISE(ABORT, 'overlap'); END;

CREATE TABLE settings (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  biller_name          TEXT    NOT NULL DEFAULT '',
  biller_address       TEXT    NOT NULL DEFAULT '',
  biller_phone         TEXT    NOT NULL DEFAULT '',
  biller_email         TEXT    NOT NULL DEFAULT '',
  company_name         TEXT    NOT NULL DEFAULT '',
  company_address      TEXT    NOT NULL DEFAULT '',
  hourly_rate_cents    INTEGER NOT NULL DEFAULT 0 CHECK (hourly_rate_cents >= 0),
  payment_terms        TEXT    NOT NULL DEFAULT 'On Receipt',
  next_invoice_number  INTEGER NOT NULL DEFAULT 1 CHECK (next_invoice_number >= 1),
  default_start_time   TEXT    NOT NULL DEFAULT '11:00'
                       CHECK (default_start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  updated_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO settings (id) VALUES (1);
`;

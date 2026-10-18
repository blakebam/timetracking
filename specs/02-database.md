# Spec 2 — Database Layer

## Goal
Open the SQLite database, apply schema migrations automatically on startup, and expose typed repository functions for entries and settings. Invoice tables are added later by spec 8, as migration 002.

Depends on: spec 1.

## Files
```
server/src/db/
├─ connection.ts        # openDb(path) → Database
├─ migrate.ts           # runMigrations(db)
├─ migrations/
│  ├─ index.ts          # ordered array: [{ version: 1, sql: m001 }, ...]
│  └─ 001_initial.ts    # export default `...SQL...`
├─ entriesRepo.ts
└─ settingsRepo.ts
shared/src/
├─ primitives.ts        # IsoDate / TimeOfDay types + their zod schemas + constructors
└─ types.ts             # TimeEntry, Settings (camelCase, used by client + server)
```
Migrations are TS modules that export SQL strings (not `.sql` files), so `tsup` bundles them with no copy step.

## Connection (`openDb`)
- Creates the parent directory if it is missing. Accepts `":memory:"` for tests.
- Pragmas:
  - `foreign_keys = ON`
  - `busy_timeout = 3000`
  - `journal_mode = DELETE` — keeps everything in **one file**, so backup is a plain file copy while the server is stopped. WAL brings no benefit for a single user.
- Runs `runMigrations(db)` before returning.
- `index.ts` closes the DB on `SIGINT`/`SIGTERM`.

## Migration runner
- Reads `PRAGMA user_version`. For each migration with a higher `version`, in order:
  1. runs its SQL
  2. sets `PRAGMA user_version = <version>`
  3. does both inside **one transaction**
- If the DB's `user_version` is newer than the code knows about, the runner throws a clear error and refuses to start.
- Migrations are append-only. Never edit a shipped migration; add a new one.

## Schema — migration 001
```sql
CREATE TABLE time_entries (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  start_time  TEXT NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  end_time    TEXT NOT NULL CHECK (end_time   GLOB '[0-2][0-9]:[0-5][0-9]'),
  task_name   TEXT NOT NULL CHECK (length(trim(task_name)) > 0),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (end_time > start_time)          -- zero-padded HH:MM compares correctly as text
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
  biller_address       TEXT    NOT NULL DEFAULT '',   -- multi-line; printed line by line
  biller_phone         TEXT    NOT NULL DEFAULT '',
  biller_email         TEXT    NOT NULL DEFAULT '',
  company_name         TEXT    NOT NULL DEFAULT '',
  company_address      TEXT    NOT NULL DEFAULT '',   -- multi-line, optional
  hourly_rate_cents    INTEGER NOT NULL DEFAULT 0 CHECK (hourly_rate_cents >= 0),
  payment_terms        TEXT    NOT NULL DEFAULT 'On Receipt',
  next_invoice_number  INTEGER NOT NULL DEFAULT 1 CHECK (next_invoice_number >= 1),
  default_start_time   TEXT    NOT NULL DEFAULT '11:00'
                       CHECK (default_start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  updated_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO settings (id) VALUES (1);
```
The `invoices` and `invoice_lines` tables are added by **migration 002 in spec 8**.
Notes:
- DB `CHECK`s are a backstop for format only. Exact rules (15-minute grid, `24:00` end-of-day, real calendar dates) are enforced by the zod schemas in `primitives.ts`.
- Touching edges (10:00–11:00 then 11:00–12:00) are **not** overlaps, because the comparisons are strict.
- `"24:00"` sorts after every other valid time as text, so both the `CHECK` and the overlap triggers work without special cases.
- `created_at`/`updated_at` are UTC audit fields. They are never used for billing.
- `biller_address`, `biller_phone`, `biller_email` and `payment_terms` are additions to the original list, matching the example invoice header (`A:/ExamplePdfs/September_Invoice.pdf`, kept outside the repo).
- `default_start_time` is the start time the Day view suggests on an empty day (spec 4). It is editable on the Settings page (spec 7).
- Times are stored as 24-hour `HH:MM`. The UI always **displays** a 12-hour clock (`formatTime12`, spec 3).

## Date/time primitives (`shared/src/primitives.ts`)
These types make the formats checkable at compile time, not just documented in comments.

```ts
type Hour    = '00'|'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'
             | '12'|'13'|'14'|'15'|'16'|'17'|'18'|'19'|'20'|'21'|'22'|'23';
type Quarter = '00'|'15'|'30'|'45';

/** Exact set of 97 allowed times: 00:00 … 23:45, plus 24:00 (end of day). */
export type TimeOfDay = `${Hour}:${Quarter}` | '24:00';
export type StartTime = Exclude<TimeOfDay, '24:00'>;
export type EndTime   = Exclude<TimeOfDay, '00:00'>;

/** A validated, real calendar date 'YYYY-MM-DD'. Only obtainable via isoDateSchema / isoDate(). */
export const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(isRealDate, 'Not a real calendar date')
  .brand<'IsoDate'>();
export type IsoDate = z.infer<typeof isoDateSchema>;

export const startTimeSchema: z.ZodType<StartTime> = /* regex ^([01]\d|2[0-3]):(00|15|30|45)$ */;
export const endTimeSchema:   z.ZodType<EndTime>   = /* same grid, 00:15 … 24:00 */;

export function isoDate(s: string): IsoDate;   // parse-or-throw; for code and tests
export function toIsoDate(d: Date): IsoDate;   // local calendar date of a JS Date
```
- `TimeOfDay` is an **exact** union, so a typo like `startTime: '08:10'` is a compile error, and editors autocomplete valid times.
- `IsoDate` is a **branded** string. A template literal type can't express "a real calendar date", so instead the type can only come from the validator. A plain `string` won't type-check where an `IsoDate` is expected.
- Types are erased at runtime, so data entering from outside (HTTP bodies, query strings, DB rows) still goes through these schemas or a trusted cast. The repos cast DB rows because the DB only ever receives validated values; the types then guarantee correctness everywhere inside.

## Shared types (`shared/src/types.ts`)
```ts
export interface TimeEntry {
  id: number;
  date: IsoDate;
  startTime: StartTime;
  endTime: EndTime;
  taskName: string;
  notes: string | null;
  createdAt: string;   // UTC ISO audit timestamp, not billing data
  updatedAt: string;
}
export type TimeEntryInput = Pick<TimeEntry, 'date' | 'startTime' | 'endTime' | 'taskName' | 'notes'>;

export interface Settings {
  billerName: string;  billerAddress: string;  billerPhone: string;  billerEmail: string;
  companyName: string; companyAddress: string;
  hourlyRateCents: number;
  paymentTerms: string;
  nextInvoiceNumber: number;
  defaultStartTime: StartTime;
  updatedAt: string;
}
export type SettingsInput = Omit<Settings, 'updatedAt'>;
```

## Repositories
Each repository is a factory that takes `db` and uses prepared statements created once. Rows are mapped snake_case → camelCase in one place per repo.

**`entriesRepo(db)`**
| Function | Behavior |
|---|---|
| `listByRange(from, to)` | inclusive range, ordered by `date, start_time` |
| `getById(id)` | `TimeEntry \| undefined` |
| `create(input)` | inserts and returns the created entry; throws `OverlapError` if the trigger fires |
| `update(id, input)` | full replace and bumps `updated_at`; returns the entry, or `undefined` if not found; throws `OverlapError` if the trigger fires |
| `remove(id)` | `boolean` (true if a row was deleted) |
| `findOverlapping(date, start, end, excludeId?)` | entries on `date` where `start_time < end AND end_time > start` |
| `taskNames(prefix?, limit = 20)` | distinct names, case-insensitive. Returns the most recently used spelling, ordered by most recent use. Optional case-insensitive prefix filter. |

**`settingsRepo(db)`**
| Function | Behavior |
|---|---|
| `get()` | `Settings` (row always exists) |
| `update(input)` | full replace and bumps `updated_at`; returns `Settings` |

Wiring: `index.ts` calls `openDb(config.dbPath)` and passes it to `createApp({ db })`. Repos are constructed inside `createApp`.

## Acceptance criteria
- [ ] The first start creates `data/timetracking.db` with `time_entries` and `settings`. `user_version = 1` and the settings row exists.
- [ ] Restarting does not re-run migrations or duplicate the settings row.
- [ ] A DB with `user_version = 99` makes startup fail with a readable message.
- [ ] If a migration fails partway, it rolls back and leaves `user_version` unchanged.
- [ ] Vitest (using `:memory:`):
  - entries CRUD round-trip
  - `listByRange` boundaries are inclusive
  - `findOverlapping` covers: touching edges (10:00–11:00 vs 11:00–12:00) **do not** overlap; nested and partial overlaps **do**; `excludeId` is respected
  - `taskNames` dedupes "Meeting"/"meeting" and returns the most recent spelling
  - a DB `CHECK` rejects `end_time <= start_time`
  - the overlap triggers: an overlapping insert/update throws `OverlapError`; a touching insert succeeds; updating an entry in place (same times) succeeds
  - settings get/update round-trip
- [ ] Type-level checks (typecheck must pass with `// @ts-expect-error` on the bad lines):
  - `const t: StartTime = '08:10'` fails
  - `const t: StartTime = '24:00'` fails
  - `const d: IsoDate = '2026-10-17'` fails (it must go through `isoDate()`)
- [ ] `isoDate('2026-02-30')` throws; `isoDate('2028-02-29')` succeeds.

## Out of scope
HTTP routes (spec 3), invoice repository and numbering logic (spec 8), backup endpoint.

# Spec 8 — Invoices

## Goal
Turn a calendar month of entries into a numbered invoice:
- **Preview** the month's invoice (task lines, hours × rate, total) as a draft.
- **Issue** it. Issuing permanently assigns the next invoice number and stores a **snapshot**: the lines, the rate, and the biller and company details.

Re-downloading an issued invoice always reproduces it exactly, even if you later edit entries or settings.

Depends on: specs 2, 3, 6 (`summarize`, `byFirstWorked`, `monthRange`), 7 (settings, `money.ts`). The PDF itself is spec 9.

## Files
```
server/src/db/migrations/002_invoices.ts
server/src/db/invoicesRepo.ts
server/src/routes/invoices.ts
shared/src/
├─ invoice.ts          # buildInvoiceDraft(), formatInvoiceNumber(), lineAmountCents()
├─ schemas.ts          # + monthParamSchema, issueInvoiceSchema
└─ api.ts              # + invoice error variants
client/src/
├─ api/invoices.ts
└─ features/invoices/
   ├─ InvoicesPage.tsx
   ├─ DraftPanel.tsx
   ├─ InvoiceList.tsx
   └─ *.module.css
```

## Schema — migration 002
```sql
CREATE TABLE invoices (
  id                 INTEGER PRIMARY KEY,
  invoice_number     INTEGER NOT NULL UNIQUE,
  period_start       TEXT    NOT NULL,              -- first day of month
  period_end         TEXT    NOT NULL,              -- last day of month
  invoice_date       TEXT    NOT NULL,              -- date printed on the invoice
  total_minutes      INTEGER NOT NULL CHECK (total_minutes > 0),
  hourly_rate_cents  INTEGER NOT NULL CHECK (hourly_rate_cents > 0),
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  -- snapshot of settings at issue time
  biller_name TEXT NOT NULL, biller_address TEXT NOT NULL,
  biller_phone TEXT NOT NULL, biller_email TEXT NOT NULL,
  company_name TEXT NOT NULL, company_address TEXT NOT NULL,
  payment_terms TEXT NOT NULL,
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
```

## Invoice math (`shared/src/invoice.ts`)
```ts
interface InvoiceLine  { taskName: string; minutes: number; rateCents: number; amountCents: number }
interface InvoiceDraft {
  invoiceNumber: number;        // settings.nextInvoiceNumber (draft) or the issued number
  periodStart: IsoDate;
  periodEnd: IsoDate;
  invoiceDate: IsoDate;
  lines: InvoiceLine[];
  totalMinutes: number;
  amountCents: number;
  biller:  { name: string; address: string; phone: string; email: string };
  company: { name: string; address: string };
  paymentTerms: string;
}
type Invoice = InvoiceDraft & { id: number; issuedAt: string };
```
- `buildInvoiceDraft(summary, settings, invoiceDate)`:
  - one line per task, in `byFirstWorked` order (matches the example)
  - every line uses the settings rate
- **Line amount:** `lineAmountCents(minutes, rateCents) = Math.round(minutes * rateCents / 60)`.
  - Everything stays in integer cents.
  - With quarter hours, rounding only matters when the rate isn't a multiple of 4 cents.
- **Total:** `amountCents` = the sum of the line amounts, so the printed lines always add up to the printed total.
- `formatInvoiceNumber(n)` → `"INV" + n padded to 4 digits`, e.g. 25 → `INV0025`.
- **Default invoice date:** the 1st of the month after the period (Sept → Oct 1, as in the example). It can be changed before issuing.

## Endpoints
| Method & path | Request | Success |
|---|---|---|
| `GET /api/invoices` | — | `200` list: `{ id, invoiceNumber, periodStart, periodEnd, invoiceDate, totalMinutes, amountCents }[]`, newest first |
| `GET /api/invoices/draft?month=YYYY-MM&invoiceDate=` | `invoiceDate` optional | `200 { draft: InvoiceDraft, problems: string[], issued: Invoice \| null }` |
| `POST /api/invoices` | `{ month: 'YYYY-MM', invoiceDate: IsoDate }` | `201 Invoice` |
| `GET /api/invoices/:id` | — | `200 Invoice` (from the snapshot, not live data) |
| `DELETE /api/invoices/:id` | — | `204`, only for the **most recently issued** invoice |

**Draft `problems`** are human-readable reasons the invoice can't be issued yet. The UI shows them and disables **Issue**:
- "Set your name in Settings"
- "Set the company name in Settings"
- "Set an hourly rate in Settings"
- "No time logged in September 2026"
- "September 2026 was already invoiced as INV0025"

**`POST` runs in one transaction:**
1. Re-check everything behind `problems`.
   - Missing settings or zero hours → `400 validation`.
   - The month was already invoiced → `409 { error: 'invoice_exists', invoice }`.
2. Insert the invoice using `settings.nextInvoiceNumber`, the settings snapshot and the lines.
3. Set `nextInvoiceNumber += 1`.

**`DELETE`** fixes a mistake on the latest invoice:
- It's only allowed if the invoice has the highest number.
  - Otherwise it returns `409 { error: 'not_latest' }` with the message "Only the most recent invoice (INV0026) can be deleted."
- On success it sets `nextInvoiceNumber` back to that invoice's number, so no gap is left in the numbering.

**Spec 7 hookup:** `PUT /api/settings` now rejects a `nextInvoiceNumber` that is ≤ the highest issued number.

## Page (`/invoices?month=YYYY-MM`)
- **Default month:** the **previous** month, since invoices are written after a month ends.
```
Invoices                                  ◀ September 2026 ▶
┌ Draft — INV0026 ─────────────────────────────────────────┐
│ Invoice date [10/01/2026]      Terms: On Receipt          │
│ Task                          Rate     Hours     Amount   │
│ Meetings                    $10.00      3.00     $30.00   │
│ Report Writing              $10.00     31.50    $315.00   │
│ …                                                         │
│ Total                                  49.00    $490.00   │
│ ⚠ problems list (if any)                                  │
│                        [Preview PDF]  [Issue INV0026]     │
└───────────────────────────────────────────────────────────┘
Issued invoices
  INV0025  Aug 2026   issued 9/1/2026   52.00 h    $520.00  [PDF] [Delete]
  INV0024  Jul 2026   …                                     [PDF]
```
- **Issue** opens a confirm dialog: "Issue INV0026 for September 2026 ($490.00)? The number is assigned permanently." Then it calls POST, shows the issued invoice, and starts the PDF download (spec 9).
- **If the month is already issued**, the panel shows the **issued snapshot** (read-only) instead of a draft.
  - If the live hours for that month now differ from the snapshot, a warning appears: "Entries for September changed after INV0025 was issued (now 50.00 h, invoiced 49.00 h)." To re-issue, you delete the invoice (if it's the latest) and issue it again.
- **Delete** shows only on the latest invoice and asks for confirmation.
- **Preview PDF** and **[PDF]** call the spec 9 endpoints. Until spec 9 is built, these buttons are disabled.

## Acceptance criteria
- [ ] Vitest for `invoice.ts`:
  - the **September 2026 example fixture** produces exactly the 7 lines, in example order, with 49 h and $490.00
  - `lineAmountCents(15, 1001)` rounds correctly
  - the line amounts always sum to the total
  - `formatInvoiceNumber(25) === "INV0025"` and `formatInvoiceNumber(12345) === "INV12345"`
  - the default invoice date for Dec 2026 is 2027-01-01
- [ ] Supertest:
  - the draft reports each kind of problem
  - issuing increments `nextInvoiceNumber`
  - issuing a second time for the same month → 409 `invoice_exists`
  - an issued invoice is unchanged after editing entries **and** settings (snapshot)
  - deleting the latest restores the number; deleting an older one → 409
  - the settings PUT with a too-low number → 400
  - if issuing fails partway (forced error), nothing is written
- [ ] Manual checks: run the preview → issue → re-download → delete → re-issue flow on seeded data.

## Out of scope
Partial payments or balance tracking (BALANCE DUE always equals the total), taxes, invoices for anything other than a calendar month, emailing invoices.

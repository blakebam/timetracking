# Spec 7 — Settings API & Page

## Goal
One place to edit everything that isn't a time entry:
- your biller details
- who you bill
- your hourly rate and payment terms
- the next invoice number
- the Day view's default start time

The invoice (specs 8–9) prints these values.

**This spec is built in two parts:**
- **7a — API** (`GET`/`PUT /api/settings`): built right after spec 3, because the Day view (spec 4) reads `defaultStartTime`.
- **7b — Page**: built after spec 4, because it reuses `TimeCombobox`.

Depends on: specs 1–3 (7a); spec 4 (7b).

## Files
```
shared/src/
├─ schemas.ts           # + settingsInputSchema
└─ money.ts             # parseUsdToCents, formatUsd (also used by specs 8–9)
server/src/routes/settings.ts
client/src/
├─ api/settings.ts
├─ hooks/useSettings.ts # created in spec 4 — gains invalidate() after save
└─ features/settings/
   ├─ SettingsPage.tsx
   └─ *.module.css
```

## Money helpers (`shared/src/money.ts`)
- `parseUsdToCents(s: string): number | null` parses the string directly, with **no float math**.
  - Accepts `35`, `35.5`, `35.50`, `$1,234.56`.
  - Rejects anything with more than 2 decimal places, negatives and junk.
- `formatUsd(cents): string` → `"$1,234.56"` (always 2 decimals, thousands separators).
- `formatRate(cents)` is the same as `formatUsd`. It's kept as a separate name so the rate column can change later without affecting amounts.

## Validation (`settingsInputSchema`)
| Field | Rule |
|---|---|
| `billerName` | trimmed, ≤ 100 |
| `billerAddress` | trimmed, ≤ 500, multi-line (each line prints on its own line) |
| `billerPhone` | trimmed, ≤ 50, free-form |
| `billerEmail` | empty, or a valid email |
| `companyName` | trimmed, ≤ 100 |
| `companyAddress` | trimmed, ≤ 500, multi-line, optional |
| `hourlyRateCents` | integer, 0 – 1,000,000 |
| `paymentTerms` | trimmed, 1–50 chars (default `On Receipt`) |
| `nextInvoiceNumber` | integer ≥ 1. **Server-side also:** must be greater than the highest issued invoice number. This check is skipped until spec 8 exists. |
| `defaultStartTime` | `startTimeSchema` |

- Fields may be blank in Settings. Spec 8 refuses to *issue* an invoice until `billerName`, `companyName` and `hourlyRateCents > 0` are set.

## Endpoints
| Method & path | Request | Success |
|---|---|---|
| `GET /api/settings` | — | `200 Settings` |
| `PUT /api/settings` | `SettingsInput` (full replace) | `200 Settings` |

Errors use spec 3's shapes. A `nextInvoiceNumber` that is too low → `400 validation` with the message "Invoice INV0025 has already been issued; the next number must be 26 or higher."

## Page (`/settings`)
```
Settings
─ You (biller) ────────────────────────────
  Name      [Jane Doe                   ]
  Address   [123 Main St                ]   (multi-line textarea)
            [Springfield TX             ]
            [75000                      ]
  Phone     [555-555-5555               ]
  Email     [jane@example.com           ]
─ Bill to ─────────────────────────────────
  Company   [Acme LLC                   ]
  Address   [                           ]   (optional textarea)
─ Billing ─────────────────────────────────
  Hourly rate     $[10.00   ]
  Payment terms   [On Receipt     ]
  Next invoice #  [26]   → next invoice will be INV0026
─ Preferences ─────────────────────────────
  Default start time  [11:00 AM ▾]   (TimeCombobox)
                                         [Save]
```
- The **rate** field is a text input. It's parsed with `parseUsdToCents` and reformatted to `10.00` when you leave the field.
- The **invoice number preview** uses `formatInvoiceNumber` (spec 8; until then, an inline `INV` + 4-digit zero-pad).
- **Save:**
  - The button is enabled only when something has changed.
  - Saving runs client-side validation with the shared schema, then shows a "Saved" confirmation and refreshes the `useSettings` cache, so the Day view picks up the new default immediately.
- **Unsaved changes:** leaving the page (an in-app link or closing the tab) asks "Discard unsaved changes?"
- **Errors:** server `400` issues are mapped to fields, the same as the Day view.

## Acceptance criteria
- [ ] Vitest for `money.ts`:
  - `parseUsdToCents`: `"10"` → 1000, `"10.5"` → 1050, `"$1,234.56"` → 123456; `"10.555"`, `"-1"` and `"abc"` → null
  - `formatUsd`: 0, 87500 and 49000 cents
- [ ] Schema tests: an invalid email, a too-long field, and a bad start time (`08:10`).
- [ ] Supertest: GET returns the defaults on a fresh DB; a PUT round-trip works; a bad body → 400.
- [ ] Manual checks:
  - edit every field, save, reload: the values persist
  - change the default start time → an empty day in the Day view uses it
  - edit a field, then click to another page → you're asked to confirm

## Out of scope
Multiple clients, multiple rates per task, tax lines.

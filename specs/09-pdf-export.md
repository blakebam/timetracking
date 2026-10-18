# Spec 9 — PDF Export (Timesheets & Invoices)

## Goal
Generate the weekly timesheet PDF and the monthly invoice PDF so they look like the examples in `A:/ExamplePdfs/` (kept outside the repo). The PDFs are rendered on the server from the same data the UI shows: the timesheet from `summarize` (spec 6), and the invoice from the invoice snapshot or draft (spec 8).

Depends on: specs 6, 7, 8.

## Reference documents
| Example | What it shows |
|---|---|
| `09-01_09-06_Timesheet.pdf` | Period starting mid-week (Sept 1 2026 is a Tuesday): month-truncated timesheet |
| `09-07_09-13_Timesheet.pdf` | Full Mon–Sun period |
| `09-14_09_20_Timesheet.pdf`, `09-21_09-27_Timesheet.pdf` | **Empty periods are still exported**, with "Total 0" |
| `09-28_09-30_Timesheet.pdf` | Period cut at month end (Mon–Wed) |
| `September_Invoice.pdf` | Monthly invoice: 7 lines, 49 Hours, USD $490.00. Equal to the sum of the five timesheets |

The examples are the **visual reference**. Some details are standardized rather than copied; see **Deliberate differences**.

## Engine
**`@react-pdf/renderer`, rendered on the server** (`renderToBuffer`).
- Layout uses JSX and flexbox, with no headless browser.
- The gradient rules in the examples are drawn with its `<Svg><LinearGradient>`.
- **Font: Inter** (it matches the examples), Regular + Medium static TTFs in `server/assets/fonts/`, with the OFL license file next to them.
  - Fonts are registered by an absolute path resolved relative to the server's own location, so they work in both dev and the `tsup` build.
  - `tsup`'s `publicDir` copies `assets/` into `dist/`.

## Files
```
server/
├─ assets/fonts/Inter-Regular.ttf, Inter-Medium.ttf, OFL.txt
└─ src/pdf/
   ├─ theme.ts             # page size, margins, colors, font sizes (single source of truth)
   ├─ components.tsx       # FadeRule (gradient line), LabelValue, etc.
   ├─ TimesheetPdf.tsx
   ├─ InvoicePdf.tsx
   └─ render.ts            # renderTimesheet(summary) / renderInvoice(invoice, { draft }) → Buffer
server/src/routes/reports.ts
shared/src/time.ts         # + formatHoursCompact()
shared/src/dates.ts        # + formatShortRange(), formatInvoiceDate(), monthName()
server/scripts/seedExample.ts   # seeds the September 2026 example data (see Testing)
```

## Formatting helpers
| Helper | Output | Used for |
|---|---|---|
| `formatHoursCompact(min)` | `0` · `0.25` · `0.5` · `1` · `16.5` · `31.75` (no trailing zeros) | Hours in **PDFs** (matches the examples). The UI keeps `formatHours` (`16.50`). |
| `formatShortRange(from, to)` | `9/1-9/6` | Timesheet title |
| `formatInvoiceDate(d)` | `October 1, 2026` | Invoice DATE |
| `formatUsd(cents)` (spec 7) | `$315.00` | Rate, amounts |
| `formatInvoiceNumber(n)` (spec 8) | `INV0025` | Invoice number |

## Page & theme (`theme.ts`)
- **US Letter** (612 × 792 pt), portrait. Side margins **30 pt**. Top content starts at about 55 pt.
- **Text color** `#444` (soft dark gray, as in the examples). Invoice task names are slightly darker (`#222`).
- **FadeRule:** a 1 pt horizontal line, `#444` at the left fading to transparent at the right edge, spanning the content width.
- All measurements below come from the examples (rendered at 950 px wide ≈ 0.644 pt/px). **Tune them by eye against the examples during implementation.**

## Timesheet PDF
```
                    9/1-9/6 Weekly Timesheet               ← centered, 15 pt, y≈69
─────────────────────────────────────────────────────────── ← FadeRule, y≈113
Items                                                Hours ← 8.5 pt
─────────────────────────────────────────────────────────── ← FadeRule, y≈148

Meetings                                                 1 ← 9.5 pt rows, ~22 pt pitch
Report Writing                                        16.5
Data Entry                                             0.5

─────────────────────────────────────────────────────────── ← FadeRule
Total                                                   18 ← 11.5 pt
```
- **Data:** `summarize(entries, period.from, period.to)`, with rows in **`byFirstWorked` order**.
- **Empty period:** no rows; the closing rule follows the header area directly, then `Total 0`, exactly like the 9/14–9/20 example.
- **Long lists** flow onto further pages, and the header rule block repeats (`fixed`).
- **Filename:** `MM-DD_MM-DD_Timesheet.pdf`, e.g. `09-01_09-06_Timesheet.pdf`.

## Invoice PDF
```
Jane Doe                                         INVOICE   ← name 16 pt; labels 8 pt uppercase
123 Main St                                      INV0025   ← values 10.5 pt, right-aligned
Springfield TX                                      DATE
75000                                    October 1, 2026
555-555-5555                                         DUE
jane@example.com                              On Receipt
                                             BALANCE DUE
                                           USD $490.00

BILL TO                                                    ← 8 pt uppercase
Acme LLC                                                   ← 14 pt
(company address lines, 10 pt, if set)

    Items Worked                    RATE    QTY    AMOUNT  ← 9 pt / 8 pt uppercase
    Meetings                      $10.00      3    $30.00  ← 10.5 pt rows, ~20 pt pitch
    Report Writing                $10.00   31.5   $315.00
    …
                          ────────────────────────────────  ← plain rule, right ~half
                          TOTAL    49 Hours     USD $490.00 ← 13 pt
```
- **Biller block:** name, then each line of `billerAddress`, then phone, then email. Empty fields are skipped, with no blank gaps.
- **Right block:**
  - INVOICE → number
  - DATE → `invoiceDate`
  - DUE → `paymentTerms`
  - BALANCE DUE → `USD ` + total
- **Lines:** task, rate, QTY = `formatHoursCompact(minutes)`, amount. Lines are in snapshot order (already `byFirstWorked`).
- **TOTAL row:** shows `"{compact hours} Hours"` (or `"1 Hour"` for exactly one hour) and `USD {total}`.
- **Draft preview:** the same layout, plus a large, light-gray, diagonal **"DRAFT"** watermark. The number shown is `nextInvoiceNumber`.
- **Filename:** `{Month}_{Year}_Invoice.pdf`, e.g. `September_2026_Invoice.pdf`. The year is added so that next September's file doesn't overwrite this one.

## Deliberate differences from the examples
1. **Amounts always have 2 decimals.** The example shows `$30`, `$25` and `$315.00` inconsistently; the PDF will show `$30.00`, `$25.00`, `$315.00`.
2. **Amount column is right-aligned** inside the margin. In the example, `$315.00` spills past the right edge.
3. **Consistent timesheet filenames.** One example is named `09-14_09_20`; the generated name is always `09-14_09-20`.

## Endpoints
| Method & path | Returns |
|---|---|
| `GET /api/reports/timesheet.pdf?start=YYYY-MM-DD` | Timesheet for `timesheetPeriod(start)` |
| `GET /api/invoices/:id/pdf` | Issued invoice, from its snapshot |
| `GET /api/invoices/draft.pdf?month=YYYY-MM&invoiceDate=` | Draft invoice with the watermark; works even when `problems` exist |

- All three return `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="…"`.
- `?inline=1` switches to `inline`, so a preview opens in a browser tab instead of downloading.
- Errors return spec 3's JSON shapes.

## UI wiring
- **Week view (spec 6):**
  - **Export PDF** is enabled in **timesheet mode**, including for empty periods, and downloads that period's timesheet.
  - In full-week mode the button is disabled, with the tooltip "Switch to Timesheet to export".
- **Calendar (spec 5):** each timesheet row gets a download icon, so all of a month's timesheets can be downloaded from one screen.
- **Invoices (spec 8):**
  - **Preview PDF** opens the draft inline in a new tab.
  - **[PDF]** downloads the issued invoice.
  - **Issue** automatically downloads the newly issued invoice.

## Testing
- **Example fixture:** `seedExample.ts` (`npm run seed:example`, writes `data/example.db`) creates September 2026 entries whose per-period, per-task totals match the five example timesheets exactly:

  | Period | Tasks, in first-worked order (hours) |
  |---|---|
  | 9/1–9/6 | Meetings 1 · Report Writing 16.5 · Data Entry 0.5 |
  | 9/7–9/13 | Meetings 0.5 · Report Writing 9 · Data Entry 2 · Research 1 · Planning 2 |
  | 9/14–9/20 | (none) |
  | 9/21–9/27 | (none) |
  | 9/28–9/30 | Meetings 1.5 · Research 4 · Design Review 4 · Email Support 1 · Report Writing 6 |

  - Settings in the fixture: rate $10.00, next invoice 25, terms On Receipt.
  - It uses **placeholder** biller details ("Jane Doe"), not real personal information.
  - The same data is exported as a Vitest fixture module.
- **Vitest:**
  - render each PDF to a buffer and extract its text with `pdfjs-dist`
  - assert the text **in order** for:
    - all five timesheets (title, rows, total; the empty ones read `Total 0`)
    - the invoice, which must equal `September_Invoice.pdf`'s text apart from the deliberate differences and placeholder biller details
  - `formatHoursCompact` and `formatShortRange` edge cases
  - `Content-Disposition` filenames
- **Manual visual check:** generate all six documents from the seeded DB and compare them side by side with `A:/ExamplePdfs/` (kept outside the repo): layout, spacing, font, gradient rules.
  - Also render a 40-task timesheet and invoice to check page breaks.

## Out of scope
Custom templates or logos, emailing, batch ZIP export, per-day breakdowns on the timesheet (the examples show per-task totals only).

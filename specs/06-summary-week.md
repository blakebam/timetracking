# Spec 6 — Summary Service & Week / Timesheet View

## Goal
One aggregation service turns entries in any date range into totals per task and per day. The calendar (spec 5), the Week view (here), invoices (spec 8) and PDFs (spec 9) all use it, so **every screen and document computes hours the same way**.

This spec also defines **timesheet periods** and builds the Week view, which has two modes:
- **Timesheet** (default): one billing period. It runs Monday–Sunday, **but is cut at month boundaries**, so a week that spans two months becomes two timesheets. This is the on-screen version of the weekly PDF.
- **Full week**: all 7 days Mon–Sun, ignoring month boundaries.

Depends on: specs 1–3 (and spec 4 for shared date helpers and the API client).

## Files
```
shared/src/
├─ dates.ts            # extended with week/month/timesheet helpers
└─ summary.ts          # summarize() — pure, no I/O
server/src/routes/summary.ts
client/src/
├─ api/summary.ts
└─ features/week/
   ├─ WeekPage.tsx
   ├─ WeekTable.tsx
   ├─ weekLogic.ts     # URL parsing + prev/next period (tested)
   └─ *.module.css
```
`summarize()` lives in **shared** as a pure function. It is unit-tested once, and the server and the client produce identical results.

## Date helpers (added to `shared/src/dates.ts`)
| Helper | Meaning |
|---|---|
| `startOfWeekIso(d)` | Monday on or before `d` (billing week start) |
| `weekRange(d)` | `{ from: Monday, to: Sunday }` containing `d` |
| `monthRange(year, month)` | 1st → last day of the month |
| `calendarGridRange(year, month)` | Sunday on/before the 1st → Saturday on/after the last day (display only, spec 5) |
| `timesheetPeriod(d)` | `weekRange(d)` **intersected with** the month containing `d` |
| `timesheetPeriods(year, month)` | all timesheet periods in the month, in order; they tile the month exactly |
| `eachDay(from, to)` | inclusive list of dates |

```ts
interface Period { from: IsoDate; to: IsoDate }
```
Example, Nov 2026 (Nov 1 is a Sunday): `Nov 1–1`, `Nov 2–8`, `Nov 9–15`, `Nov 16–22`, `Nov 23–29`, `Nov 30–30`. Single-day periods are valid.

## Summary model (`shared/src/summary.ts`)
```ts
interface TaskTotal {
  taskName: string;
  minutes: number;
  firstWorked: { date: IsoDate; startTime: StartTime };   // earliest entry for this task in the range
}
interface DayTotal  { date: IsoDate; minutes: number; tasks: TaskTotal[] }
interface Summary {
  from: IsoDate;
  to: IsoDate;
  totalMinutes: number;
  tasks: TaskTotal[];   // whole range, sorted by minutes desc, then name asc
  days: DayTotal[];     // one per day in [from, to], including zero days, in date order
}

function summarize(entries: TimeEntry[], from: IsoDate, to: IsoDate): Summary;
```

Rules:
- **Grouping is case-insensitive**, and inner whitespace is collapsed before comparing.
  - The display name is the spelling from the **most recent** entry in the range (latest date, then latest start).
  - So "meeting" and "Meeting" become one row.
- **All math is integer minutes.** Hours are converted only for display, with `formatHours`.
- Entries outside `[from, to]` are ignored (defensive).
- `days` always covers every day in the range, so callers never handle gaps.
- `days[i].tasks` is sorted the same way as the top-level `tasks`.
- Also exports `byFirstWorked(tasks): TaskTotal[]`, which re-sorts tasks chronologically by `firstWorked` (date, then start). **PDFs and invoices use this order**, to match the example documents. The UI keeps the largest-first order.

## Endpoint
| Method & path | Request | Success |
|---|---|---|
| `GET /api/summary?from=&to=` | `rangeQuerySchema` (spec 3; ≤ 366 days) | `200 Summary` |

The route runs `entriesRepo.listByRange` then `summarize`. Error shapes are the same as spec 3.

## Week view

### Routing
`/week?start=YYYY-MM-DD&mode=timesheet|full`
- `mode` defaults to `timesheet`.
- `start` is normalized, and the URL is replaced if it changed:
  - **timesheet:** `start` becomes `timesheetPeriod(start).from`, i.e. that week's Monday, or the 1st of the month if the week began in the previous month.
  - **full:** `start` becomes `startOfWeekIso(start)`.
- A missing or invalid `start` means today.

### Layout (timesheet mode, a period cut at month end)
```
◀  Timesheet: Mon Oct 26 – Sat Oct 31, 2026  ▶   [This week]   (•Timesheet ○ Full week)   [Export PDF]
┌──────────────────┬───────┬───────┬───────┬───────┬───────┬───────┬────────┐
│ Task             │  Mon  │  Tue  │  Wed  │  Thu  │  Fri  │  Sat  │ Total  │
│                  │ 10/26 │ 10/27 │ 10/28 │ 10/29 │ 10/30 │ 10/31 │        │
├──────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼────────┤
│ API refactor     │  4.00 │  6.50 │       │  5.00 │       │       │ 15.50  │
│ Meeting          │  1.00 │  0.50 │  1.00 │  1.00 │  1.00 │       │  4.50  │
├──────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼────────┤
│ Daily total      │  5.00 │  7.00 │  1.00 │  6.00 │  1.00 │       │ 20.00  │
└──────────────────┴───────┴───────┴───────┴───────┴───────┴───────┴────────┘
ℹ This week continues into November → [Nov 1 timesheet ›]
```

### Behavior
- **Columns:** only the days in the current range. A timesheet has 1–7 columns; full week always has 7.
- **Data:** one `GET /api/summary` request for the range shown.
- **Table:**
  - rows are tasks, in `summary.tasks` order
  - empty cells are blank
  - the footer row shows daily totals plus the grand total
- **Prev/next:**
  - **timesheet:** moves to the adjacent period, so a week that spans two months takes two steps (e.g. Oct 26–31 → Nov 1–1 → Nov 2–8)
  - **full:** moves ±7 days
- **Split-week note** (timesheet mode): if the period was cut by a month boundary, a note links to the other half.
- **Full week mode:** if the week spans two months, a visual divider is drawn between the months.
- **Mode toggle:** switches modes while keeping the same anchor date.
- Day headers link to `/day/<date>`.
- **Export PDF:** **disabled**, with the tooltip "Coming soon" (spec 9 exports the timesheet period).
- **Empty range:** shows the message "No time logged in this period."

## Acceptance criteria
- [ ] Vitest for `summarize()`:
  - empty input → zero totals, and `days` still has every date
  - case/whitespace variants merge, and the display name follows the most recent spelling
  - sort order (minutes desc, name asc on ties)
  - `firstWorked` is the earliest entry; `byFirstWorked` orders by it
  - per-day task breakdown is correct
  - out-of-range entries are ignored
  - the sum of `days[].minutes` equals `totalMinutes` equals the sum of `tasks[].minutes`
- [ ] Vitest for the date helpers:
  - `startOfWeekIso` for a Sunday returns the **previous** Monday
  - `startOfWeekIso` for a Monday returns itself
  - `monthRange` for Feb in a leap year (2028) and a non-leap year (2026)
  - `calendarGridRange`:
    - Oct 2026 → Sun Sep 27 to Sat Oct 31
    - Nov 2026 → Sun Nov 1 to Sat Dec 5
  - `timesheetPeriods`:
    - Oct 2026 → `1–4, 5–11, 12–18, 19–25, 26–31`
    - Nov 2026 → `1–1, 2–8, 9–15, 16–22, 23–29, 30–30`
    - for any month, the periods tile the month with no gaps or overlaps (check every month of 2026–2028)
  - `timesheetPeriod('2026-11-01')` → `Nov 1–1`
  - `timesheetPeriod('2026-10-28')` → `Oct 26–31`
- [ ] Vitest for `weekLogic.ts`:
  - URL normalization in both modes
  - prev/next across a month boundary in timesheet mode (Oct 26–31 ↔ Nov 1–1 ↔ Nov 2–8)
- [ ] Supertest: `/api/summary` returns the correct shape and totals for seeded entries; a bad range → 400.
- [ ] Manual checks:
  - timesheet totals match a hand calculation for a seeded period
  - a split week shows the note and its link works
  - the mode toggle keeps the anchor date
  - day header links open the Day view

## Out of scope
PDF generation (spec 9), invoice amounts and rates (spec 8), filtering by task.

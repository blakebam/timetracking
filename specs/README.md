# Work Specs

Personal time tracking + invoicing app. Stack: Vite/React/TS client, Express/TS server, SQLite (better-sqlite3), npm workspaces.

Conventions that apply to every spec:
- Dates are local `YYYY-MM-DD` strings; times are local `HH:MM` strings. No UTC timestamps for billable data.
- Money is integer cents. Durations are integer minutes.
- Dates and times have strict types (`IsoDate` branded string; `StartTime`/`EndTime` exact quarter-hour unions). See spec 2.
- Times are stored as 24-hour `HH:MM` but **always displayed in 12-hour AM/PM** (`formatTime12`). Time fields accept typed shorthand (`110` → 11:00 AM).
- Times are in 15-minute increments. Entries never span midnight (split them across two days).
- **Billing weeks** run Monday–Sunday. A **timesheet period** is a billing week cut at month boundaries, so a week that spans two months yields two timesheets. The **calendar display** is Sunday-first.
- Overlapping entries on the same day are rejected (API `409` + DB trigger backstop).
- One user, one billing company. The server binds to `127.0.0.1` only, with no auth.

| # | Spec | Status |
|---|------|--------|
| 1 | [Project scaffold](01-scaffold.md) | Done |
| 2 | [Database layer](02-database.md) | Done |
| 3 | [Entries API + validation](03-entries-api.md) | Done |
| 4 | [Day view & entry form](04-day-view.md) | Done |
| 5 | [Monthly calendar](05-calendar.md) | Done |
| 6 | [Summary service & week/timesheet view](06-summary-week.md) | Done |
| 7 | [Settings API & page](07-settings.md) | Done |
| 8 | [Invoices](08-invoices.md) | Done |
| 9 | [PDF export](09-pdf-export.md) | Done |

**Build order:** 1 → 2 → 3 → **7a** (settings API) → 4 → **7b** (settings page) → 6 → 5 → 8 → 9
(the Day view reads the default start time from the settings API; the settings page reuses the Day view's time picker; the calendar uses the summary endpoint and timesheet periods)

Progress, with commits and remaining steps in order, is tracked in the [root README](../README.md#build-progress).

Reference PDFs (real past timesheets and an invoice) are kept **outside the repo** because they contain personal details. Locally they are in `A:\ExamplePdfs\`.

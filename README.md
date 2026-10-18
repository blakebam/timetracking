# Time Tracking & Invoices

A personal, self-hosted web app for logging the hours you work on tasks and billing for them. It produces a **weekly timesheet PDF** and a **monthly invoice PDF**, with pay calculated from your hourly rate.

It is single-user and has no login. The server listens only on `127.0.0.1`, so other machines can't reach it, and all data stays in one local SQLite file.

## Features

- **Day view** — log entries with a start time, end time and task. Times accept quick shorthand (`110` → 11:00 AM), new entries start where the last one ended, task names autocomplete, and overlapping entries are rejected. Use Alt+←/→ to move between days.
- **Week view** — per-task and per-day totals, shown either as a timesheet period (Monday–Sunday, split at month boundaries) or a full week. Export the timesheet as a PDF.
- **Calendar** — a monthly grid showing each day's total and largest tasks, the month total, and links to each timesheet period and its PDF.
- **Invoices** — preview a draft invoice for any month (one line per task), then issue it. Issuing snapshots the hours, rate and billing details and advances the invoice number. Download issued invoices or a watermarked draft as PDF.
- **Settings** — your biller details, the bill-to company, hourly rate, next invoice number and default start time.

## Tech stack

- **Client:** React 19, Vite, TypeScript (`client/`)
- **Server:** Express 5, TypeScript (`server/`), with PDFs rendered by `@react-pdf/renderer`
- **Storage:** SQLite via better-sqlite3, in a single file at `data/timetracking.db` (gitignored)
- **Shared:** types, zod schemas, and date, time and money helpers used by both sides (`shared/`)

## Getting started

Requires **Node 24** (see `.nvmrc`).

```sh
npm install
npm run dev
```

Then open http://localhost:5173. In development the client proxies `/api` requests to the server on port 4000.

To run the production build as a single process:

```sh
npm run build
npm start
```

Then open http://127.0.0.1:4000.

The database is created and migrated automatically on first start. Fill in the **Settings** page before issuing invoices.

### Commands

| Command                | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Server and client with hot reload                            |
| `npm run build`        | Builds `client/dist` and `server/dist`                       |
| `npm start`            | Runs the built app at http://127.0.0.1:4000                  |
| `npm test`             | Runs the test suite (Vitest)                                 |
| `npm run typecheck`    | Type-checks every package                                    |
| `npm run format`       | Formats the code with Prettier                               |
| `npm run seed:example` | Writes `data/example.db` with sample data for September 2026 |

### Configuration

All environment variables are optional:

| Variable  | Default                | Description          |
| --------- | ---------------------- | -------------------- |
| `PORT`    | `4000`                 | Server port          |
| `HOST`    | `127.0.0.1`            | Address to listen on |
| `DB_PATH` | `data/timetracking.db` | SQLite database file |

### Example data

To try the app without touching your own data, seed the example database and point the app at it:

```sh
npm run seed:example
DB_PATH=data/example.db npm run dev
```

The example uses placeholder biller details.

### Backup

Stop the server and copy `data/timetracking.db`. Everything is stored in that one file.

## Project layout

```
client/src/
  api/          fetch wrappers for each endpoint
  hooks/        data hooks (entries, settings, summary, invoices)
  components/   shared UI such as the time picker
  features/     day/, week/, calendar/, invoices/, settings/ pages
  styles/       design tokens
server/src/
  app.ts        routes
  index.ts      startup
  db/           connection, migrations, repositories
  routes/       API route handlers
  middleware/   validation and error handling
  pdf/          timesheet and invoice PDF documents
server/assets/fonts/   Inter fonts and license
server/scripts/        example data seeder
shared/src/     types, schemas, date/time/money helpers, summary and invoice math
data/           local database (gitignored)
```

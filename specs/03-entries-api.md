# Spec 3 — Entries API + Validation

## Goal
Build the REST endpoints for creating, reading, updating and deleting time entries, plus task-name autocomplete. Validation uses zod schemas in `@tt/shared`, so the client (spec 4) validates with exactly the same rules. **Overlapping entries are rejected**: the request fails with a `409`, the new or changed entry is not saved, and the response names the existing entry it collides with.

Depends on: specs 1, 2.

## Files
```
shared/src/
├─ time.ts            # pure time helpers (built on primitives.ts from spec 2)
├─ schemas.ts         # entry / query / param schemas
└─ api.ts             # response + error types
server/src/
├─ middleware/validate.ts   # validate(schema, 'body' | 'query' | 'params')
├─ middleware/errors.ts     # extended: ZodError → 400, NotFoundError → 404, OverlapError → 409
├─ routes/entries.ts
└─ routes/tasks.ts
```

## Time helpers (`shared/src/time.ts`)
- `toMinutes(t: TimeOfDay): number` — `"24:00"` → 1440
- `fromMinutes(n: number): TimeOfDay` — throws if `n` is not on the 15-minute grid or is outside 0–1440
- `durationMinutes(start: StartTime, end: EndTime): number`
- `formatHours(minutes: number): string` — `90` → `"1.50"` (decimal hours, 2 dp; the format used on reports)
- `formatTime12(t: TimeOfDay): string` — the **only** way times are shown to the user (UI, messages, PDFs):
  - `"00:00"` → `"12:00 AM"`
  - `"09:15"` → `"9:15 AM"`
  - `"12:00"` → `"12:00 PM"`
  - `"13:30"` → `"1:30 PM"`
  - `"24:00"` → `"12:00 AM"`
- `formatRange12(start, end)` → `"9:00 AM – 10:30 AM"`

## Validation rules (`shared/src/schemas.ts`)
Date and time field rules come from the spec 2 primitives (`isoDateSchema`, `startTimeSchema`, `endTimeSchema`). This spec adds:

| Field | Rule |
|---|---|
| (cross-field) | `endTime > startTime`, message: "End time must be after start time". There are no overnight entries; split them across two days. |
| `taskName` | trimmed, internal whitespace collapsed, 1–100 chars |
| `notes` | optional; trimmed; empty → `null`; max 1000 chars |

Exports:
- `entryInputSchema` → parses to `TimeEntryInput` (branded/literal types included)
- `rangeQuerySchema` → `{ from: IsoDate, to: IsoDate }`, with `from <= to` and a span ≤ 366 days
- `idParamSchema` → positive int, coerced from string

## Endpoints
| Method & path | Request | Success |
|---|---|---|
| `GET /api/entries?from=&to=` | range query | `200 TimeEntry[]`, sorted by date then start |
| `GET /api/entries/:id` | — | `200 TimeEntry` |
| `POST /api/entries` | `TimeEntryInput` | `201 TimeEntry` |
| `PUT /api/entries/:id` | `TimeEntryInput` (full replace) | `200 TimeEntry` |
| `DELETE /api/entries/:id` | — | `204` |
| `GET /api/tasks/names?q=&limit=` | `q` optional prefix, `limit` 1–50 (default 20) | `200 string[]` |

### Overlap handling (POST and PUT)
1. After validation, the route calls `findOverlapping(date, startTime, endTime, excludeId = id on PUT)`.
2. If any entries come back, the route responds `409` with an `overlap` error (see **Error shapes**) and **writes nothing**. On a `PUT`, the stored entry stays unchanged.
3. If the DB trigger still raises (it shouldn't), the repo's `OverlapError` maps to the same `409`, re-queried so the response lists the conflicts.
- Touching edges (ending 11:00, next starting 11:00) are allowed.
- Updating an entry never conflicts with itself.

## Error shapes (`shared/src/api.ts`)
```ts
type ApiError =
  | { error: 'validation'; issues: { path: string; message: string }[] }   // 400
  | { error: 'overlap';    message: string; conflicts: TimeEntry[] }        // 409
  | { error: 'not_found' }                                                  // 404
  | { error: 'internal' };                                                  // 500
```
- Example `overlap` message (12-hour times via `formatRange12`): `"9:30 AM – 10:30 AM overlaps \"Meeting\" (9:00 AM – 10:00 AM) on Sat, Oct 17. Change the times on one of the two entries."`
- `conflicts` gives the client what it needs to highlight the clashing entry and offer to edit it (spec 4).
- Malformed JSON bodies return `400 validation`. All messages should be written for a human, since spec 4 shows them in the UI.

## Acceptance criteria
- [ ] The schemas are imported from `@tt/shared` by the server, and the client can import them too (verified by a typecheck).
- [ ] Unit tests for `time.ts`:
  - `toMinutes`/`fromMinutes` round-trip across all 97 values
  - `24:00` → 1440
  - `fromMinutes(10)` throws
  - `formatHours(15) === "0.25"`
  - `formatTime12` for `00:00`, `00:15`, `11:45`, `12:00`, `12:15`, `23:45`, `24:00`
- [ ] Schema tests:
  - rejects `08:10`, `24:15`, start `24:00`, end `00:00`, end ≤ start, a blank task, `2026-13-01`, `2026-02-29`
  - accepts `23:45`→`24:00` and `2028-02-29`
  - normalizes `"  Team   meeting "` to `"Team meeting"`
- [ ] Supertest API tests against `:memory:`:
  - full CRUD happy path, with correct status codes
  - `GET` range is inclusive and sorted
  - `PUT`/`DELETE`/`GET` with an unknown id → 404; a non-numeric id → 400
  - an overlapping `POST` → `409 overlap` listing the existing entry, and the entry count is unchanged
  - an overlapping `PUT` → `409`, and the stored entry is unchanged
  - a touching entry → `201`
  - re-saving an entry with its own times → `200`
  - the `/api/tasks/names` prefix filter is case-insensitive and deduped
  - a bad range (`from > to`, or a span > 366 days) → 400

## Out of scope
UI (spec 4), aggregation/summaries (spec 6), bulk import, undo.

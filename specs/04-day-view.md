# Spec 4 — Day View & Entry Form

## Goal
The main working screen: pick a day, see its entries, and add, edit or delete entries quickly. It is optimized for typing in a day's work in one sitting.
- Time fields accept typed shorthand, e.g. `110` → 11:00 AM.
- Each save sets up the next entry to start where the last one ended.
- All times are displayed in 12-hour AM/PM format.

Depends on: specs 1–3, and spec 7's `GET /api/settings` (for the default start time). **Build spec 7 before this one.**

## Files
```
shared/src/dates.ts                  # local-date helpers (extended in spec 6)
client/src/
├─ api/client.ts                     # apiFetch<T>() + ApiRequestError
├─ api/entries.ts                    # listEntries, createEntry, updateEntry, deleteEntry, taskNames
├─ hooks/useEntries.ts               # { entries, loading, error, reload } for a date range
├─ hooks/useSettings.ts              # cached settings (from spec 7 API)
├─ components/TimeCombobox.tsx       # typed + dropdown time picker
├─ components/timeMatch.ts           # pure matching logic for TimeCombobox (tested)
├─ styles/tokens.css                 # colors, spacing, fonts (global)
└─ features/day/
   ├─ DayPage.tsx                    # route component
   ├─ DayHeader.tsx                  # date, prev/next/today, day total
   ├─ EntryList.tsx
   ├─ EntryForm.tsx
   ├─ dayLogic.ts                    # pure helpers (tested)
   └─ *.module.css
```
Styling uses **CSS Modules** (built into Vite) plus a global `tokens.css`. No UI library.

## Shared date helpers (`shared/src/dates.ts`)
- `parseIsoLocal(d: IsoDate): Date` creates the date at **local** midnight with `new Date(y, m - 1, d)`.
  - Never use `new Date("YYYY-MM-DD")`, which parses as UTC and can land on the wrong day.
- `todayIso(): IsoDate`
- `addDays(d: IsoDate, n: number): IsoDate`
- `formatLongDate(d: IsoDate): string` → `"Saturday, October 17, 2026"`

## Routing
- `/` redirects to `/day/<today>`.
- `/day/:date`, where `:date` is checked with `isoDateSchema`. An invalid date redirects to today.

## API client (`client/src/api/`)
- `apiFetch<T>(path, init)` sends and receives JSON.
  - On a non-2xx response it throws `ApiRequestError { status, body: ApiError }`, using the shared `ApiError` type from spec 3.
  - On a network failure it throws `ApiRequestError { status: 0 }`.
- `entries.ts` has one function per endpoint from spec 3, with typed results.
- `useEntries(from, to)` refetches when the range changes and exposes `reload()`. No caching library.

## Layout
```
┌────────────────────────────────────────────────────────────────────┐
│ ◀  Saturday, October 17, 2026  ▶   [Today] [📅 date picker]        │
│                                                  Day total: 7.50 h │
├────────────────────────────────────────────────────────────────────┤
│ Start [11:00 AM  ▾]   End [12:00 PM  ▾]   (1.00 h)                 │
│ Task  [Meeting__________] (autocomplete)                           │
│ Notes [_______________________________]              [Add entry]   │
│ ⚠ error banner (when present)                                      │
├────────────────────────────────────────────────────────────────────┤
│ 11:00 AM – 12:00 PM  1.00 h  Meeting        notes…   [Edit] [✕]   │
│ 12:00 PM –  2:30 PM  2.50 h  API refactor            [Edit] [✕]   │
│ (empty state: "No entries for this day yet.")                      │
└────────────────────────────────────────────────────────────────────┘
```

## TimeCombobox (typed time entry)
This is a text input with a dropdown list of valid times, following the ARIA combobox pattern. It is used for both Start and End.

**Props**
- `options: TimeOfDay[]`
  - Start: `00:00`–`23:45`.
  - End: only times later than the chosen Start, up to `24:00`, which is labelled "12:00 AM (end of day)".
- `reference: TimeOfDay`, used to pick between AM and PM when what you type could be either.
  - Start: the smart default (see below).
  - End: the current Start.
- `value`, `onChange`, `error`

**Labels.** Every option is shown with `formatTime12`, e.g. `11:00 AM`.

**Matching** (`timeMatch.ts → matchTimes(input, options, reference): TimeOfDay[]`, best match first):
1. Normalize the input:
   - lowercase it and remove spaces
   - take off a trailing `a`/`am`/`p`/`pm` and remember it as an AM/PM filter
2. Find the candidates:
   - **No colon in the input:** compare the input against each option's 12-hour label **with the colon and suffix removed**. For example, `11:00 AM` becomes `1100` and `1:30 PM` becomes `130`. Keep the options whose digits **start with** the input.
   - **Colon in the input:** compare against the label's `h:mm` prefix, so `1:1` matches `1:15`.
3. Apply the AM/PM filter, if one was typed.
4. Rank the candidates by distance in minutes from `reference`. On a tie, the later time wins.

Examples (with `reference` = 11:00 AM unless noted):

| Typed | Result | Why |
|---|---|---|
| `110` | 11:00 AM | `1100` starts with `110`; AM is nearer the reference than PM |
| `110p` | 11:00 PM | the suffix forces PM |
| `130` | 1:30 PM | 1:30 PM is 2.5 h from the reference; 1:30 AM is 9.5 h away |
| `1:1` | 1:15 PM | the colon means "hour 1, minutes starting with 1" |
| `9` | 9:00 AM | |
| `1245` | 12:45 PM | |
| `5` in **End**, with Start 9:00 AM | 5:00 PM | 5:00 AM isn't offered, because it's before the Start |
| `99` | (no match) | the field shows the error "Not a valid time" |

**Interaction**
- As you type, the dropdown filters to the candidates and highlights the best one.
- `↑`/`↓` move the highlight. `Enter` or `Tab` commits the highlighted time. Leaving the field also commits the best match.
- If nothing matches, the field keeps the text, shows the error, and blocks submit.
- Clicking the field shows the full list, scrolled to the current value.

## Entry form behavior
- **Smart defaults** (`dayLogic.ts`):
  - `start` = the end time of the day's latest entry, or **`settings.defaultStartTime`** (default 11:00 AM, editable in spec 7) if the day is empty.
  - `end` = `start + 1 h`, capped at `24:00`.
  - If the day is already filled to midnight, the form is disabled with a note.
- **Live duration** preview next to the end time.
- **Task field:** a text input with a native `<datalist>`, fed by `GET /api/tasks/names?q=` (debounced 150 ms). Free text is always allowed.
- **Notes:** an optional single-line input.
- **Submit (Enter or button):**
  1. Validate with `entryInputSchema` (same rules as the server). Show field errors inline.
  2. On success: `reload()`, reset the form using the smart defaults (so the next entry starts where this one ended), and focus the Task field.
- **Edit mode:** clicking **Edit** on a row loads that entry into the same form.
  - The button label becomes "Save changes", a **Cancel** link appears, and the row being edited is highlighted.
  - Smart defaults don't apply while editing.

## Error handling
| Server response | UI |
|---|---|
| `400 validation` | Map each `issues[].path` onto its field. Anything that can't be mapped goes in the banner. |
| `409 overlap` | Show `message` in the banner and outline the `conflicts` rows in the list. Each conflicting row gets an **"Edit this entry"** shortcut. **The form keeps the user's input** (nothing was saved). |
| `404` on edit/delete | Banner "That entry no longer exists", then `reload()`. |
| Network (`status 0`) | Banner "Can't reach the server — is it running?" |

## Header and entry list
- **Header:**
  - Prev/next buttons move one day. **Today** jumps to today. The date picker jumps to any day.
  - **Keyboard:** `Alt+←` / `Alt+→` go to the previous/next day, unless focus is inside a text field.
  - Shows the day total, as `formatHours`.
- **List:**
  - Sorted by start time. Each row shows the time range (`formatRange12`), duration, task and notes (truncated, full text in a tooltip), plus Edit and Delete.
  - Delete asks `window.confirm("Delete 11:00 AM – 12:00 PM Meeting?")` first, then `reload()`.
  - If the entry being edited is deleted, edit mode is cancelled.

## Acceptance criteria
- [ ] Vitest for `timeMatch.ts`: every row of the examples table, plus:
  - `12` with reference 11:00 AM → 12:00 PM
  - `12a` → 12:00 AM
  - an empty input → all options, ordered by distance from the reference
  - End options never include times at or before the Start
- [ ] Vitest for `dayLogic.ts`:
  - default start on an empty day uses `defaultStartTime`
  - default start after existing entries, including out-of-order input
  - end is capped at `24:00`
  - the "day full" state
- [ ] Vitest for `dates.ts`:
  - `addDays` across month, year and DST boundaries (2026-03-08, 2026-11-01)
  - `parseIsoLocal` returns local midnight
- [ ] Manual checks:
  - add three back-to-back entries using only the keyboard (type a start like `110`, Tab, type an end like `1`, Tab, task, Enter). Each entry starts where the previous ended.
  - no time anywhere on the page is shown in 24-hour format
  - an overlapping add shows the banner, outlines the conflicting row, and keeps the form contents; **Edit this entry** opens it
  - edit an entry's times: the list and day total update
  - delete with confirm
  - prev/next/today/date-picker navigation; a bad URL date redirects to today
  - with the server stopped, the "Can't reach the server" banner appears
  - change the default start time in Settings → an empty day now defaults to it

## Out of scope
Calendar (spec 5), week/timesheet view (spec 6), copying entries from a previous day, timers/stopwatch.

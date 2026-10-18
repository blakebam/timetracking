# Spec 5 — Monthly Calendar

## Goal
Show a normal monthly calendar (**Sunday first**) as the historical record. Each day shows how much was worked and on what, and clicking a day opens it in the Day view.

Billing timesheets run Monday–Sunday and are cut at month boundaries, so they don't line up with Sunday-first rows. Instead of row totals, the calendar lists the month's **timesheet periods** with their totals, each linking to its timesheet.

Depends on: spec 4 (Day route), spec 6 (`/api/summary`, `calendarGridRange`, `timesheetPeriods`). **Build spec 6 before this one.**

## Files
```
client/src/features/calendar/
├─ CalendarPage.tsx
├─ MonthGrid.tsx
├─ DayCell.tsx
├─ TimesheetList.tsx
├─ calendarLogic.ts        # pure helpers (tested)
└─ *.module.css
client/src/api/summary.ts  # getSummary(from, to) — from spec 6
```

## Routing
- `/calendar?month=YYYY-MM`. If the param is missing or invalid, it shows the current month (the URL is replaced, not pushed).

## Layout
```
◀  October 2026  ▶   [This month]                       Month total: 152.25 h
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ 27·  │ 28·  │ 29·  │ 30·  │  1   │  2   │  3   │
│      │      │      │      │8.00 h│7.50 h│      │
│      │      │      │      │Mtg   │API…  │      │
│      │      │      │      │+2    │      │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ …                                                │
└──────────────────────────────────────────────────┘
· = day outside the displayed month (muted, still shows its data)

Timesheets — October 2026
  Thu Oct 1 – Sun Oct 4      12.00 h   ›
  Mon Oct 5 – Sun Oct 11     38.50 h   ›
  Mon Oct 12 – Sun Oct 18    40.00 h   ›
  Mon Oct 19 – Sun Oct 25    36.75 h   ›
  Mon Oct 26 – Sat Oct 31    25.00 h   ›
                     Total  152.25 h
```

## Behavior
- **Grid range:** from the Sunday on or before the 1st to the Saturday on or after the last day of the month, so 4–6 rows. Built with `calendarGridRange(year, month)` from spec 6.
- **Data:** **one** request, `GET /api/summary?from=<gridStart>&to=<gridEnd>`.
  - The grid uses `days[]`.
  - The timesheet list and the month total are computed from the same `days[]`, filtered to in-month dates.
- **Day cell:**
  - shows the day number and, if worked, the total as `formatHours`
  - lists up to **2 task names** (the largest by minutes), then `+N more`
  - days with no entries show only the number
  - today gets an accent border
  - days outside the month are muted but still clickable and still show their data
- **Click a day** (or press Enter on a focused day) → `/day/<date>`.
- **Timesheet list:** one row per period from `timesheetPeriods(year, month)` (spec 6). Each row shows its date range and total hours, and links to `/week?start=<period.from>&mode=timesheet`. The list total equals the month total.
- **Header:**
  - prev/next month and **This month** buttons
  - **Month total** counts only days inside the displayed month. This is the same number the monthly invoice will use.
- **Accessibility:** the grid uses `role="grid"`, and each day cell is a link with an `aria-label` like "Thursday October 1, 8.00 hours".
- **Loading/error:** while loading, the grid frame shows with empty cells. On error, the same banner component as the Day view.

## Pure helpers (`calendarLogic.ts`)
- `parseMonthParam(s: string | null): { year, month } | null`
- `shiftMonth({ year, month }, ±1)`
- `buildWeeks(range, days): DayCell[][]`: rows of 7, Sunday first. Days missing from `days` count as 0.
- `periodTotals(periods, days): { period, minutes }[]`
- `monthTotal(days, year, month)`: sums only in-month days.
- `topTasks(dayTasks, 2)`: returns `{ shown, moreCount }`.

## Acceptance criteria
- [ ] Vitest for `calendarLogic.ts`:
  - `parseMonthParam` rejects `2026-13` and `abc`, and accepts `2026-02`
  - `shiftMonth` across a year boundary (Dec → Jan, Jan → Dec)
  - `buildWeeks` row counts:
    - Feb 2026 (starts on a Sunday, 28 days) → 4 rows
    - Oct 2026 → 5 rows
    - Aug 2026 (starts on a Saturday, 31 days) → 6 rows
  - every row starts on a Sunday
  - `monthTotal` excludes spill-over days and equals the sum of `periodTotals`
  - `topTasks` with 0, 2 and 5 tasks
- [ ] Manual checks:
  - entries added in the Day view show up with correct totals
  - timesheet totals match the Week view in timesheet mode
  - clicking a day opens the Day view; clicking a timesheet row opens that timesheet
  - prev/next/This month and `?month=` deep links work; an invalid `?month=` falls back to the current month
  - the Network tab shows exactly one summary request per month shown

## Out of scope
Heatmap coloring, dragging entries between days, year view.

/**
 * Page geometry, colors and type sizes for every PDF, in points. Measured from the reference
 * documents (rendered 950 px wide ≈ 0.644 pt/px) and tuned by eye against them.
 */
export const page = {
  /** US Letter, portrait. */
  size: 'LETTER',
  width: 612,
  height: 792,
  marginX: 30,
  /** Where the timesheet title's line box starts. */
  timesheetTop: 60,
  invoiceTop: 18,
  bottom: 40,
} as const;

export const contentWidth = page.width - 2 * page.marginX;

export const colors = {
  text: '#444444',
  /** Invoice task names. */
  strong: '#222222',
  /** The plain rule above the invoice total. */
  rule: '#a8a8a8',
  watermark: '#ececec',
} as const;

export const fontFamily = 'Inter';

export const fontWeight = { regular: 400, medium: 500 } as const;

export const fontSize = {
  timesheetTitle: 15,
  timesheetHeader: 8.5,
  timesheetRow: 9.5,
  timesheetTotal: 11.5,

  billerName: 16,
  billerLine: 10.5,
  label: 8,
  value: 10.5,
  company: 14,
  companyLine: 10,
  itemsHeader: 9,
  invoiceRow: 10.5,
  invoiceTotal: 13,
  watermark: 150,
} as const;

/** Row pitch: the distance from one row's baseline to the next. */
export const rowHeight = {
  timesheet: 22,
  invoice: 20,
  billerLine: 19.5,
} as const;

import { summarize, timesheetPdfQuerySchema, timesheetPeriod } from '@tt/shared';
import { Router } from 'express';
import type { EntriesRepo } from '../db/entriesRepo';
import { parse } from '../middleware/validate';
import { renderTimesheet, timesheetFilename } from '../pdf/render';
import { sendPdf } from './sendPdf';

export function reportsRouter(entries: EntriesRepo) {
  const router = Router();

  /** The timesheet for the period containing `start`; empty periods are exported too. */
  router.get('/timesheet.pdf', async (req, res) => {
    const { start, inline } = parse(timesheetPdfQuerySchema, req.query);
    const { from, to } = timesheetPeriod(start);
    const pdf = await renderTimesheet(summarize(entries.listByRange(from, to), from, to));
    sendPdf(res, pdf, timesheetFilename({ from, to }), inline);
  });

  return router;
}

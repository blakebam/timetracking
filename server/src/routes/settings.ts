import { formatInvoiceNumber, settingsInputSchema } from '@tt/shared';
import { Router } from 'express';
import type { InvoicesRepo } from '../db/invoicesRepo';
import type { SettingsRepo } from '../db/settingsRepo';
import { HttpError } from '../httpError';
import { parse } from '../middleware/validate';

export function settingsRouter(repo: SettingsRepo, invoices: InvoicesRepo) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(repo.get());
  });

  /** Full replace. nextInvoiceNumber must exceed the highest issued invoice, so numbers stay unique. */
  router.put('/', (req, res) => {
    const input = parse(settingsInputSchema, req.body);
    const highest = invoices.highestNumber();
    if (highest !== null && input.nextInvoiceNumber <= highest) {
      throw new HttpError(400, {
        error: 'validation',
        issues: [
          {
            path: 'nextInvoiceNumber',
            message: `Invoice ${formatInvoiceNumber(highest)} has already been issued; the next number must be ${highest + 1} or higher.`,
          },
        ],
      });
    }
    res.json(repo.update(input));
  });

  return router;
}

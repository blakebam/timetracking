import { rangeQuerySchema, summarize } from '@tt/shared';
import { Router } from 'express';
import type { EntriesRepo } from '../db/entriesRepo';
import { parse } from '../middleware/validate';

export function summaryRouter(entries: EntriesRepo) {
  const router = Router();

  router.get('/', (req, res) => {
    const { from, to } = parse(rangeQuerySchema, req.query);
    res.json(summarize(entries.listByRange(from, to), from, to));
  });

  return router;
}

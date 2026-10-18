import { taskNamesQuerySchema } from '@tt/shared';
import { Router } from 'express';
import type { EntriesRepo } from '../db/entriesRepo';
import { parse } from '../middleware/validate';

export function tasksRouter(entries: EntriesRepo) {
  const router = Router();

  router.get('/names', (req, res) => {
    const { q, limit } = parse(taskNamesQuerySchema, req.query);
    res.json(entries.taskNames(q, limit));
  });

  return router;
}

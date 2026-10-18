import {
  entryInputSchema,
  formatRange12,
  formatShortDate,
  idParamSchema,
  rangeQuerySchema,
  type TimeEntry,
  type TimeEntryInput,
} from '@tt/shared';
import { Router } from 'express';
import type { EntriesRepo } from '../db/entriesRepo';
import { OverlapError } from '../db/errors';
import { HttpError, notFound } from '../httpError';
import { parse } from '../middleware/validate';

function overlapError(input: TimeEntryInput, conflicts: TimeEntry[]): HttpError {
  const described = conflicts
    .map((c) => `"${c.taskName}" (${formatRange12(c.startTime, c.endTime)})`)
    .join(' and ');
  const message =
    `${formatRange12(input.startTime, input.endTime)} overlaps ${described} ` +
    `on ${formatShortDate(input.date)}. Change the times on one of the two entries.`;
  return new HttpError(409, { error: 'overlap', message, conflicts });
}

export function entriesRouter(repo: EntriesRepo) {
  const router = Router();

  /** Rejects overlaps up front; the DB trigger is a backstop that maps to the same 409. */
  function writeWithoutOverlap<T>(
    input: TimeEntryInput,
    excludeId: number | undefined,
    write: () => T,
  ): T {
    const findConflicts = () =>
      repo.findOverlapping(input.date, input.startTime, input.endTime, excludeId);

    const conflicts = findConflicts();
    if (conflicts.length > 0) throw overlapError(input, conflicts);
    try {
      return write();
    } catch (err) {
      if (err instanceof OverlapError) throw overlapError(input, findConflicts());
      throw err;
    }
  }

  router.get('/', (req, res) => {
    const { from, to } = parse(rangeQuerySchema, req.query);
    res.json(repo.listByRange(from, to));
  });

  router.get('/:id', (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const entry = repo.getById(id);
    if (!entry) throw notFound();
    res.json(entry);
  });

  router.post('/', (req, res) => {
    const input = parse(entryInputSchema, req.body);
    const entry = writeWithoutOverlap(input, undefined, () => repo.create(input));
    res.status(201).json(entry);
  });

  router.put('/:id', (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const input = parse(entryInputSchema, req.body);
    if (!repo.getById(id)) throw notFound();
    const entry = writeWithoutOverlap(input, id, () => repo.update(id, input));
    if (!entry) throw notFound();
    res.json(entry);
  });

  router.delete('/:id', (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    if (!repo.remove(id)) throw notFound();
    res.status(204).end();
  });

  return router;
}

import type { ApiError } from '@tt/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../httpError';

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found' } satisfies ApiError);
};

/** body-parser's error for a request body that isn't valid JSON. */
const isJsonParseError = (err: unknown) =>
  err instanceof SyntaxError && (err as { type?: string }).type === 'entity.parse.failed';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.body);
    return;
  }
  if (err instanceof ZodError) {
    const body: ApiError = {
      error: 'validation',
      issues: err.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
    };
    res.status(400).json(body);
    return;
  }
  if (isJsonParseError(err)) {
    const body: ApiError = {
      error: 'validation',
      issues: [{ path: '', message: 'Request body is not valid JSON' }],
    };
    res.status(400).json(body);
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'internal' } satisfies ApiError);
};

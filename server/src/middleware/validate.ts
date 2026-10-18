import type { z } from 'zod';

/**
 * Parses request data with a shared schema. On failure the ZodError propagates to the
 * error handler, which turns it into a 400 `validation` response.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}

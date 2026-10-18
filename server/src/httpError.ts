import type { ApiError } from '@tt/shared';

/** An error that should reach the client as a specific status and JSON body. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.error);
    this.name = 'HttpError';
  }
}

export const notFound = () => new HttpError(404, { error: 'not_found' });

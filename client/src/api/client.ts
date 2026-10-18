import type { ApiError } from '@tt/shared';

/** A failed API call. `status` 0 means the server couldn't be reached at all. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(status === 0 ? 'Network error' : `HTTP ${status}`);
    this.name = 'ApiRequestError';
  }
}

interface ApiInit extends Omit<RequestInit, 'body'> {
  /** Sent as the JSON request body. */
  json?: unknown;
}

/** JSON in, JSON out. Throws ApiRequestError on a network failure or a non-2xx response. */
export async function apiFetch<T>(
  path: string,
  { json, headers, ...init }: ApiInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: json === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError(0, null);
  }

  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // A proxy with the server down answers 5xx without our JSON shape.
    if (body === null && res.status >= 500) throw new ApiRequestError(0, null);
    throw new ApiRequestError(res.status, (body as ApiError | null) ?? { error: 'internal' });
  }
  return body as T;
}

/** The overlap/validation/etc. body of an API error, or null for anything else. */
export function apiErrorBody(err: unknown): ApiError | null {
  return err instanceof ApiRequestError ? err.body : null;
}

/** A short, user-facing message for a failed request with no more specific handling. */
export function describeError(err: unknown): string {
  if (err instanceof ApiRequestError && err.status === 0) {
    return 'Can’t reach the server — is it running?';
  }
  const status = err instanceof ApiRequestError ? ` (HTTP ${err.status})` : '';
  return `Something went wrong${status}. Please try again.`;
}

/** Clerk's reverification hint as the API sends it with 403 reverification_required. */
export interface ReverificationHint {
  level: 'first_factor' | 'second_factor' | 'multi_factor';
  afterMinutes: number;
}

export interface ReverifyOptions {
  /** Opens the identity provider's reverification dialog; false when the person cancelled. */
  reverify(hint?: ReverificationHint): Promise<boolean>;
  getToken(opts?: { fresh?: boolean }): Promise<string | null | undefined>;
}

export const REVERIFICATION_REQUIRED = 'reverification_required';
export const REVERIFICATION_CANCELLED = 'reverification_cancelled';

async function hintOf(res: Response): Promise<ReverificationHint | null | undefined> {
  if (res.status !== 403) return undefined;
  try {
    const body = (await res.clone().json()) as { code?: string; reverification?: ReverificationHint };
    return body.code === REVERIFICATION_REQUIRED ? (body.reverification ?? null) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wraps fetch for the live API: a 403 reverification_required (a sensitive action and a second factor older than the
 * step-up window) opens the reverification dialog, then sends the same request once more with a fresh token and the same
 * Idempotency-Key. A cancelled dialog answers 403 reverification_cancelled; nothing was changed on the server.
 */
export function withReverification(fetchImpl: typeof fetch, opts: ReverifyOptions): typeof fetch {
  return async (input, init) => {
    const first = await fetchImpl(input, init);
    const hint = await hintOf(first);
    if (hint === undefined) return first;
    let confirmed = false;
    try {
      confirmed = await opts.reverify(hint ?? undefined);
    } catch {
      confirmed = false;
    }
    if (!confirmed) {
      return new Response(
        JSON.stringify({
          status: 403,
          code: REVERIFICATION_CANCELLED,
          detail: 'You did not confirm it is you, so nothing was changed.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }
    const token = await opts.getToken({ fresh: true });
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetchImpl(input, { ...init, headers: Object.fromEntries(headers.entries()) });
  };
}

/** An API failure with OnGem's stable problem code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    detail?: string,
  ) {
    super(detail || code || `HTTP ${status}`);
  }

  get forbidden(): boolean {
    return this.status === 403 && this.code !== 'reverification_cancelled';
  }
}

/** What a founder reads for the API's problem codes; anything else falls back to the API's own detail. */
const MESSAGES: Record<string, string> = {
  reverification_cancelled: 'You did not confirm it is you, so nothing was changed.',
  reverification_required:
    'This needs you to confirm it is you with your second factor. Nothing was changed. Try again and confirm.',
  permission_denied: 'Your role does not allow this. An owner of the company can do it.',
  forbidden: 'Your role does not allow this. An owner of the company can do it.',
  draft_result_mismatch:
    'This was not the action the assistant drafted, so the draft was not confirmed. Nothing else changed.',
  draft_not_open: 'The assistant draft has expired or was already decided, so it was not confirmed.',
  draft_not_found: 'The assistant draft is no longer there.',
  idempotency_in_progress:
    'OnGem is still working on this request. Wait a moment and check before trying again; it will not run twice.',
  insufficient_funds: 'Your available balance is lower than this payment.',
  device_revoked: 'This browser was signed out of OnGem. Sign in again.',
  device_required: 'This browser is not registered with OnGem yet. Sign out, then sign in again.',
};

/** The line a screen shows for a failure. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const known = e.code ? MESSAGES[e.code] : undefined;
    if (known) return known;
    if (e.status === 403) return 'Your role does not allow this. An owner of the company can do it.';
    if (e.status === 0) return 'Could not reach OnGem. Check your connection and try again.';
    return e.message;
  }
  return 'Something went wrong. Try again.';
}

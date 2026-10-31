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

/** The line a screen shows for a failure. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'reverification_cancelled')
      return 'You did not confirm it is you, so nothing was changed.';
    if (e.status === 403) return 'Your role does not allow this. An owner of the company can do it.';
    if (e.status === 0) return 'Could not reach OnGem. Check your connection and try again.';
    return e.message;
  }
  return 'Something went wrong. Try again.';
}

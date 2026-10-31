/** Clerk's reverification hint as the API sends it with 403 reverification_required. */
export interface ReverificationHint {
  level: 'first_factor' | 'second_factor' | 'multi_factor';
  afterMinutes: number;
}

export const REVERIFICATION_REQUIRED = 'reverification_required';
export const REVERIFICATION_CANCELLED = 'reverification_cancelled';

import { formatMinor } from '../lib/format';
import { t } from '../i18n/store';
import { REGION_CONFIG } from '../region';

const limit = (amountMinor: number) => formatMinor({ amountMinor, currency: REGION_CONFIG.currency });

/** Where a 409 wrong_region says the company is served (OG-022 R24): its home region and that region's API base. */
export interface WrongRegion {
  homeRegion: string | null;
  apiBaseUrl: string | null;
}

/** An API failure with OnGem's stable problem code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    detail?: string,
    readonly where?: WrongRegion,
  ) {
    super(detail || code || `HTTP ${status}`);
  }

  get forbidden(): boolean {
    return this.status === 403 && this.code !== 'reverification_cancelled';
  }
}

/** The problem codes a founder reads a sentence for: content entries `app.errors.<code>` (OG-033 R1). */
const KNOWN = new Set([
  'reverification_cancelled',
  'reverification_required',
  'permission_denied',
  'forbidden',
  'draft_result_mismatch',
  'draft_not_open',
  'draft_not_found',
  'idempotency_in_progress',
  'insufficient_funds',
  'funding_source_not_verified',
  'funding_source_refused',
  'funding_source_not_found',
  'limit_exceeded',
  'daily_limit_exceeded',
  'rail_unavailable',
  'self_approval_forbidden',
  'payment_not_pending_approval',
  'invalid_transition',
  'schedule_not_found',
  'recipient_blocked',
  'capability_unavailable',
  'company_not_member',
  'invite_not_valid',
  'invite_email_mismatch',
  'invite_exists',
  'membership_limit',
  'destination_not_allowed',
  'device_revoked',
  'device_required',
  'device_proof_required',
  'device_proof_invalid',
]);

/** The line a screen shows for a failure; anything unknown falls back to the API's own detail. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code && KNOWN.has(e.code))
      return t(`app.errors.${e.code}`, {
        limit: limit(REGION_CONFIG.topUpLimit),
        daily_limit: limit(REGION_CONFIG.topUpDailyLimit),
      });
    if (e.status === 403) return t('app.errors.forbidden');
    if (e.status === 0) return t('app.errors.network');
    return e.message;
  }
  return t('app.errors.unknown');
}

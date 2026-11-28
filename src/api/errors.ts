import { formatDate, formatMinor } from '../lib/format';
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
    /** OG-074 `credential_change_wait`: when card actions may run again (ISO time). */
    readonly until?: string,
    /** OG-087 `policy_invalid`: each problem's stable code (and English detail, for logs only). */
    readonly problems?: { code: string; detail?: string }[],
  ) {
    super(detail || code || `HTTP ${status}`);
  }

  get forbidden(): boolean {
    return this.status === 403 && this.code !== 'reverification_cancelled';
  }
}

/** OG-054: every error code of the multi-currency contract has its own sentence (`app.errors.<code>`, both languages). */
export const OG054_CODES = [
  'currency_unsupported',
  'corridor_not_found',
  'corridor_unavailable',
  'corridor_amount_out_of_range',
  'corridor_exists',
  'corridor_change_pending',
  'corridor_change_not_found',
  'corridor_change_not_pending',
  'recipient_field_required',
  'recipient_corridor_mismatch',
  'iban_invalid',
  'bic_invalid',
  'sort_code_invalid',
  'routing_number_invalid',
  'account_number_invalid',
  'currency_accounts_disabled',
  'currency_account_unavailable',
  'currency_account_exists',
  'primary_account_required',
  'account_open_pending',
  'receiving_details_unavailable',
  'first_party_unavailable',
  'drift_item_not_found',
  'drift_run_not_found',
  'idempotency_key_required',
  'idempotency_key_reused',
  'ops_issuer_required',
  'validation_failed',
  'account_not_found',
  'recipient_not_found',
  'company_closing',
  'company_frozen',
  'company_closed',
  'fx_pair_unavailable',
  'fx_quote_mismatch',
  'fx_quote_expired',
  'fx_quote_not_accepted',
  'fx_quote_in_use',
  'fx_quote_not_found',
  'movement_beneficiary_unavailable',
  'movement_not_found',
  'movement_account_not_found',
  'movement_not_pending_approval',
  'movement_wrong_state',
  'monthly_limit_exceeded',
  'reason_required',
] as const;

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
  'rate_limited',
  'sms_consent_required',
  'sms_consent_outdated',
  'sms_consent_unavailable',
  'sms_code_limit',
  ...OG054_CODES,
]);

/** The line a screen shows for a failure; anything unknown falls back to the API's own detail. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    // OG-074: a card action waits after a password, email or second factor change; the sentence says until when.
    if (e.code === 'credential_change_wait')
      return e.until
        ? t('app.errors.credential_change_wait', { until: formatDate(e.until, { time: true }) })
        : t('app.errors.credential_change_wait_unknown');
    // 409 is a transfer between accounts at different banks or regions (OG-023); 422 is a rail that cannot be scheduled.
    if (e.code === 'capability_unavailable' && e.status === 409)
      return t('app.errors.capability_unavailable_accounts');
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

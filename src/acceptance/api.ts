import type { OnGemApi } from '../api/client';
import { ApiError } from '../api/errors';
import { IS_AE } from '../region';

/**
 * OG-039 payment acceptance (ADR-0055, proposed): on only when the build sets VITE_ACCEPTANCE_ENABLED=true, never in a
 * UAE build (residency, ADR-0050), and only when the core says it is on for this environment.
 */
export const ACCEPTANCE_ENABLED: boolean = import.meta.env.VITE_ACCEPTANCE_ENABLED === 'true' && !IS_AE;

export interface AcceptanceAmount {
  amountMinor: number;
  currency: string;
  display: string;
}

export interface MerchantSummary {
  id: string;
  /** The processor's account id the elements mount with; opaque to OnGem. */
  elementAccountId: string;
  active: boolean;
  individual: string | null;
  business: string | null;
  balances: { available: AcceptanceAmount; pending: AcceptanceAmount; reserve: AcceptanceAmount }[];
  balancesAsOf: string | null;
}

export interface AcceptanceStatus {
  enabled: boolean;
  environment: 'sandbox' | 'production' | null;
  merchant: MerchantSummary | null;
}

export interface ElementToken {
  token: string;
  expiresAt: string;
  elementAccountId: string;
  environment: 'sandbox' | 'production';
}

export interface CheckoutSummary {
  id: string;
  amount: AcceptanceAmount;
  title: string;
  elementPriceId: string;
  purchaseUrl: string | null;
  createdAt: string;
}

export interface PayoutDestination {
  id: string;
  name: string | null;
  last4: string | null;
  currency: string | null;
  isDefault: boolean;
  instant: boolean;
}

export interface PayoutResult {
  id: string;
  status: string;
  amount: AcceptanceAmount;
  fee: AcceptanceAmount | null;
  rejectCode: string | null;
}

export type Surface = 'VERIFY' | 'PAYMENTS' | 'WALLET_ACTIVITY' | 'WITHDRAW';

type Caller = { call<T>(method: string, path: string, body?: { json: unknown }): Promise<T> };

const BASE = '/v1/acceptance';

/** The acceptance endpoints of ongem-core through the live client (bearer, Idempotency-Key, step-up retry). */
export class AcceptanceApi {
  constructor(private readonly api: OnGemApi) {}

  private get live(): Caller {
    if (this.api.kind !== 'live') throw new ApiError(404, 'acceptance_disabled');
    return this.api as unknown as Caller;
  }

  status = async (): Promise<AcceptanceStatus> => {
    if (this.api.kind !== 'live') return { enabled: false, environment: null, merchant: null };
    return this.live.call('GET', BASE);
  };

  open = async (): Promise<MerchantSummary> => this.live.call('POST', `${BASE}/account`);

  verify = async (
    kind: 'INDIVIDUAL' | 'BUSINESS',
  ): Promise<{ kind: string; status: string; sessionUrl: string | null }> =>
    this.live.call('POST', `${BASE}/verifications`, { json: { kind } });

  token = async (surface: Surface): Promise<ElementToken> =>
    this.live.call('POST', `${BASE}/element-tokens`, { json: { surface } });

  createCheckout = async (amountMinor: number, title: string): Promise<CheckoutSummary> =>
    this.live.call('POST', `${BASE}/checkouts`, { json: { amountMinor, currency: 'USD', title } });

  checkouts = async (): Promise<CheckoutSummary[]> => this.live.call('GET', `${BASE}/checkouts`);

  destinations = async (): Promise<PayoutDestination[]> =>
    this.live.call('GET', `${BASE}/payout-destinations?currency=USD`);

  payout = async (
    amountMinor: number,
    destinationId: string,
    speed: 'STANDARD' | 'INSTANT',
  ): Promise<PayoutResult> =>
    this.live.call('POST', `${BASE}/payouts`, {
      json: { amountMinor, currency: 'USD', destinationId, speed },
    });

  payouts = async (): Promise<PayoutResult[]> => this.live.call('GET', `${BASE}/payouts`);
}

/** Whole dollars and cents from the withdraw element's major-unit number, without float drift. */
export function minorFromMajor(amount: number): number {
  return Math.round(amount * 100);
}

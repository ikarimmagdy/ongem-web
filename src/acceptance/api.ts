import type { OnGemApi } from '../api/client';
import { ApiError } from '../api/errors';

export { ACCEPTANCE_ENABLED } from './flag';

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
  /** OG-055: which provider serves this company; the client loads that provider's card form. */
  provider?: Provider | null;
  environment: 'sandbox' | 'production' | null;
  merchant: MerchantSummary | null;
}

export type Provider = 'stripe' | 'whop';

/** OG-055 the Get paid screen's headline state (contract 1.1). */
export type GetPaidState =
  'OFF' | 'NOT_OPENED' | 'ACTION_REQUIRED' | 'IN_REVIEW' | 'REJECTED' | 'RESTRICTED' | 'ACTIVE';

export interface AcceptancePayment {
  id: string;
  checkoutId: string | null;
  status: string;
  amount: AcceptanceAmount;
  failureCode: string | null;
  paidAt: string | null;
  updatedAt: string;
}

export interface Balances {
  available: AcceptanceAmount;
  pending: AcceptanceAmount;
  reserve: AcceptanceAmount;
}

/** GET /v1/acceptance/get-paid: everything the Get paid screen shows, balances read live from the provider. */
export interface GetPaid {
  enabled: boolean;
  provider: Provider | null;
  environment: 'sandbox' | 'production' | null;
  state: GetPaidState;
  merchant: {
    id: string;
    active: boolean;
    individual: string | null;
    business: string | null;
  } | null;
  onboarding: { actionRequired: boolean } | null;
  balances: Balances[];
  balancesAsOf: string | null;
  balanceUnavailable: boolean;
  payoutDestination: PayoutDestination | null;
  recentPayments: AcceptancePayment[];
  recentPayouts: PayoutResult[];
}

export const GET_PAID_OFF: GetPaid = {
  enabled: false,
  provider: null,
  environment: null,
  state: 'OFF',
  merchant: null,
  onboarding: null,
  balances: [],
  balancesAsOf: null,
  balanceUnavailable: false,
  payoutDestination: null,
  recentPayments: [],
  recentPayouts: [],
};

/** GET /v1/acceptance/checkouts/{id}/client-config: what the card form needs, all public values. */
export type ClientConfig = {
  checkoutId: string;
  environment: 'sandbox' | 'production';
  amount: AcceptanceAmount;
  title: string;
} & (
  | {
      provider: 'stripe';
      client: {
        publishableKey: string;
        connectedAccountId: string | null;
        mode: 'payment';
        amountMinor: string;
        currency: string;
        paymentMethodCreation: 'manual';
        /** Comma separated, such as `card` (cards only). */
        paymentMethodTypes?: string;
      };
    }
  | { provider: 'whop'; client: { accountId: string; planId: string; purchaseUrl: string | null } }
);

/** POST /v1/acceptance/checkouts/{id}/confirm. `clientSecret` only with REQUIRES_ACTION, never kept. */
export interface ConfirmResult {
  paymentId: string;
  checkoutId: string;
  status: 'SUCCEEDED' | 'PENDING' | 'AUTHORIZED' | 'REQUIRES_ACTION' | 'FAILED';
  clientSecret: string | null;
  failureCode: string | null;
}

/** The demo's sample Get paid (a client that offers one); the live client calls the core. */
export interface AcceptanceBackend {
  getPaid(): Promise<GetPaid>;
  status(): Promise<AcceptanceStatus>;
  open(): Promise<unknown>;
  onboardingLink(): Promise<{ url: string | null; returnUrl: string | null }>;
  createCheckout(amountMinor: number, title: string): Promise<CheckoutSummary>;
  clientConfig(checkoutId: string): Promise<ClientConfig>;
  confirm(checkoutId: string, confirmationToken: string, buyerEmail: string | null): Promise<ConfirmResult>;
  linkPayoutDestination(): Promise<PayoutDestination>;
  payout(amountMinor: number, destinationId: string): Promise<PayoutResult>;
  payments(): Promise<AcceptancePayment[]>;
  payouts(): Promise<PayoutResult[]>;
  payLinkSettings(): Promise<PayLinkSettings>;
  createPayLink(input: NewPayLink): Promise<PayLink>;
  payLinks(state: PayLinkState | null): Promise<PayLink[]>;
  revokePayLink(id: string): Promise<PayLink>;
}

/** OG-058 GET /v1/acceptance/pay-links/settings: the limits the core enforces; a client never carries its own. */
export interface PayLinkSettings {
  enabled: boolean;
  baseUrl: string;
  currencies: string[];
  minAmountMinor: number;
  maxAmountMinor: number;
  /** ISO 8601 durations, such as PT168H, PT15M and P30D. */
  defaultExpiry: string;
  minExpiry: string;
  maxExpiry: string;
  defaultMaxUses: number;
  maxUses: number;
  maxOpenPerCompany: number;
  titleMaxLength: number;
}

export type PayLinkState = 'OPEN' | 'PAID' | 'EXPIRED' | 'REVOKED';
export const PAY_LINK_STATES: PayLinkState[] = ['OPEN', 'PAID', 'EXPIRED', 'REVOKED'];

/** A pay link as every founder read answers it; `url` carries the full token so it can be shared again. */
export interface PayLink {
  id: string;
  url: string;
  state: PayLinkState;
  checkoutId: string;
  title: string;
  amount: AcceptanceAmount;
  maxUses: number;
  uses: number;
  usesRemaining: number;
  expiresAt: string;
  customerEmail: string | null;
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
  lastPaymentAt: string | null;
}

/** POST /v1/acceptance/pay-links in its amount form; the core makes the checkout. */
export interface NewPayLink {
  amountMinor: number;
  currency: string;
  title: string;
  expiresAt?: string;
  maxUses?: number;
  customerEmail?: string;
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
  /** OG-055: the company's OnGem account this destination is, when OnGem linked it. */
  ongemAccountId?: string | null;
}

export interface PayoutResult {
  id: string;
  status: string;
  amount: AcceptanceAmount;
  fee: AcceptanceAmount | null;
  rejectCode: string | null;
  /** OG-055: the day the provider expects the money at the bank, and when the payout was made. */
  arrivalDate?: string | null;
  createdAt?: string;
}

export type Surface = 'VERIFY' | 'PAYMENTS' | 'WALLET_ACTIVITY' | 'WITHDRAW';

type Caller = {
  call<T>(
    method: string,
    path: string,
    body?: { json: unknown },
    accept?: string,
    idempotencyKey?: string,
  ): Promise<T>;
};

/** Waits between asks again of a confirm whose outcome the provider has not given yet (202, same key); tests shorten. */
export const confirmTiming = { retryMs: [1000, 2000, 4000] };

const BASE = '/v1/acceptance';
const OUTCOME_UNKNOWN = 'acceptance_outcome_unknown';

/** The acceptance endpoints of ongem-core through the live client (bearer, Idempotency-Key, step-up retry). */
export class AcceptanceApi {
  constructor(private readonly api: OnGemApi) {}

  private get live(): Caller {
    if (this.api.kind !== 'live') throw new ApiError(404, 'acceptance_disabled');
    return this.api as unknown as Caller;
  }

  /** The demo's sample Get paid, when the demo client offers one; a demo without it reads acceptance as off. */
  private get demo(): AcceptanceBackend | null {
    if (this.api.kind === 'live') return null;
    return (this.api as unknown as { acceptance?: AcceptanceBackend }).acceptance ?? null;
  }

  get provider(): 'live' | 'demo' {
    return this.api.kind;
  }

  status = async (): Promise<AcceptanceStatus> => {
    if (this.demo) return this.demo.status();
    if (this.api.kind !== 'live') return { enabled: false, environment: null, merchant: null };
    return this.live.call('GET', BASE);
  };

  /** OG-055: the whole Get paid screen in one read; off answers 200 with state OFF. */
  getPaid = async (): Promise<GetPaid> => {
    if (this.demo) return this.demo.getPaid();
    if (this.api.kind !== 'live') return GET_PAID_OFF;
    return this.live.call('GET', `${BASE}/get-paid`);
  };

  open = async (): Promise<unknown> =>
    this.demo ? this.demo.open() : this.live.call('POST', `${BASE}/account`);

  /** A short-lived link to the provider's hosted onboarding or remediation; opened at once, never kept. */
  onboardingLink = async (): Promise<{ url: string | null; returnUrl: string | null }> =>
    this.demo ? this.demo.onboardingLink() : this.live.call('POST', `${BASE}/onboarding-link`);

  clientConfig = async (checkoutId: string): Promise<ClientConfig> =>
    this.demo
      ? this.demo.clientConfig(checkoutId)
      : this.live.call('GET', `${BASE}/checkouts/${encodeURIComponent(checkoutId)}/client-config`);

  /**
   * One Idempotency-Key per Pay tap: a 202 `acceptance_outcome_unknown` is asked again with the same key, so the card is
   * charged at most once. A declined card is a 200 with FAILED, not an error.
   */
  confirm = async (
    checkoutId: string,
    confirmationToken: string,
    buyerEmail: string | null = null,
    key: string = crypto.randomUUID(),
  ): Promise<ConfirmResult> => {
    if (this.demo) return this.demo.confirm(checkoutId, confirmationToken, buyerEmail);
    const path = `${BASE}/checkouts/${encodeURIComponent(checkoutId)}/confirm`;
    const body = { json: { confirmationToken, buyerEmail, returnUrl: null } };
    for (let i = 0; ; i += 1) {
      const r = await this.live.call<ConfirmResult & { code?: string }>('POST', path, body, undefined, key);
      if (r.code !== OUTCOME_UNKNOWN) return r;
      const wait = confirmTiming.retryMs[i];
      if (wait === undefined) throw new ApiError(202, OUTCOME_UNKNOWN);
      await new Promise((ok) => setTimeout(ok, wait));
    }
  };

  /** The company's OnGem account as the payout destination (owners). */
  linkPayoutDestination = async (): Promise<PayoutDestination> =>
    this.demo ? this.demo.linkPayoutDestination() : this.live.call('POST', `${BASE}/payout-destination`);

  payments = async (): Promise<AcceptancePayment[]> =>
    this.demo ? this.demo.payments() : this.live.call('GET', `${BASE}/payments`);

  verify = async (
    kind: 'INDIVIDUAL' | 'BUSINESS',
  ): Promise<{ kind: string; status: string; sessionUrl: string | null }> =>
    this.live.call('POST', `${BASE}/verifications`, { json: { kind } });

  token = async (surface: Surface): Promise<ElementToken> =>
    this.live.call('POST', `${BASE}/element-tokens`, { json: { surface } });

  createCheckout = async (amountMinor: number, title: string): Promise<CheckoutSummary> =>
    this.demo
      ? this.demo.createCheckout(amountMinor, title)
      : this.live.call('POST', `${BASE}/checkouts`, { json: { amountMinor, currency: 'USD', title } });

  checkouts = async (): Promise<CheckoutSummary[]> => this.live.call('GET', `${BASE}/checkouts`);

  destinations = async (): Promise<PayoutDestination[]> =>
    this.live.call('GET', `${BASE}/payout-destinations?currency=USD`);

  payout = async (
    amountMinor: number,
    destinationId: string,
    speed: 'STANDARD' | 'INSTANT',
  ): Promise<PayoutResult> =>
    this.demo
      ? this.demo.payout(amountMinor, destinationId)
      : this.live.call('POST', `${BASE}/payouts`, {
          json: { amountMinor, currency: 'USD', destinationId, speed },
        });

  payouts = async (): Promise<PayoutResult[]> =>
    this.demo ? this.demo.payouts() : this.live.call('GET', `${BASE}/payouts`);

  /** OG-058: the limits a pay link is made within. */
  payLinkSettings = async (): Promise<PayLinkSettings> =>
    this.demo ? this.demo.payLinkSettings() : this.live.call('GET', `${BASE}/pay-links/settings`);

  createPayLink = async (input: NewPayLink): Promise<PayLink> =>
    this.demo ? this.demo.createPayLink(input) : this.live.call('POST', `${BASE}/pay-links`, { json: input });

  /** Newest first, at most 50; [state] narrows it. */
  payLinks = async (state: PayLinkState | null = null): Promise<PayLink[]> =>
    this.demo
      ? this.demo.payLinks(state)
      : this.live.call('GET', `${BASE}/pay-links${state ? `?state=${state}` : ''}`);

  revokePayLink = async (id: string): Promise<PayLink> =>
    this.demo
      ? this.demo.revokePayLink(id)
      : this.live.call('POST', `${BASE}/pay-links/${encodeURIComponent(id)}/revoke`);
}

/** Dollars and cents typed by the founder, as minor units; 0 when it is not an amount. */
export function minorOf(text: string): number {
  const v = text.trim();
  return /^\d{1,7}(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : 0;
}

/** Whole dollars and cents from the withdraw element's major-unit number, without float drift. */
export function minorFromMajor(amount: number): number {
  return Math.round(amount * 100);
}

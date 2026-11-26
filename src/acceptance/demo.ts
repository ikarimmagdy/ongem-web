// content-check: data (sample amounts and ids; sentences shown as UI copy are content keys)
import { ApiError } from '../api/errors';
import { brand } from '../lib/brand';
import { durationMs } from '../lib/duration';
import type {
  AcceptanceBackend,
  AcceptanceAmount,
  AcceptancePayment,
  AcceptanceStatus,
  CheckoutSummary,
  ClientConfig,
  ConfirmResult,
  GetPaid,
  NewPayLink,
  PayLink,
  PayLinkSettings,
  PayLinkState,
  PayoutDestination,
  PayoutResult,
} from './api';

const usd = (amountMinor: number): AcceptanceAmount => ({
  amountMinor,
  currency: 'USD',
  display: `$${(amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
});

/**
 * OG-055 demo Get paid: an active Stripe merchant with live-looking balances, recent payments and a payout, so the demo
 * shows the same screens as live. Nothing leaves the browser. The card form is Stripe's own: with
 * VITE_DEMO_STRIPE_PUBLISHABLE_KEY (a test publishable key, for reviews) the real Payment Element shows, else a stand-in.
 */
export class DemoAcceptance implements AcceptanceBackend {
  private seq = 0;
  private destination: PayoutDestination | null = null;
  private available = 125000;
  private pendingMinor = 4300;
  private paymentsState: AcceptancePayment[] = [
    payment('apy_demo_3', 'chk_demo_3', 'SUCCEEDED', 4300, '2026-10-29T09:58:40Z'),
    payment('apy_demo_2', 'chk_demo_2', 'FAILED', 12000, '2026-10-28T16:20:00Z', 'card_declined'),
    payment('apy_demo_1', 'chk_demo_1', 'SUCCEEDED', 85000, '2026-10-27T11:05:00Z'),
  ];
  private payoutsState: PayoutResult[] = [
    {
      id: 'apo_demo_1',
      status: 'COMPLETED',
      amount: usd(50000),
      fee: null,
      rejectCode: null,
      arrivalDate: '2026-10-24',
      createdAt: '2026-10-22T09:00:00Z',
    },
  ];
  private checkouts = new Map<string, CheckoutSummary>();
  /** OG-058 sample links: one open, one paid, one expired, newest first. */
  private links: PayLink[] = [
    link(
      'plk_demo_3',
      'OPEN',
      'Logo design',
      4300,
      1,
      0,
      '2026-11-05T15:00:00Z',
      '2026-10-29T10:00:00Z',
      'buyer@example.com',
    ),
    link(
      'plk_demo_2',
      'PAID',
      'Website hosting, November',
      12000,
      1,
      1,
      '2026-11-02T09:00:00Z',
      '2026-10-26T09:00:00Z',
    ),
    link(
      'plk_demo_1',
      'EXPIRED',
      'Workshop seat',
      25000,
      10,
      3,
      '2026-10-20T09:00:00Z',
      '2026-10-13T09:00:00Z',
    ),
  ];

  constructor(
    private readonly stepUp: (purpose: string) => Promise<void> = async () => undefined,
    private readonly now: () => string = () => '2026-10-29T15:00:00Z',
    private readonly publishableKey: string = import.meta.env.VITE_DEMO_STRIPE_PUBLISHABLE_KEY?.trim() ?? '',
  ) {}

  private next(prefix: string) {
    this.seq += 1;
    return `${prefix}_demo_new_${this.seq}`;
  }

  getPaid = async (): Promise<GetPaid> =>
    structuredClone({
      enabled: true,
      provider: 'stripe',
      environment: 'sandbox',
      state: 'ACTIVE',
      merchant: { id: 'mch_demo', active: true, individual: 'APPROVED', business: 'APPROVED' },
      onboarding: { actionRequired: false },
      balances: [{ available: usd(this.available), pending: usd(this.pendingMinor), reserve: usd(0) }],
      balancesAsOf: this.now(),
      balanceUnavailable: false,
      payoutDestination: this.destination,
      recentPayments: this.paymentsState.slice(0, 10),
      recentPayouts: this.payoutsState.slice(0, 10),
    } satisfies GetPaid);

  status = async (): Promise<AcceptanceStatus> => ({
    enabled: true,
    provider: 'stripe',
    environment: 'sandbox',
    merchant: {
      id: 'mch_demo',
      elementAccountId: 'acct_demo',
      active: true,
      individual: 'APPROVED',
      business: 'APPROVED',
      balances: [],
      balancesAsOf: null,
    },
  });

  open = async () => this.status();

  onboardingLink = async () => ({ url: null, returnUrl: null });

  createCheckout = async (amountMinor: number, title: string): Promise<CheckoutSummary> => {
    const c: CheckoutSummary = {
      id: this.next('chk'),
      amount: usd(amountMinor),
      title,
      elementPriceId: '',
      purchaseUrl: null,
      createdAt: this.now(),
    };
    c.elementPriceId = c.id;
    this.checkouts.set(c.id, c);
    return structuredClone(c);
  };

  clientConfig = async (checkoutId: string): Promise<ClientConfig> => {
    const c = this.checkouts.get(checkoutId);
    if (!c) throw new ApiError(404, 'acceptance_checkout_not_found');
    return {
      checkoutId,
      provider: 'stripe',
      environment: 'sandbox',
      amount: c.amount,
      title: c.title,
      client: {
        publishableKey: this.publishableKey,
        connectedAccountId: null,
        mode: 'payment',
        amountMinor: String(c.amount.amountMinor),
        currency: 'usd',
        paymentMethodCreation: 'manual',
      },
    };
  };

  confirm = async (checkoutId: string): Promise<ConfirmResult> => {
    const c = this.checkouts.get(checkoutId);
    if (!c) throw new ApiError(404, 'acceptance_checkout_not_found');
    const p = payment(this.next('apy'), checkoutId, 'SUCCEEDED', c.amount.amountMinor, this.now());
    this.paymentsState.unshift(p);
    this.pendingMinor += c.amount.amountMinor;
    return { paymentId: p.id, checkoutId, status: 'SUCCEEDED', clientSecret: null, failureCode: null };
  };

  linkPayoutDestination = async (): Promise<PayoutDestination> => {
    this.destination ??= {
      id: 'ba_demo_ongem',
      name: null,
      last4: '6789',
      currency: 'USD',
      isDefault: true,
      instant: false,
      ongemAccountId: 'acc_demo_checking',
    };
    return structuredClone(this.destination);
  };

  payout = async (amountMinor: number, destinationId: string): Promise<PayoutResult> => {
    if (!this.destination || destinationId !== this.destination.id)
      throw new ApiError(404, 'acceptance_destination_not_found');
    if (amountMinor > this.available) throw new ApiError(422, 'acceptance_insufficient_balance');
    await this.stepUp('acceptance_payout');
    this.available -= amountMinor;
    const p: PayoutResult = {
      id: this.next('apo'),
      status: 'PROCESSING',
      amount: usd(amountMinor),
      fee: null,
      rejectCode: null,
      arrivalDate: null,
      createdAt: this.now(),
    };
    this.payoutsState.unshift(p);
    return structuredClone(p);
  };

  /** The core's default limits (contract 1), as a demo company would read them. */
  payLinkSettings = async (): Promise<PayLinkSettings> => ({
    enabled: true,
    baseUrl: `${typeof window === 'undefined' ? `https://${brand().domains.web}` : window.location.origin}/pay`,
    currencies: ['USD'],
    minAmountMinor: 100,
    maxAmountMinor: 1000000,
    defaultExpiry: 'PT168H',
    minExpiry: 'PT15M',
    maxExpiry: 'P30D',
    defaultMaxUses: 1,
    maxUses: 100,
    maxOpenPerCompany: 500,
    titleMaxLength: 120,
  });

  createPayLink = async (input: NewPayLink): Promise<PayLink> => {
    const s = await this.payLinkSettings();
    if (input.amountMinor < s.minAmountMinor || input.amountMinor > s.maxAmountMinor)
      throw new ApiError(422, 'validation_failed');
    const created = this.now();
    const expires =
      input.expiresAt ??
      new Date(new Date(created).getTime() + (durationMs(s.defaultExpiry) ?? 0)).toISOString();
    const l = link(
      this.next('plk'),
      'OPEN',
      input.title,
      input.amountMinor,
      input.maxUses ?? s.defaultMaxUses,
      0,
      expires,
      created,
      input.customerEmail ?? null,
    );
    l.url = `${s.baseUrl}/${demoToken()}`;
    this.links.unshift(l);
    return structuredClone(l);
  };

  payLinks = async (state: PayLinkState | null): Promise<PayLink[]> =>
    structuredClone(this.links.filter((l) => !state || l.state === state));

  revokePayLink = async (id: string): Promise<PayLink> => {
    const l = this.links.find((x) => x.id === id);
    if (!l) throw new ApiError(404, 'pay_link_not_found');
    if (l.state === 'PAID' || l.state === 'EXPIRED') throw new ApiError(409, 'pay_link_not_open');
    l.state = 'REVOKED';
    l.revokedAt ??= this.now();
    return structuredClone(l);
  };

  payments = async () => structuredClone(this.paymentsState);
  payouts = async () => structuredClone(this.payoutsState);
}

function payment(
  id: string,
  checkoutId: string,
  status: string,
  amountMinor: number,
  at: string,
  failureCode: string | null = null,
): AcceptancePayment {
  return {
    id,
    checkoutId,
    status,
    amount: usd(amountMinor),
    failureCode,
    paidAt: status === 'SUCCEEDED' ? at : null,
    updatedAt: at,
  };
}

function link(
  id: string,
  state: PayLinkState,
  title: string,
  amountMinor: number,
  maxUses: number,
  uses: number,
  expiresAt: string,
  createdAt: string,
  customerEmail: string | null = null,
): PayLink {
  return {
    id,
    url: `https://${brand().domains.web}/pay/${id}_sample_token`,
    state,
    checkoutId: id.replace('plk_', 'chk_'),
    title,
    amount: usd(amountMinor),
    maxUses,
    uses,
    usesRemaining: maxUses - uses,
    expiresAt,
    customerEmail,
    createdAt,
    createdBy: 'prn_demo_owner',
    revokedAt: null,
    lastPaymentAt: uses > 0 ? createdAt : null,
  };
}

/** A random URL-safe token, as long as the core's. */
function demoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

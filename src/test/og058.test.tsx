import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { acceptanceHeaders, type HeadersPolicy } from '../../scripts/acceptance-headers.mjs';
import type { OnGemApi } from '../api/client';
import { DemoOnGemApi } from '../api/demo';
import { AcceptanceApi, type AcceptanceBackend, type PayLinkSettings } from '../acceptance/api';
import { DemoAcceptance } from '../acceptance/demo';
import { expiryFor } from '../acceptance/PayLinks';
import { publicPayConfig, type PublicPayLink } from '../acceptance/publicPay';
import { setLocale } from '../i18n';
import { durationMs } from '../lib/duration';
import { isAppPath, siteRoutes } from '../public/content';
import { chooseOption, renderApp } from './render';

vi.hoisted(() => {
  vi.stubEnv('VITE_ACCEPTANCE_ENABLED', 'true');
});

const stripe = vi.hoisted(() => ({
  instance: { createConfirmationToken: vi.fn(), handleNextAction: vi.fn() },
  elements: { submit: vi.fn(async () => ({})) },
  options: [] as unknown[],
  loadStripe: vi.fn(),
}));

vi.mock('@stripe/stripe-js', () => ({ loadStripe: stripe.loadStripe }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }: { children: React.ReactNode; options: unknown }) => {
    stripe.options.push(options);
    return <div data-testid="stripe-elements">{children}</div>;
  },
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => stripe.instance,
  useElements: () => stripe.elements,
}));

let tokenN = 0;
beforeEach(() => {
  stripe.loadStripe.mockReset();
  stripe.loadStripe.mockResolvedValue(stripe.instance);
  stripe.instance.createConfirmationToken.mockReset();
  stripe.instance.createConfirmationToken.mockImplementation(async () => ({
    confirmationToken: { id: `ctoken_${++tokenN}` },
  }));
  stripe.instance.handleNextAction.mockReset();
  stripe.options.length = 0;
  publicPayConfig.retryMs = [1, 1];
});

/** The demo client with its Get paid replaced by [backend]. */
function demoWith(backend: Partial<AcceptanceBackend> & object, base = new DemoAcceptance()): DemoOnGemApi {
  const api = new DemoOnGemApi();
  Object.defineProperty(api, 'acceptance', { value: Object.assign(base, backend) });
  return api;
}

/** The contract's public read (section 3.1) with a test publishable key; values are OnGem's, not Stripe's. */
const OPEN: PublicPayLink = {
  state: 'OPEN',
  title: 'Logo design',
  amount: { amountMinor: 4300, currency: 'USD', display: '$43.00' },
  merchantDisplayName: 'Acme Robotics LLC',
  expiresAt: '2026-11-29T10:00:00Z',
  provider: 'stripe',
  environment: 'sandbox',
  client: {
    publishableKey: 'pk_test_from_api',
    connectedAccountId: 'acct_from_api',
    mode: 'payment',
    amountMinor: '4300',
    currency: 'usd',
    paymentMethodCreation: 'manual',
    paymentMethodTypes: 'card',
  },
};

type Answer = { status: number; body: unknown };
/** A fetch for the public paths: each `METHOD path` answers its queue in order, the last one repeating. */
function publicApi(answers: Record<string, Answer[]>) {
  const calls: Array<{ method: string; path: string; init: RequestInit }> = [];
  publicPayConfig.baseUrl = '/api-dev';
  publicPayConfig.fetchImpl = (async (url: string, init: RequestInit) => {
    const path = url.replace('/api-dev', '');
    calls.push({ method: init.method ?? 'GET', path, init });
    const q = answers[`${init.method ?? 'GET'} ${path}`];
    if (!q) return new Response(JSON.stringify({ code: 'pay_link_not_found' }), { status: 404 });
    const a = q.length > 1 ? q.shift()! : q[0]!;
    return new Response(JSON.stringify(a.body), { status: a.status });
  }) as unknown as typeof fetch;
  return calls;
}

const T = 'q3Vt0m9aXc2pE7rL1bN5yKdH8sW4uZ6fJ0gTiOaR2eM';
const P = `/v1/public/pay-links/${T}`;
const header = (init: RequestInit, name: string) => (init.headers as Record<string, string>)[name];

describe('OG-058 pay links, founder side', { timeout: 20000 }, () => {
  it('OG058_founder_creates_a_link_within_the_settings_and_copies_it', async () => {
    const base = new DemoAcceptance();
    const createPayLink = vi.fn(base.createPayLink);
    const api = demoWith({ createPayLink }, base);
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderApp('/get-paid', { api });
    await userEvent.click(await screen.findByRole('tab', { name: 'Payment links' }));
    const form = await screen.findByTestId('pay-link-form');
    await userEvent.type(within(form).getByTestId('pay-link-amount'), '0.50');
    expect(within(form).getByText('Enter an amount from US$1.00 to US$10,000.00.')).toBeInTheDocument();
    expect(within(form).getByTestId('pay-link-create')).toBeDisabled();
    await userEvent.clear(within(form).getByTestId('pay-link-amount'));
    await userEvent.type(within(form).getByTestId('pay-link-amount'), '43');
    await userEvent.type(within(form).getByTestId('pay-link-title'), 'Brand kit');
    await userEvent.type(within(form).getByTestId('pay-link-email'), 'buyer@example.com');
    // The default expiry comes from the settings (PT168H from the pinned clock).
    expect(within(form).getByText(/Leave it empty and the link expires on 27 Oct 2026/)).toBeInTheDocument();
    await userEvent.click(within(form).getByTestId('pay-link-create'));
    const made = await screen.findByTestId('pay-link-made');
    expect(createPayLink).toHaveBeenCalledWith({
      amountMinor: 4300,
      currency: 'USD',
      title: 'Brand kit',
      maxUses: 1,
      customerEmail: 'buyer@example.com',
    });
    const url = within(made).getByTestId('pay-link-url').textContent ?? '';
    expect(url).toMatch(/\/pay\/[A-Za-z0-9_-]{43}$/);
    await userEvent.click(within(made).getByTestId('pay-link-copy'));
    expect(writeText).toHaveBeenCalledWith(url);
    const table = screen.getByRole('table', { name: 'Your payment links' });
    expect(within(table).getByText('Brand kit')).toBeInTheDocument();
  });

  it('OG058_limited_use_bounds_and_revoke_an_open_link', async () => {
    const api = new DemoOnGemApi();
    renderApp('/get-paid', { api });
    await userEvent.click(await screen.findByRole('tab', { name: 'Payment links' }));
    const form = await screen.findByTestId('pay-link-form');
    await chooseOption(within(form).getByTestId('pay-link-use'), 'limited');
    await userEvent.clear(within(form).getByTestId('pay-link-max-uses'));
    await userEvent.type(within(form).getByTestId('pay-link-max-uses'), '101');
    expect(within(form).getByText('Enter a number from 2 to 100.')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Your payment links' });
    expect(within(table).getByText('Open')).toBeInTheDocument();
    expect(within(table).getByText('1 of 1 paid')).toBeInTheDocument();
    expect(within(table).getByText('3 of 10 paid')).toBeInTheDocument();
    expect(within(table).queryByTestId('pay-link-revoke-plk_demo_2')).toBeNull();
    await userEvent.click(within(table).getByTestId('pay-link-revoke-plk_demo_3'));
    await userEvent.click(await screen.findByTestId('pay-link-revoke-confirm'));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('pay-link-row-plk_demo_3').closest('tr')!).getByText('Revoked'),
      ).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId('pay-link-filter-OPEN'));
    expect(await screen.findByText('No payment links')).toBeInTheDocument();
  });

  it('OG058_expiry_day_is_checked_against_the_settings', () => {
    const s: Pick<PayLinkSettings, 'minExpiry' | 'maxExpiry'> = { minExpiry: 'PT15M', maxExpiry: 'P30D' };
    const now = new Date('2026-11-22T10:00:00Z');
    const day = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(expiryFor('', s, now)).toEqual({});
    expect(expiryFor(day(now), s, now)).toEqual({ error: 'too_soon' });
    const inAWeek = new Date(now.getTime() + 7 * 86400000);
    expect(expiryFor(day(inAWeek), s, now)).toEqual({ expiresAt: inAWeek.toISOString() });
    const last = new Date(now.getTime() + 30 * 86400000);
    expect(expiryFor(day(last), s, now)).toEqual({ expiresAt: last.toISOString() });
    expect(expiryFor(day(new Date(last.getTime() + 86400000)), s, now)).toEqual({ error: 'too_late' });
    expect(durationMs('PT168H')).toBe(168 * 3600000);
    expect(durationMs('PT15M')).toBe(900000);
    expect(durationMs('P30D')).toBe(30 * 86400000);
    // Contract change 2: the core writes 30 days as Java does.
    expect(durationMs('PT720H')).toBe(30 * 86400000);
    expect(expiryFor(day(last), { minExpiry: 'PT15M', maxExpiry: 'PT720H' }, now)).toEqual({
      expiresAt: last.toISOString(),
    });
    expect(durationMs('P')).toBeNull();
    expect(durationMs('7 days')).toBeNull();
  });

  it('OG058_whop_company_has_no_payment_links_tab', async () => {
    const whop = { ...(await new DemoAcceptance().getPaid()), provider: 'whop' as const };
    renderApp('/get-paid', { api: demoWith({ getPaid: async () => whop }) });
    await screen.findByTestId('get-paid');
    expect(screen.queryByRole('tab', { name: 'Payment links' })).toBeNull();
  });

  it('OG058_live_founder_calls_follow_the_contract', async () => {
    const call = vi.fn(async () => ({}));
    const api = new AcceptanceApi({ kind: 'live', call } as unknown as OnGemApi);
    await api.payLinkSettings();
    await api.createPayLink({ amountMinor: 4300, currency: 'USD', title: 'Logo design', maxUses: 1 });
    await api.payLinks();
    await api.payLinks('OPEN');
    await api.revokePayLink('plk_8c1d');
    expect(call.mock.calls.map((c) => `${(c as unknown[])[0]} ${(c as unknown[])[1]}`)).toEqual([
      'GET /v1/acceptance/pay-links/settings',
      'POST /v1/acceptance/pay-links',
      'GET /v1/acceptance/pay-links',
      'GET /v1/acceptance/pay-links?state=OPEN',
      'POST /v1/acceptance/pay-links/plk_8c1d/revoke',
    ]);
    expect((call.mock.calls[1] as unknown[])[2]).toEqual({
      json: { amountMinor: 4300, currency: 'USD', title: 'Logo design', maxUses: 1 },
    });
  });
});

describe('OG-058 pay link page, buyer side', { timeout: 20000 }, () => {
  it('OG058_public_page_without_sign_in_shows_merchant_amount_and_card_form', async () => {
    const calls = publicApi({ [`GET ${P}`]: [{ status: 200, body: OPEN }] });
    renderApp(`/pay/${T}`, { mode: 'none' });
    const page = await screen.findByTestId('pay-state-open');
    expect(within(page).getByTestId('pay-merchant')).toHaveTextContent('Acme Robotics LLC');
    expect(within(page).getByTestId('pay-title')).toHaveTextContent('Logo design');
    expect(within(page).getByTestId('pay-amount')).toHaveTextContent('US$43.00');
    expect(within(page).getByText('Test mode: use a test card. No real money moves.')).toBeInTheDocument();
    expect(await within(page).findByTestId('payment-element')).toBeInTheDocument();
    expect(stripe.loadStripe).toHaveBeenCalledWith('pk_test_from_api', { stripeAccount: 'acct_from_api' });
    expect(stripe.options[0]).toMatchObject({
      mode: 'payment',
      amount: 4300,
      currency: 'usd',
      paymentMethodCreation: 'manual',
      allowedPaymentMethodTypes: ['card'],
      locale: 'en',
    });
    expect(screen.queryByTestId('auth-sign-in')).toBeNull();
    expect(header(calls[0]!.init, 'Authorization')).toBeUndefined();
    expect(calls[0]!.init.credentials).toBe('omit');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  it('OG058_one_key_per_pay_tap_and_the_same_key_when_the_outcome_is_unknown', async () => {
    const calls = publicApi({
      [`GET ${P}`]: [{ status: 200, body: OPEN }],
      [`POST ${P}/confirm`]: [
        {
          status: 200,
          body: {
            paymentId: 'apy_1',
            status: 'FAILED',
            clientSecret: null,
            failureCode: 'card_declined',
            linkState: 'OPEN',
          },
        },
        { status: 202, body: { code: 'acceptance_outcome_unknown' } },
        {
          status: 200,
          body: {
            paymentId: 'apy_2',
            status: 'SUCCEEDED',
            clientSecret: null,
            failureCode: null,
            linkState: 'PAID',
          },
        },
      ],
    });
    renderApp(`/pay/${T}`, { mode: 'none' });
    await userEvent.click(await screen.findByTestId('acceptance-pay'));
    expect(await screen.findByTestId('acceptance-pay-error')).toHaveTextContent('The card was declined.');
    await userEvent.type(screen.getByTestId('acceptance-buyer-email'), 'buyer@example.com');
    await userEvent.click(screen.getByTestId('acceptance-pay'));
    expect(await screen.findByTestId('pay-done-paid')).toHaveTextContent('Payment complete');
    const confirms = calls.filter((c) => c.method === 'POST');
    expect(confirms).toHaveLength(3);
    const keys = confirms.map((c) => header(c.init, 'Idempotency-Key'));
    // The second tap's outcome was unknown: asked again with its own key; the first tap had another.
    expect(keys[1]).toBe(keys[2]);
    expect(keys[0]).not.toBe(keys[1]);
    expect(JSON.parse(confirms[2]!.init.body as string)).toEqual({
      confirmationToken: JSON.parse(confirms[1]!.init.body as string).confirmationToken,
      buyerEmail: 'buyer@example.com',
      returnUrl: null,
    });
  });

  it('OG058_outcome_still_unknown_offers_check_again_with_the_same_key', async () => {
    const unknown = { status: 202, body: { code: 'acceptance_outcome_unknown' } };
    const calls = publicApi({
      [`GET ${P}`]: [{ status: 200, body: OPEN }],
      [`POST ${P}/confirm`]: [
        unknown,
        unknown,
        unknown,
        {
          status: 200,
          body: {
            paymentId: 'apy_3',
            status: 'PENDING',
            clientSecret: null,
            failureCode: null,
            linkState: 'OPEN',
          },
        },
      ],
    });
    renderApp(`/pay/${T}`, { mode: 'none' });
    await userEvent.click(await screen.findByTestId('acceptance-pay'));
    expect(await screen.findByTestId('acceptance-outcome-unknown')).toBeInTheDocument();
    expect(screen.queryByTestId('acceptance-pay')).toBeNull();
    await userEvent.click(screen.getByTestId('acceptance-check-again'));
    expect(await screen.findByTestId('pay-done-processing')).toBeInTheDocument();
    const keys = new Set(
      calls.filter((c) => c.method === 'POST').map((c) => header(c.init, 'Idempotency-Key')),
    );
    expect(keys.size).toBe(1);
    expect(stripe.instance.createConfirmationToken).toHaveBeenCalledTimes(1);
  });

  it('OG058_3d_secure_then_the_payment_state_from_the_core', async () => {
    publicApi({
      [`GET ${P}`]: [{ status: 200, body: OPEN }],
      [`POST ${P}/confirm`]: [
        {
          status: 200,
          body: {
            paymentId: 'apy_7c1b',
            status: 'REQUIRES_ACTION',
            clientSecret: 'pi_secret_once',
            failureCode: null,
            linkState: 'OPEN',
          },
        },
      ],
      [`GET ${P}/payments/apy_7c1b`]: [
        {
          status: 200,
          body: { paymentId: 'apy_7c1b', status: 'SUCCEEDED', failureCode: null, linkState: 'PAID' },
        },
      ],
    });
    stripe.instance.handleNextAction.mockResolvedValue({ paymentIntent: { status: 'requires_capture' } });
    renderApp(`/pay/${T}`, { mode: 'none' });
    await userEvent.click(await screen.findByTestId('acceptance-pay'));
    expect(await screen.findByTestId('pay-done-paid')).toBeInTheDocument();
    expect(stripe.instance.handleNextAction).toHaveBeenCalledWith({ clientSecret: 'pi_secret_once' });
  });

  it('OG058_paid_expired_revoked_unavailable_and_unknown_links', async () => {
    const cases: Array<[PublicPayLink['state'], string, string]> = [
      ['PAID', 'pay-state-paid', 'Paid, thank you'],
      ['EXPIRED', 'pay-state-expired', 'This link has expired'],
      ['REVOKED', 'pay-state-revoked', 'This link is no longer active'],
      ['UNAVAILABLE', 'pay-state-unavailable', 'Payments are paused'],
    ];
    for (const [state, id, words] of cases) {
      const ended: PublicPayLink = { ...OPEN, state };
      delete ended.client;
      publicApi({ [`GET ${P}`]: [{ status: 200, body: ended }] });
      const r = renderApp(`/pay/${T}`, { mode: 'none' });
      expect(await screen.findByTestId(id)).toHaveTextContent(words);
      expect(screen.queryByTestId('payment-element')).toBeNull();
      r.unmount();
    }
    publicApi({});
    renderApp(`/pay/${T}`, { mode: 'none' });
    expect(await screen.findByTestId('pay-state-not_found')).toHaveTextContent('Link not found');
    expect(stripe.loadStripe).not.toHaveBeenCalled();
  });

  it('OG058_a_link_that_ends_while_paying_shows_its_state_and_busy_is_a_message', async () => {
    publicApi({
      [`GET ${P}`]: [{ status: 200, body: OPEN }],
      [`POST ${P}/confirm`]: [
        { status: 409, body: { code: 'pay_link_busy' } },
        { status: 409, body: { code: 'pay_link_expired' } },
      ],
    });
    renderApp(`/pay/${T}`, { mode: 'none' });
    await userEvent.click(await screen.findByTestId('acceptance-pay'));
    expect(await screen.findByTestId('acceptance-pay-error')).toHaveTextContent(
      'Someone else is paying this link right now.',
    );
    await userEvent.click(screen.getByTestId('acceptance-pay'));
    expect(await screen.findByTestId('pay-state-expired')).toHaveTextContent('Ask Acme Robotics LLC');
  });

  it('OG058_arabic_page_and_card_form', async () => {
    publicApi({ [`GET ${P}`]: [{ status: 200, body: OPEN }] });
    await act(() => setLocale('ar'));
    renderApp(`/pay/${T}`, { mode: 'none' });
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    const page = await screen.findByTestId('pay-state-open');
    expect(
      within(page).getByText('وضع الاختبار: استخدم بطاقة اختبار. لا تُنقل أموال حقيقية.'),
    ).toBeInTheDocument();
    expect(await within(page).findByTestId('payment-element')).toBeInTheDocument();
    expect(stripe.options.at(-1)).toMatchObject({ locale: 'ar' });
    expect(within(page).getByTestId('acceptance-pay')).toHaveTextContent('ادفع');
  });
});

describe('OG-058 edge, headers and bundle', () => {
  it('OG058_headers_cover_the_pay_page_and_the_edge_answers_it', () => {
    const h = acceptanceHeaders(
      'sandbox',
      JSON.parse(readFileSync(join(process.cwd(), 'security-headers.json'), 'utf8')) as HeadersPolicy,
    );
    const csp = Object.fromEntries(
      h.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy.split(';').map((d) => {
        const [name, ...v] = d.trim().split(' ');
        return [name, v];
      }),
    ) as Record<string, string[]>;
    expect(csp['script-src']).toEqual(
      expect.arrayContaining(['https://js.stripe.com', 'https://*.js.stripe.com']),
    );
    expect(csp['frame-src']).toEqual(
      expect.arrayContaining(['https://js.stripe.com', 'https://hooks.stripe.com']),
    );
    expect(csp['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https://api.stripe.com']));
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    // The token is in the path: only the origin ever leaves in a Referer.
    expect(h.SecurityHeadersConfig.ReferrerPolicy.ReferrerPolicy).toBe('strict-origin');
    expect(h.SecurityHeadersConfig.FrameOptions.FrameOption).toBe('DENY');
    expect(h.Comment).toContain('/pay/<token>');
    expect(siteRoutes().app).toEqual(expect.arrayContaining(['pay', 'get-paid']));
    // A buyer never signs in: the pay page is not an app path (Clerk does not load for it).
    expect(isAppPath(`/pay/${T}`)).toBe(false);
    expect(isAppPath('/get-paid')).toBe(true);
  });

  it('OG058_pay_page_is_its_own_chunk_and_stripe_loads_lazily', () => {
    const src = (f: string) => readFileSync(join(process.cwd(), 'src', f), 'utf8');
    for (const f of [
      'acceptance/PayLinkPage.tsx',
      'acceptance/publicPay.ts',
      'acceptance/PayLinks.tsx',
      'App.tsx',
    ])
      expect(src(f)).not.toMatch(/from '@stripe\//);
    expect(src('acceptance/PayLinkPage.tsx')).toMatch(/import\('\.\/StripeSurfaces'\)/);
    expect(src('App.tsx')).toMatch(/import\('\.\/acceptance\/PayLinkPage'\)/);
    expect(src('main.tsx')).toMatch(/secretAfter: \[[^\]]*'pay'/);
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OnGemApi } from '../api/client';
import { DemoOnGemApi } from '../api/demo';
import {
  AcceptanceApi,
  confirmTiming,
  GET_PAID_OFF,
  type AcceptanceBackend,
  type GetPaid,
} from '../acceptance/api';
import { DemoAcceptance } from '../acceptance/demo';
import { stripeAppearance } from '../acceptance/appearance';
import { minorOf } from '../acceptance/GetPaid';
import { stripeFor } from '../acceptance/StripeSurfaces';
import themes from '../themes/ongem-themes.json';
import type { Theme } from '../design-system/theme';
import { renderApp } from './render';

vi.hoisted(() => {
  vi.stubEnv('VITE_ACCEPTANCE_ENABLED', 'true');
});

const stripe = vi.hoisted(() => ({
  instance: {
    createConfirmationToken: vi.fn(),
    handleNextAction: vi.fn(),
  },
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

beforeEach(() => {
  stripe.loadStripe.mockReset();
  stripe.loadStripe.mockResolvedValue(stripe.instance);
  stripe.instance.createConfirmationToken.mockReset();
  stripe.instance.createConfirmationToken.mockResolvedValue({ confirmationToken: { id: 'ctoken_1' } });
  stripe.instance.handleNextAction.mockReset();
  stripe.options.length = 0;
  confirmTiming.retryMs = [1, 1, 1];
});

/** The demo client with its Get paid replaced by [backend] (a Stripe key, a state, a spy). */
function demoWith(backend: Partial<AcceptanceBackend> & object, base = new DemoAcceptance()): DemoOnGemApi {
  const api = new DemoOnGemApi();
  Object.defineProperty(api, 'acceptance', { value: Object.assign(base, backend) });
  return api;
}

function liveCaller(answers: Record<string, unknown>) {
  const call = vi.fn(async (method: string, path: string) => {
    const a = answers[`${method} ${path}`];
    return typeof a === 'function' ? (a as () => unknown)() : a;
  });
  return { call, api: new AcceptanceApi({ kind: 'live', call } as unknown as OnGemApi) };
}

describe('OG-055 Get paid with Stripe (web)', { timeout: 20000 }, () => {
  it('OG055_screen_reads_get_paid_once_and_shows_state_balance_and_recent', async () => {
    const api = new DemoOnGemApi();
    renderApp('/get-paid', { api });
    const screenRoot = await screen.findByTestId('get-paid');
    expect(within(screenRoot).getByTestId('acceptance-state-active')).toHaveTextContent('Active');
    expect(screen.getByText('Ready to take payments')).toBeInTheDocument();
    const balance = screen.getByTestId('acceptance-balance');
    expect(balance).toHaveTextContent('US$1,250.00');
    expect(balance).toHaveTextContent('US$43.00');
    expect(screen.getByText(/Read live from the provider/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Payments' })).toHaveTextContent('The card was declined.');
    expect(screen.getByRole('table', { name: 'Payouts' })).toHaveTextContent('Arrived');
    expect(await screen.findByTestId('nav-get_paid')).toBeInTheDocument();
  });

  it('OG055_owner_links_the_ongem_account_as_payout_destination_then_pays_out', async () => {
    const api = new DemoOnGemApi();
    renderApp('/get-paid', { api });
    await userEvent.click(await screen.findByTestId('acceptance-link-destination'));
    expect(await screen.findByTestId('acceptance-destination')).toHaveTextContent('ending 6789');
    await userEvent.click(screen.getByRole('tab', { name: 'Withdraw' }));
    await userEvent.type(screen.getByTestId('acceptance-withdraw-amount'), '2000');
    expect(screen.getByText('This is more than the available balance.')).toBeInTheDocument();
    await userEvent.clear(screen.getByTestId('acceptance-withdraw-amount'));
    await userEvent.type(screen.getByTestId('acceptance-withdraw-amount'), '100');
    await userEvent.click(screen.getByTestId('acceptance-withdraw'));
    expect(await screen.findByTestId('acceptance-withdraw-done')).toHaveTextContent('US$100.00');
  });

  it('OG055_payment_element_from_client_config_sends_confirmation_token_to_core', async () => {
    const confirm = vi.fn(async (checkoutId: string) => ({
      paymentId: 'apy_1',
      checkoutId,
      status: 'SUCCEEDED' as const,
      clientSecret: null,
      failureCode: null,
    }));
    const api = demoWith({ confirm }, new DemoAcceptance(undefined, undefined, 'pk_test_from_api'));
    renderApp('/get-paid', { api });
    await userEvent.click(await screen.findByRole('tab', { name: 'Request a payment' }));
    await userEvent.type(screen.getByTestId('acceptance-amount'), '43');
    await userEvent.type(screen.getByTestId('acceptance-title'), 'Logo design');
    await userEvent.click(screen.getByTestId('acceptance-create'));
    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(stripe.loadStripe).toHaveBeenCalledWith('pk_test_from_api', undefined);
    expect(stripe.options[0]).toMatchObject({
      mode: 'payment',
      amount: 4300,
      currency: 'usd',
      paymentMethodCreation: 'manual',
    });
    await userEvent.type(screen.getByTestId('acceptance-buyer-email'), 'buyer@example.com');
    await userEvent.click(screen.getByTestId('acceptance-pay'));
    expect(await screen.findByTestId('acceptance-outcome-paid')).toBeInTheDocument();
    expect(stripe.elements.submit).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^chk_/), 'ctoken_1', 'buyer@example.com');
  });

  it('OG055_3ds_handles_next_action_and_a_decline_is_shown_not_thrown', async () => {
    const results = [
      { status: 'REQUIRES_ACTION', clientSecret: 'pi_secret_once', failureCode: null },
      { status: 'FAILED', clientSecret: null, failureCode: 'insufficient_funds' },
    ];
    const confirm = vi.fn(async (checkoutId: string) => ({
      paymentId: 'apy_1',
      checkoutId,
      ...results.shift()!,
    }));
    stripe.instance.handleNextAction.mockResolvedValue({ paymentIntent: { status: 'processing' } });
    const api = demoWith(
      { confirm: confirm as AcceptanceBackend['confirm'] },
      new DemoAcceptance(undefined, undefined, 'pk_test_x'),
    );
    renderApp('/get-paid', { api });
    await userEvent.click(await screen.findByRole('tab', { name: 'Request a payment' }));
    await userEvent.type(screen.getByTestId('acceptance-amount'), '10');
    await userEvent.type(screen.getByTestId('acceptance-title'), 'Hours');
    await userEvent.click(screen.getByTestId('acceptance-create'));
    await userEvent.click(await screen.findByTestId('acceptance-pay'));
    expect(await screen.findByTestId('acceptance-outcome-processing')).toBeInTheDocument();
    expect(stripe.instance.handleNextAction).toHaveBeenCalledWith({ clientSecret: 'pi_secret_once' });

    await userEvent.click(screen.getByTestId('acceptance-create'));
    await userEvent.click(await screen.findByTestId('acceptance-pay'));
    expect(await screen.findByTestId('acceptance-pay-error')).toHaveTextContent(
      'The card has insufficient funds.',
    );
  });

  it('OG055_buyer_checkout_shows_amount_and_card_form', async () => {
    const backend = new DemoAcceptance(undefined, undefined, 'pk_test_x');
    const checkout = await backend.createCheckout(4300, 'Logo design');
    const api = demoWith({}, backend);
    renderApp(`/get-paid/checkout/${checkout.id}`, { api });
    const page = await screen.findByTestId('buyer-checkout');
    expect(within(page).getByTestId('buyer-checkout-amount')).toHaveTextContent('US$43.00');
    expect(within(page).getByText('Logo design')).toBeInTheDocument();
    expect(await within(page).findByTestId('payment-element')).toBeInTheDocument();
  });

  it('OG055_action_required_opens_the_providers_link_at_once', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });
    const state: GetPaid = {
      ...(await new DemoAcceptance().getPaid()),
      state: 'ACTION_REQUIRED',
      merchant: { id: 'mch_1', active: false, individual: 'APPROVED', business: 'ACTION_REQUIRED' },
    };
    const onboardingLink = vi.fn(async () => ({
      url: 'https://connect.stripe.com/setup/c/acct_1/abc',
      returnUrl: 'https://app-dev.platform.ongem.com/get-paid',
    }));
    renderApp('/get-paid', { api: demoWith({ getPaid: async () => state, onboardingLink }) });
    await userEvent.click(await screen.findByTestId('acceptance-onboarding'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/c/acct_1/abc'));
    expect(screen.queryByRole('tab', { name: 'Request a payment' })).toBeNull();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('OG055_off_not_opened_and_rejected_states', async () => {
    const off = renderApp('/get-paid', { api: demoWith({ getPaid: async () => GET_PAID_OFF }) });
    expect(await screen.findByTestId('acceptance-off')).toBeInTheDocument();
    off.unmount();
    const notOpened = {
      ...GET_PAID_OFF,
      enabled: true,
      provider: 'stripe',
      environment: 'sandbox',
      state: 'NOT_OPENED',
    };
    const open = vi.fn(async () => ({}));
    const first = renderApp('/get-paid', {
      api: demoWith({ getPaid: async () => notOpened as GetPaid, open }),
    });
    await userEvent.click(await screen.findByTestId('acceptance-open'));
    expect(open).toHaveBeenCalled();
    first.unmount();
    const rejected = {
      ...(await new DemoAcceptance().getPaid()),
      state: 'REJECTED',
      merchant: { id: 'm', active: false, individual: 'REJECTED', business: 'REJECTED' },
    } as GetPaid;
    renderApp('/get-paid', { api: demoWith({ getPaid: async () => rejected }) });
    expect(await screen.findByText('Contact support')).toHaveAttribute('href', '/support/new');
  });

  it('OG055_whop_company_keeps_whop_surfaces', async () => {
    const whop = { ...(await new DemoAcceptance().getPaid()), provider: 'whop' } as GetPaid;
    const status = vi.fn(async () => ({
      ...(await new DemoAcceptance().status()),
      provider: 'whop' as const,
    }));
    renderApp('/get-paid', { api: demoWith({ getPaid: async () => whop, status }) });
    const root = await screen.findByTestId('get-paid');
    expect(root).toHaveAttribute('data-provider', 'whop');
    await waitFor(() => expect(status).toHaveBeenCalled());
    expect(screen.queryByTestId('acceptance-link-destination')).toBeNull();
  });

  it('OG055_live_calls_follow_the_contract', async () => {
    let n = 0;
    const { call, api } = liveCaller({
      'GET /v1/acceptance/get-paid': GET_PAID_OFF,
      'POST /v1/acceptance/onboarding-link': { url: null, returnUrl: null },
      'GET /v1/acceptance/checkouts/chk_1/client-config': { provider: 'stripe' },
      'POST /v1/acceptance/payout-destination': { id: 'ba_1' },
      'POST /v1/acceptance/checkouts/chk_1/confirm': () =>
        ++n === 1
          ? { code: 'acceptance_outcome_unknown' }
          : {
              paymentId: 'apy_1',
              checkoutId: 'chk_1',
              status: 'SUCCEEDED',
              clientSecret: null,
              failureCode: null,
            },
    });
    await api.getPaid();
    await api.onboardingLink();
    await api.clientConfig('chk_1');
    await api.linkPayoutDestination();
    const r = await api.confirm('chk_1', 'ctoken_1', null, 'key-1');
    expect(r.status).toBe('SUCCEEDED');
    const confirms = call.mock.calls.filter((c) => c[1].endsWith('/confirm'));
    expect(confirms).toHaveLength(2);
    // The same Pay tap: the 202 outcome-unknown is asked again with the same Idempotency-Key.
    expect(confirms.map((c) => (c as unknown[])[4])).toEqual(['key-1', 'key-1']);
    expect((confirms[0] as unknown[])[2]).toEqual({
      json: { confirmationToken: 'ctoken_1', buyerEmail: null, returnUrl: null },
    });
  });

  it('OG055_stripe_js_per_key_and_account_and_styled_from_theme', async () => {
    await stripeFor('pk_a', 'acct_1');
    await stripeFor('pk_a', 'acct_1');
    expect(stripe.loadStripe).toHaveBeenCalledTimes(1);
    expect(stripe.loadStripe).toHaveBeenCalledWith('pk_a', { stripeAccount: 'acct_1' });
    const theme = (themes as unknown as { themes: Theme[] }).themes[0]!;
    const a = stripeAppearance(theme);
    expect(a.variables.colorPrimary).toBe(theme.color.brand.primary);
    expect(a.variables.fontFamily).toBe(theme.typography.body.family);
    expect(a.variables.borderRadius).toBe(`${theme.radius.md}px`);
    expect(minorOf('19.99')).toBe(1999);
    expect(minorOf('1.999')).toBe(0);
  });

  it('OG055_stripe_loads_only_from_the_lazy_stripe_chunk', () => {
    const src = (f: string) => readFileSync(join(process.cwd(), 'src', f), 'utf8');
    for (const f of ['acceptance/GetPaid.tsx', 'acceptance/api.ts', 'acceptance/demo.ts', 'SignedIn.tsx'])
      expect(src(f)).not.toMatch(/from '@stripe\//);
    expect(src('acceptance/GetPaid.tsx')).toMatch(/import\('\.\/StripeSurfaces'\)/);
    expect(src('SignedIn.tsx')).not.toMatch(/from '\.\/recording\/Recorder'/);
  });
});

import { useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { ApiError, errorText } from '../api/errors';
import { Button, Field, Input, Notice } from '../design-system';
import { useTheme } from '../design-system/theme/ThemeProvider';
import { t, useContent } from '../i18n';
import type { AcceptanceApi, ClientConfig, ConfirmResult } from './api';
import { stripeAppearance } from './appearance';

type StripeConfig = Extract<ClientConfig, { provider: 'stripe' }>;

/** One Stripe.js per publishable key and connected account; loaded only on the Get paid routes. */
const loaded = new Map<string, Promise<Stripe | null>>();
export function stripeFor(publishableKey: string, account: string | null): Promise<Stripe | null> {
  const id = `${publishableKey}|${account ?? ''}`;
  let p = loaded.get(id);
  if (!p) {
    p = loadStripe(publishableKey, account ? { stripeAccount: account } : undefined);
    loaded.set(id, p);
  }
  return p;
}

export type PayOutcome = 'paid' | 'processing';

/** What the card form needs from Stripe: the public values the core hands out (OG-055 client-config, OG-058 public read). */
export interface StripeClient {
  publishableKey: string;
  connectedAccountId: string | null;
  amountMinor: string;
  currency: string;
  /** Comma separated, such as `card`; left out, Stripe's defaults for the account. */
  paymentMethodTypes?: string;
}

/** The core's answer to a confirm, as the card form reads it. */
export interface Confirmed {
  paymentId: string;
  status: ConfirmResult['status'];
  clientSecret: string | null;
  failureCode: string | null;
}

/** How a card form pays: the core's confirm, and, after 3D Secure, the payment's state from the core when it has one. */
export interface CardPayment {
  /** [key]: one per Pay tap; a retry of the same tap passes the same key, token and email. */
  confirm(confirmationToken: string, buyerEmail: string | null, key: string): Promise<Confirmed>;
  settle?(paymentId: string): Promise<{ status: ConfirmResult['status']; failureCode: string | null }>;
  /** The words for a refusal; null when the caller has handled it (the page moved to another state). */
  describeError?(e: unknown): string | null;
}

/**
 * OG-055: the buyer's card on the founder's screen with Stripe's Payment Element in deferred mode (no PaymentIntent on
 * the client). Pay submits the element, makes a ConfirmationToken and sends only its id to ongem-core, which creates and
 * confirms the payment on the company's connected account. 3D Secure is finished with handleNextAction and the
 * client secret is used once and never kept. Publishable key and connected account come from the core's client-config.
 */
export function StripeCheckout({
  api,
  config,
  onDone,
}: {
  api: AcceptanceApi;
  config: StripeConfig;
  onDone(outcome: PayOutcome): void;
}) {
  const payment = useMemo<CardPayment>(
    () => ({
      confirm: (token, email, key) => api.confirm(config.checkoutId, token, email, key),
    }),
    [api, config.checkoutId],
  );
  return <StripeCardForm client={config.client} payment={payment} onDone={onDone} />;
}

/** The Payment Element for [client], or the demo's stand-in when there is no publishable key (demo without a review key). */
export function StripeCardForm({
  client: c,
  payment,
  onDone,
}: {
  client: StripeClient;
  payment: CardPayment;
  onDone(outcome: PayOutcome): void;
}) {
  const { theme } = useTheme();
  const locale = useContent();
  const stripe = useMemo(
    () => (c.publishableKey ? stripeFor(c.publishableKey, c.connectedAccountId) : null),
    [c.publishableKey, c.connectedAccountId],
  );
  const types = c.paymentMethodTypes;
  const options = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: Number(c.amountMinor),
      currency: c.currency,
      paymentMethodCreation: 'manual' as const,
      // Stripe.js of @stripe/stripe-js 10 refuses `paymentMethodTypes` ("no longer supported"); the same list is
      // `allowedPaymentMethodTypes` there.
      ...(types ? { allowedPaymentMethodTypes: types.split(',').map((x) => x.trim()) } : {}),
      appearance: stripeAppearance(theme),
      locale: locale === 'ar' ? ('ar' as const) : ('en' as const),
    }),
    [c.amountMinor, c.currency, types, theme, locale],
  );
  if (!stripe)
    // Demo mode without a review key: the card form is Stripe's own and is not shown here.
    return <DemoPay payment={payment} onDone={onDone} />;
  return (
    <Elements stripe={stripe} options={options}>
      <PayForm payment={payment} onDone={onDone} />
    </Elements>
  );
}

function outcomeOf(r: { status: ConfirmResult['status'] }): PayOutcome | 'failed' | 'action' {
  if (r.status === 'SUCCEEDED') return 'paid';
  if (r.status === 'FAILED') return 'failed';
  if (r.status === 'REQUIRES_ACTION') return 'action';
  return 'processing';
}

export function declineText(code: string | null): string {
  switch (code) {
    case 'card_declined':
    case 'insufficient_funds':
    case 'expired_card':
    case 'incorrect_cvc':
      return t(`app.get_paid.decline.${code}`);
    default:
      return t('app.get_paid.decline.other');
  }
}

function Email({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <Field label={t('app.get_paid.buyer_email')} hint={t('app.get_paid.buyer_email_hint')}>
      <Input
        type="email"
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="acceptance-buyer-email"
      />
    </Field>
  );
}

const OUTCOME_UNKNOWN = 'acceptance_outcome_unknown';

/** A Pay tap whose outcome the processor has not given yet: asked again with the same key, token and email. */
interface Tap {
  key: string;
  token: string;
  email: string | null;
}

function PayForm({ payment, onDone }: { payment: CardPayment; onDone(outcome: PayOutcome): void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<Tap | null>(null);
  const tapping = useRef(false);

  const finish = async (tap: Tap) => {
    try {
      const r = await payment.confirm(tap.token, tap.email, tap.key);
      setUnknown(null);
      const o = outcomeOf(r);
      if (o === 'failed') setError(declineText(r.failureCode));
      else if (o === 'action') {
        const next =
          stripe && r.clientSecret ? await stripe.handleNextAction({ clientSecret: r.clientSecret }) : null;
        if (!next || next.error) {
          setError(next?.error?.message ?? t('app.get_paid.decline.authentication'));
          return;
        }
        if (payment.settle) {
          const after = await payment.settle(r.paymentId);
          const a = outcomeOf(after);
          if (a === 'failed') setError(declineText(after.failureCode));
          else onDone(a === 'paid' ? 'paid' : 'processing');
        } else onDone(next.paymentIntent?.status === 'succeeded' ? 'paid' : 'processing');
      } else onDone(o);
    } catch (e) {
      if (e instanceof ApiError && e.code === OUTCOME_UNKNOWN) {
        setUnknown(tap);
        return;
      }
      setUnknown(null);
      const words = payment.describeError ? payment.describeError(e) : errorText(e);
      if (words !== null) setError(words);
    }
  };

  const run = async (make: () => Promise<Tap | null>) => {
    if (tapping.current) return;
    tapping.current = true;
    setBusy(true);
    setError(null);
    try {
      const tap = await make();
      if (tap) await finish(tap);
    } finally {
      tapping.current = false;
      setBusy(false);
    }
  };

  const pay = () =>
    run(async () => {
      if (!stripe || !elements) return null;
      const submitted = await elements.submit();
      if (submitted.error) {
        setError(submitted.error.message ?? t('app.get_paid.decline.other'));
        return null;
      }
      const made = await stripe.createConfirmationToken({ elements });
      if (made.error || !made.confirmationToken) {
        setError(made.error?.message ?? t('app.get_paid.decline.other'));
        return null;
      }
      // One key per tap; a retry of this tap (outcome unknown) reuses it with the same token.
      return { key: crypto.randomUUID(), token: made.confirmationToken.id, email: email.trim() || null };
    });

  return (
    <div className="fw-form" data-testid="stripe-checkout" data-block>
      <PaymentElement options={{ layout: 'tabs' }} />
      <Email value={email} onChange={setEmail} />
      {error && (
        <Notice status="failure">
          <span data-testid="acceptance-pay-error">{error}</span>
        </Notice>
      )}
      {unknown ? (
        <Notice
          status="info"
          action={
            <Button
              onClick={() => void run(async () => unknown)}
              disabled={busy}
              data-testid="acceptance-check-again"
            >
              {t('app.get_paid.check_again')}
            </Button>
          }
        >
          <span data-testid="acceptance-outcome-unknown">{t('app.get_paid.outcome_unknown')}</span>
        </Notice>
      ) : (
        <Button
          onClick={() => void pay()}
          disabled={!stripe || !elements || busy}
          data-testid="acceptance-pay"
        >
          {busy ? t('app.get_paid.paying') : t('app.get_paid.pay')}
        </Button>
      )}
    </div>
  );
}

/** The demo's stand-in for the card form: the same Pay and outcome, with a sample token. */
function DemoPay({ payment, onDone }: { payment: CardPayment; onDone(outcome: PayOutcome): void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fw-form" data-testid="stripe-checkout-demo">
      <Notice status="info">{t('app.get_paid.demo_card')}</Notice>
      <Email value={email} onChange={setEmail} />
      {error && <Notice status="failure">{error}</Notice>}
      <Button
        data-testid="acceptance-pay"
        onClick={() =>
          void payment.confirm('ctoken_demo', email.trim() || null, crypto.randomUUID()).then(
            (r) => {
              const o = outcomeOf(r);
              if (o === 'failed') setError(declineText(r.failureCode));
              else onDone(o === 'paid' ? 'paid' : 'processing');
            },
            (e: unknown) => {
              const words = payment.describeError ? payment.describeError(e) : errorText(e);
              if (words !== null) setError(words);
            },
          )
        }
      >
        {t('app.get_paid.pay')}
      </Button>
    </div>
  );
}

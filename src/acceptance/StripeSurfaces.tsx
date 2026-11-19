import { useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { errorText } from '../api/errors';
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
  const { theme } = useTheme();
  const locale = useContent();
  const c = config.client;
  const stripe = useMemo(
    () => (c.publishableKey ? stripeFor(c.publishableKey, c.connectedAccountId) : null),
    [c.publishableKey, c.connectedAccountId],
  );
  const options = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: Number(c.amountMinor),
      currency: c.currency,
      paymentMethodCreation: 'manual' as const,
      appearance: stripeAppearance(theme),
      locale: locale === 'ar' ? ('ar' as const) : ('en' as const),
    }),
    [c.amountMinor, c.currency, theme, locale],
  );
  if (!stripe)
    // Demo mode without a review key: the card form is Stripe's own and is not shown here.
    return <DemoPay api={api} checkoutId={config.checkoutId} onDone={onDone} />;
  return (
    <Elements stripe={stripe} options={options}>
      <PayForm api={api} checkoutId={config.checkoutId} onDone={onDone} />
    </Elements>
  );
}

function outcomeOf(r: ConfirmResult): PayOutcome | 'failed' | 'action' {
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

function PayForm({
  api,
  checkoutId,
  onDone,
}: {
  api: AcceptanceApi;
  checkoutId: string;
  onDone(outcome: PayOutcome): void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tapping = useRef(false);

  const pay = async () => {
    if (!stripe || !elements || tapping.current) return;
    tapping.current = true;
    setBusy(true);
    setError(null);
    try {
      const submitted = await elements.submit();
      if (submitted.error) {
        setError(submitted.error.message ?? t('app.get_paid.decline.other'));
        return;
      }
      const made = await stripe.createConfirmationToken({ elements });
      if (made.error || !made.confirmationToken) {
        setError(made.error?.message ?? t('app.get_paid.decline.other'));
        return;
      }
      const r = await api.confirm(checkoutId, made.confirmationToken.id, email.trim() || null);
      const o = outcomeOf(r);
      if (o === 'failed') setError(declineText(r.failureCode));
      else if (o === 'action') {
        const next = r.clientSecret ? await stripe.handleNextAction({ clientSecret: r.clientSecret }) : null;
        if (!next || next.error) setError(next?.error?.message ?? t('app.get_paid.decline.authentication'));
        else onDone(next.paymentIntent?.status === 'succeeded' ? 'paid' : 'processing');
      } else onDone(o);
    } catch (e) {
      setError(errorText(e));
    } finally {
      tapping.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fw-form" data-testid="stripe-checkout" data-block>
      <PaymentElement options={{ layout: 'tabs' }} />
      <Email value={email} onChange={setEmail} />
      {error && (
        <Notice status="failure">
          <span data-testid="acceptance-pay-error">{error}</span>
        </Notice>
      )}
      <Button onClick={() => void pay()} disabled={!stripe || !elements || busy} data-testid="acceptance-pay">
        {busy ? t('app.get_paid.paying') : t('app.get_paid.pay')}
      </Button>
    </div>
  );
}

/** The demo's stand-in for the card form: the same Pay and outcome, with a sample token. */
function DemoPay({
  api,
  checkoutId,
  onDone,
}: {
  api: AcceptanceApi;
  checkoutId: string;
  onDone(outcome: PayOutcome): void;
}) {
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
          void api.confirm(checkoutId, 'ctoken_demo', email.trim() || null).then(
            (r) => {
              const o = outcomeOf(r);
              if (o === 'failed') setError(declineText(r.failureCode));
              else onDone(o === 'paid' ? 'paid' : 'processing');
            },
            (e: unknown) => setError(errorText(e)),
          )
        }
      >
        {t('app.get_paid.pay')}
      </Button>
    </div>
  );
}

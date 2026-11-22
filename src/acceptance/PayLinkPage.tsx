import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/errors';
import { Button, Card, Logo, Notice, Skeleton } from '../design-system';
import { has, LanguageSwitch, t, useChannels, useContent } from '../i18n';
import { formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { usePageHead } from '../public/seo';
import { publicPay, type PublicPayLink, type PublicPayState } from './publicPay';
import type { CardPayment, PayOutcome } from './StripeSurfaces';
import './paylink.css';

// Stripe.js and the Payment Element load only when the link is open and the form is about to show.
const StripeCardForm = lazy(() => import('./StripeSurfaces').then((m) => ({ default: m.StripeCardForm })));

/** Refusals that mean the link itself moved on: the page shows that state instead of an error. */
const LINK_ENDED: Record<string, PublicPayState> = {
  pay_link_expired: 'EXPIRED',
  pay_link_revoked: 'REVOKED',
  pay_link_used: 'PAID',
  pay_link_unavailable: 'UNAVAILABLE',
};

/** The words for a public refusal (`app.get_paid.pay_page.error.<code>`), else the general one. */
export function payErrorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return t('app.get_paid.pay_page.error.network');
    const k = `app.get_paid.pay_page.error.${e.code ?? ''}`;
    if (e.code && has(k)) return t(k);
  }
  return t('app.get_paid.pay_page.error.other');
}

type View = { kind: 'link'; state: PublicPayState } | { kind: 'done'; outcome: PayOutcome };

/**
 * OG-058 the buyer's page for a pay link (`/pay/:token`), without sign-in: the merchant's name, what it is for, the
 * amount and the card form, or the link's state when it can no longer take a payment. Nothing about the founder, the
 * company or the token is kept or sent anywhere but ongem-core.
 */
export function PayLinkPage() {
  useChannels('web_public', 'web_app');
  useContent();
  const { token = '' } = useParams();
  const link = useAsync(() => publicPay.read(token), [token]);
  const [view, setView] = useState<View | null>(null);
  useEffect(() => setView(null), [token]);
  const data = link.status === 'success' ? link.data : null;
  usePageHead(
    '/pay',
    {
      title: data
        ? t('app.get_paid.pay_page.page_title', { merchant: data.merchantDisplayName })
        : t('app.get_paid.pay_page.page_title_plain'),
      description: t('app.get_paid.pay_page.page_description'),
    },
    [],
    { noindex: true },
  );
  return (
    <div className="pay-page" data-testid="pay-link-page">
      <header className="pay-page__top">
        <Logo />
        <LanguageSwitch className="pay-page__lang" />
      </header>
      <main className="pay-page__main" id="main">
        {link.status === 'loading' ? (
          <Card>
            <Skeleton label={t('app.get_paid.pay_page.loading')} />
          </Card>
        ) : link.status === 'error' ? (
          <ReadError error={link.error} retry={link.reload} />
        ) : (
          <Body
            link={link.data}
            token={token}
            view={view ?? { kind: 'link', state: link.data.state }}
            setView={setView}
          />
        )}
      </main>
      <footer className="pay-page__foot">
        <p>{t('app.get_paid.pay_page.footer')}</p>
      </footer>
    </div>
  );
}

function ReadError({ error, retry }: { error: unknown; retry(): void }) {
  if (error instanceof ApiError && error.status === 404)
    return (
      <Ended
        testId="pay-state-not_found"
        title={t('app.get_paid.pay_page.not_found_title')}
        text={t('app.get_paid.pay_page.not_found_text')}
      />
    );
  return (
    <Card>
      <Notice status="failure" action={<Button onClick={retry}>{t('app.get_paid.pay_page.retry')}</Button>}>
        <span data-testid="pay-read-error">{payErrorText(error)}</span>
      </Notice>
    </Card>
  );
}

function Ended({ testId, title, text }: { testId: string; title: string; text: string }) {
  return (
    <Card>
      <div className="pay-page__ended" data-testid={testId} role="status">
        <h1 className="pay-page__title">{title}</h1>
        <p>{text}</p>
      </div>
    </Card>
  );
}

function Summary({ link }: { link: PublicPayLink }) {
  return (
    <div className="pay-page__summary">
      <p className="pay-page__merchant" data-testid="pay-merchant">
        {link.merchantDisplayName}
      </p>
      <h1 className="pay-page__title" data-testid="pay-title">
        {link.title}
      </h1>
      <p className="pay-page__amount fw-num" data-testid="pay-amount">
        {formatMinor(link.amount)}
      </p>
    </div>
  );
}

function Body({
  link,
  token,
  view,
  setView,
}: {
  link: PublicPayLink;
  token: string;
  view: View;
  setView(v: View): void;
}) {
  const payment = useMemo<CardPayment>(
    () => ({
      confirm: async (confirmationToken, email, key) => {
        const r = await publicPay.confirm(token, confirmationToken, email, key);
        return r;
      },
      settle: (paymentId) => publicPay.payment(token, paymentId),
      describeError: (e) => {
        const ended = e instanceof ApiError && e.code ? LINK_ENDED[e.code] : undefined;
        if (ended) {
          setView({ kind: 'link', state: ended });
          return null;
        }
        return payErrorText(e);
      },
    }),
    [token, setView],
  );
  if (view.kind === 'done')
    return (
      <Card>
        <div className="pay-page__ended" data-testid={`pay-done-${view.outcome}`} role="status">
          <p className="pay-page__merchant">{link.merchantDisplayName}</p>
          <h1 className="pay-page__title">
            {view.outcome === 'paid'
              ? t('app.get_paid.pay_page.paid_title')
              : t('app.get_paid.pay_page.processing_title')}
          </h1>
          <p className="pay-page__amount fw-num">{formatMinor(link.amount)}</p>
          <p>
            {view.outcome === 'paid'
              ? t('app.get_paid.pay_page.paid_text')
              : t('app.get_paid.pay_page.processing_text')}
          </p>
        </div>
      </Card>
    );
  switch (view.state) {
    case 'PAID':
      return (
        <Ended
          testId="pay-state-paid"
          title={t('app.get_paid.pay_page.state.paid_title')}
          text={t('app.get_paid.pay_page.state.paid_text')}
        />
      );
    case 'EXPIRED':
      return (
        <Ended
          testId="pay-state-expired"
          title={t('app.get_paid.pay_page.state.expired_title')}
          text={t('app.get_paid.pay_page.state.expired_text', { merchant: link.merchantDisplayName })}
        />
      );
    case 'REVOKED':
      return (
        <Ended
          testId="pay-state-revoked"
          title={t('app.get_paid.pay_page.state.revoked_title')}
          text={t('app.get_paid.pay_page.state.revoked_text', { merchant: link.merchantDisplayName })}
        />
      );
    case 'UNAVAILABLE':
      return (
        <Ended
          testId="pay-state-unavailable"
          title={t('app.get_paid.pay_page.state.unavailable_title')}
          text={t('app.get_paid.pay_page.state.unavailable_text', { merchant: link.merchantDisplayName })}
        />
      );
    default:
      break;
  }
  return (
    <Card>
      <div className="pay-page__open" data-testid="pay-state-open">
        <Summary link={link} />
        {link.environment === 'sandbox' && (
          <Notice status="info">{t('app.get_paid.pay_page.sandbox')}</Notice>
        )}
        <p className="fw-hint">
          {t('app.get_paid.pay_page.expires', { date: formatDate(link.expiresAt, { time: true }) })}
        </p>
        {link.client ? (
          <Suspense fallback={<Skeleton label={t('app.get_paid.pay_page.loading')} />}>
            <StripeCardForm
              client={link.client}
              payment={payment}
              onDone={(outcome) => setView({ kind: 'done', outcome })}
            />
          </Suspense>
        ) : (
          <Notice status="failure">{t('app.get_paid.pay_page.error.other')}</Notice>
        )}
      </div>
    </Card>
  );
}

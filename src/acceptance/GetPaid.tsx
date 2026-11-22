import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  Skeleton,
  StatusChip,
  Table,
  Tabs,
} from '../design-system';
import { has, t } from '../i18n';
import { formatBankDate, formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { human, stateStatus } from '../screens/common';
import { useSession } from '../session';
import {
  AcceptanceApi,
  type AcceptancePayment,
  type ClientConfig,
  type GetPaid,
  type GetPaidState,
  type MerchantSummary,
  minorOf,
  type PayoutResult,
} from './api';
import { PayLinks } from './PayLinks';
import type { PayOutcome } from './StripeSurfaces';

/** Whop's elements (OG-039) for a company Whop serves; Stripe's Payment Element (OG-055) for one Stripe serves. */
const Surfaces = {
  Provider: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.WhopProvider }))),
  Verify: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.VerifySurface }))),
  Checkout: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.CheckoutSurface }))),
  Activity: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.ActivitySurface }))),
  Withdraw: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.WithdrawSurface }))),
  Stripe: lazy(() => import('./StripeSurfaces').then((m) => ({ default: m.StripeCheckout }))),
};

type Tab = 'overview' | 'request' | 'links' | 'activity' | 'withdraw';

function verificationStatus(s: string | null): 'success' | 'pending' | 'failure' | 'neutral' {
  if (s === 'APPROVED') return 'success';
  if (s === 'REJECTED') return 'failure';
  if (s == null || s === 'NOT_STARTED') return 'neutral';
  return 'pending';
}

function stateText(s: string | null) {
  return t(`app.get_paid.state.${(s ?? 'NOT_STARTED').toLowerCase()}`);
}

const HEADLINE_STATUS: Record<GetPaidState, 'success' | 'pending' | 'failure' | 'neutral' | 'info'> = {
  OFF: 'neutral',
  NOT_OPENED: 'neutral',
  ACTION_REQUIRED: 'pending',
  IN_REVIEW: 'info',
  REJECTED: 'failure',
  RESTRICTED: 'failure',
  ACTIVE: 'success',
};

/** A payment's or payout's state in the reader's language. */
export function moneyState(kind: 'payment' | 'payout', status: string) {
  const k = `app.get_paid.${kind}_state.${status.toLowerCase()}`;
  return has(k) ? t(k) : human(status);
}

export { minorOf } from './api';

function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title={t('app.get_paid.title')} subtitle={t('app.get_paid.subtitle')} />
      {children}
    </>
  );
}

/**
 * Get paid (OG-039, OG-055): card payments through the provider ongem-core names for the company (Stripe or Whop). One
 * read of GET /v1/acceptance/get-paid gives the headline state, verification, the live balance, the payout destination
 * and recent payments and payouts. The provider's hosted page finishes onboarding or remediation; the founder takes a
 * card with the provider's own form; payouts go to the company's OnGem account with step-up.
 */
export function GetPaidScreen() {
  const { api, can } = useSession();
  const acceptance = useMemo(() => new AcceptanceApi(api), [api]);
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN((x) => x + 1), []);
  const read = useAsync(() => acceptance.getPaid(), [acceptance, n]);
  // A reload after a change keeps the screen (and its open tab) until the new read is in.
  const [last, setLast] = useState<GetPaid | null>(null);
  useEffect(() => {
    if (read.status === 'success') setLast(read.data);
  }, [read]);
  const gp = read.status === 'success' ? read.data : last;
  // Whop's elements mount with the processor's account id, which only GET /v1/acceptance carries.
  const whop = useAsync(
    () => (gp?.provider === 'whop' ? acceptance.status() : Promise.resolve(null)),
    [acceptance, gp?.provider, n],
  );
  const [tab, setTab] = useState<Tab>('overview');

  if (read.status === 'loading' && !gp)
    return (
      <Frame>
        <Skeleton label={t('app.get_paid.loading')} />
      </Frame>
    );
  if (read.status === 'error' && !gp)
    return (
      <Frame>
        <Notice status="failure" action={<Button onClick={reload}>{t('app.get_paid.retry')}</Button>}>
          {errorText(read.error)}
        </Notice>
      </Frame>
    );
  if (!gp || !gp.enabled || gp.state === 'OFF' || !gp.environment)
    return (
      <Frame>
        <Notice status="info">
          <span data-testid="acceptance-off">{t('app.get_paid.unavailable')}</span>
        </Notice>
      </Frame>
    );
  const merchant = whop.status === 'success' ? (whop.data?.merchant ?? null) : null;
  const active = gp.state === 'ACTIVE';

  const overview = (
    <Overview
      gp={gp}
      api={acceptance}
      merchant={merchant}
      onChanged={reload}
      owner={can(Permission.ONBOARDING_MANAGE)}
    />
  );
  if (gp.state === 'NOT_OPENED' || !gp.merchant)
    return (
      <Frame>
        <div data-testid="get-paid">{overview}</div>
      </Frame>
    );
  const items = [
    { id: 'overview', label: t('app.get_paid.tab.overview'), content: overview },
    ...(can(Permission.PAYMENT_CREATE) && active
      ? [
          {
            id: 'request',
            label: t('app.get_paid.tab.request'),
            content: <RequestPayment api={acceptance} onPaid={reload} />,
          },
        ]
      : []),
    // OG-058: pay links need a card form a public page can mount, which Whop does not offer (contract 5).
    ...(can(Permission.PAYMENT_VIEW) && active && gp.provider !== 'whop'
      ? [
          {
            id: 'links',
            label: t('app.get_paid.tab.links'),
            content: <PayLinks api={acceptance} canCreate={can(Permission.PAYMENT_CREATE)} />,
          },
        ]
      : []),
    ...(can(Permission.PAYMENT_VIEW)
      ? [
          {
            id: 'activity',
            label: t('app.get_paid.tab.activity'),
            content:
              gp.provider === 'whop' ? (
                merchant && <Surfaces.Activity api={acceptance} accountId={merchant.elementAccountId} />
              ) : (
                <Activity api={acceptance} />
              ),
          },
        ]
      : []),
    ...(can(Permission.PAYMENT_CREATE) && active
      ? [
          {
            id: 'withdraw',
            label: t('app.get_paid.tab.withdraw'),
            content:
              gp.provider === 'whop' ? (
                merchant && (
                  <Surfaces.Withdraw
                    api={acceptance}
                    accountId={merchant.elementAccountId}
                    onPaidOut={reload}
                  />
                )
              ) : (
                <Withdraw gp={gp} api={acceptance} onPaidOut={reload} />
              ),
          },
        ]
      : []),
  ];
  const tabs = (
    <Tabs items={items} value={tab} onChange={(id) => setTab(id as Tab)} label={t('app.get_paid.title')} />
  );
  return (
    <Frame>
      <div data-testid="get-paid" data-provider={gp.provider ?? ''}>
        <Suspense fallback={<Skeleton label={t('app.get_paid.loading')} />}>
          {gp.provider === 'whop' ? (
            <Surfaces.Provider environment={gp.environment}>{tabs}</Surfaces.Provider>
          ) : (
            tabs
          )}
        </Suspense>
      </div>
    </Frame>
  );
}

/** The headline, verification, balance, payout destination and the latest payments and payouts. */
function Overview({
  gp,
  api,
  merchant,
  owner,
  onChanged,
}: {
  gp: GetPaid;
  api: AcceptanceApi;
  merchant: MerchantSummary | null;
  owner: boolean;
  onChanged(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kyc, setKyc] = useState<'individual' | 'business' | null>(null);
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  // The link is single-use and short-lived: made on the tap, opened at once, never kept. The provider sends the founder
  // back to /get-paid, which reads the state again.
  const continueOnboarding = async () => {
    setBusy(true);
    setError(null);
    try {
      const link = await api.onboardingLink();
      if (link.url && /^https:\/\//.test(link.url)) window.location.assign(link.url);
      else onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const startKyc = async (kind: 'individual' | 'business') => {
    setError(null);
    try {
      await api.verify(kind === 'business' ? 'BUSINESS' : 'INDIVIDUAL');
      setKyc(kind);
    } catch (e) {
      setError(errorText(e));
    }
  };
  const state = gp.state;
  const m = gp.merchant;
  const action = (() => {
    if (state === 'NOT_OPENED')
      return owner ? (
        <Button onClick={() => void run(api.open)} disabled={busy} data-testid="acceptance-open">
          {t('app.get_paid.start')}
        </Button>
      ) : (
        <p className="fw-row__sub">{t('app.get_paid.owner_only')}</p>
      );
    if (state === 'ACTION_REQUIRED')
      return owner ? (
        gp.provider === 'whop' && merchant ? (
          <div className="fw-actions">
            {m?.individual !== 'APPROVED' && (
              <Button onClick={() => void startKyc('individual')}>{t('app.get_paid.verify_identity')}</Button>
            )}
            {m?.business !== 'APPROVED' && (
              <Button variant="secondary" onClick={() => void startKyc('business')}>
                {t('app.get_paid.verify_business')}
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={() => void continueOnboarding()}
            disabled={busy}
            data-testid="acceptance-onboarding"
          >
            {t('app.get_paid.continue_onboarding')}
          </Button>
        )
      ) : (
        <p className="fw-row__sub">{t('app.get_paid.owner_only')}</p>
      );
    if (state === 'REJECTED' || state === 'RESTRICTED')
      return (
        <Link className="og-btn og-btn--secondary og-btn--md" to="/support/new">
          {t('app.get_paid.contact_support')}
        </Link>
      );
    return null;
  })();
  return (
    <div className="fw-stack">
      {gp.environment === 'sandbox' && <Notice status="info">{t('app.get_paid.sandbox')}</Notice>}
      <Card title={t(`app.get_paid.headline.${state.toLowerCase()}`)}>
        <div className="fw-thread" data-testid={`acceptance-state-${state.toLowerCase()}`}>
          <p>
            <StatusChip status={HEADLINE_STATUS[state]}>
              {t(`app.get_paid.state_word.${state.toLowerCase()}`)}
            </StatusChip>
          </p>
          <p>{t(`app.get_paid.headline_text.${state.toLowerCase()}`)}</p>
          {action}
          {error && <Notice status="failure">{error}</Notice>}
        </div>
      </Card>
      {m && (
        <Card title={t('app.get_paid.verification')}>
          <dl className="fw-kv">
            <dt>{t('app.get_paid.identity')}</dt>
            <dd>
              <StatusChip status={verificationStatus(m.individual)}>{stateText(m.individual)}</StatusChip>
            </dd>
            <dt>{t('app.get_paid.business')}</dt>
            <dd>
              <StatusChip status={verificationStatus(m.business)}>{stateText(m.business)}</StatusChip>
            </dd>
          </dl>
          {kyc && merchant && (
            <Suspense fallback={<Skeleton label={t('app.get_paid.loading')} />}>
              <Surfaces.Verify
                api={api}
                accountId={merchant.elementAccountId}
                kind={kyc}
                onDone={() => {
                  setKyc(null);
                  onChanged();
                }}
              />
            </Suspense>
          )}
        </Card>
      )}
      {m && (
        <Card title={t('app.get_paid.balance')}>
          {gp.balanceUnavailable ? (
            <Notice status="info">
              <span data-testid="acceptance-balance-unavailable">
                {t('app.get_paid.balance_unavailable')}
              </span>
            </Notice>
          ) : gp.balances.length === 0 ? (
            <p>{t('app.get_paid.balance_empty')}</p>
          ) : (
            gp.balances.map((b) => (
              <dl key={b.available.currency} className="fw-kv" data-mask data-testid="acceptance-balance">
                <dt>{t('app.get_paid.available')}</dt>
                <dd className="fw-num">{formatMinor(b.available)}</dd>
                <dt>{t('app.get_paid.pending')}</dt>
                <dd className="fw-num">{formatMinor(b.pending)}</dd>
                <dt>{t('app.get_paid.reserve')}</dt>
                <dd className="fw-num">{formatMinor(b.reserve)}</dd>
              </dl>
            ))
          )}
          <p className="fw-hint">
            {gp.balancesAsOf
              ? t('app.get_paid.balance_as_of', { time: formatDate(gp.balancesAsOf, { time: true }) })
              : t('app.get_paid.balance_note')}
          </p>
        </Card>
      )}
      {m && gp.provider !== 'whop' && (
        <Card title={t('app.get_paid.payout_destination')}>
          {gp.payoutDestination ? (
            <p data-testid="acceptance-destination" data-mask>
              {gp.payoutDestination.name
                ? t('app.get_paid.destination_line', {
                    name: gp.payoutDestination.name,
                    last4: gp.payoutDestination.last4 ?? '',
                  })
                : t('app.get_paid.destination_line_unnamed', { last4: gp.payoutDestination.last4 ?? '' })}
            </p>
          ) : owner ? (
            <div className="fw-thread">
              <p>{t('app.get_paid.destination_none')}</p>
              <Button
                onClick={() => void run(api.linkPayoutDestination)}
                disabled={busy}
                data-testid="acceptance-link-destination"
              >
                {t('app.get_paid.destination_link')}
              </Button>
            </div>
          ) : (
            <p>{t('app.get_paid.destination_none_member')}</p>
          )}
        </Card>
      )}
      {m && gp.provider !== 'whop' && (
        <Card title={t('app.get_paid.recent')}>
          <PaymentsTable rows={gp.recentPayments} />
          <PayoutsTable rows={gp.recentPayouts} />
        </Card>
      )}
    </div>
  );
}

function PaymentsTable({ rows }: { rows: AcceptancePayment[] }) {
  return (
    <Table
      caption={t('app.get_paid.payments')}
      rows={rows}
      rowKey={(r) => r.id}
      stack
      empty={
        <EmptyState title={t('app.get_paid.payments_empty')}>
          {t('app.get_paid.payments_empty_text')}
        </EmptyState>
      }
      columns={[
        {
          key: 'when',
          header: t('app.get_paid.col.date'),
          render: (r) => formatDate(r.paidAt ?? r.updatedAt, { time: true }),
        },
        {
          key: 'state',
          header: t('app.get_paid.col.state'),
          render: (r) => (
            <span>
              <StatusChip status={stateStatus(r.status === 'SUCCEEDED' ? 'SETTLED' : r.status)}>
                {moneyState('payment', r.status)}
              </StatusChip>
              {r.failureCode && <span className="fw-row__sub"> {declineWord(r.failureCode)}</span>}
            </span>
          ),
        },
        {
          key: 'amount',
          header: t('app.get_paid.col.amount'),
          align: 'end',
          render: (r) => <span data-mask>{formatMinor(r.amount)}</span>,
        },
      ]}
    />
  );
}

function PayoutsTable({ rows }: { rows: PayoutResult[] }) {
  return (
    <Table
      caption={t('app.get_paid.payouts')}
      rows={rows}
      rowKey={(r) => r.id}
      stack
      empty={
        <EmptyState title={t('app.get_paid.payouts_empty')}>
          {t('app.get_paid.payouts_empty_text')}
        </EmptyState>
      }
      columns={[
        {
          key: 'when',
          header: t('app.get_paid.col.date'),
          render: (r) => (r.createdAt ? formatDate(r.createdAt, { time: true }) : ''),
        },
        {
          key: 'state',
          header: t('app.get_paid.col.state'),
          render: (r) => (
            <span>
              <StatusChip status={stateStatus(r.status === 'COMPLETED' ? 'SETTLED' : r.status)}>
                {moneyState('payout', r.status)}
              </StatusChip>
              {r.arrivalDate &&
                !['COMPLETED', 'FAILED', 'REVERSED', 'CANCELLED', 'DENIED', 'REJECTED'].includes(
                  r.status,
                ) && (
                  <span className="fw-row__sub">
                    {' '}
                    {t('app.get_paid.arrives', { date: formatBankDate(r.arrivalDate) })}
                  </span>
                )}
            </span>
          ),
        },
        {
          key: 'amount',
          header: t('app.get_paid.col.amount'),
          align: 'end',
          render: (r) => <span data-mask>{formatMinor(r.amount)}</span>,
        },
      ]}
    />
  );
}

function declineWord(code: string) {
  return ['card_declined', 'insufficient_funds', 'expired_card', 'incorrect_cvc'].includes(code)
    ? t(`app.get_paid.decline.${code}`)
    : t('app.get_paid.decline.other');
}

/** Every payment and payout OnGem holds for the company (Stripe; Whop's own activity element for Whop). */
function Activity({ api }: { api: AcceptanceApi }) {
  const data = useAsync(() => Promise.all([api.payments(), api.payouts()]), [api]);
  if (data.status === 'loading') return <Skeleton label={t('app.get_paid.loading')} />;
  if (data.status === 'error')
    return (
      <Notice status="failure" action={<Button onClick={data.reload}>{t('app.get_paid.retry')}</Button>}>
        {errorText(data.error)}
      </Notice>
    );
  const [payments, payouts] = data.data;
  return (
    <div className="fw-stack" data-testid="acceptance-activity">
      <Card title={t('app.get_paid.payments')}>
        <PaymentsTable rows={payments} />
      </Card>
      <Card title={t('app.get_paid.payouts')}>
        <PayoutsTable rows={payouts} />
      </Card>
    </div>
  );
}

/** A payout of the available balance to the company's OnGem account; the core asks for step-up. */
function Withdraw({ gp, api, onPaidOut }: { gp: GetPaid; api: AcceptanceApi; onPaidOut(): void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PayoutResult | null>(null);
  const [busy, setBusy] = useState(false);
  const dest = gp.payoutDestination;
  const available = gp.balances[0]?.available;
  const minor = minorOf(amount);
  if (!dest)
    return (
      <Notice status="info">
        <span data-testid="acceptance-withdraw-no-destination">
          {t('app.get_paid.withdraw_needs_destination')}
        </span>
      </Notice>
    );
  const over = available ? minor > available.amountMinor : false;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await api.payout(minor, dest.id, 'STANDARD'));
      setAmount('');
      onPaidOut();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={t('app.get_paid.withdraw_title')}>
      <div className="fw-thread" data-testid="acceptance-withdraw-form">
        {available && (
          <p data-mask>{t('app.get_paid.withdraw_available', { amount: formatMinor(available) })}</p>
        )}
        <p data-mask>
          {dest.name
            ? t('app.get_paid.withdraw_to', { name: dest.name, last4: dest.last4 ?? '' })
            : t('app.get_paid.withdraw_to_unnamed', { last4: dest.last4 ?? '' })}
        </p>
        <Field
          label={t('app.get_paid.amount')}
          hint={t('app.get_paid.amount_hint')}
          error={over ? t('app.get_paid.withdraw_over') : undefined}
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="acceptance-withdraw-amount"
          />
        </Field>
        {error && <Notice status="failure">{error}</Notice>}
        {done && (
          <Notice status="success">
            <span data-testid="acceptance-withdraw-done">
              {t('app.get_paid.withdraw_done', { amount: formatMinor(done.amount) })}
            </span>
          </Notice>
        )}
        <div className="fw-actions">
          <Button
            onClick={() => void send()}
            disabled={busy || minor <= 0 || over}
            data-testid="acceptance-withdraw"
          >
            {t('app.get_paid.withdraw')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** The card form of a checkout, as the provider names it: Stripe's Payment Element or Whop's checkout element. */
function TakePayment({
  api,
  config,
  onPaid,
}: {
  api: AcceptanceApi;
  config: ClientConfig;
  onPaid(outcome: PayOutcome): void;
}) {
  if (config.provider === 'stripe')
    return (
      <Suspense fallback={<Skeleton label={t('app.get_paid.loading')} />}>
        <Surfaces.Stripe api={api} config={config} onDone={onPaid} />
      </Suspense>
    );
  return (
    <Suspense fallback={<Skeleton label={t('app.get_paid.loading')} />}>
      {config.client.purchaseUrl && (
        <p>
          {t('app.get_paid.share_link')}{' '}
          <a href={config.client.purchaseUrl} target="_blank" rel="noreferrer noopener">
            {config.client.purchaseUrl}
          </a>
        </p>
      )}
      <Surfaces.Provider environment={config.environment}>
        <Surfaces.Checkout checkoutId={config.checkoutId} onPaid={() => onPaid('paid')} />
      </Surfaces.Provider>
    </Suspense>
  );
}

function Outcome({ outcome }: { outcome: PayOutcome }) {
  return (
    <Notice status={outcome === 'paid' ? 'success' : 'info'}>
      <span data-testid={`acceptance-outcome-${outcome}`}>
        {outcome === 'paid' ? t('app.get_paid.paid') : t('app.get_paid.processing')}
      </span>
    </Notice>
  );
}

/** Create a payment request, then take the card here or open the checkout for the customer. */
function RequestPayment({ api, onPaid }: { api: AcceptanceApi; onPaid(): void }) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PayOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const minor = minorOf(amount);

  const create = async () => {
    setError(null);
    setOutcome(null);
    setBusy(true);
    try {
      const checkout = await api.createCheckout(minor, title.trim());
      setConfig(await api.clientConfig(checkout.id));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fw-stack">
      <Card title={t('app.get_paid.request_title')}>
        <Field label={t('app.get_paid.amount')} hint={t('app.get_paid.amount_hint')}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="acceptance-amount"
          />
        </Field>
        <Field label={t('app.get_paid.description')}>
          <Input
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="acceptance-title"
          />
        </Field>
        {error && <Notice status="failure">{error}</Notice>}
        <Button
          onClick={() => void create()}
          disabled={busy || minor <= 0 || !title.trim()}
          data-testid="acceptance-create"
        >
          {t('app.get_paid.create')}
        </Button>
      </Card>
      {config && (
        <Card title={t('app.get_paid.take_payment', { amount: formatMinor(config.amount) })}>
          <div className="fw-thread" data-testid="acceptance-take">
            {outcome ? (
              <Outcome outcome={outcome} />
            ) : (
              <>
                <TakePayment
                  api={api}
                  config={config}
                  onPaid={(o) => {
                    setOutcome(o);
                    onPaid();
                  }}
                />
                {config.provider === 'stripe' && (
                  <Button
                    variant="ghost"
                    data-testid="acceptance-open-checkout"
                    onClick={() => navigate(`/get-paid/checkout/${encodeURIComponent(config.checkoutId)}`)}
                  >
                    {t('app.get_paid.open_checkout')}
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * OG-055 the buyer's checkout: the founder hands over the screen and the customer sees only the company, what they pay
 * for, the amount and the card form. The checkout's own configuration is read again, so the page can be reopened.
 */
export function GetPaidCheckoutScreen() {
  const { api, companyId, companies, currentCompanyId } = useSession();
  const { checkoutId = '' } = useParams();
  const acceptance = useMemo(() => new AcceptanceApi(api), [api]);
  const config = useAsync(() => acceptance.clientConfig(checkoutId), [acceptance, checkoutId]);
  const [outcome, setOutcome] = useState<PayOutcome | null>(null);
  const company = companies.find((c) => c.companyId === (companyId ?? currentCompanyId))?.companyName;
  useEffect(() => setOutcome(null), [checkoutId]);
  return (
    <div className="fw-checkout" data-testid="buyer-checkout">
      <Card title={company ?? t('app.get_paid.checkout_title')}>
        {config.status === 'loading' ? (
          <Skeleton label={t('app.get_paid.loading')} />
        ) : config.status === 'error' ? (
          <Notice
            status="failure"
            action={<Button onClick={config.reload}>{t('app.get_paid.retry')}</Button>}
          >
            {errorText(config.error)}
          </Notice>
        ) : (
          <div className="fw-thread">
            <p>{config.data.title}</p>
            <p className="fw-checkout__amount fw-num" data-mask data-testid="buyer-checkout-amount">
              {formatMinor(config.data.amount)}
            </p>
            {outcome ? (
              <Outcome outcome={outcome} />
            ) : (
              <TakePayment api={acceptance} config={config.data} onPaid={setOutcome} />
            )}
          </div>
        )}
      </Card>
      <p className="fw-row__sub">
        <Link to="/get-paid">{t('app.get_paid.back')}</Link>
      </p>
    </div>
  );
}

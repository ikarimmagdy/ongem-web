import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import { Button, Card, Field, Input, Notice, PageHeader, StatusChip, Tabs } from '../design-system';
import { t } from '../i18n';
import { formatMinor } from '../lib/format';
import { useSession } from '../session';
import { AcceptanceApi, type AcceptanceStatus, type CheckoutSummary } from './api';

const Surfaces = {
  Provider: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.WhopProvider }))),
  Verify: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.VerifySurface }))),
  Checkout: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.CheckoutSurface }))),
  Activity: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.ActivitySurface }))),
  Withdraw: lazy(() => import('./WhopSurfaces').then((m) => ({ default: m.WithdrawSurface }))),
};

type Tab = 'overview' | 'request' | 'activity' | 'withdraw';

function verificationStatus(s: string | null): 'success' | 'pending' | 'failure' | 'neutral' {
  if (s === 'APPROVED') return 'success';
  if (s === 'REJECTED') return 'failure';
  if (s == null || s === 'NOT_STARTED') return 'neutral';
  return 'pending';
}

function stateText(s: string | null) {
  return t(`app.get_paid.state.${(s ?? 'NOT_STARTED').toLowerCase()}`);
}

/**
 * Get paid (OG-039, ADR-0055 proposed): payment acceptance through the processor's embedded elements. Open the
 * merchant account, verify it (prefilled from the company's application), take a payment, see the activity and withdraw
 * to the bank. Shown only in a build with VITE_ACCEPTANCE_ENABLED and when ongem-core says acceptance is on.
 */
export function GetPaidScreen() {
  const { api, can } = useSession();
  const acceptance = useMemo(() => new AcceptanceApi(api), [api]);
  const [status, setStatus] = useState<AcceptanceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [kyc, setKyc] = useState<'individual' | 'business' | null>(null);

  const load = useCallback(() => {
    setError(null);
    acceptance
      .status()
      .then(setStatus)
      .catch((e: unknown) => setError(errorText(e)));
  }, [acceptance]);
  useEffect(load, [load]);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptance.open();
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const startKyc = async (kind: 'individual' | 'business') => {
    setError(null);
    try {
      // The core starts the verification prefilled with what OnGem holds; the element resumes it.
      await acceptance.verify(kind === 'business' ? 'BUSINESS' : 'INDIVIDUAL');
      setKyc(kind);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const header = <PageHeader title={t('app.get_paid.title')} subtitle={t('app.get_paid.subtitle')} />;
  if (error && !status)
    return (
      <>
        {header}
        <Notice status="failure" action={<Button onClick={load}>{t('app.get_paid.retry')}</Button>}>
          {error}
        </Notice>
      </>
    );
  if (!status)
    return (
      <>
        {header}
        <p role="status">{t('app.get_paid.loading')}</p>
      </>
    );
  if (!status.enabled || !status.environment)
    return (
      <>
        {header}
        <Notice status="info">{t('app.get_paid.unavailable')}</Notice>
      </>
    );

  const m = status.merchant;
  const env = status.environment;
  if (!m)
    return (
      <>
        {header}
        <Card title={t('app.get_paid.start_title')}>
          <p>{t('app.get_paid.start_text')}</p>
          {error && <Notice status="failure">{error}</Notice>}
          {can(Permission.ONBOARDING_MANAGE) ? (
            <Button onClick={open} disabled={busy} data-testid="acceptance-open">
              {t('app.get_paid.start')}
            </Button>
          ) : (
            <Notice status="info">{t('app.get_paid.owner_only')}</Notice>
          )}
        </Card>
      </>
    );

  const overview = (
    <div className="fw-stack">
      {env === 'sandbox' && <Notice status="info">{t('app.get_paid.sandbox')}</Notice>}
      <Card title={t('app.get_paid.verification')}>
        <p>
          {t('app.get_paid.identity')}{' '}
          <StatusChip status={verificationStatus(m.individual)}>{stateText(m.individual)}</StatusChip>
        </p>
        <p>
          {t('app.get_paid.business')}{' '}
          <StatusChip status={verificationStatus(m.business)}>{stateText(m.business)}</StatusChip>
        </p>
        {can(Permission.ONBOARDING_MANAGE) && (
          <div className="fw-actions">
            {m.individual !== 'APPROVED' && (
              <Button onClick={() => startKyc('individual')}>{t('app.get_paid.verify_identity')}</Button>
            )}
            {m.business !== 'APPROVED' && (
              <Button variant="secondary" onClick={() => startKyc('business')}>
                {t('app.get_paid.verify_business')}
              </Button>
            )}
          </div>
        )}
        {error && <Notice status="failure">{error}</Notice>}
        {kyc && (
          <Suspense fallback={<p role="status">{t('app.get_paid.loading')}</p>}>
            <Surfaces.Verify
              api={acceptance}
              accountId={m.elementAccountId}
              kind={kyc}
              onDone={() => {
                setKyc(null);
                load();
              }}
            />
          </Suspense>
        )}
      </Card>
      <Card title={t('app.get_paid.balance')}>
        {m.balances.length === 0 ? (
          <p>{t('app.get_paid.balance_empty')}</p>
        ) : (
          m.balances.map((b) => (
            <dl key={b.available.currency} className="fw-kv" data-mask>
              <dt>{t('app.get_paid.available')}</dt>
              <dd>{formatMinor(b.available)}</dd>
              <dt>{t('app.get_paid.pending')}</dt>
              <dd>{formatMinor(b.pending)}</dd>
              <dt>{t('app.get_paid.reserve')}</dt>
              <dd>{formatMinor(b.reserve)}</dd>
            </dl>
          ))
        )}
        <p className="fw-hint">{t('app.get_paid.balance_note')}</p>
      </Card>
    </div>
  );

  const items = [
    { id: 'overview', label: t('app.get_paid.tab.overview'), content: overview },
    ...(can(Permission.PAYMENT_CREATE)
      ? [
          {
            id: 'request',
            label: t('app.get_paid.tab.request'),
            content: <RequestPayment api={acceptance} />,
          },
        ]
      : []),
    ...(can(Permission.PAYMENT_VIEW)
      ? [
          {
            id: 'activity',
            label: t('app.get_paid.tab.activity'),
            content: <Surfaces.Activity api={acceptance} accountId={m.elementAccountId} />,
          },
        ]
      : []),
    ...(can(Permission.PAYMENT_CREATE)
      ? [
          {
            id: 'withdraw',
            label: t('app.get_paid.tab.withdraw'),
            content: <Surfaces.Withdraw api={acceptance} accountId={m.elementAccountId} onPaidOut={load} />,
          },
        ]
      : []),
  ];
  return (
    <>
      {header}
      <Suspense fallback={<p role="status">{t('app.get_paid.loading')}</p>}>
        <Surfaces.Provider environment={env}>
          <Tabs
            items={items}
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            label={t('app.get_paid.title')}
          />
        </Surfaces.Provider>
      </Suspense>
    </>
  );
}

/** Create a payment request and take it here with the checkout element, or share its hosted link. */
function RequestPayment({ api }: { api: AcceptanceApi }) {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const minor = /^\d{1,7}(\.\d{1,2})?$/.test(amount.trim()) ? Math.round(Number(amount.trim()) * 100) : 0;

  const create = async () => {
    setError(null);
    setPaid(false);
    try {
      setCheckout(await api.createCheckout(minor, title.trim()));
    } catch (e) {
      setError(errorText(e));
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
        <Button onClick={create} disabled={minor <= 0 || !title.trim()} data-testid="acceptance-create">
          {t('app.get_paid.create')}
        </Button>
      </Card>
      {checkout && (
        <Card title={t('app.get_paid.take_payment', { amount: formatMinor(checkout.amount) })}>
          {checkout.purchaseUrl && (
            <p>
              {t('app.get_paid.share_link')}{' '}
              <a href={checkout.purchaseUrl} target="_blank" rel="noreferrer noopener">
                {checkout.purchaseUrl}
              </a>
            </p>
          )}
          {paid ? (
            <Notice status="success">{t('app.get_paid.paid')}</Notice>
          ) : (
            <Surfaces.Checkout checkoutId={checkout.id} onPaid={() => setPaid(true)} />
          )}
        </Card>
      )}
    </div>
  );
}

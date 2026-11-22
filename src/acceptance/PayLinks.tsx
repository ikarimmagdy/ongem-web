import { useEffect, useMemo, useState } from 'react';
import { ApiError, errorText } from '../api/errors';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  Select,
  Skeleton,
  StatusChip,
  Table,
} from '../design-system';
import { has, t } from '../i18n';
import { durationMs } from '../lib/duration';
import { formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { DateInput, FilterChips, PrefixedInput } from '../screens/common';
import {
  minorOf,
  PAY_LINK_STATES,
  type AcceptanceApi,
  type NewPayLink,
  type PayLink,
  type PayLinkSettings,
  type PayLinkState,
} from './api';

/** A refusal of a pay link call in the founder's words (`app.get_paid.pay_link.error.<code>`), else the app's. */
export function payLinkErrorText(e: unknown): string {
  if (e instanceof ApiError && e.code) {
    const k = `app.get_paid.pay_link.error.${e.code}`;
    if (has(k)) return t(k);
  }
  return errorText(e);
}

const STATE_STATUS: Record<PayLinkState, 'success' | 'info' | 'neutral' | 'failure'> = {
  OPEN: 'info',
  PAID: 'success',
  EXPIRED: 'neutral',
  REVOKED: 'failure',
};

const stateWord = (s: PayLinkState) => t(`app.get_paid.pay_link.state.${s.toLowerCase()}`);

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The expiry for a chosen calendar day: that day at the current time of day, at most the longest expiry the core allows.
 * Blank means the core's default. Returns an error key when the day is outside what the core allows.
 */
export function expiryFor(
  day: string,
  settings: Pick<PayLinkSettings, 'minExpiry' | 'maxExpiry'>,
  now: Date = new Date(),
): { expiresAt?: string; error?: 'too_soon' | 'too_late' } {
  const m = DAY.exec(day);
  if (!m) return {};
  const at = new Date(now);
  at.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const min = durationMs(settings.minExpiry) ?? 0;
  const max = durationMs(settings.maxExpiry);
  if (at.getTime() < now.getTime() + min) return { error: 'too_soon' };
  if (max !== null && at.getTime() > now.getTime() + max) {
    // The last allowed day itself, later in the day than the limit: the limit.
    const last = new Date(now.getTime() + max);
    if (at.toDateString() !== last.toDateString()) return { error: 'too_late' };
    return { expiresAt: last.toISOString() };
  }
  return { expiresAt: at.toISOString() };
}

/**
 * OG-058 the founder's pay links on Get paid: make one (amount, what it is for, expiry, single or limited use, an
 * optional customer email), copy or share it, see every link with its state and uses, and revoke an open one. Every
 * limit comes from GET /v1/acceptance/pay-links/settings.
 */
export function PayLinks({ api, canCreate }: { api: AcceptanceApi; canCreate: boolean }) {
  const settings = useAsync(() => api.payLinkSettings(), [api]);
  const [filter, setFilter] = useState<'ALL' | PayLinkState>('ALL');
  const [n, setN] = useState(0);
  const list = useAsync(() => api.payLinks(filter === 'ALL' ? null : filter), [api, filter, n]);
  const reload = () => setN((x) => x + 1);

  if (settings.status === 'loading') return <Skeleton label={t('app.get_paid.loading')} />;
  if (settings.status === 'error')
    return (
      <Notice status="failure" action={<Button onClick={settings.reload}>{t('app.get_paid.retry')}</Button>}>
        {payLinkErrorText(settings.error)}
      </Notice>
    );
  if (!settings.data.enabled)
    return (
      <Notice status="info">
        <span data-testid="pay-links-off">{t('app.get_paid.pay_link.off')}</span>
      </Notice>
    );
  return (
    <div className="fw-stack" data-testid="pay-links">
      {canCreate && <CreatePayLink api={api} settings={settings.data} onMade={reload} />}
      <Card title={t('app.get_paid.pay_link.list_title')}>
        <FilterChips
          label={t('app.get_paid.pay_link.filter_label')}
          testId="pay-link-filter"
          value={filter}
          onChange={(id) => setFilter(id as 'ALL' | PayLinkState)}
          options={[
            { id: 'ALL', label: t('app.get_paid.pay_link.filter_all') },
            ...PAY_LINK_STATES.map((s) => ({ id: s, label: stateWord(s) })),
          ]}
        />
        {list.status === 'loading' ? (
          <Skeleton label={t('app.get_paid.loading')} />
        ) : list.status === 'error' ? (
          <Notice status="failure" action={<Button onClick={list.reload}>{t('app.get_paid.retry')}</Button>}>
            {payLinkErrorText(list.error)}
          </Notice>
        ) : (
          <LinksTable rows={list.data} api={api} canCreate={canCreate} onChanged={reload} />
        )}
      </Card>
    </div>
  );
}

function CreatePayLink({
  api,
  settings,
  onMade,
}: {
  api: AcceptanceApi;
  settings: PayLinkSettings;
  onMade(): void;
}) {
  const currency = settings.currencies[0] ?? 'USD';
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [use, setUse] = useState<'single' | 'limited'>(settings.defaultMaxUses > 1 ? 'limited' : 'single');
  const [uses, setUses] = useState(String(Math.max(2, settings.defaultMaxUses)));
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<PayLink | null>(null);

  const minor = minorOf(amount);
  const money = (amountMinor: number) => formatMinor({ amountMinor, currency });
  const amountError =
    amount.trim() && (minor < settings.minAmountMinor || minor > settings.maxAmountMinor)
      ? t('app.get_paid.pay_link.amount_range', {
          min: money(settings.minAmountMinor),
          max: money(settings.maxAmountMinor),
        })
      : undefined;
  const now = useMemo(() => new Date(), []);
  const expiry = expiryFor(day, settings, now);
  const lastDay = new Date(now.getTime() + (durationMs(settings.maxExpiry) ?? 0));
  const defaultAt = new Date(now.getTime() + (durationMs(settings.defaultExpiry) ?? 0));
  const expiryError = expiry.error
    ? t(`app.get_paid.pay_link.expiry_${expiry.error}`, { date: formatDate(lastDay) })
    : undefined;
  const usesNumber = /^\d{1,4}$/.test(uses.trim()) ? Number(uses) : 0;
  const usesError =
    use === 'limited' && (usesNumber < 2 || usesNumber > settings.maxUses)
      ? t('app.get_paid.pay_link.uses_range', { max: String(settings.maxUses) })
      : undefined;
  const emailError =
    email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? t('app.get_paid.pay_link.email_invalid')
      : undefined;
  const ready =
    minor > 0 && !amountError && title.trim() && !expiryError && !usesError && !emailError && !busy;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const input: NewPayLink = {
        amountMinor: minor,
        currency,
        title: title.trim(),
        maxUses: use === 'single' ? 1 : usesNumber,
        ...(expiry.expiresAt ? { expiresAt: expiry.expiresAt } : {}),
        ...(email.trim() ? { customerEmail: email.trim() } : {}),
      };
      setMade(await api.createPayLink(input));
      setAmount('');
      setTitle('');
      setDay('');
      setEmail('');
      onMade();
    } catch (e) {
      setError(payLinkErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('app.get_paid.pay_link.create_title')}>
      <div className="fw-thread" data-testid="pay-link-form">
        <p className="fw-hint">{t('app.get_paid.pay_link.intro')}</p>
        <Field label={t('app.get_paid.amount')} error={amountError}>
          <PrefixedInput
            prefix={money(0).replace(/[\d.,\s\u00a0]/g, '')}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="pay-link-amount"
          />
        </Field>
        <Field label={t('app.get_paid.description')}>
          <Input
            maxLength={settings.titleMaxLength}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="pay-link-title"
          />
        </Field>
        <Field
          label={t('app.get_paid.pay_link.expiry')}
          hint={t('app.get_paid.pay_link.expiry_hint', { date: formatDate(defaultAt, { time: true }) })}
          error={expiryError}
        >
          <DateInput value={day} onChange={setDay} data-testid="pay-link-expiry" />
        </Field>
        <Field label={t('app.get_paid.pay_link.uses')}>
          <Select
            value={use}
            onChange={(v) => setUse(v as 'single' | 'limited')}
            options={[
              { value: 'single', label: t('app.get_paid.pay_link.single_use') },
              { value: 'limited', label: t('app.get_paid.pay_link.limited_use') },
            ]}
            data-testid="pay-link-use"
          />
        </Field>
        {use === 'limited' && (
          <Field
            label={t('app.get_paid.pay_link.max_uses')}
            hint={t('app.get_paid.pay_link.max_uses_hint', { max: String(settings.maxUses) })}
            error={usesError}
          >
            <Input
              inputMode="numeric"
              value={uses}
              onChange={(e) => setUses(e.target.value)}
              data-testid="pay-link-max-uses"
            />
          </Field>
        )}
        <Field
          label={t('app.get_paid.pay_link.customer_email')}
          hint={t('app.get_paid.pay_link.customer_email_hint')}
          error={emailError}
        >
          <Input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="pay-link-email"
          />
        </Field>
        {error && (
          <Notice status="failure">
            <span data-testid="pay-link-error">{error}</span>
          </Notice>
        )}
        <div className="fw-actions">
          <Button onClick={() => void create()} disabled={!ready} data-testid="pay-link-create">
            {t('app.get_paid.pay_link.create')}
          </Button>
        </div>
        {made && <MadeLink link={made} />}
      </div>
    </Card>
  );
}

/** Copies [text]; says Copied for two seconds. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = (id: string, text: string) => {
    try {
      void navigator.clipboard?.writeText(text).then(
        () => setCopied(id),
        () => undefined,
      );
    } catch {
      /* no clipboard: the link stays on screen to copy by hand */
    }
  };
  return { copied, copy };
}

function MadeLink({ link }: { link: PayLink }) {
  const { copied, copy } = useCopy();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <Notice status="success">
      <div className="fw-thread" data-testid="pay-link-made">
        <p>
          {t('app.get_paid.pay_link.made', {
            amount: formatMinor(link.amount),
            date: formatDate(link.expiresAt, { time: true }),
          })}
        </p>
        <bdi dir="ltr" className="fw-copy__value" data-testid="pay-link-url">
          {link.url}
        </bdi>
        <div className="fw-actions">
          <Button size="sm" onClick={() => copy(link.id, link.url)} data-testid="pay-link-copy">
            {copied === link.id ? t('app.ds.copied') : t('app.get_paid.pay_link.copy')}
          </Button>
          {canShare && (
            <Button
              size="sm"
              variant="secondary"
              data-testid="pay-link-share"
              onClick={() =>
                void navigator
                  .share({
                    title: link.title,
                    text: t('app.get_paid.pay_link.share_text', { title: link.title }),
                    url: link.url,
                  })
                  .catch(() => undefined)
              }
            >
              {t('app.get_paid.pay_link.share')}
            </Button>
          )}
        </div>
        <span className="og-visually-hidden" aria-live="polite">
          {copied === link.id ? t('app.ds.copied') : ''}
        </span>
      </div>
    </Notice>
  );
}

function LinksTable({
  rows,
  api,
  canCreate,
  onChanged,
}: {
  rows: PayLink[];
  api: AcceptanceApi;
  canCreate: boolean;
  onChanged(): void;
}) {
  const { copied, copy } = useCopy();
  const [revoking, setRevoking] = useState<PayLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    setError(null);
    try {
      await api.revokePayLink(revoking.id);
      setRevoking(null);
      onChanged();
    } catch (e) {
      setError(payLinkErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Table
        caption={t('app.get_paid.pay_link.list_title')}
        rows={rows}
        rowKey={(r) => r.id}
        stack
        empty={
          <EmptyState title={t('app.get_paid.pay_link.empty')}>
            {t('app.get_paid.pay_link.empty_text')}
          </EmptyState>
        }
        columns={[
          {
            key: 'title',
            header: t('app.get_paid.pay_link.col.title'),
            render: (r) => (
              <span data-testid={`pay-link-row-${r.id}`}>
                {r.title}
                {r.customerEmail && (
                  <span className="fw-row__sub" data-mask>
                    {' '}
                    {r.customerEmail}
                  </span>
                )}
              </span>
            ),
          },
          {
            key: 'state',
            header: t('app.get_paid.col.state'),
            render: (r) => (
              <span>
                <StatusChip status={STATE_STATUS[r.state]}>{stateWord(r.state)}</StatusChip>
                <span className="fw-row__sub">
                  {' '}
                  {t('app.get_paid.pay_link.uses_of', { uses: String(r.uses), max: String(r.maxUses) })}
                </span>
              </span>
            ),
          },
          {
            key: 'expires',
            header: t('app.get_paid.pay_link.col.expires'),
            render: (r) => formatDate(r.expiresAt, { time: true }),
          },
          {
            key: 'amount',
            header: t('app.get_paid.col.amount'),
            align: 'end',
            render: (r) => <span data-mask>{formatMinor(r.amount)}</span>,
          },
          {
            key: 'actions',
            header: t('app.get_paid.pay_link.col.actions'),
            align: 'end',
            render: (r) =>
              r.state === 'OPEN' ? (
                <span className="fw-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('app.get_paid.pay_link.copy_named', { title: r.title })}
                    onClick={() => copy(r.id, r.url)}
                    data-testid={`pay-link-copy-${r.id}`}
                  >
                    {copied === r.id ? t('app.ds.copied') : t('app.get_paid.pay_link.copy')}
                  </Button>
                  {canCreate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('app.get_paid.pay_link.revoke_named', { title: r.title })}
                      onClick={() => {
                        setError(null);
                        setRevoking(r);
                      }}
                      data-testid={`pay-link-revoke-${r.id}`}
                    >
                      {t('app.get_paid.pay_link.revoke')}
                    </Button>
                  )}
                </span>
              ) : null,
          },
        ]}
      />
      <Modal
        open={revoking !== null}
        title={t('app.get_paid.pay_link.revoke_title')}
        onClose={() => setRevoking(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)}>
              {t('app.get_paid.pay_link.keep')}
            </Button>
            <Button
              variant="danger"
              onClick={() => void revoke()}
              disabled={busy}
              data-testid="pay-link-revoke-confirm"
            >
              {t('app.get_paid.pay_link.revoke')}
            </Button>
          </>
        }
      >
        <p>
          {revoking &&
            t('app.get_paid.pay_link.revoke_text', {
              title: revoking.title,
              amount: formatMinor(revoking.amount),
            })}
        </p>
        {error && <Notice status="failure">{error}</Notice>}
      </Modal>
    </>
  );
}

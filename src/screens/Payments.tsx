import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import type { Account, Payment, Recipient } from '../api/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  StatusChip,
} from '../design-system';
import { decimalToMinor, formatDate, formatMinor, minorToDecimal } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { paymentLabel } from '../lib/states';
import { useDrafts } from '../assistant/drafts';
import { t } from '../i18n';
import { REGION_CONFIG } from '../region';
import { useSession } from '../session';
import { AcctLast4, Amt, Load, stateStatus } from './common';
import { Schedules } from './Schedules';
import { TopUp } from './TopUp';
import { SplitHint } from './SplitHint';
import { RecipientsScreen } from './Recipients';

/** Payments per page on the list (UX-16): the list stays short and the form beside it stays in view. */
export const PAYMENTS_PAGE = 10;

/** Who a payment goes to, for lists (OG-035 R4): the recipient, an own account, or Top-up. */
export function payeeName(p: Payment, accounts: Account[], recipients: Recipient[]) {
  if (p.fundingSourceId) {
    const a = accounts.find((x) => x.id === p.fromAccountId);
    return a ? t('app.payments.to.topup_to', { account: a.name }) : t('app.payments.kind.topup');
  }
  if (p.toAccountId) {
    const a = accounts.find((x) => x.id === p.toAccountId);
    return a ? `${a.name}` : t('app.payments.to.your_account');
  }
  return recipients.find((r) => r.id === p.recipientId)?.name ?? t('app.payments.to.recipient');
}

/**
 * Where the payment is, in words (SL1-15): sending, sent with the bank's reference, or settled. A payment waiting for
 * approval names who approves it (Q-091): OnGem when nobody else in the company can.
 */
export function paymentStatusLine(
  state: string,
  bankReference?: string | null,
  approvalBy?: Payment['approvalBy'],
): string {
  switch (state.toUpperCase()) {
    case 'PENDING_APPROVAL':
      return approvalBy === 'ONGEM'
        ? t('app.payments.status_line.pending_approval_ongem')
        : t('app.payments.status_line.pending_approval');
    case 'REJECTED':
      return t('app.payments.status_line.rejected');
    case 'DRAFT':
    case 'PRECHECKED':
      return t('app.payments.status_line.sending');
    case 'SUBMITTED':
    case 'BANK_REVIEW':
      return bankReference
        ? t('app.payments.status_line.sent_reference', { reference: bankReference })
        : t('app.payments.status_line.sent');
    case 'SETTLED':
      return t('app.payments.status_line.settled');
    default:
      return paymentLabel(state);
  }
}

/** Approve or decline a payment waiting for a second person (G-40 top-ups, wires); the maker is refused by the API. */
function Approval({ id, onDone }: { id: string; onDone(): void }) {
  const { api } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const act = async (f: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await f();
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {error && <Notice status="failure">{error}</Notice>}
      <div className="fw-actions">
        <Button
          variant="secondary"
          data-testid="payment-reject"
          disabled={busy}
          onClick={() => void act(() => api.rejectPayment(id))}
        >
          {t('app.payments.decline')}
        </Button>
        <Button
          data-testid="payment-approve"
          disabled={busy}
          onClick={() => void act(() => api.approvePayment(id))}
        >
          {t('app.payments.approve')}
        </Button>
      </div>
    </>
  );
}

/** What a payment is, for its title: a top-up, a transfer between own accounts or a payment (R-UX-4). */
export function paymentKind(p: {
  fundingSourceId?: string | null;
  toAccountId?: string | null;
  toCompanyId?: string | null;
}): string {
  return p.fundingSourceId
    ? t('app.payments.kind.topup')
    : p.toCompanyId
      ? t('app.payments.detail.company_transfer')
      : p.toAccountId
        ? t('app.payments.kind.transfer')
        : t('app.payments.kind.payment');
}

export function PaymentDetail({ id }: { id: string }) {
  const { api, can } = useSession();
  const [n, setN] = useState(0);
  const payment = useAsync(() => api.payment(id), [api, id, n]);
  return (
    <Load state={payment} label={t('app.payments.loading.payment')}>
      {(p) => (
        <Card
          title={
            <>
              <span data-testid="payment-kind">{paymentKind(p)}</span> <Amt value={p.amount} />
            </>
          }
          data-testid="payment-detail"
        >
          <p role="status" data-testid="payment-status-line">
            {paymentStatusLine(p.state, p.providerReference, p.approvalBy)}
          </p>
          <KeyValue
            items={[
              {
                label: t('app.payments.detail.status'),
                value: <StatusChip status={stateStatus(p.state)}>{paymentLabel(p.state)}</StatusChip>,
              },
              {
                label: t('app.payments.detail.rail'),
                value: p.fundingSourceId
                  ? REGION_CONFIG.topUpRail
                  : p.toCompanyId
                    ? t('app.payments.detail.company_transfer')
                    : p.toAccountId
                      ? t('app.payments.detail.internal_transfer')
                      : REGION_CONFIG.paymentRail(p.rail),
              },
              {
                label: t('app.payments.detail.reference'),
                value: p.reference ?? t('app.payments.detail.none'),
              },
              {
                label: t('app.payments.detail.bank_reference'),
                value: p.providerReference ?? t('app.payments.detail.not_yet'),
              },
              ...(p.state === 'RETURNED'
                ? [
                    {
                      label: t('app.payments.detail.returned'),
                      value: (
                        <span data-testid="return-code">
                          {`${p.returnCode ?? ''} ${p.returnReason ?? ''}`.trim()}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {p.state === 'PENDING_APPROVAL' && p.approvalBy !== 'ONGEM' && can(Permission.PAYMENT_APPROVE) && (
            <Approval id={p.id} onDone={() => setN((x) => x + 1)} />
          )}
          <ol
            className="fw-timeline"
            aria-label={t('app.payments.detail.timeline')}
            data-testid="payment-timeline"
          >
            {p.timeline.map((step, i) => (
              <li
                key={i}
                className={i === p.timeline.length - 1 ? 'fw-timeline__step is-current' : 'fw-timeline__step'}
              >
                <span className="fw-timeline__label">{paymentLabel(step.to)}</span>
                <span className="fw-timeline__date">{formatDate(step.at, { time: true })}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </Load>
  );
}

/** New payment: an ACH to a recipient or a transfer between own accounts; review, then send with step-up (OG-030 R4). */
export function NewPayment() {
  const { api, companies, currentCompanyId } = useSession();
  const drafts = useDrafts();
  const navigate = useNavigate();
  const [q] = useSearchParams();
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const rails = REGION_CONFIG.rails;
  const railValue = (r: (typeof rails)[number]) => r.rail.toLowerCase();
  const [kind, setKind] = useState(q.get('kind') === 'internal' ? 'internal' : railValue(rails[0]!));
  // OG-023 R11: the person's other ACTIVE companies in this region, whose accounts can take a transfer.
  const others = companies.filter(
    (m) =>
      m.companyId !== currentCompanyId &&
      (m.region ?? api.region) === api.region &&
      (m.companyState ?? 'ACTIVE') === 'ACTIVE',
  );
  const othersKey = others.map((m) => m.companyId).join(',');
  const companyAccounts = useAsync(
    async () =>
      kind !== 'company'
        ? []
        : (
            await Promise.all(
              others.map(async (c) =>
                (await api.forCompany(c.companyId).accounts())
                  .filter((a) => a.status === 'ACTIVE')
                  .map((a) => ({ company: c.companyName ?? t('app.shell.company'), account: a })),
              ),
            )
          ).flat(),
    [api, othersKey, kind],
  );
  const [toCompanyAccount, setToCompanyAccount] = useState('');
  const [from, setFrom] = useState(q.get('from') ?? '');
  const [toAccount, setToAccount] = useState(q.get('to') ?? '');
  const [recipient, setRecipient] = useState(q.get('recipient') ?? '');
  const [amount, setAmount] = useState(() => {
    const m = Number(q.get('amount'));
    return Number.isSafeInteger(m) && m > 0
      ? minorToDecimal({ amountMinor: m, currency: REGION_CONFIG.currency })
      : '';
  });
  const [reference, setReference] = useState(q.get('ref') ?? '');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The payment created for this review: a retry after a failed send sends it again, never a second payment.
  const created = useRef<Payment | null>(null);
  const inFlight = useRef(false);
  if (accounts.status !== 'success' || recipients.status !== 'success') {
    return (
      <Load
        state={accounts.status !== 'success' ? accounts : (recipients as never)}
        label={t('app.payments.loading.accounts')}
      >
        {() => null}
      </Load>
    );
  }
  // Money moves only from and to an ACTIVE account (the API also sends OPENING, FROZEN, RESTRICTED, CLOSING, CLOSED).
  const accs = accounts.data.filter((a) => a.status === 'ACTIVE');
  // A prefilled value (from a draft or a link) counts only when it is one of the options on screen.
  const fromId = accs.some((a) => a.id === from) ? from : accs[0]?.id || '';
  const minor = decimalToMinor(amount, REGION_CONFIG.currency);
  // ongem-core refuses only a BLOCKED payee: a new recipient stays PENDING until the bank checks it on the first payment,
  // so holding payments to CLEAR ones only would leave every new recipient unpayable.
  const payable = recipients.data.filter((r) => r.screening !== 'BLOCKED');
  const toId = accs.some((a) => a.id === toAccount && a.id !== fromId) ? toAccount : '';
  const recipientId = payable.some((r) => r.id === recipient) ? recipient : '';
  const fromCurrency = accs.find((a) => a.id === fromId)?.currency;
  const destinations =
    companyAccounts.status === 'success'
      ? companyAccounts.data.filter((d) => !fromCurrency || d.account.currency === fromCurrency)
      : [];
  const destination = destinations.find((d) => d.account.id === toCompanyAccount);
  const companyToId = destination?.account.id ?? '';
  const destinationLabel = (d: (typeof destinations)[number]) =>
    t('app.payments.form.company_account', { company: d.company, name: d.account.name });
  const target = kind === 'internal' ? toId : kind === 'company' ? companyToId : recipientId;
  // FA-031: the From account's available balance shows under it, and an amount over it is refused before Review.
  const fromAvailable = accs.find((a) => a.id === fromId)?.balance?.available ?? null;
  const overBalance = Boolean(minor && fromAvailable && minor > fromAvailable.amountMinor);
  const valid = Boolean(fromId && target && minor && !overBalance);
  const rail = rails.find((r) => railValue(r) === kind) ?? rails[0]!;
  const send = async () => {
    if (!minor || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const draft =
        created.current ??
        (await api.createPayment({
          fromAccountId: fromId,
          rail: kind === 'internal' ? 'BOOK' : kind === 'company' ? 'INTERNAL' : rail.rail,
          achTiming: kind === 'internal' || kind === 'company' ? null : (rail.achTiming ?? null),
          recipientId: kind === 'internal' || kind === 'company' ? null : recipientId,
          toAccountId: kind === 'internal' ? toId : kind === 'company' ? companyToId : null,
          amountMinor: minor,
          currency: REGION_CONFIG.currency,
          reference: reference.trim() || null,
        }));
      created.current = draft;
      const sent = await api.sendPayment(draft.id);
      created.current = null;
      await drafts.done(['PAYMENT', 'INTERNAL_TRANSFER'], sent.id, {
        fromAccountId: fromId,
        amountMinor: minor,
        ...(kind === 'internal'
          ? { toAccountId: toId }
          : kind === 'company'
            ? { toAccountId: companyToId }
            : { recipientId }),
      });
      navigate(`/payments/${sent.id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const change = () => {
    created.current = null;
    setReview(false);
  };
  if (review && minor) {
    const fromA = accs.find((a) => a.id === fromId);
    return (
      <Card title={t('app.payments.review.title')} data-testid="payment-review">
        <KeyValue
          items={[
            {
              label: t('app.payments.review.amount'),
              value: (
                <span data-mask="">
                  {formatMinor({ amountMinor: minor, currency: REGION_CONFIG.currency })}
                </span>
              ),
            },
            {
              label: t('app.payments.review.from'),
              value: (
                <>
                  {fromA?.name} <AcctLast4 value={fromA?.last4} />
                </>
              ),
            },
            {
              label: t('app.payments.review.to'),
              value:
                kind === 'internal'
                  ? accs.find((a) => a.id === toId)?.name
                  : kind === 'company' && destination
                    ? destinationLabel(destination)
                    : payable.find((r) => r.id === recipientId)?.name,
            },
            {
              label: t('app.payments.review.how'),
              value:
                kind === 'internal' || kind === 'company' ? t('app.payments.review.internal_now') : rail.how,
            },
          ]}
        />
        <p>{t('app.payments.review.note')}</p>
        {error && <Notice status="failure">{error}</Notice>}
        <div className="fw-actions">
          <Button variant="secondary" disabled={busy} onClick={change}>
            {t('app.payments.review.change')}
          </Button>
          <Button data-testid="payment-send" disabled={busy} onClick={() => void send()}>
            {t('app.payments.review.send')}
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card title={t('app.payments.form.title')} data-testid="payment-form">
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setReview(true);
        }}
      >
        <Field label={t('app.payments.form.type')}>
          <Select
            data-testid="payment-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={[
              ...rails.map((r) => ({ value: railValue(r), label: r.option })),
              { value: 'internal', label: t('app.payments.form.internal') },
              ...(others.length
                ? [{ value: 'company', label: t('app.payments.form.between_companies') }]
                : []),
            ]}
          />
        </Field>
        <Field
          label={t('app.payments.review.from')}
          hint={
            fromAvailable ? (
              <span data-testid="payment-from-available" data-mask="">
                {t('app.payments.form.available', { amount: formatMinor(fromAvailable) })}
              </span>
            ) : undefined
          }
        >
          <Select
            data-testid="payment-from"
            data-mask=""
            value={fromId}
            onChange={(e) => setFrom(e.target.value)}
            options={accs.map((a) => ({
              value: a.id,
              label: t('app.payments.form.account_ending', { name: a.name, last4: a.last4 ?? '' }),
            }))}
          />
        </Field>
        {kind === 'company' ? (
          companyAccounts.status === 'loading' ? (
            <Skeleton label={t('app.payments.form.companies_loading')} />
          ) : companyAccounts.status === 'error' ? (
            <Notice status="failure">{errorText(companyAccounts.error)}</Notice>
          ) : (
            <Field label={t('app.payments.form.to_account')}>
              <Select
                data-testid="payment-to-company-account"
                value={companyToId}
                onChange={(e) => setToCompanyAccount(e.target.value)}
                options={[
                  { value: '', label: t('app.payments.form.choose_account') },
                  ...destinations.map((d) => ({ value: d.account.id, label: destinationLabel(d) })),
                ]}
              />
            </Field>
          )
        ) : kind === 'internal' ? (
          <Field label={t('app.payments.form.to_account')}>
            <Select
              data-testid="payment-to-account"
              value={toId}
              onChange={(e) => setToAccount(e.target.value)}
              options={[
                { value: '', label: t('app.payments.form.choose_account') },
                ...accs.filter((a) => a.id !== fromId).map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </Field>
        ) : (
          <Field
            label={t('app.payments.form.recipient')}
            hint={
              !payable.length
                ? t('app.payments.form.recipient_first')
                : payable.some((r) => r.id === recipientId && r.screening === 'PENDING')
                  ? t('app.payments.form.recipient_pending')
                  : undefined
            }
          >
            <Select
              data-testid="payment-recipient"
              value={recipientId}
              onChange={(e) => setRecipient(e.target.value)}
              options={[
                { value: '', label: t('app.payments.form.choose_recipient') },
                ...payable.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </Field>
        )}
        <Field
          label={REGION_CONFIG.amountLabel}
          error={
            amount && !minor
              ? t('app.payments.form.amount_error')
              : overBalance && fromAvailable
                ? t('app.payments.form.over_balance', { amount: formatMinor(fromAvailable) })
                : undefined
          }
        >
          <Input
            data-testid="payment-amount"
            data-mask=""
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t('app.payments.form.reference')}>
          <Input
            data-testid="payment-reference"
            maxLength={80}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <div className="fw-actions">
          <Button type="submit" data-testid="payment-review-button" disabled={!valid}>
            {t('app.payments.form.review')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** The Payments tabs (OG-035 R6), each a route; the old routes are the tab routes. */
export const PAYMENT_TABS = [
  { id: 'all', to: '/payments' },
  { id: 'send', to: '/payments/new' },
  { id: 'scheduled', to: '/payments/schedules' },
  { id: 'recipients', to: '/payments/recipients' },
  { id: 'add_money', to: '/payments/top-up' },
  { id: 'approvals', to: '/payments/approvals' },
] as const;
export type PaymentTab = (typeof PAYMENT_TABS)[number]['id'];

/** The tab a route belongs to; a payment's detail belongs to All payments. */
export function paymentTabOf(pathname: string): PaymentTab {
  const end = pathname.replace(/\/+$/, '');
  return PAYMENT_TABS.find((x) => x.id !== 'all' && end === x.to)?.id ?? 'all';
}

/** The tabs this person may open: Send needs payment:create, Add money an ACTIVE company, approvals payment:approve. */
export function visiblePaymentTabs(can: (p: string) => boolean, companyState: string) {
  return PAYMENT_TABS.filter((x) =>
    x.id === 'send'
      ? can(Permission.PAYMENT_CREATE)
      : x.id === 'scheduled'
        ? can(Permission.PAYMENT_VIEW)
        : x.id === 'add_money'
          ? can(Permission.PAYMENT_VIEW) && companyState === 'ACTIVE'
          : x.id === 'approvals'
            ? can(Permission.PAYMENT_APPROVE)
            : true,
  );
}

function PaymentsTabs({ current }: { current: PaymentTab }) {
  const { can, companyState } = useSession();
  return (
    <nav className="fw-tabs" aria-label={t('app.payments.tabs.label')} data-testid="payments-tabs">
      <ul className="fw-tabs__list">
        {visiblePaymentTabs(can, companyState).map((x) => (
          <li key={x.id}>
            <Link
              to={x.to}
              className={`fw-tabs__tab${x.id === current ? ' is-active' : ''}`}
              aria-current={x.id === current ? 'page' : undefined}
              data-testid={`payments-tab-${x.id}`}
            >
              {t(`app.payments.tabs.${x.id}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Payments waiting for a second person (OG-035 R6), each with Approve and Decline; OnGem's own approvals are left out. */
export function Approvals() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [n, setN] = useState(0);
  const list = useAsync(() => api.payments(null, 100), [api, n]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  return (
    <Load state={list} label="payments">
      {(page) => {
        const waiting = page.items.filter((p) => p.state === 'PENDING_APPROVAL' && p.approvalBy !== 'ONGEM');
        return waiting.length ? (
          <ul className="fw-list" data-testid="approvals-list">
            {waiting.map((p) => (
              <li key={p.id} className="fw-approval" data-testid={`approval-${p.id}`}>
                <button className="fw-row" onClick={() => navigate(`/payments/${p.id}`)}>
                  <span className="fw-row__main">
                    <strong>{payeeName(p, accs, recs)}</strong>
                    <span className="fw-row__sub">
                      {p.reference ?? paymentKind(p)}
                      {p.createdAt ? ` · ${formatDate(p.createdAt)}` : ''}
                    </span>
                  </span>
                  <Amt value={p.amount} />
                </button>
                <Approval id={p.id} onDone={() => setN((x) => x + 1)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('app.payments.approvals.empty.title')}>
            {t('app.payments.approvals.empty.text')}
          </EmptyState>
        );
      }}
    </Load>
  );
}

export function PaymentsScreen() {
  const { api, can } = useSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = paymentTabOf(location.pathname);
  // Cursors of the pages before the current one; the last entry is the current page's cursor (null = first page).
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  // Reloaded from the first page whenever another tab was open, so a payment or top-up just made shows at once (R-UX-4).
  useEffect(() => {
    if (tab !== 'all') setCursors([null]);
  }, [tab]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  return (
    <>
      <PageHeader title={t('app.payments.title')} />
      <PaymentsTabs current={tab} />
      {tab === 'all' ? (
        <PaymentsList
          id={id}
          cursors={cursors}
          setCursors={setCursors}
          cursor={cursor ?? null}
          accs={accs}
          recs={recs}
          onOpen={(pid) => navigate(`/payments/${pid}`)}
          onBack={() => navigate('/payments')}
        />
      ) : (
        <div className="fw-tab-panel" data-testid={`payments-panel-${tab}`}>
          {tab === 'scheduled' ? (
            <Schedules />
          ) : tab === 'add_money' ? (
            <TopUp />
          ) : tab === 'recipients' ? (
            <RecipientsScreen embedded />
          ) : tab === 'approvals' ? (
            can(Permission.PAYMENT_APPROVE) ? (
              <Approvals />
            ) : (
              <Notice status="info">
                <span data-testid="approvals-denied">{t('app.payments.approvals.role_denied')}</span>
              </Notice>
            )
          ) : can(Permission.PAYMENT_CREATE) ? (
            <NewPayment />
          ) : (
            <Notice status="info">{t('app.payments.role_denied')}</Notice>
          )}
        </div>
      )}
    </>
  );
}

function PaymentsList({
  id,
  cursors,
  setCursors,
  cursor,
  accs,
  recs,
  onOpen,
  onBack,
}: {
  id?: string;
  cursors: (string | null)[];
  setCursors: (f: (x: (string | null)[]) => (string | null)[]) => void;
  cursor: string | null;
  accs: Account[];
  recs: Recipient[];
  onOpen(id: string): void;
  onBack(): void;
}) {
  const { api } = useSession();
  const list = useAsync(() => api.payments(cursor, PAYMENTS_PAGE), [api, cursor]);
  return (
    <div className={`fw-split${id ? ' has-detail' : ''}`}>
      <div className="fw-split__list">
        <Load state={list} label={t('app.payments.loading.payments')}>
          {(page) =>
            page.items.length ? (
              <>
                <ul className="fw-list" data-testid="payments-list">
                  {page.items.map((p) => (
                    <li key={p.id}>
                      <button
                        className={`fw-row${p.id === id ? ' is-active' : ''}`}
                        data-testid={`payment-${p.id}`}
                        onClick={() => onOpen(p.id)}
                      >
                        <span className="fw-row__main">
                          <strong>{payeeName(p, accs, recs)}</strong>
                          <span className="fw-row__sub">
                            {p.fundingSourceId
                              ? t('app.payments.kind.topup')
                              : p.toCompanyId
                                ? t('app.payments.detail.company_transfer')
                                : p.toAccountId
                                  ? t('app.payments.detail.internal_transfer')
                                  : REGION_CONFIG.paymentRail(p.rail)}{' '}
                            {p.createdAt ? `· ${formatDate(p.createdAt)}` : ''}
                          </span>
                        </span>
                        <span className="fw-row__main">
                          <Amt value={p.amount} />
                          <StatusChip status={stateStatus(p.state)}>{paymentLabel(p.state)}</StatusChip>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {(page.next || cursors.length > 1) && (
                  <nav
                    className="fw-pager"
                    aria-label={t('app.payments.pager.label')}
                    data-testid="payments-pager"
                  >
                    <Button
                      variant="secondary"
                      data-testid="payments-newer"
                      disabled={cursors.length === 1}
                      onClick={() => setCursors((x) => x.slice(0, -1))}
                    >
                      {t('app.payments.pager.newer')}
                    </Button>
                    <span className="fw-pager__label" aria-live="polite">
                      {t('app.payments.pager.page', { page: cursors.length })}
                    </span>
                    <Button
                      variant="secondary"
                      data-testid="payments-older"
                      disabled={!page.next}
                      onClick={() => setCursors((x) => [...x, page.next as string])}
                    >
                      {t('app.payments.pager.older')}
                    </Button>
                  </nav>
                )}
              </>
            ) : (
              <EmptyState title={t('app.payments.empty.title')}>{t('app.payments.empty.text')}</EmptyState>
            )
          }
        </Load>
      </div>
      <div>
        {id && (
          <Button variant="ghost" onClick={onBack}>
            {t('app.payments.back')}
          </Button>
        )}
        {id ? (
          <PaymentDetail id={id} />
        ) : (
          <SplitHint title={t('app.payments.hint.title')}>{t('app.payments.hint.text')}</SplitHint>
        )}
      </div>
    </div>
  );
}

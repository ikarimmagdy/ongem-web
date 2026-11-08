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

/** Payments per page on the list (UX-16): the list stays short and the form beside it stays in view. */
export const PAYMENTS_PAGE = 10;

function to(p: Payment, accounts: Account[], recipients: Recipient[]) {
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
export function paymentKind(p: { fundingSourceId?: string | null; toAccountId?: string | null }): string {
  return p.fundingSourceId
    ? t('app.payments.kind.topup')
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
  const { api } = useSession();
  const drafts = useDrafts();
  const navigate = useNavigate();
  const [q] = useSearchParams();
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const rails = REGION_CONFIG.rails;
  const railValue = (r: (typeof rails)[number]) => r.rail.toLowerCase();
  const [kind, setKind] = useState(q.get('kind') === 'internal' ? 'internal' : railValue(rails[0]!));
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
  const target = kind === 'internal' ? toId : recipientId;
  const valid = Boolean(fromId && target && minor);
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
          rail: kind === 'internal' ? 'BOOK' : rail.rail,
          achTiming: kind === 'internal' ? null : (rail.achTiming ?? null),
          recipientId: kind === 'internal' ? null : recipientId,
          toAccountId: kind === 'internal' ? toId : null,
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
        ...(kind === 'internal' ? { toAccountId: toId } : { recipientId }),
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
                  : payable.find((r) => r.id === recipientId)?.name,
            },
            {
              label: t('app.payments.review.how'),
              value: kind === 'internal' ? t('app.payments.review.internal_now') : rail.how,
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
            ]}
          />
        </Field>
        <Field label={t('app.payments.review.from')}>
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
        {kind === 'internal' ? (
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
          error={amount && !minor ? t('app.payments.form.amount_error') : undefined}
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

export function PaymentsScreen() {
  const { api, can } = useSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/payments/new');
  const isTopUp = location.pathname.endsWith('/payments/top-up');
  const isSchedules = location.pathname.endsWith('/payments/schedules');
  // Cursors of the pages before the current one; the last entry is the current page's cursor (null = first page).
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  // Reloaded after a payment or a top-up is created, from the first page, so the new item shows at once (R-UX-4).
  useEffect(() => {
    if (isNew || isTopUp) setCursors([null]);
  }, [isNew, isTopUp]);
  const list = useAsync(() => api.payments(cursor, PAYMENTS_PAGE), [api, cursor, isNew, isTopUp]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  const detail = isNew || isTopUp || isSchedules || Boolean(id);
  return (
    <>
      <PageHeader
        title={t('app.payments.title')}
        actions={
          <div className="fw-actions">
            <Link
              to="/recipients"
              className="og-btn og-btn--secondary og-btn--md"
              data-testid="payments-recipients"
            >
              {t('app.payments.recipients')}
            </Link>
            {can(Permission.PAYMENT_VIEW) && (
              <Button
                variant="secondary"
                data-testid="scheduled"
                onClick={() => navigate('/payments/schedules')}
              >
                {t('app.payments.scheduled')}
              </Button>
            )}
            {can(Permission.PAYMENT_VIEW) && (
              <Button
                variant="secondary"
                data-testid="add-money"
                onClick={() => navigate('/payments/top-up')}
              >
                {t('app.payments.add_money')}
              </Button>
            )}
            {can(Permission.PAYMENT_CREATE) && (
              <Button data-testid="new-payment" onClick={() => navigate('/payments/new')}>
                {t('app.payments.form.title')}
              </Button>
            )}
          </div>
        }
      />
      <div className={`fw-split${detail ? ' has-detail' : ''}`}>
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
                          onClick={() => navigate(`/payments/${p.id}`)}
                        >
                          <span className="fw-row__main">
                            <strong>{to(p, accs, recs)}</strong>
                            <span className="fw-row__sub">
                              {p.fundingSourceId
                                ? t('app.payments.kind.topup')
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
          {detail && (
            <Button variant="ghost" onClick={() => navigate('/payments')}>
              {t('app.payments.back')}
            </Button>
          )}
          {isSchedules ? (
            <Schedules />
          ) : isTopUp ? (
            <TopUp />
          ) : isNew ? (
            can(Permission.PAYMENT_CREATE) ? (
              <NewPayment />
            ) : (
              <Notice status="info">{t('app.payments.role_denied')}</Notice>
            )
          ) : id ? (
            <PaymentDetail id={id} />
          ) : (
            <SplitHint title={t('app.payments.hint.title')}>{t('app.payments.hint.text')}</SplitHint>
          )}
        </div>
      </div>
    </>
  );
}

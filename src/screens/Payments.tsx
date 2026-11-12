import { useEffect, useRef, useState, type ComponentProps } from 'react';
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
  Modal,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  StatusChip,
  TextArea,
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
    case 'SENT':
    case 'BANK_REVIEW':
      // FA-035: the bank's own reference is an internal id; the founder reads where the payment is.
      void bankReference;
      return t('app.payments.status_line.sent');
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
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reasonTooLong = reason.trim().length > DECLINE_REASON_MAX;
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
      {/* FA-037: Decline says what it does before it does it. */}
      <Modal
        open={declining}
        title={t('app.payments.decline_confirm.title')}
        onClose={() => setDeclining(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclining(false)}>
              {t('app.common.cancel')}
            </Button>
            <Button
              variant="danger"
              data-testid="payment-reject-confirm"
              disabled={reasonTooLong}
              onClick={() => {
                setDeclining(false);
                const why = reason.trim().replace(/\s+/g, ' ');
                void act(() => (why ? api.rejectPayment(id, why) : api.rejectPayment(id)));
              }}
            >
              {t('app.payments.decline')}
            </Button>
          </>
        }
      >
        <p>{t('app.payments.decline_confirm.text')}</p>
        {/* FA-037: an optional reason the person who asked for the payment sees. */}
        <Field
          label={t('app.payments.decline_reason.label')}
          hint={t('app.payments.decline_reason.hint')}
          error={reasonTooLong ? t('app.payments.decline_reason.too_long') : undefined}
        >
          <TextArea
            data-testid="payment-reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </Modal>
      <div className="fw-actions fw-approval__actions">
        <Button
          variant="secondary"
          data-testid="payment-reject"
          disabled={busy}
          onClick={() => setDeclining(true)}
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

/** FA-037: ongem-core keeps a decline reason of up to 280 characters. */
export const DECLINE_REASON_MAX = 280;

/** FA-034: the states a payment has a receipt in (it has left or is leaving), as ongem-core answers. */
export const RECEIPT_STATES = new Set([
  'PRECHECKED',
  'SUBMITTED',
  'SENT',
  'BANK_REVIEW',
  'SETTLED',
  'RETURNED',
]);

/** FA-034: downloads the payment's PDF receipt and saves it under its own name; the bytes are never kept. */
function ReceiptButton({ id }: { id: string }) {
  const { api } = useSession();
  const [phase, setPhase] = useState<'idle' | 'busy' | 'ready' | 'failed'>('idle');
  const download = async () => {
    setPhase('busy');
    try {
      const blob = await api.paymentReceipt(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-receipt-${id}.pdf`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPhase('ready');
    } catch {
      setPhase('failed');
    }
  };
  return (
    <>
      <Button
        variant="secondary"
        data-testid="payment-receipt"
        disabled={phase === 'busy'}
        onClick={() => void download()}
      >
        {phase === 'busy' ? t('app.payments.receipt.preparing') : t('app.payments.receipt.download')}
      </Button>
      <span role="status" className="og-visually-hidden" data-testid="payment-receipt-status">
        {phase === 'ready' ? t('app.payments.receipt.ready') : ''}
      </span>
      {phase === 'failed' && (
        <Notice status="failure">
          <span data-testid="payment-receipt-error">{t('app.payments.receipt.error')}</span>
        </Notice>
      )}
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

/** How a payment travels, in words, never a rail code (FA-035): the method and when it arrives. */
export function paymentMethod(p: Payment): string {
  if (p.fundingSourceId) return REGION_CONFIG.topUpRail;
  if (p.toCompanyId) return t('app.payments.detail.company_transfer');
  if (p.toAccountId) return t('app.payments.review.internal_now');
  return REGION_CONFIG.rails.find((r) => r.rail === p.rail)?.how ?? REGION_CONFIG.paymentRail(p.rail);
}

/** The timeline without repeats (FA-035): consecutive steps that read the same are one step, at its first time. */
export function timelineSteps(timeline: Payment['timeline']): { label: string; at: string }[] {
  const out: { label: string; at: string }[] = [];
  for (const step of timeline) {
    const label = paymentLabel(step.to);
    if (out[out.length - 1]?.label !== label) out.push({ label, at: step.at });
  }
  return out;
}

/** A payment's title: "Payment to Acme Supplies LLC", a transfer or a top-up to an account (FA-035). */
export function paymentTitle(p: Payment, payee: string): string {
  return p.fundingSourceId
    ? t('app.payments.detail.title_topup', { payee })
    : p.toAccountId
      ? t('app.payments.detail.title_transfer', { payee })
      : t('app.payments.detail.title_payment', { payee });
}

export function PaymentDetail({ id, justSent = false }: { id: string; justSent?: boolean }) {
  const { api, can } = useSession();
  const navigate = useNavigate();
  const [n, setN] = useState(0);
  const payment = useAsync(() => api.payment(id), [api, id, n]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients().catch(() => []), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  const loaded = payment.status === 'success' ? payment.data : null;
  const titleOf = (p: Payment) =>
    paymentTitle(
      p,
      p.fundingSourceId
        ? (accs.find((a) => a.id === p.fromAccountId)?.name ?? t('app.payments.to.your_account'))
        : payeeName(p, accs, recs),
    );
  const title = loaded ? titleOf(loaded) : null;
  // FA-035: the browser tab names the payment, not the list.
  useEffect(() => {
    if (title) document.title = t('app.nav.document_title', { page: title });
  }, [title]);
  return (
    <Load state={payment} label={t('app.payments.loading.payment')}>
      {(p) => {
        const payee = payeeName(p, accs, recs);
        const from = accs.find((a) => a.id === (p.fundingSourceId ? undefined : p.fromAccountId));
        const steps = timelineSteps(p.timeline);
        return (
          <>
            {justSent && (
              // FA-034: a confirmation after sending: what left, to whom, from where and when it arrives.
              <section className="fw-sent" data-testid="payment-sent" aria-labelledby="payment-sent-title">
                <span className="fw-sent__mark" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="28"
                    height="28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <h2 id="payment-sent-title" className="fw-sent__title">
                  {p.state === 'PENDING_APPROVAL'
                    ? t('app.payments.sent.waiting_title')
                    : t('app.payments.sent.title')}
                </h2>
                <p className="og-money og-money--xl fw-sent__amount" data-mask="">
                  {formatMinor(p.amount)}
                </p>
                <p className="fw-sent__to">{t('app.payments.sent.to', { payee })}</p>
                <div className="fw-actions fw-sent__actions">
                  <Button data-testid="payment-send-another" onClick={() => navigate('/payments/new')}>
                    {t('app.payments.sent.another')}
                  </Button>
                  <Button
                    variant="secondary"
                    data-testid="payment-print"
                    onClick={() => typeof window.print === 'function' && window.print()}
                  >
                    {t('app.payments.sent.print')}
                  </Button>
                  {RECEIPT_STATES.has(p.state) && <ReceiptButton id={p.id} />}
                </div>
              </section>
            )}
            <Card
              title={
                <>
                  <span data-testid="payment-kind">{titleOf(p)}</span>
                </>
              }
              data-testid="payment-detail"
            >
              <p className="og-money og-money--xl fw-detail__amount" data-mask="">
                {formatMinor(p.amount)}
              </p>
              <p role="status" data-testid="payment-status-line">
                {paymentStatusLine(p.state, p.providerReference, p.approvalBy)}
              </p>
              {p.state === 'REJECTED' && p.declinedBy && (
                <p data-testid="payment-declined-by">
                  {t('app.payments.detail.declined_by', { name: p.declinedBy })}
                </p>
              )}
              <KeyValue
                items={[
                  {
                    label: t('app.payments.detail.status'),
                    value: <StatusChip status={stateStatus(p.state)}>{paymentLabel(p.state)}</StatusChip>,
                  },
                  {
                    label: t('app.payments.review.to'),
                    value: <span data-testid="payment-to">{payee}</span>,
                  },
                  ...(from
                    ? [
                        {
                          label: t('app.payments.review.from'),
                          value: (
                            <span data-testid="payment-from-account">
                              {from.name} <AcctLast4 value={from.last4} />
                            </span>
                          ),
                        },
                      ]
                    : []),
                  {
                    label: t('app.payments.detail.method'),
                    value: <span data-testid="payment-method">{paymentMethod(p)}</span>,
                  },
                  {
                    label: t('app.payments.detail.reference'),
                    value: p.reference ?? t('app.payments.detail.none'),
                  },
                  ...(p.requestedBy
                    ? [
                        {
                          label: t('app.payments.detail.requested_by'),
                          value: <span data-testid="payment-requested-by">{p.requestedBy}</span>,
                        },
                      ]
                    : []),
                  ...(p.state === 'REJECTED' && p.declineReason
                    ? [
                        {
                          label: t('app.payments.detail.decline_reason'),
                          value: <span data-testid="payment-decline-reason">{p.declineReason}</span>,
                        },
                      ]
                    : []),
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
              {p.state === 'PENDING_APPROVAL' &&
                p.approvalBy !== 'ONGEM' &&
                can(Permission.PAYMENT_APPROVE) && <Approval id={p.id} onDone={() => setN((x) => x + 1)} />}
              {!justSent && RECEIPT_STATES.has(p.state) && (
                <div className="fw-actions">
                  <ReceiptButton id={p.id} />
                </div>
              )}
              <ol
                className="fw-timeline"
                aria-label={t('app.payments.detail.timeline')}
                data-testid="payment-timeline"
              >
                {steps.map((step, i) => (
                  <li
                    key={i}
                    className={i === steps.length - 1 ? 'fw-timeline__step is-current' : 'fw-timeline__step'}
                  >
                    <span className="fw-timeline__label">{step.label}</span>
                    <span className="fw-timeline__date">{formatDate(step.at, { time: true })}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </>
        );
      }}
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
  // FA-036: Review is always offered; pressing it with something missing says what.
  const [tried, setTried] = useState(false);
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
      navigate(`/payments/${sent.id}?sent=1`);
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
  const missing = [
    !target && t('app.payments.form.missing.to'),
    !minor && t('app.payments.form.missing.amount'),
  ].filter(Boolean) as string[];
  const toName =
    kind === 'internal'
      ? accs.find((a) => a.id === toId)?.name
      : kind === 'company' && destination
        ? destinationLabel(destination)
        : payable.find((r) => r.id === recipientId)?.name;
  return (
    <div className="fw-send">
      <Card title={t('app.payments.form.title')} data-testid="payment-form">
        <form
          className="fw-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
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
                    : rail.how
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
            <PrefixedInput
              prefix={currencyPrefix()}
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
          {tried && missing.length > 0 && !overBalance && (
            <p className="og-field__error" role="alert" data-testid="payment-missing">
              {t('app.payments.form.missing.intro', { items: missing.join(', ') })}
            </p>
          )}
          <div className="fw-actions">
            <Button type="submit" data-testid="payment-review-button" disabled={overBalance}>
              {t('app.payments.form.review')}
            </Button>
          </div>
        </form>
      </Card>
      {/* FA-019: a live summary beside the form on a wide screen. */}
      <aside
        className="fw-send__summary"
        aria-label={t('app.payments.summary.title')}
        data-testid="payment-summary"
      >
        <h2 className="og-card__title">{t('app.payments.summary.title')}</h2>
        <KeyValue
          items={[
            {
              label: t('app.payments.review.amount'),
              value: (
                <span data-mask="">
                  {minor
                    ? formatMinor({ amountMinor: minor, currency: REGION_CONFIG.currency })
                    : t('app.payments.summary.not_chosen')}
                </span>
              ),
            },
            { label: t('app.payments.review.to'), value: toName ?? t('app.payments.summary.not_chosen') },
            {
              label: t('app.payments.review.from'),
              value: accs.find((a) => a.id === fromId)?.name ?? t('app.payments.summary.not_chosen'),
            },
            {
              label: t('app.payments.review.how'),
              value:
                kind === 'internal' || kind === 'company' ? t('app.payments.review.internal_now') : rail.how,
            },
          ]}
        />
      </aside>
    </div>
  );
}

/** The amount field with the currency in front of it (FA-036), forwarding the field's id and aria to the input. */
function PrefixedInput({ prefix, ...rest }: { prefix: string } & ComponentProps<typeof Input>) {
  return (
    <span className="fw-prefixed">
      <span className="fw-prefixed__prefix" aria-hidden="true">
        {prefix}
      </span>
      <Input {...rest} />
    </span>
  );
}

/** US$ or AED, as the amounts are written (from the money format, never typed in). */
const currencyPrefix = () =>
  formatMinor({ amountMinor: 0, currency: REGION_CONFIG.currency })
    .replace(/[\d.,\s\u00a0]/g, '')
    .trim();

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

/** FA-023: the tabs are lists only; Send and Add money are actions in the page header. */
const LIST_TABS: PaymentTab[] = ['all', 'scheduled', 'approvals', 'recipients'];
const ACTION_TABS: PaymentTab[] = ['send', 'add_money'];

function PaymentsTabs({ current, waiting }: { current: PaymentTab; waiting: number }) {
  const { can, companyState } = useSession();
  const list = useRef<HTMLUListElement>(null);
  // FA-022: the selected tab is scrolled into view on a phone.
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);
  const visible = visiblePaymentTabs(can, companyState);
  return (
    <nav className="fw-tabs" aria-label={t('app.payments.tabs.label')} data-testid="payments-tabs">
      <ul className="fw-tabs__list" ref={list}>
        {LIST_TABS.map((id) => visible.find((x) => x.id === id))
          .filter((x): x is (typeof PAYMENT_TABS)[number] => Boolean(x))
          .map((x) => (
            <li key={x.id}>
              <Link
                to={x.to}
                className={`fw-tabs__tab${x.id === current ? ' is-active' : ''}`}
                aria-current={x.id === current ? 'page' : undefined}
                data-testid={`payments-tab-${x.id}`}
              >
                {t(`app.payments.tabs.${x.id}`)}
                {x.id === 'approvals' && waiting > 0 && (
                  <span className="fw-tabs__count" data-testid="approvals-count">
                    {waiting}
                  </span>
                )}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}

function PaymentsActions({ current }: { current: PaymentTab }) {
  const { can, companyState } = useSession();
  const visible = visiblePaymentTabs(can, companyState);
  return (
    <>
      {ACTION_TABS.map((id) => visible.find((x) => x.id === id))
        .filter((x): x is (typeof PAYMENT_TABS)[number] => Boolean(x))
        .map((x) => (
          <Link
            key={x.id}
            to={x.to}
            className={`og-btn og-btn--md ${x.id === 'send' ? 'og-btn--primary' : 'og-btn--secondary'}`}
            aria-current={x.id === current ? 'page' : undefined}
            data-testid={`payments-tab-${x.id}`}
          >
            {t(`app.payments.tabs.${x.id}`)}
          </Link>
        ))}
    </>
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
                    <span className="fw-row__sub">{p.reference ?? paymentKind(p)}</span>
                    {/* FA-037: from which account and when it was asked for. */}
                    {p.requestedBy && (
                      <span className="fw-row__sub" data-testid={`approval-requested-by-${p.id}`}>
                        {t('app.payments.requested_by', { name: p.requestedBy })}
                      </span>
                    )}
                    <span className="fw-row__sub" data-testid={`approval-from-${p.id}`}>
                      {t('app.payments.approvals.from_on', {
                        account:
                          accs.find((a) => a.id === p.fromAccountId)?.name ??
                          t('app.payments.to.your_account'),
                        date: p.createdAt ? formatDate(p.createdAt) : '',
                      })}
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
  const approver = can(Permission.PAYMENT_APPROVE);
  const pending = useAsync(
    () => (approver ? api.payments(null, 100) : Promise.resolve(null)),
    [api, tab, id, approver],
  );
  const waiting =
    pending.status === 'success' && pending.data
      ? pending.data.items.filter((p) => p.state === 'PENDING_APPROVAL' && p.approvalBy !== 'ONGEM').length
      : 0;
  const [search] = useSearchParams();
  return (
    <>
      <PageHeader title={t('app.payments.title')} actions={<PaymentsActions current={tab} />} />
      <PaymentsTabs current={tab} waiting={waiting} />
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
          justSent={search.get('sent') === '1'}
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
  justSent,
}: {
  id?: string;
  cursors: (string | null)[];
  setCursors: (f: (x: (string | null)[]) => (string | null)[]) => void;
  cursor: string | null;
  accs: Account[];
  recs: Recipient[];
  onOpen(id: string): void;
  onBack(): void;
  justSent: boolean;
}) {
  const { api } = useSession();
  const navigate = useNavigate();
  const list = useAsync(() => api.payments(cursor, PAYMENTS_PAGE), [api, cursor]);
  // FA-018: on a wide screen the newest payment opens at once instead of an empty detail column.
  const first = list.status === 'success' ? list.data.items[0]?.id : undefined;
  useEffect(() => {
    if (id || !first || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(min-width: 901px)').matches) navigate(`/payments/${first}`, { replace: true });
  }, [id, first, navigate]);
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
          <Button variant="ghost" className="fw-split__back" onClick={onBack}>
            {t('app.payments.back')}
          </Button>
        )}
        {id ? (
          <PaymentDetail id={id} justSent={justSent} />
        ) : (
          <SplitHint title={t('app.payments.hint.title')}>{t('app.payments.hint.text')}</SplitHint>
        )}
      </div>
    </div>
  );
}

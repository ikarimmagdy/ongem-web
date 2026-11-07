import { useRef, useState } from 'react';
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
  Stepper,
} from '../design-system';
import { decimalToMinor, formatDate, formatMinor, minorToDecimal } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useDrafts } from '../assistant/drafts';
import { useSession } from '../session';
import { Amt, Last4, Load, human, stateStatus } from './common';
import { Schedules } from './Schedules';
import { TopUp } from './TopUp';

function to(p: Payment, accounts: Account[], recipients: Recipient[]) {
  if (p.fundingSourceId) {
    const a = accounts.find((x) => x.id === p.fromAccountId);
    return a ? `Top-up to ${a.name}` : 'Top-up';
  }
  if (p.toAccountId) {
    const a = accounts.find((x) => x.id === p.toAccountId);
    return a ? `${a.name}` : 'Your account';
  }
  return recipients.find((r) => r.id === p.recipientId)?.name ?? 'Recipient';
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
        ? 'Waiting for OnGem to approve it, because no one else in your company can approve payments. Nothing has moved yet.'
        : 'Waiting for a second person in your company to approve it. Nothing has moved yet.';
    case 'REJECTED':
      return 'Declined by the approver. Nothing was moved.';
    case 'DRAFT':
    case 'PRECHECKED':
      return 'Sending. Our banking partner did not answer yet. We will not send it twice.';
    case 'SUBMITTED':
    case 'BANK_REVIEW':
      return bankReference ? `Sent. Bank reference ${bankReference}.` : 'Sent. The bank reference follows.';
    case 'SETTLED':
      return 'Settled.';
    default:
      return human(state);
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
          Decline
        </Button>
        <Button
          data-testid="payment-approve"
          disabled={busy}
          onClick={() => void act(() => api.approvePayment(id))}
        >
          Approve
        </Button>
      </div>
    </>
  );
}

export function PaymentDetail({ id }: { id: string }) {
  const { api, can } = useSession();
  const [n, setN] = useState(0);
  const payment = useAsync(() => api.payment(id), [api, id, n]);
  return (
    <Load state={payment} label="payment">
      {(p) => (
        <Card
          title={
            <>
              Payment <Amt value={p.amount} />
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
                label: 'Status',
                value: <StatusChip status={stateStatus(p.state)}>{human(p.state)}</StatusChip>,
              },
              {
                label: 'Rail',
                value: p.fundingSourceId
                  ? 'ACH debit from your account at another bank'
                  : p.toAccountId
                    ? 'Internal transfer'
                    : 'ACH',
              },
              { label: 'Reference', value: p.reference ?? 'None' },
              { label: 'Bank reference', value: p.providerReference ?? 'Not yet' },
              ...(p.state === 'RETURNED'
                ? [
                    {
                      label: 'Returned by the bank',
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
          <Stepper
            label="Payment timeline"
            items={p.timeline.map((t, i) => ({
              id: `${i}`,
              label: human(t.to),
              statusText: formatDate(t.at, { time: true }),
              status: stateStatus(t.to),
              current: i === p.timeline.length - 1,
            }))}
          />
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
  const [kind, setKind] = useState(q.get('kind') === 'internal' ? 'internal' : 'ach');
  const [from, setFrom] = useState(q.get('from') ?? '');
  const [toAccount, setToAccount] = useState(q.get('to') ?? '');
  const [recipient, setRecipient] = useState(q.get('recipient') ?? '');
  const [amount, setAmount] = useState(() => {
    const m = Number(q.get('amount'));
    return Number.isSafeInteger(m) && m > 0 ? minorToDecimal({ amountMinor: m, currency: 'USD' }) : '';
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
      <Load state={accounts.status !== 'success' ? accounts : (recipients as never)} label="accounts">
        {() => null}
      </Load>
    );
  }
  // Money moves only from and to an ACTIVE account (the API also sends OPENING, FROZEN, RESTRICTED, CLOSING, CLOSED).
  const accs = accounts.data.filter((a) => a.status === 'ACTIVE');
  // A prefilled value (from a draft or a link) counts only when it is one of the options on screen.
  const fromId = accs.some((a) => a.id === from) ? from : accs[0]?.id || '';
  const minor = decimalToMinor(amount, 'USD');
  // ongem-core refuses only a BLOCKED payee: a new recipient stays PENDING until the bank checks it on the first payment,
  // so holding payments to CLEAR ones only would leave every new recipient unpayable.
  const payable = recipients.data.filter((r) => r.screening !== 'BLOCKED');
  const toId = accs.some((a) => a.id === toAccount && a.id !== fromId) ? toAccount : '';
  const recipientId = payable.some((r) => r.id === recipient) ? recipient : '';
  const target = kind === 'internal' ? toId : recipientId;
  const valid = Boolean(fromId && target && minor);
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
          rail: kind === 'internal' ? 'BOOK' : 'ACH',
          achTiming: kind === 'internal' ? null : 'STANDARD',
          recipientId: kind === 'internal' ? null : recipientId,
          toAccountId: kind === 'internal' ? toId : null,
          amountMinor: minor,
          currency: 'USD',
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
      <Card title="Review the payment" data-testid="payment-review">
        <KeyValue
          items={[
            {
              label: 'Amount',
              value: <span data-mask="">{formatMinor({ amountMinor: minor, currency: 'USD' })}</span>,
            },
            {
              label: 'From',
              value: (
                <>
                  {fromA?.name} <Last4 value={fromA?.last4} />
                </>
              ),
            },
            {
              label: 'To',
              value:
                kind === 'internal'
                  ? accs.find((a) => a.id === toId)?.name
                  : payable.find((r) => r.id === recipientId)?.name,
            },
            {
              label: 'How',
              value:
                kind === 'internal' ? 'Internal transfer, right away' : 'Standard ACH, 1 to 2 business days',
            },
          ]}
        />
        <p>
          The bank checks the live balance right before it leaves. You confirm it is you before it is sent.
        </p>
        {error && <Notice status="failure">{error}</Notice>}
        <div className="fw-actions">
          <Button variant="secondary" disabled={busy} onClick={change}>
            Change
          </Button>
          <Button data-testid="payment-send" disabled={busy} onClick={() => void send()}>
            Send
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card title="New payment" data-testid="payment-form">
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setReview(true);
        }}
      >
        <Field label="Type">
          <Select
            data-testid="payment-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={[
              { value: 'ach', label: 'ACH to a recipient' },
              { value: 'internal', label: 'Transfer between my accounts' },
            ]}
          />
        </Field>
        <Field label="From">
          <Select
            data-testid="payment-from"
            data-mask=""
            value={fromId}
            onChange={(e) => setFrom(e.target.value)}
            options={accs.map((a) => ({ value: a.id, label: `${a.name} ending ${a.last4 ?? ''}` }))}
          />
        </Field>
        {kind === 'internal' ? (
          <Field label="To account">
            <Select
              data-testid="payment-to-account"
              value={toId}
              onChange={(e) => setToAccount(e.target.value)}
              options={[
                { value: '', label: 'Choose an account' },
                ...accs.filter((a) => a.id !== fromId).map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </Field>
        ) : (
          <Field
            label="Recipient"
            hint={
              !payable.length
                ? 'Add a recipient first.'
                : payable.some((r) => r.id === recipientId && r.screening === 'PENDING')
                  ? 'Checked by the bank with the first payment.'
                  : undefined
            }
          >
            <Select
              data-testid="payment-recipient"
              value={recipientId}
              onChange={(e) => setRecipient(e.target.value)}
              options={[
                { value: '', label: 'Choose a recipient' },
                ...payable.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </Field>
        )}
        <Field label="Amount in US$" error={amount && !minor ? 'Enter an amount like 1,250.00' : undefined}>
          <Input
            data-testid="payment-amount"
            data-mask=""
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Reference (optional)">
          <Input
            data-testid="payment-reference"
            maxLength={80}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <div className="fw-actions">
          <Button type="submit" data-testid="payment-review-button" disabled={!valid}>
            Review
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
  const [pages, setPages] = useState<string[]>([]);
  const list = useAsync(async () => {
    const first = await api.payments(null, 20);
    let items = first.items;
    let next = first.next;
    for (const c of pages) {
      const page = await api.payments(c, 20);
      items = [...items, ...page.items];
      next = page.next;
    }
    return { items, next };
  }, [api, pages, isNew]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  const detail = isNew || isTopUp || isSchedules || Boolean(id);
  return (
    <>
      <PageHeader
        title="Payments"
        actions={
          <div className="fw-actions">
            <Link
              to="/recipients"
              className="og-btn og-btn--secondary og-btn--md"
              data-testid="payments-recipients"
            >
              Recipients
            </Link>
            {can(Permission.PAYMENT_VIEW) && (
              <Button
                variant="secondary"
                data-testid="scheduled"
                onClick={() => navigate('/payments/schedules')}
              >
                Scheduled
              </Button>
            )}
            {can(Permission.PAYMENT_VIEW) && (
              <Button
                variant="secondary"
                data-testid="add-money"
                onClick={() => navigate('/payments/top-up')}
              >
                Add money
              </Button>
            )}
            {can(Permission.PAYMENT_CREATE) && (
              <Button data-testid="new-payment" onClick={() => navigate('/payments/new')}>
                New payment
              </Button>
            )}
          </div>
        }
      />
      <div className={`fw-split${detail ? ' has-detail' : ''}`}>
        <div className="fw-split__list">
          <Load state={list} label="payments">
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
                              {p.fundingSourceId ? 'Top-up' : p.toAccountId ? 'Internal transfer' : 'ACH'}{' '}
                              {p.createdAt ? `· ${formatDate(p.createdAt)}` : ''}
                            </span>
                          </span>
                          <span className="fw-row__main">
                            <Amt value={p.amount} />
                            <StatusChip status={stateStatus(p.state)}>{human(p.state)}</StatusChip>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {page.next && (
                    <Button
                      variant="secondary"
                      data-testid="payments-more"
                      onClick={() => setPages((x) => [...x, page.next as string])}
                    >
                      Show more
                    </Button>
                  )}
                </>
              ) : (
                <EmptyState title="No payments yet">
                  Payments you send show here with their status from the bank.
                </EmptyState>
              )
            }
          </Load>
        </div>
        <div>
          {detail && (
            <Button variant="ghost" onClick={() => navigate('/payments')}>
              Back to payments
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
              <Notice status="info">Your role does not allow this. An owner of the company can do it.</Notice>
            )
          ) : id ? (
            <PaymentDetail id={id} />
          ) : null}
        </div>
      </div>
    </>
  );
}

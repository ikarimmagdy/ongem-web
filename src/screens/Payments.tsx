import { useState } from 'react';
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

/** Called after a payment the founder sent from this form, so a drafted action can be confirmed (OG-031). */
export type OnSent = (payment: Payment) => void | Promise<void>;

function to(p: Payment, accounts: Account[], recipients: Recipient[]) {
  if (p.toAccountId) {
    const a = accounts.find((x) => x.id === p.toAccountId);
    return a ? `${a.name}` : 'Your account';
  }
  return recipients.find((r) => r.id === p.recipientId)?.name ?? 'Recipient';
}

export function PaymentDetail({ id }: { id: string }) {
  const { api } = useSession();
  const payment = useAsync(() => api.payment(id), [api, id]);
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
          <KeyValue
            items={[
              {
                label: 'Status',
                value: <StatusChip status={stateStatus(p.state)}>{human(p.state)}</StatusChip>,
              },
              { label: 'Rail', value: p.toAccountId ? 'Internal transfer' : 'ACH' },
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
export function NewPayment({ onSent }: { onSent?: OnSent }) {
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
  const [amount, setAmount] = useState(
    q.get('amount') ? minorToDecimal({ amountMinor: Number(q.get('amount')), currency: 'USD' }) : '',
  );
  const [reference, setReference] = useState(q.get('ref') ?? '');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (accounts.status !== 'success' || recipients.status !== 'success') {
    return (
      <Load state={accounts.status !== 'success' ? accounts : (recipients as never)} label="accounts">
        {() => null}
      </Load>
    );
  }
  const accs = accounts.data;
  const fromId = from || accs[0]?.id || '';
  const minor = decimalToMinor(amount, 'USD');
  const clear = recipients.data.filter((r) => r.screening === 'CLEAR');
  const target = kind === 'internal' ? toAccount : recipient;
  const valid = Boolean(fromId && target && minor && (kind !== 'internal' || toAccount !== fromId));
  const send = async () => {
    if (!minor) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await api.createPayment({
        fromAccountId: fromId,
        rail: kind === 'internal' ? 'BOOK' : 'ACH',
        achTiming: kind === 'internal' ? null : 'STANDARD',
        recipientId: kind === 'internal' ? null : recipient,
        toAccountId: kind === 'internal' ? toAccount : null,
        amountMinor: minor,
        currency: 'USD',
        reference: reference.trim() || null,
      });
      const sent = await api.sendPayment(draft.id);
      await onSent?.(sent);
      await drafts.done(['PAYMENT', 'INTERNAL_TRANSFER'], sent.id);
      navigate(`/payments/${sent.id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
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
                  ? accs.find((a) => a.id === toAccount)?.name
                  : clear.find((r) => r.id === recipient)?.name,
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
          <Button variant="secondary" onClick={() => setReview(false)}>
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
              value={toAccount}
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
              clear.length
                ? undefined
                : 'Add a recipient first; only recipients the bank cleared can be paid.'
            }
          >
            <Select
              data-testid="payment-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              options={[
                { value: '', label: 'Choose a recipient' },
                ...clear.map((r) => ({ value: r.id, label: r.name })),
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

export function PaymentsScreen({ onSent }: { onSent?: OnSent }) {
  const { api, can } = useSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/payments/new');
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
  }, [api, pages]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  const detail = isNew || Boolean(id);
  return (
    <>
      <PageHeader
        title="Payments"
        actions={
          <div className="fw-actions">
            <Link to="/recipients">Recipients</Link>
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
                              {p.toAccountId ? 'Internal transfer' : 'ACH'}{' '}
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
          {isNew ? (
            can(Permission.PAYMENT_CREATE) ? (
              <NewPayment onSent={onSent} />
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

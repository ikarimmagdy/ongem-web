import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import type { Account, FundingSource } from '../api/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Notice,
  Select,
  StatusChip,
  type Status,
} from '../design-system';
import { decimalToMinor, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Last4, Load } from './common';

/** A funding source's state in words, the same as the app's (G-40). */
export function fundingState(state: string): { status: Status; text: string } {
  switch (state.toUpperCase()) {
    case 'VERIFIED':
      return { status: 'success', text: 'Verified' };
    case 'UNVERIFIED':
      return { status: 'pending', text: 'Waiting for the bank to verify it' };
    default:
      return { status: 'neutral', text: 'Removed' };
  }
}

export const fundingName = (f: FundingSource) => f.nickname?.trim() || 'Account at another bank';

/** Runs one write at a time, with its error line. */
function useOnce() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const run = async (f: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** Typed in (MANUAL): the bank verifies it before money can be pulled. The account number is cleared once sent. */
function LinkAccount({ accounts, onLinked }: { accounts: Account[]; onLinked(): void }) {
  const { api } = useSession();
  const { busy, error, run } = useOnce();
  const [accountId, setAccountId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [routing, setRouting] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState<'CHECKING' | 'SAVINGS'>('CHECKING');
  const [nickname, setNickname] = useState('');
  const to = accounts.some((a) => a.id === accountId) ? accountId : (accounts[0]?.id ?? '');
  const valid = Boolean(to && ownerName.trim() && /^\d{9}$/.test(routing) && /^\d{4,17}$/.test(number));
  const link = () =>
    run(async () => {
      await api.linkFundingSource({
        accountId: to,
        method: 'MANUAL',
        accountNumber: number,
        routingNumber: routing,
        accountType: type,
        ownerName: ownerName.trim(),
        nickname: nickname.trim() || null,
      });
      setNumber('');
      setRouting('');
      onLinked();
    });
  return (
    <Card title="Link an account at another bank" data-testid="funding-link-form">
      <p>
        Use an account your company owns. The bank verifies it before you can pull money from it, which can
        take a few business days.
      </p>
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void link();
        }}
      >
        <Field label="For the OnGem account">
          <Select
            data-testid="funding-link-account"
            value={to}
            onChange={(e) => setAccountId(e.target.value)}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} ending ${a.last4 ?? ''}` }))}
          />
        </Field>
        <Field label="Name on the account">
          <Input
            data-testid="funding-link-owner"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </Field>
        <Field label="Routing number" hint="9 digits">
          <Input
            data-testid="funding-link-routing"
            inputMode="numeric"
            autoComplete="off"
            maxLength={9}
            value={routing}
            onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Account number" hint="Only the last four are kept.">
          <Input
            data-testid="funding-link-number"
            data-mask=""
            inputMode="numeric"
            autoComplete="off"
            maxLength={17}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Account type">
          <Select
            data-testid="funding-link-type"
            value={type}
            onChange={(e) => setType(e.target.value as 'CHECKING' | 'SAVINGS')}
            options={[
              { value: 'CHECKING', label: 'Checking' },
              { value: 'SAVINGS', label: 'Savings' },
            ]}
          />
        </Field>
        <Field label="Nickname (optional)">
          <Input
            data-testid="funding-link-nickname"
            maxLength={40}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </Field>
        {error && <Notice status="failure">{error}</Notice>}
        <div className="fw-actions">
          <Button type="submit" data-testid="funding-link-save" disabled={!valid || busy}>
            Link account
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** The top-up: from a verified account at another bank into an OnGem account, reviewed, then confirmed with step-up. */
function TopUpForm({ sources, accounts }: { sources: FundingSource[]; accounts: Account[] }) {
  const { api } = useSession();
  const navigate = useNavigate();
  const { busy, error, run } = useOnce();
  const verified = sources.filter((f) => f.state === 'VERIFIED');
  const [source, setSource] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [review, setReview] = useState(false);
  const fromId = verified.some((f) => f.id === source) ? source : (verified[0]?.id ?? '');
  const from = verified.find((f) => f.id === fromId);
  const toId = accounts.some((a) => a.id === to) ? to : (from?.accountId ?? accounts[0]?.id ?? '');
  const minor = decimalToMinor(amount, 'USD');
  const valid = Boolean(fromId && toId && minor);
  if (!verified.length) {
    return (
      <Notice status="info">
        <span data-testid="topup-none-verified">
          Top-ups need an account the bank has verified. Link one, then check back once it shows Verified.
        </span>
      </Notice>
    );
  }
  const send = () =>
    run(async () => {
      if (!minor) return;
      const p = await api.createTopUp({
        fundingSourceId: fromId,
        toAccountId: toId,
        amountMinor: minor,
        currency: 'USD',
        reference: reference.trim() || null,
      });
      navigate(`/payments/${p.id}`);
    });
  if (review && minor && from) {
    const toA = accounts.find((a) => a.id === toId);
    return (
      <Card title="Review the top-up" data-testid="topup-review">
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
                  {fundingName(from)} <Last4 value={from.last4} />
                </>
              ),
            },
            {
              label: 'To',
              value: (
                <>
                  {toA?.name} <Last4 value={toA?.last4} />
                </>
              ),
            },
            { label: 'How', value: 'ACH debit, 1 to 3 business days' },
          ]}
        />
        <p>
          A second person in your company approves it before the bank pulls the money. If no one else in your
          company can approve, OnGem approves it. You confirm it is you first.
        </p>
        {error && <Notice status="failure">{error}</Notice>}
        <div className="fw-actions">
          <Button variant="secondary" disabled={busy} onClick={() => setReview(false)}>
            Change
          </Button>
          <Button data-testid="topup-send" disabled={busy} onClick={() => void send()}>
            Top up
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card title="Top up" data-testid="topup-form">
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setReview(true);
        }}
      >
        <Field label="From">
          <Select
            data-testid="topup-from"
            value={fromId}
            onChange={(e) => setSource(e.target.value)}
            options={verified.map((f) => ({ value: f.id, label: `${fundingName(f)} ending ${f.last4}` }))}
          />
        </Field>
        <Field label="To">
          <Select
            data-testid="topup-to"
            value={toId}
            onChange={(e) => setTo(e.target.value)}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} ending ${a.last4 ?? ''}` }))}
          />
        </Field>
        <Field
          label="Amount in US$"
          hint="Up to US$25,000.00 a top-up and US$50,000.00 a day."
          error={amount && !minor ? 'Enter an amount like 1,250.00' : undefined}
        >
          <Input
            data-testid="topup-amount"
            data-mask=""
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Reference (optional)">
          <Input
            data-testid="topup-reference"
            maxLength={80}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <div className="fw-actions">
          <Button type="submit" data-testid="topup-review-button" disabled={!valid}>
            Review
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * G-40, add money: the company's own accounts at other banks (linked, verified by the bank, removed) and a top-up by
 * ACH debit from a verified one. The top-up is a payment; its detail shows the approval and the bank's progress.
 */
export function TopUp() {
  const { api, can } = useSession();
  const [n, setN] = useState(0);
  const refresh = () => setN((x) => x + 1);
  const sources = useAsync(() => api.fundingSources(), [api, n]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const { busy, error, run } = useOnce();
  const accs = accounts.status === 'success' ? accounts.data.filter((a) => a.status === 'ACTIVE') : [];
  const check = (id: string) => run(async () => void (await api.fundingSource(id)).id).then(refresh);
  const remove = (id: string) => run(async () => void (await api.removeFundingSource(id)).id).then(refresh);
  return (
    <div className="fw-stack" data-testid="topup">
      <Card title="Your accounts at other banks">
        <Load state={sources} label="accounts at other banks">
          {(list) =>
            list.length ? (
              <ul className="fw-list" data-testid="funding-list">
                {list.map((f) => {
                  const s = fundingState(f.state);
                  return (
                    <li key={f.id} className="fw-row" data-testid={`funding-${f.id}`}>
                      <span className="fw-row__main">
                        <strong>{fundingName(f)}</strong>
                        <span className="fw-row__sub">
                          <Last4 value={f.last4} /> {f.accountType ? f.accountType.toLowerCase() : ''}
                        </span>
                      </span>
                      <span className="fw-row__main">
                        <StatusChip status={s.status}>
                          <span data-testid={`funding-${f.id}-state`}>{s.text}</span>
                        </StatusChip>
                        {f.state === 'UNVERIFIED' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            data-testid={`funding-check-${f.id}`}
                            disabled={busy}
                            onClick={() => void check(f.id)}
                          >
                            Check again
                          </Button>
                        )}
                        {can(Permission.RECIPIENT_MANAGE) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`funding-remove-${f.id}`}
                            disabled={busy}
                            onClick={() => void remove(f.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="No accounts linked yet">
                Link your company's account at another bank to move money into OnGem.
              </EmptyState>
            )
          }
        </Load>
        {error && <Notice status="failure">{error}</Notice>}
      </Card>
      {can(Permission.PAYMENT_CREATE) && sources.status === 'success' && (
        <TopUpForm sources={sources.data} accounts={accs} />
      )}
      {can(Permission.RECIPIENT_MANAGE) && accs.length > 0 && (
        <LinkAccount accounts={accs} onLinked={refresh} />
      )}
    </div>
  );
}

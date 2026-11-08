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
import { has, t } from '../i18n';
import { decimalToMinor, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { normaliseIban, uaeIbanValid } from '../lib/iban';
import { IS_AE, REGION_CONFIG } from '../region';
import { useSession } from '../session';
import { AcctLast4, Load } from './common';

/** A funding source's state in words, the same as the app's (G-40). */
export function fundingState(state: string): { status: Status; text: string } {
  switch (state.toUpperCase()) {
    case 'VERIFIED':
      return { status: 'success', text: t('app.topup.state.verified') };
    case 'UNVERIFIED':
      return { status: 'pending', text: t('app.topup.state.unverified') };
    default:
      return { status: 'neutral', text: t('app.topup.state.removed') };
  }
}

export const fundingName = (f: FundingSource) => f.nickname?.trim() || t('app.topup.account_at_other_bank');

/** An account type in words, as the list shows it; a type the web does not know shows as the API sends it. */
const accountTypeText = (type: string) => {
  const key = `app.topup.type.${type.toLowerCase()}`;
  return has(key) ? t(key) : type.toLowerCase();
};

const accountOption = (a: Account) => ({
  value: a.id,
  label: t('app.topup.account_ending', { name: a.name, last4: a.last4 ?? '' }),
});

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
  const valid = Boolean(
    to &&
    ownerName.trim() &&
    (IS_AE ? uaeIbanValid(number) : /^\d{9}$/.test(routing) && /^\d{4,17}$/.test(number)),
  );
  const link = () =>
    run(async () => {
      const common = {
        accountId: to,
        method: 'MANUAL' as const,
        ownerName: ownerName.trim(),
        nickname: nickname.trim() || null,
      };
      await api.linkFundingSource(
        IS_AE
          ? { ...common, iban: normaliseIban(number), accountType: 'CURRENT' }
          : { ...common, accountNumber: number, routingNumber: routing, accountType: type },
      );
      setNumber('');
      setRouting('');
      onLinked();
    });
  return (
    <Card title={t('app.topup.link.title')} data-testid="funding-link-form">
      <p>{t('app.topup.link.intro')}</p>
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void link();
        }}
      >
        <Field label={t('app.topup.link.for_account')}>
          <Select
            data-testid="funding-link-account"
            value={to}
            onChange={(e) => setAccountId(e.target.value)}
            options={accounts.map(accountOption)}
          />
        </Field>
        <Field label={t('app.topup.link.owner')}>
          <Input
            data-testid="funding-link-owner"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </Field>
        {IS_AE ? (
          <Field label={t('app.topup.link.iban')} hint={t('app.topup.link.iban_hint')}>
            <Input
              data-testid="funding-link-iban"
              data-mask=""
              autoComplete="off"
              maxLength={29}
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
            />
          </Field>
        ) : (
          <>
            <Field label={t('app.topup.link.routing')} hint={t('app.topup.link.routing_hint')}>
              <Input
                data-testid="funding-link-routing"
                inputMode="numeric"
                autoComplete="off"
                maxLength={9}
                value={routing}
                onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label={t('app.topup.link.number')} hint={t('app.topup.link.number_hint')}>
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
            <Field label={t('app.topup.link.type')}>
              <Select
                data-testid="funding-link-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'CHECKING' | 'SAVINGS')}
                options={[
                  { value: 'CHECKING', label: t('app.topup.link.checking') },
                  { value: 'SAVINGS', label: t('app.topup.link.savings') },
                ]}
              />
            </Field>
          </>
        )}
        <Field label={t('app.topup.link.nickname')}>
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
            {t('app.topup.link.save')}
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
  const minor = decimalToMinor(amount, REGION_CONFIG.currency);
  const valid = Boolean(fromId && toId && minor);
  if (!verified.length) {
    return (
      <Notice status="info">
        <span data-testid="topup-none-verified">{t('app.topup.none_verified')}</span>
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
        currency: REGION_CONFIG.currency,
        reference: reference.trim() || null,
      });
      navigate(`/payments/${p.id}`);
    });
  if (review && minor && from) {
    const toA = accounts.find((a) => a.id === toId);
    return (
      <Card title={t('app.topup.review.title')} data-testid="topup-review">
        <KeyValue
          items={[
            {
              label: t('app.topup.review.amount'),
              value: (
                <span data-mask="">
                  {formatMinor({ amountMinor: minor, currency: REGION_CONFIG.currency })}
                </span>
              ),
            },
            {
              label: t('app.topup.review.from'),
              value: (
                <>
                  {fundingName(from)} <AcctLast4 value={from.last4} />
                </>
              ),
            },
            {
              label: t('app.topup.review.to'),
              value: (
                <>
                  {toA?.name} <AcctLast4 value={toA?.last4} />
                </>
              ),
            },
            { label: t('app.topup.review.how'), value: REGION_CONFIG.topUpHow },
          ]}
        />
        <p>{t('app.topup.review.note')}</p>
        {error && <Notice status="failure">{error}</Notice>}
        <div className="fw-actions">
          <Button variant="secondary" disabled={busy} onClick={() => setReview(false)}>
            {t('app.topup.review.change')}
          </Button>
          <Button data-testid="topup-send" disabled={busy} onClick={() => void send()}>
            {t('app.topup.top_up')}
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card title={t('app.topup.top_up')} data-testid="topup-form">
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setReview(true);
        }}
      >
        <Field label={t('app.topup.review.from')}>
          <Select
            data-testid="topup-from"
            value={fromId}
            onChange={(e) => setSource(e.target.value)}
            options={verified.map((f) => ({
              value: f.id,
              label: t('app.topup.account_ending', { name: fundingName(f), last4: f.last4 ?? '' }),
            }))}
          />
        </Field>
        <Field label={t('app.topup.review.to')}>
          <Select
            data-testid="topup-to"
            value={toId}
            onChange={(e) => setTo(e.target.value)}
            options={accounts.map(accountOption)}
          />
        </Field>
        <Field
          label={REGION_CONFIG.amountLabel}
          hint={t('app.topup.form.limits', {
            per_topup: formatMinor({
              amountMinor: REGION_CONFIG.topUpLimit,
              currency: REGION_CONFIG.currency,
            }),
            per_day: formatMinor({
              amountMinor: REGION_CONFIG.topUpDailyLimit,
              currency: REGION_CONFIG.currency,
            }),
          })}
          error={amount && !minor ? t('app.topup.form.amount_error') : undefined}
        >
          <Input
            data-testid="topup-amount"
            data-mask=""
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t('app.topup.form.reference')}>
          <Input
            data-testid="topup-reference"
            maxLength={80}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <div className="fw-actions">
          <Button type="submit" data-testid="topup-review-button" disabled={!valid}>
            {t('app.topup.form.review')}
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
      <Card title={t('app.topup.sources.title')}>
        <Load state={sources} label={t('app.topup.loading.sources')}>
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
                          <AcctLast4 value={f.last4} /> {f.accountType ? accountTypeText(f.accountType) : ''}
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
                            {t('app.topup.check_again')}
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
                            {t('app.topup.remove')}
                          </Button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title={t('app.topup.empty.title')}>{t('app.topup.empty.text')}</EmptyState>
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

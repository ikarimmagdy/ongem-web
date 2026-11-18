import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errorText } from '../api/errors';
import type { Account, FxQuote, Movement } from '../api/types';
import { Button, Card, Field, KeyValue, Notice, Select } from '../design-system';
import { decimalToMinor, formatMinor } from '../lib/format';
import { bankOf, institutionLabel } from '../lib/fx';
import { useAsync } from '../lib/useAsync';
import { t } from '../i18n';
import { useSession } from '../session';
import { Load } from './common';
import { MoneyInput, QuoteLines, useCountdown } from './fxCommon';

/**
 * How a conversion from [from] into [to] is funded (contract 6.1): one bank needs nothing more; across banks the money
 * first moves to the company's own account in the sold currency at the bank holding [to], which must have local details.
 * `missing` when there is no such account yet.
 */
export function viaFor(
  from: Account,
  to: Account,
  accounts: Account[],
): { via: Account | null; missing: boolean } {
  if (bankOf(from) === bankOf(to)) return { via: null, missing: false };
  const via = accounts.find(
    (a) =>
      a.id !== from.id &&
      a.status === 'ACTIVE' &&
      a.currency === from.currency &&
      bankOf(a) === bankOf(to) &&
      Boolean(a.receiving),
  );
  return { via: via ?? null, missing: !via };
}

const label = (a: Account) => t('app.fx.account_option', { name: a.name, currency: a.currency });

/** OG-054: convert between own accounts. Quote (rate, fee, margin apart, expiry), accept with step-up, then track it. */
export function ConvertScreen() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [q] = useSearchParams();
  const accounts = useAsync(() => api.accounts(), [api]);
  const [from, setFrom] = useState(q.get('from') ?? '');
  const [to, setTo] = useState(q.get('to') ?? '');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const left = useCountdown(quote);
  // The movement made from an accepted quote: a failed submit is retried on it, never a second movement.
  const made = useRef<Movement | null>(null);
  return (
    <Load state={accounts} label="accounts">
      {(all) => {
        const accs = all.filter((a) => a.status === 'ACTIVE');
        const fromA = accs.find((a) => a.id === from) ?? accs[0];
        const targets = accs.filter((a) => fromA && a.currency !== fromA.currency);
        const toA = targets.find((a) => a.id === to);
        const minor = fromA ? decimalToMinor(amount, fromA.currency) : null;
        const available = fromA?.balance?.available;
        const over = Boolean(minor && available && minor > available.amountMinor);
        const route = fromA && toA ? viaFor(fromA, toA, accs) : null;
        const reset = () => {
          setQuote(null);
          made.current = null;
          setFailure(null);
        };
        const ask = async () => {
          setTried(true);
          if (!fromA || !toA || !minor || over || route?.missing) return;
          setBusy(true);
          setFailure(null);
          try {
            setQuote(
              await api.createQuote({
                sellCurrency: fromA.currency,
                buyCurrency: toA.currency,
                side: 'SELL',
                amountMinor: minor,
                toAccountId: toA.id,
              }),
            );
          } catch (e) {
            setFailure(errorText(e));
          } finally {
            setBusy(false);
          }
        };
        const accept = async () => {
          if (!quote || !fromA || !toA) return;
          setBusy(true);
          setFailure(null);
          try {
            if (!made.current) {
              await api.acceptQuote(quote.id);
              made.current = await api.createMovement({
                intent: 'CONVERT',
                fromAccountId: fromA.id,
                viaAccountId: route?.via?.id ?? null,
                toAccountId: toA.id,
                quoteId: quote.id,
              });
            }
            const sent = await api.submitMovement(made.current.id);
            navigate(`/payments/movements/${sent.id}?sent=1`);
          } catch (e) {
            setFailure(errorText(e));
          } finally {
            setBusy(false);
          }
        };
        if (targets.length === 0 && accs.length) {
          return (
            <Notice status="info">
              <span data-testid="convert-none">{t('app.fx.convert.none')}</span>
            </Notice>
          );
        }
        return (
          <div className="fw-send">
            <Card title={t('app.fx.convert.title')} data-testid="convert-form">
              {quote ? (
                <>
                  <QuoteLines quote={quote} left={left} />
                  {route?.via && (
                    <p className="fw-row__sub" data-testid="convert-via">
                      {t('app.fx.convert.via_note', {
                        via: route.via.name,
                        institution: institutionLabel(toA!) ?? t('app.fx.other_bank'),
                      })}
                    </p>
                  )}
                  <p className="fw-row__sub">{t('app.fx.convert.accept_note')}</p>
                  {failure && <Notice status="failure">{failure}</Notice>}
                  <div className="fw-actions">
                    <Button variant="secondary" disabled={busy} onClick={reset}>
                      {t('app.payments.review.change')}
                    </Button>
                    {left > 0 || made.current ? (
                      <Button data-testid="convert-accept" disabled={busy} onClick={() => void accept()}>
                        {t('app.fx.convert.accept')}
                      </Button>
                    ) : (
                      <Button data-testid="convert-requote" disabled={busy} onClick={() => void ask()}>
                        {t('app.fx.quote.again')}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <form
                  className="fw-form"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask();
                  }}
                >
                  <Field
                    label={t('app.fx.convert.from')}
                    hint={
                      available ? (
                        <span data-mask="">
                          {t('app.payments.form.available', { amount: formatMinor(available) })}
                        </span>
                      ) : undefined
                    }
                  >
                    <Select
                      data-testid="convert-from"
                      value={fromA?.id ?? ''}
                      onChange={(v) => {
                        setFrom(v);
                        setTo('');
                      }}
                      options={accs.map((a) => ({ value: a.id, label: label(a) }))}
                    />
                  </Field>
                  <Field
                    label={t('app.fx.convert.to')}
                    error={tried && !toA ? t('app.fx.convert.to_error') : undefined}
                  >
                    <Select
                      data-testid="convert-to"
                      value={toA?.id ?? ''}
                      onChange={setTo}
                      options={[
                        { value: '', label: t('app.payments.form.choose_account') },
                        ...targets.map((a) => ({ value: a.id, label: label(a) })),
                      ]}
                    />
                  </Field>
                  {route?.missing && fromA && toA && (
                    <Notice status="info">
                      <span data-testid="convert-via-missing">
                        {t('app.fx.convert.via_missing', {
                          currency: fromA.currency,
                          institution: institutionLabel(toA) ?? t('app.fx.other_bank'),
                        })}
                      </span>{' '}
                      <Link to={`/accounts?open=${fromA.currency}`}>{t('app.fx.convert.via_open')}</Link>
                    </Notice>
                  )}
                  <Field
                    label={t('app.fx.convert.amount', { currency: fromA?.currency ?? '' })}
                    error={
                      (amount || tried) && !minor
                        ? t('app.fx.amount_error', { currency: fromA?.currency ?? '' })
                        : over && available
                          ? t('app.payments.form.over_balance', { amount: formatMinor(available) })
                          : undefined
                    }
                  >
                    <MoneyInput
                      currency={fromA?.currency ?? ''}
                      data-testid="convert-amount"
                      data-mask=""
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>
                  {failure && <Notice status="failure">{failure}</Notice>}
                  <div className="fw-actions">
                    <Button type="submit" data-testid="convert-quote" disabled={busy || over}>
                      {t('app.fx.quote.get')}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
            <aside className="fw-send__summary" aria-label={t('app.payments.summary.title')}>
              <h2 className="og-card__title">{t('app.payments.summary.title')}</h2>
              <KeyValue
                items={[
                  {
                    label: t('app.fx.convert.from'),
                    value: fromA ? label(fromA) : t('app.payments.summary.not_chosen'),
                  },
                  {
                    label: t('app.fx.convert.to'),
                    value: toA ? label(toA) : t('app.payments.summary.not_chosen'),
                  },
                  {
                    label: t('app.fx.convert.where'),
                    value: toA
                      ? (institutionLabel(toA) ?? t('app.payments.summary.not_chosen'))
                      : t('app.payments.summary.not_chosen'),
                  },
                  {
                    label: t('app.payments.review.amount'),
                    value: (
                      <span data-mask="">
                        {minor && fromA
                          ? formatMinor({ amountMinor: minor, currency: fromA.currency })
                          : t('app.payments.summary.not_chosen')}
                      </span>
                    ),
                  },
                ]}
              />
            </aside>
          </div>
        );
      }}
    </Load>
  );
}

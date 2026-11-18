import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import type { Corridor, FxQuote, InternationalRecipient, Movement } from '../api/types';
import { Button, Card, Field, Input, KeyValue, Notice, Select } from '../design-system';
import { decimalToMinor, formatMinor } from '../lib/format';
import { corridorLabel, countryName, railName, settlementLine } from '../lib/fx';
import { useAsync } from '../lib/useAsync';
import { t } from '../i18n';
import { useSession } from '../session';
import { AcctLast4, Last4, Load } from './common';
import { MoneyInput, QuoteLines, useCountdown } from './fxCommon';
import { AddInternationalRecipient } from './InternationalRecipients';

export const ABROAD_STEPS = ['corridor', 'recipient', 'amount', 'quote'] as const;
type Step = (typeof ABROAD_STEPS)[number];

/** Whether [minor] is inside the corridor's limits per payment (destination currency, what the beneficiary receives). */
export function withinCorridor(c: Corridor, minor: number | null): 'low' | 'high' | 'ok' | null {
  if (!minor) return null;
  if (minor < c.minAmount.amountMinor) return 'low';
  if (minor > c.maxAmount.amountMinor) return 'high';
  return 'ok';
}

/** The recipients that fit a corridor: its destination country and currency. */
export const fitting = (rs: InternationalRecipient[], c: Corridor) =>
  rs.filter(
    (r) =>
      r.status === 'ACTIVE' && r.country === c.destinationCountry && r.currency === c.destinationCurrency,
  );

/**
 * OG-054 send abroad: a corridor the API offers, a recipient that fits it, an amount within its limits and a quote;
 * accept with step-up, and the movement goes through the approval rules before its legs run.
 */
export function SendAbroadScreen() {
  const { api, can } = useSession();
  const navigate = useNavigate();
  const [n, setN] = useState(0);
  const data = useAsync(async () => {
    const [corridors, recipients, accounts] = await Promise.all([
      api.corridors(),
      api.internationalRecipients(),
      api.accounts(),
    ]);
    return { corridors, recipients, accounts };
  }, [api, n]);
  const [step, setStep] = useState<Step>('corridor');
  const [corridorId, setCorridorId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const made = useRef<Movement | null>(null);
  const left = useCountdown(quote);
  const go = (s: Step) => {
    setTried(false);
    setFailure(null);
    if (s !== 'quote') {
      setQuote(null);
      made.current = null;
    }
    setStep(s);
  };
  return (
    <Load state={data} label="payments">
      {({ corridors, recipients, accounts }) => {
        if (!corridors.length)
          return (
            <Notice status="info">
              <span data-testid="abroad-off">{t('app.fx.abroad.off')}</span>
            </Notice>
          );
        const corridor = corridors.find((c) => c.id === corridorId);
        const fits = corridor ? fitting(recipients, corridor) : [];
        const recipient = fits.find((r) => r.id === recipientId);
        const sources = corridor
          ? accounts.filter((a) => a.status === 'ACTIVE' && a.currency === corridor.sourceCurrency)
          : [];
        const fromA = sources.find((a) => a.id === from) ?? sources[0];
        const minor = corridor ? decimalToMinor(amount, corridor.destinationCurrency) : null;
        const range = corridor ? withinCorridor(corridor, minor) : null;
        const index = ABROAD_STEPS.indexOf(step) + 1;
        const ask = async () => {
          setTried(true);
          if (!corridor || !fromA || !minor || range !== 'ok') return;
          setBusy(true);
          setFailure(null);
          try {
            setQuote(
              await api.createQuote({
                sellCurrency: corridor.sourceCurrency,
                buyCurrency: corridor.destinationCurrency,
                side: 'BUY',
                amountMinor: minor,
                corridorId: corridor.id,
              }),
            );
            made.current = null;
            setStep('quote');
          } catch (e) {
            setFailure(errorText(e));
          } finally {
            setBusy(false);
          }
        };
        const accept = async () => {
          if (!quote || !corridor || !recipient || !fromA) return;
          setBusy(true);
          setFailure(null);
          try {
            if (!made.current) {
              await api.acceptQuote(quote.id);
              made.current = await api.createMovement({
                intent: 'PAY_ABROAD',
                fromAccountId: fromA.id,
                corridorId: corridor.id,
                recipientId: recipient.id,
                quoteId: quote.id,
                reference: reference.trim() || null,
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
        return (
          <div className="fw-send">
            <Card
              title={t('app.fx.abroad.title')}
              data-testid="abroad-form"
              actions={
                <span className="fw-row__sub" data-testid="abroad-step">
                  {t('app.fx.abroad.step', { step: index, total: ABROAD_STEPS.length })}
                </span>
              }
            >
              {step === 'corridor' && (
                <form
                  className="fw-form"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    setTried(true);
                    if (corridor) go('recipient');
                  }}
                >
                  <Field
                    label={t('app.fx.abroad.corridor')}
                    hint={
                      corridor ? (settlementLine(corridor) ?? undefined) : t('app.fx.abroad.corridor_hint')
                    }
                    error={tried && !corridor ? t('app.fx.abroad.corridor_error') : undefined}
                  >
                    <Select
                      data-testid="abroad-corridor"
                      value={corridorId}
                      onChange={(v) => {
                        setCorridorId(v);
                        setRecipientId('');
                        setAmount('');
                      }}
                      options={[
                        { value: '', label: t('app.fx.abroad.choose_corridor') },
                        ...corridors.map((c) => ({ value: c.id, label: corridorLabel(c) })),
                      ]}
                    />
                  </Field>
                  {corridor && (
                    <p className="fw-row__sub" data-testid="abroad-limits">
                      {t('app.fx.abroad.limits', {
                        min: formatMinor(corridor.minAmount),
                        max: formatMinor(corridor.maxAmount),
                      })}
                    </p>
                  )}
                  <div className="fw-actions">
                    <Button type="submit" data-testid="abroad-next-corridor">
                      {t('app.fx.next')}
                    </Button>
                  </div>
                </form>
              )}
              {step === 'recipient' && corridor && (
                <div className="fw-form">
                  {adding ? (
                    <AddInternationalRecipient
                      corridors={[corridor]}
                      corridorId={corridor.id}
                      onCancel={() => setAdding(false)}
                      onAdded={(r) => {
                        setAdding(false);
                        setRecipientId(r.id);
                        setN((x) => x + 1);
                      }}
                    />
                  ) : (
                    <>
                      <Field
                        label={t('app.fx.abroad.recipient')}
                        hint={
                          fits.length
                            ? t('app.fx.abroad.recipient_hint', {
                                country: countryName(corridor.destinationCountry),
                                currency: corridor.destinationCurrency,
                              })
                            : t('app.fx.abroad.recipient_none')
                        }
                        error={tried && !recipient ? t('app.fx.abroad.recipient_error') : undefined}
                      >
                        <Select
                          data-testid="abroad-recipient"
                          value={recipient?.id ?? ''}
                          onChange={setRecipientId}
                          options={[
                            { value: '', label: t('app.payments.form.choose_recipient') },
                            ...fits.map((r) => ({
                              value: r.id,
                              label: t('app.fx.abroad.recipient_option', {
                                name: r.name,
                                last4: r.accountLast4 ?? '',
                              }),
                            })),
                          ]}
                        />
                      </Field>
                      <div className="fw-actions">
                        <Button variant="secondary" onClick={() => go('corridor')}>
                          {t('app.fx.back')}
                        </Button>
                        {can(Permission.RECIPIENT_MANAGE) && (
                          <Button
                            variant="secondary"
                            data-testid="abroad-add-recipient"
                            onClick={() => setAdding(true)}
                          >
                            {t('app.fx.recipient.add')}
                          </Button>
                        )}
                        <Button
                          data-testid="abroad-next-recipient"
                          onClick={() => {
                            setTried(true);
                            if (recipient) go('amount');
                          }}
                        >
                          {t('app.fx.next')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {step === 'amount' && corridor && (
                <form
                  className="fw-form"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask();
                  }}
                >
                  {sources.length ? (
                    <Field
                      label={t('app.payments.review.from')}
                      hint={
                        fromA?.balance ? (
                          <span data-mask="">
                            {t('app.payments.form.available', {
                              amount: formatMinor(fromA.balance.available),
                            })}
                          </span>
                        ) : undefined
                      }
                    >
                      <Select
                        data-testid="abroad-from"
                        value={fromA?.id ?? ''}
                        onChange={setFrom}
                        options={sources.map((a) => ({
                          value: a.id,
                          label: t('app.payments.form.account_ending', {
                            name: a.name,
                            last4: a.last4 ?? '',
                          }),
                        }))}
                      />
                    </Field>
                  ) : (
                    <Notice status="info">
                      <span data-testid="abroad-no-source">
                        {t('app.fx.abroad.no_source', { currency: corridor.sourceCurrency })}
                      </span>
                    </Notice>
                  )}
                  <Field
                    label={t('app.fx.abroad.amount', { currency: corridor.destinationCurrency })}
                    hint={t('app.fx.abroad.limits', {
                      min: formatMinor(corridor.minAmount),
                      max: formatMinor(corridor.maxAmount),
                    })}
                    error={
                      (amount || tried) && !minor
                        ? t('app.fx.amount_error', { currency: corridor.destinationCurrency })
                        : range === 'low'
                          ? t('app.fx.abroad.under_min', { min: formatMinor(corridor.minAmount) })
                          : range === 'high'
                            ? t('app.fx.abroad.over_max', { max: formatMinor(corridor.maxAmount) })
                            : undefined
                    }
                  >
                    <MoneyInput
                      currency={corridor.destinationCurrency}
                      data-testid="abroad-amount"
                      data-mask=""
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>
                  <Field label={t('app.payments.form.reference')}>
                    <Input
                      data-testid="abroad-reference"
                      maxLength={80}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </Field>
                  {failure && <Notice status="failure">{failure}</Notice>}
                  <div className="fw-actions">
                    <Button variant="secondary" type="button" onClick={() => go('recipient')}>
                      {t('app.fx.back')}
                    </Button>
                    <Button type="submit" data-testid="abroad-quote" disabled={busy || !sources.length}>
                      {t('app.fx.quote.get')}
                    </Button>
                  </div>
                </form>
              )}
              {step === 'quote' && quote && corridor && (
                <>
                  <QuoteLines quote={quote} left={left} />
                  <p className="fw-row__sub">{t('app.fx.abroad.accept_note')}</p>
                  {failure && <Notice status="failure">{failure}</Notice>}
                  <div className="fw-actions">
                    <Button variant="secondary" disabled={busy} onClick={() => go('amount')}>
                      {t('app.payments.review.change')}
                    </Button>
                    {left > 0 || made.current ? (
                      <Button data-testid="abroad-accept" disabled={busy} onClick={() => void accept()}>
                        {t('app.fx.abroad.accept')}
                      </Button>
                    ) : (
                      <Button data-testid="abroad-requote" disabled={busy} onClick={() => void ask()}>
                        {t('app.fx.quote.again')}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>
            <aside className="fw-send__summary" aria-label={t('app.payments.summary.title')}>
              <h2 className="og-card__title">{t('app.payments.summary.title')}</h2>
              <KeyValue
                items={[
                  {
                    label: t('app.fx.abroad.corridor'),
                    value: corridor ? corridorLabel(corridor) : t('app.payments.summary.not_chosen'),
                  },
                  {
                    label: t('app.payments.review.to'),
                    value: recipient ? (
                      <span>
                        {recipient.name} <Last4 value={recipient.accountLast4} />
                      </span>
                    ) : (
                      t('app.payments.summary.not_chosen')
                    ),
                  },
                  {
                    label: t('app.payments.review.from'),
                    value:
                      fromA && step !== 'corridor' && step !== 'recipient' ? (
                        <span>
                          {fromA.name} <AcctLast4 value={fromA.last4} />
                        </span>
                      ) : (
                        t('app.payments.summary.not_chosen')
                      ),
                  },
                  {
                    label: t('app.fx.abroad.they_get'),
                    value: (
                      <span data-mask="">
                        {minor && corridor
                          ? formatMinor({ amountMinor: minor, currency: corridor.destinationCurrency })
                          : t('app.payments.summary.not_chosen')}
                      </span>
                    ),
                  },
                  {
                    label: t('app.payments.review.how'),
                    value: corridor ? railName(corridor.rail) : t('app.payments.summary.not_chosen'),
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

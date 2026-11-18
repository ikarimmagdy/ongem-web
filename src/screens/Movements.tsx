import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import type {
  Account,
  FxQuote,
  InternationalRecipient,
  Movement,
  MovementFx,
  MovementReceipt,
} from '../api/types';
import { Button, Card, EmptyState, KeyValue, Modal, Notice, StatusChip, Stepper } from '../design-system';
import { formatDate, formatMinor } from '../lib/format';
import {
  CANCELLABLE,
  MOVING,
  countryName,
  legLabel,
  legStateLabel,
  legTone,
  movementLabel,
  movementSentence,
  movementTone,
  railName,
  rateLine,
} from '../lib/fx';
import { useAsync } from '../lib/useAsync';
import { t } from '../i18n';
import { useSession } from '../session';
import { AcctLast4, Last4, Load } from './common';
import { QuoteLines, useCountdown } from './fxCommon';

/** How often a movement on its way is read again (a first-party leg shows in transit until the bank shows the credit). */
export const MOVEMENT_POLL_MS = 3000;

const accountName = (accounts: Account[], id?: string | null) => accounts.find((a) => a.id === id)?.name;

/** Who a movement goes to: the recipient abroad, or the own account money is converted into. */
export function movementPayee(
  m: Movement,
  accounts: Account[],
  recipients: InternationalRecipient[],
): string {
  if (m.recipientId)
    return recipients.find((r) => r.id === m.recipientId)?.name ?? t('app.fx.recipient_unknown');
  return accountName(accounts, m.toAccountId) ?? t('app.fx.your_account');
}

export const movementKind = (m: Pick<Movement, 'intent'>) =>
  m.intent === 'PAY_ABROAD' ? t('app.fx.kind.abroad') : t('app.fx.kind.convert');

/** The FX lines of a movement or receipt: pair and rate, provider fee, OnGem margin apart, total. */
export function fxItems(fx: MovementFx) {
  return [
    { label: t('app.fx.quote.rate'), value: <bdi dir="ltr">{rateLine(fx)}</bdi> },
    {
      label: t('app.fx.quote.converted'),
      value: <span data-mask="">{formatMinor(fx.sell)}</span>,
    },
    {
      label: t('app.fx.quote.provider_fee'),
      value: (
        <span data-mask="" data-testid="fx-fee">
          {formatMinor(fx.providerFee)}
        </span>
      ),
    },
    {
      label: t('app.fx.quote.margin', { bps: fx.marginBps }),
      value: (
        <span data-mask="" data-testid="fx-margin">
          {formatMinor(fx.margin)}
        </span>
      ),
    },
    {
      label: t('app.fx.quote.total'),
      value: <strong data-mask="">{formatMinor(fx.totalDebit)}</strong>,
    },
  ];
}

/** Movements (convert and send abroad), newest first, with Send abroad and Convert where the API offers them. */
export function MovementsList({ abroad, convert }: { abroad: boolean; convert: boolean }) {
  const { api, can } = useSession();
  const navigate = useNavigate();
  const list = useAsync(() => api.movements(), [api]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.internationalRecipients().catch(() => []), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  const create = can(Permission.PAYMENT_CREATE);
  return (
    <>
      <div className="fw-tab-toolbar">
        <p className="fw-row__sub">{t('app.fx.list.subtitle')}</p>
        {create && (
          <span className="fw-actions">
            {convert && (
              <Link
                className="og-btn og-btn--md og-btn--secondary"
                to="/payments/convert"
                data-testid="fx-convert-start"
              >
                {t('app.fx.convert.action')}
              </Link>
            )}
            {abroad && (
              <Link
                className="og-btn og-btn--md og-btn--primary"
                to="/payments/abroad"
                data-testid="fx-abroad-start"
              >
                {t('app.fx.abroad.action')}
              </Link>
            )}
          </span>
        )}
      </div>
      <Load state={list} label="payments">
        {(rows) =>
          rows.length ? (
            <ul className="fw-list" data-testid="movements-list">
              {rows.map((m) => (
                <li key={m.id}>
                  <button
                    className="fw-row"
                    data-testid={`movement-${m.id}`}
                    onClick={() => navigate(`/payments/movements/${m.id}`)}
                  >
                    <span className="fw-row__main">
                      <strong>{movementPayee(m, accs, recs)}</strong>
                      <span className="fw-row__sub">
                        {movementKind(m)} · {formatDate(m.createdAt)}
                      </span>
                    </span>
                    <span className="fw-row__main">
                      <span className="og-money" data-mask="">
                        {formatMinor(m.deliver)}
                      </span>
                      <StatusChip status={movementTone(m.state)}>{movementLabel(m)}</StatusChip>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('app.fx.list.empty_title')}>{t('app.fx.list.empty_text')}</EmptyState>
          )
        }
      </Load>
    </>
  );
}

/** A new quote for a movement whose quote expired (AWAITING_QUOTE): the same conversion, accepted again with step-up. */
function Requote({ m, onDone }: { m: Movement; onDone(): void }) {
  const { api } = useSession();
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const left = useCountdown(quote);
  const ask = async () => {
    setBusy(true);
    setFailure(null);
    try {
      setQuote(
        await api.createQuote(
          m.intent === 'PAY_ABROAD'
            ? {
                sellCurrency: m.debit.currency,
                buyCurrency: m.deliver.currency,
                side: 'BUY',
                amountMinor: m.deliver.amountMinor,
                corridorId: m.corridorId ?? null,
              }
            : {
                sellCurrency: m.debit.currency,
                buyCurrency: m.deliver.currency,
                side: 'SELL',
                amountMinor: m.fx?.sell.amountMinor ?? m.debit.amountMinor,
                toAccountId: m.toAccountId ?? null,
              },
        ),
      );
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    if (!quote) return;
    setBusy(true);
    setFailure(null);
    try {
      await api.acceptQuote(quote.id);
      await api.requoteMovement(m.id, quote.id);
      await api.submitMovement(m.id);
      onDone();
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-testid="movement-requote">
      <Notice status="pending">{t('app.fx.requote.text')}</Notice>
      {quote && <QuoteLines quote={quote} left={left} />}
      {failure && <Notice status="failure">{failure}</Notice>}
      <div className="fw-actions">
        {quote && left > 0 ? (
          <Button data-testid="movement-requote-accept" disabled={busy} onClick={() => void accept()}>
            {t('app.fx.quote.accept')}
          </Button>
        ) : (
          <Button data-testid="movement-requote-ask" disabled={busy} onClick={() => void ask()}>
            {quote ? t('app.fx.quote.again') : t('app.fx.requote.ask')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** One movement: its state in words, each leg in plain words, the FX lines, approval, cancel and the receipt. */
export function MovementDetail({ id, justSent = false }: { id: string; justSent?: boolean }) {
  const { api, can } = useSession();
  const [n, setN] = useState(0);
  const movement = useAsync(() => api.movement(id), [api, id, n]);
  const accounts = useAsync(() => api.accounts(), [api, n]);
  const recipients = useAsync(() => api.internationalRecipients().catch(() => []), [api]);
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [receipt, setReceipt] = useState(false);
  const inFlight = useRef(false);
  const state = movement.status === 'success' ? movement.data.state : null;
  // A movement on its way is read again until it settles or stops.
  useEffect(() => {
    if (!state || !MOVING.has(state)) return;
    const timer = setTimeout(() => setN((x) => x + 1), MOVEMENT_POLL_MS);
    return () => clearTimeout(timer);
  }, [state, n]);
  const act = (f: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    f()
      .then(
        () => setN((x) => x + 1),
        (e: unknown) => setFailure(errorText(e)),
      )
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  };
  return (
    <Load state={movement} label={t('app.payments.loading.payment')}>
      {(m) => {
        const payee = movementPayee(m, accs, recs);
        const from = accs.find((a) => a.id === m.fromAccountId);
        const recipient = recs.find((r) => r.id === m.recipientId);
        return (
          <Card
            title={<span data-testid="movement-kind">{movementKind(m)}</span>}
            data-testid="movement-detail"
          >
            {justSent && (
              <Notice status="success">
                <span data-testid="movement-sent">
                  {m.state === 'PENDING_APPROVAL'
                    ? t('app.fx.sent.waiting')
                    : t('app.fx.sent.done', { payee })}
                </span>
              </Notice>
            )}
            <p className="og-money og-money--xl fw-detail__amount" data-mask="">
              {formatMinor(m.deliver)}
            </p>
            <p className="fw-row__sub">{t('app.fx.detail.to', { payee })}</p>
            <p role="status" data-testid="movement-status-line">
              <StatusChip status={movementTone(m.state)}>{movementLabel(m)}</StatusChip> {movementSentence(m)}
            </p>
            <KeyValue
              items={[
                {
                  label: t('app.fx.detail.debit'),
                  value: (
                    <strong data-mask="" data-testid="movement-debit">
                      {formatMinor(m.debit)}
                    </strong>
                  ),
                },
                {
                  label: t('app.payments.review.from'),
                  value: from ? (
                    <span>
                      {from.name} <AcctLast4 value={from.last4} />
                    </span>
                  ) : (
                    t('app.fx.your_account')
                  ),
                },
                {
                  label: t('app.payments.review.to'),
                  value: (
                    <span data-testid="movement-to">
                      {payee} {recipient && <Last4 value={recipient.accountLast4} />}
                    </span>
                  ),
                },
                ...(m.beneficiaryCountry
                  ? [{ label: t('app.fx.detail.country'), value: countryName(m.beneficiaryCountry) }]
                  : []),
                {
                  label: t('app.payments.detail.reference'),
                  value: m.reference ?? t('app.payments.detail.none'),
                },
                { label: t('app.fx.detail.created'), value: formatDate(m.createdAt, { time: true }) },
              ]}
            />
            {m.fx && (
              <section aria-labelledby="movement-fx-title" data-testid="movement-fx">
                <h3 id="movement-fx-title" className="fw-subhead">
                  {t('app.fx.detail.fx_title')}
                </h3>
                <KeyValue items={fxItems(m.fx)} />
              </section>
            )}
            <section aria-labelledby="movement-legs-title">
              <h3 id="movement-legs-title" className="fw-subhead">
                {t('app.fx.detail.legs_title')}
              </h3>
              <div data-testid="movement-legs">
                <Stepper
                  label={t('app.fx.detail.legs_title')}
                  items={m.legs.map((l) => ({
                    id: l.id,
                    label: (
                      <span data-testid={`leg-${l.capability.toLowerCase()}`}>
                        {legLabel(l, {
                          amount: formatMinor(l.amount),
                          from: from?.name,
                          to: accountName(accs, m.toAccountId),
                          via: accountName(accs, m.viaAccountId),
                          payee,
                          sell: m.fx ? formatMinor(m.fx.sell) : formatMinor(m.debit),
                          buy: formatMinor(m.deliver),
                        })}
                      </span>
                    ),
                    statusText: legStateLabel(l),
                    status: legTone(l),
                    current: l.inTransit || l.state === 'SUBMITTED',
                  }))}
                />
              </div>
            </section>
            {m.state === 'AWAITING_QUOTE' && can(Permission.PAYMENT_CREATE) && (
              <Requote m={m} onDone={() => setN((x) => x + 1)} />
            )}
            {failure && <Notice status="failure">{failure}</Notice>}
            <div className="fw-actions">
              {m.state === 'PLANNED' && can(Permission.PAYMENT_CREATE) && (
                <Button
                  data-testid="movement-submit"
                  disabled={busy}
                  onClick={() => act(() => api.submitMovement(m.id))}
                >
                  {t('app.fx.detail.submit')}
                </Button>
              )}
              {m.state === 'PENDING_APPROVAL' && can(Permission.PAYMENT_APPROVE) && (
                <>
                  <Button
                    data-testid="movement-approve"
                    disabled={busy}
                    onClick={() => act(() => api.approveMovement(m.id))}
                  >
                    {t('app.payments.approve')}
                  </Button>
                  <Button
                    variant="secondary"
                    data-testid="movement-decline"
                    disabled={busy}
                    onClick={() => act(() => api.rejectMovement(m.id))}
                  >
                    {t('app.payments.decline')}
                  </Button>
                </>
              )}
              {CANCELLABLE.has(m.state) && can(Permission.PAYMENT_CREATE) && (
                <Button
                  variant="ghost"
                  data-testid="movement-cancel"
                  disabled={busy}
                  onClick={() => act(() => api.cancelMovement(m.id))}
                >
                  {t('app.fx.detail.cancel')}
                </Button>
              )}
              <Button variant="secondary" data-testid="movement-receipt" onClick={() => setReceipt(true)}>
                {t('app.fx.receipt.open')}
              </Button>
            </div>
            <ReceiptModal id={receipt ? m.id : null} onClose={() => setReceipt(false)} />
          </Card>
        );
      }}
    </Load>
  );
}

/** The receipt of a movement (GET /v1/movements/{id}/receipt): amounts, FX lines, corridor and recipient (last 4). */
export function ReceiptModal({ id, onClose }: { id: string | null; onClose(): void }) {
  const { api } = useSession();
  const receipt = useAsync<MovementReceipt | null>(
    () => (id ? api.movementReceipt(id) : Promise.resolve(null)),
    [api, id],
  );
  return (
    <Modal
      open={Boolean(id)}
      title={t('app.fx.receipt.title')}
      onClose={onClose}
      closeLabel={t('app.common.close')}
    >
      <Load state={receipt} label="receipt">
        {(r) =>
          r ? (
            <div data-testid="movement-receipt-view" className="fw-receipt">
              <KeyValue
                items={[
                  { label: t('app.fx.receipt.kind'), value: movementKind(r) },
                  {
                    label: t('app.fx.receipt.state'),
                    value: (
                      <StatusChip status={movementTone(r.state)}>
                        {movementLabel({ state: r.state, legs: [] })}
                      </StatusChip>
                    ),
                  },
                  {
                    label: t('app.payments.detail.reference'),
                    value: r.reference ?? t('app.payments.detail.none'),
                  },
                  {
                    label: t('app.fx.detail.debit'),
                    value: (
                      <strong data-mask="" data-testid="receipt-debit">
                        {formatMinor(r.debit)}
                      </strong>
                    ),
                  },
                  {
                    label: t('app.fx.receipt.deliver'),
                    value: (
                      <strong data-mask="" data-testid="receipt-deliver">
                        {formatMinor(r.deliver)}
                      </strong>
                    ),
                  },
                  ...(r.fromAccount
                    ? [
                        {
                          label: t('app.payments.review.from'),
                          value: (
                            <span>
                              {r.fromAccount.currency} <AcctLast4 value={r.fromAccount.last4} />
                            </span>
                          ),
                        },
                      ]
                    : []),
                  ...(r.recipient
                    ? [
                        {
                          label: t('app.payments.review.to'),
                          value: (
                            <span data-testid="receipt-recipient">
                              {r.recipient.name} <Last4 value={r.recipient.accountLast4} />
                            </span>
                          ),
                        },
                      ]
                    : r.toAccount
                      ? [
                          {
                            label: t('app.payments.review.to'),
                            value: (
                              <span>
                                {r.toAccount.currency} <Last4 value={r.toAccount.last4} />
                              </span>
                            ),
                          },
                        ]
                      : []),
                  ...(r.corridor
                    ? [
                        {
                          label: t('app.fx.receipt.corridor'),
                          value: (
                            <span data-testid="receipt-corridor">
                              {t('app.fx.receipt.corridor_value', {
                                country: countryName(r.corridor.destinationCountry),
                                rail: railName(r.corridor.rail),
                              })}
                            </span>
                          ),
                        },
                      ]
                    : []),
                  ...(r.fx ? fxItems(r.fx) : []),
                  ...(r.fx
                    ? [
                        {
                          label: t('app.fx.receipt.quote'),
                          value: (
                            <bdi dir="ltr" data-testid="receipt-quote">
                              {r.fx.quoteId}
                            </bdi>
                          ),
                        },
                      ]
                    : []),
                  { label: t('app.fx.detail.created'), value: formatDate(r.createdAt, { time: true }) },
                  {
                    label: t('app.fx.receipt.settled'),
                    value: r.settledAt
                      ? formatDate(r.settledAt, { time: true })
                      : t('app.fx.receipt.not_settled'),
                  },
                ]}
              />
              <div className="fw-actions">
                <Button
                  variant="secondary"
                  data-testid="receipt-print"
                  onClick={() => typeof window.print === 'function' && window.print()}
                >
                  {t('app.payments.sent.print')}
                </Button>
              </div>
            </div>
          ) : null
        }
      </Load>
    </Modal>
  );
}

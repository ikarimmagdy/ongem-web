import { useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorText } from '../api/errors';
import type { Card as CardModel, Transaction } from '../api/types';
import { Button, Card, Field, Notice, Select, TextArea } from '../design-system';
import { formatBankDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useDrafts } from '../assistant/drafts';
import { useSession } from '../session';
import { t } from '../i18n';
import { Load } from './common';

const REASONS = ['not_mine', 'twice', 'wrong_amount', 'not_received', 'other'] as const;
type Reason = (typeof REASONS)[number];

/** Card charges of the card's account, newest first: what a founder can dispute. */
function charges(rows: Transaction[]): Transaction[] {
  return rows.filter((tx) => tx.rail === 'CARD' && tx.direction === 'DEBIT');
}

function txLine(tx: Transaction): string {
  return t('app.dispute.charge', {
    amount: formatMinor(tx.amount),
    date: tx.effectiveDate ? formatBankDate(tx.effectiveDate) : '',
  });
}

/**
 * Dispute a card charge (FA-039): pick the card and the charge, say why, add details and a receipt, and read what happens
 * next. It opens a DISPUTE support request with every fact the bank needs, so nobody has to ask again.
 */
export function DisputeForm() {
  const { api } = useSession();
  const drafts = useDrafts();
  const navigate = useNavigate();
  const [q] = useSearchParams();
  const base = useId();
  const cards = useAsync(() => api.cards(), [api]);
  const [cardId, setCardId] = useState(q.get('card') ?? '');
  const list = cards.status === 'success' ? cards.data.items : [];
  const card: CardModel | undefined = list.find((c) => c.id === cardId) ?? list[0];
  const txns = useAsync(
    () => (card ? api.transactions(card.fundingAccountId, 100) : Promise.resolve([])),
    [api, card?.fundingAccountId],
  );
  const [txId, setTxId] = useState('');
  const [reason, setReason] = useState<Reason | ''>('');
  const [details, setDetails] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const rows = txns.status === 'success' ? charges(txns.data) : [];
  const tx = rows.find((x) => x.id === txId);
  const missing = [
    !tx && t('app.dispute.missing.charge'),
    !reason && t('app.dispute.missing.reason'),
    reason === 'other' && !details.trim() && t('app.dispute.missing.details'),
  ].filter(Boolean) as string[];
  const send = async () => {
    setTried(true);
    if (missing.length || !tx || !card || !reason || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = [
        t('app.dispute.body.card', { last4: card.last4 }),
        t('app.dispute.body.charge', { charge: txLine(tx), id: tx.id }),
        t('app.dispute.body.reason', { reason: t(`app.dispute.reason.${reason}`) }),
        details.trim() ? t('app.dispute.body.details', { details: details.trim() }) : '',
      ]
        .filter(Boolean)
        .join('\n');
      const opened = await api.openTicket({
        subject: t('app.dispute.subject', { last4: card.last4, charge: txLine(tx) }),
        category: 'DISPUTE',
        body,
      });
      if (file) await api.attachToTicket(opened.ticket.id, file);
      await drafts.done(['SUPPORT_TICKET'], opened.ticket.id);
      navigate(`/support/${opened.ticket.id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Card title={t('app.dispute.title')} data-testid="dispute-form">
      <Load state={cards} label="cards">
        {() => (
          <div className="fw-form">
            {list.length > 1 && (
              <Field label={t('app.dispute.card')}>
                <Select
                  data-testid="dispute-card"
                  value={card?.id ?? ''}
                  onChange={(e) => {
                    setCardId(e.target.value);
                    setTxId('');
                  }}
                  options={list.map((c) => ({
                    value: c.id,
                    label: t('app.dispute.card_option', { last4: c.last4, holder: c.holderName }),
                  }))}
                />
              </Field>
            )}
            <fieldset className="fw-pick" aria-describedby={`${base}-charge-hint`}>
              <legend className="og-field__label">{t('app.dispute.pick')}</legend>
              <p className="og-field__hint" id={`${base}-charge-hint`}>
                {t('app.dispute.pick_hint')}
              </p>
              <Load state={txns} label="transactions">
                {() =>
                  rows.length ? (
                    <ul className="fw-pick__list" data-testid="dispute-charges">
                      {rows.slice(0, 20).map((x) => (
                        <li key={x.id}>
                          <label className={`fw-pick__row${x.id === txId ? ' is-active' : ''}`}>
                            <input
                              type="radio"
                              name={`${base}-charge`}
                              value={x.id}
                              checked={x.id === txId}
                              data-testid={`dispute-charge-${x.id}`}
                              onChange={() => setTxId(x.id)}
                            />
                            <span data-mask="">{txLine(x)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="fw-row__sub" data-testid="dispute-no-charges">
                      {t('app.dispute.no_charges')}
                    </p>
                  )
                }
              </Load>
            </fieldset>
            <Field label={t('app.dispute.reason_label')}>
              <Select
                data-testid="dispute-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as Reason | '')}
                options={[
                  { value: '', label: t('app.dispute.reason_choose') },
                  ...REASONS.map((r) => ({ value: r, label: t(`app.dispute.reason.${r}`) })),
                ]}
              />
            </Field>
            {tx && (
              <p className="fw-row__sub" data-testid="dispute-amount" data-mask="">
                {t('app.dispute.amount', { amount: formatMinor(tx.amount) })}
              </p>
            )}
            <Field label={t('app.dispute.details')} hint={t('app.dispute.details_hint')}>
              <TextArea
                data-testid="dispute-details"
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </Field>
            <Field label={t('app.dispute.receipt')} hint={t('app.dispute.receipt_hint')}>
              <input
                type="file"
                data-testid="dispute-receipt"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Notice status="info">
              <span data-testid="dispute-next">{t('app.dispute.next')}</span>
            </Notice>
            {tried && missing.length > 0 && (
              <p className="og-field__error" role="alert" data-testid="dispute-missing">
                {t('app.dispute.missing.intro', { items: missing.join(', ') })}
              </p>
            )}
            {error && <Notice status="failure">{error}</Notice>}
            <div className="fw-actions">
              <Button data-testid="dispute-send" disabled={busy} onClick={() => void send()}>
                {t('app.dispute.send')}
              </Button>
            </div>
          </div>
        )}
      </Load>
    </Card>
  );
}

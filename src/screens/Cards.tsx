import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorText } from '../api/errors';
import { Button, Card, EmptyState, KeyValue, Notice, PageHeader, StatusChip } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { useDrafts } from '../assistant/drafts';
import { useSession } from '../session';
import type { CardWidgetKind, CardWidgetSession } from '../api/types';
import { CardWidget } from './CardWidget';
import { Last4, Load, human, stateStatus } from './common';
import { SplitHint } from './SplitHint';

const WIDGET_LABELS: Record<CardWidgetKind, string> = {
  REVEAL: 'Show card details',
  GET_PIN: 'Show PIN',
  SET_PIN: 'Set PIN',
  ACTIVATE: 'Activate card',
};

function CardDetail({ id, onListChanged }: { id: string; onListChanged?(): void }) {
  const { api } = useSession();
  const navigate = useNavigate();
  const drafts = useDrafts();
  const [n, setN] = useState(0);
  const card = useAsync(() => api.card(id), [api, id, n]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [widget, setWidget] = useState<CardWidgetSession | null>(null);
  const [opening, setOpening] = useState<CardWidgetKind | null>(null);
  const openWidget = async (kind: CardWidgetKind) => {
    if (opening) return;
    setOpening(kind);
    setError(null);
    setWidget(null);
    try {
      setWidget(await api.cardWidget(id, kind));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setOpening(null);
    }
  };
  const toggle = async (frozen: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.setCardFrozen(id, frozen);
      await drafts.done([frozen ? 'CARD_FREEZE' : 'CARD_UNFREEZE'], id, { cardId: id });
      setN((x) => x + 1);
      onListChanged?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Load state={card} label="card">
      {(c) => (
        <Card
          title={
            <>
              Card <Last4 value={c.last4} />
            </>
          }
          data-testid="card-detail"
        >
          <KeyValue
            items={[
              { label: 'Cardholder', value: c.holderName },
              { label: 'Type', value: human(c.form) },
              {
                label: 'Status',
                value: (
                  <StatusChip status={stateStatus(c.state)}>
                    <span data-testid="card-state">{human(c.state)}</span>
                  </StatusChip>
                ),
              },
            ]}
          />
          <p>The bank shows the card number and PIN in its own secure view. OnGem never sees them.</p>
          {error && <Notice status="failure">{error}</Notice>}
          {widget && (
            <CardWidget
              key={`${widget.kind}-${widget.expiresAt}`}
              session={widget}
              onClose={() => setWidget(null)}
            />
          )}
          <div className="fw-actions" data-testid="card-widget-actions">
            {(c.state === 'ACTIVE' || c.state === 'FROZEN'
              ? (['REVEAL', 'GET_PIN', 'SET_PIN'] as const)
              : c.state === 'PENDING'
                ? (['ACTIVATE'] as const)
                : []
            ).map((k) => (
              <Button
                key={k}
                variant="secondary"
                data-testid={`card-widget-${k.toLowerCase()}`}
                disabled={opening !== null}
                onClick={() => void openWidget(k)}
              >
                {WIDGET_LABELS[k]}
              </Button>
            ))}
          </div>
          <div className="fw-actions">
            {c.state === 'ACTIVE' && (
              <Button data-testid="card-freeze" disabled={busy} onClick={() => void toggle(true)}>
                Freeze card
              </Button>
            )}
            {c.state === 'FROZEN' && (
              <Button data-testid="card-unfreeze" disabled={busy} onClick={() => void toggle(false)}>
                Unfreeze card
              </Button>
            )}
            <Button
              variant="secondary"
              data-testid="card-dispute"
              onClick={() =>
                navigate(
                  `/support/new?category=DISPUTE&subject=${encodeURIComponent(`Dispute a charge on card ending ${c.last4}`)}`,
                )
              }
            >
              Dispute a charge
            </Button>
          </div>
        </Card>
      )}
    </Load>
  );
}

export function CardsScreen() {
  const { api } = useSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const list = useAsync(() => api.cards(), [api, id, version]);
  // On a wide screen the first card opens at once instead of an empty detail column (R-UX-9).
  const first = list.status === 'success' ? list.data.items[0]?.id : undefined;
  useEffect(() => {
    if (id || !first || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(min-width: 901px)').matches) navigate(`/cards/${first}`, { replace: true });
  }, [id, first, navigate]);
  return (
    <>
      <PageHeader title="Cards" subtitle="Last four digits only." />
      <div className={`fw-split${id ? ' has-detail' : ''}`}>
        <div className="fw-split__list">
          <Load state={list} label="cards">
            {(page) =>
              page.items.length ? (
                <ul className="fw-card-tiles" data-testid="cards-list">
                  {page.items.map((c) => (
                    <li key={c.id}>
                      <button
                        className={`fw-card-tile${c.id === id ? ' is-active' : ''}${c.state === 'FROZEN' ? ' is-frozen' : ''}`}
                        data-testid={`card-${c.id}`}
                        aria-current={c.id === id ? 'true' : undefined}
                        onClick={() => navigate(`/cards/${c.id}`)}
                      >
                        <span className="fw-card-tile__top">
                          <span className="fw-card-tile__form">{human(c.form)}</span>
                          <StatusChip status={stateStatus(c.state)}>{human(c.state)}</StatusChip>
                        </span>
                        <span className="fw-card-tile__number">
                          <Last4 value={c.last4} />
                        </span>
                        <span className="fw-card-tile__holder">{c.holderName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No cards yet">Cards ops issues for your company show here.</EmptyState>
              )
            }
          </Load>
        </div>
        <div>
          {id && (
            <>
              <Button variant="ghost" onClick={() => navigate('/cards')}>
                Back to cards
              </Button>
              <CardDetail id={id} onListChanged={() => setVersion((x) => x + 1)} />
            </>
          )}
          {!id && (
            <SplitHint title="Pick a card">
              Freeze or unfreeze it, see its details in the bank's secure window, or dispute a charge.
            </SplitHint>
          )}
        </div>
      </div>
    </>
  );
}

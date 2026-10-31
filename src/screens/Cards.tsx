import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorText } from '../api/errors';
import { Button, Card, EmptyState, KeyValue, Notice, PageHeader, StatusChip } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { useDrafts } from '../assistant/drafts';
import { useSession } from '../session';
import { Last4, Load, human, stateStatus } from './common';

/** Called after the founder froze or unfroze a card here (OG-031 confirms a drafted change with it). */
export type OnCardChanged = (cardId: string, frozen: boolean) => void | Promise<void>;

function CardDetail({
  id,
  onChanged,
  onListChanged,
}: {
  id: string;
  onChanged?: OnCardChanged;
  onListChanged?(): void;
}) {
  const { api } = useSession();
  const drafts = useDrafts();
  const [n, setN] = useState(0);
  const card = useAsync(() => api.card(id), [api, id, n]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const toggle = async (frozen: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.setCardFrozen(id, frozen);
      await onChanged?.(id, frozen);
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
          <p>The full card number stays with the bank and is never shown here.</p>
          {error && <Notice status="failure">{error}</Notice>}
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
          </div>
        </Card>
      )}
    </Load>
  );
}

export function CardsScreen({ onChanged }: { onChanged?: OnCardChanged }) {
  const { api } = useSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const list = useAsync(() => api.cards(), [api, id, version]);
  return (
    <>
      <PageHeader title="Cards" subtitle="Last four digits only." />
      <div className={`fw-split${id ? ' has-detail' : ''}`}>
        <div className="fw-split__list">
          <Load state={list} label="cards">
            {(page) =>
              page.items.length ? (
                <ul className="fw-list" data-testid="cards-list">
                  {page.items.map((c) => (
                    <li key={c.id}>
                      <button
                        className={`fw-row${c.id === id ? ' is-active' : ''}`}
                        data-testid={`card-${c.id}`}
                        onClick={() => navigate(`/cards/${c.id}`)}
                      >
                        <span className="fw-row__main">
                          <strong>{c.holderName}</strong>
                          <span className="fw-row__sub">
                            {human(c.form)} <Last4 value={c.last4} />
                          </span>
                        </span>
                        <StatusChip status={stateStatus(c.state)}>{human(c.state)}</StatusChip>
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
              <CardDetail id={id} onChanged={onChanged} onListChanged={() => setVersion((x) => x + 1)} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

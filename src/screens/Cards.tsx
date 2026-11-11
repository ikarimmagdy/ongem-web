import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorText } from '../api/errors';
import {
  Button,
  Card,
  CardFace,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  StatusChip,
  type CardFaceProps,
} from '../design-system';
import type { Card as CardModel } from '../api/types';
import { t } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { useDrafts } from '../assistant/drafts';
import { useSession } from '../session';
import type { CardWidgetKind, CardWidgetSession } from '../api/types';
import { CardWidget } from './CardWidget';
import { Last4, Load, human, stateStatus } from './common';
import { SplitHint } from './SplitHint';

const WIDGET_LABELS: Record<CardWidgetKind, string> = {
  REVEAL: 'app.cards.widget_reveal',
  GET_PIN: 'app.cards.widget_get_pin',
  SET_PIN: 'app.cards.widget_set_pin',
  ACTIVATE: 'app.cards.widget_activate',
};

/** One card face for a card (FA-001): navy for virtual cards, white for physical ones, frost when frozen. */
function faceOf(c: CardModel): CardFaceProps {
  return {
    last4: c.last4,
    holder: c.holderName,
    kind: human(c.form),
    base: c.form === 'PHYSICAL' ? 'white' : 'navy',
    frozen: c.state === 'FROZEN',
    frozenLabel: human('FROZEN'),
    status: c.state === 'ACTIVE' || c.state === 'FROZEN' ? undefined : human(c.state),
  };
}

/** The bank's card details close on their own after a minute (FA-003). */
const WIDGET_OPEN_MS = 60_000;

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
  useEffect(() => {
    if (!widget) return;
    const timer = window.setTimeout(() => setWidget(null), WIDGET_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [widget]);
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
              {t('app.cards.card')} <Last4 value={c.last4} />
            </>
          }
          data-testid="card-detail"
        >
          <div className="fw-card-detail__face">
            <CardFace {...faceOf(c)} size="lg" />
          </div>
          <KeyValue
            items={[
              { label: t('app.cards.cardholder'), value: c.holderName },
              { label: t('app.cards.type'), value: human(c.form) },
              {
                label: t('app.cards.status'),
                value: (
                  <StatusChip status={stateStatus(c.state)}>
                    <span data-testid="card-state">{human(c.state)}</span>
                  </StatusChip>
                ),
              },
            ]}
          />
          <p>{t('app.cards.secure_view_note')}</p>
          {error && <Notice status="failure">{error}</Notice>}
          {widget && (
            <CardWidget
              key={`${widget.kind}-${widget.expiresAt}`}
              session={widget}
              onClose={() => setWidget(null)}
            />
          )}
          <div className="fw-actions" data-testid="card-widget-actions" hidden={Boolean(widget)}>
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
                {t(WIDGET_LABELS[k])}
              </Button>
            ))}
          </div>
          <div className="fw-actions">
            {c.state === 'ACTIVE' && (
              <Button data-testid="card-freeze" disabled={busy} onClick={() => void toggle(true)}>
                {t('app.cards.freeze')}
              </Button>
            )}
            {c.state === 'FROZEN' && (
              <Button data-testid="card-unfreeze" disabled={busy} onClick={() => void toggle(false)}>
                {t('app.cards.unfreeze')}
              </Button>
            )}
            <Button
              variant="secondary"
              data-testid="card-dispute"
              onClick={() =>
                navigate(
                  `/support/new?category=DISPUTE&subject=${encodeURIComponent(t('app.cards.dispute_subject', { last4: c.last4 ?? '' }))}`,
                )
              }
            >
              {t('app.cards.dispute')}
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
      <PageHeader title={t('app.cards.title')} subtitle={t('app.cards.subtitle')} />
      <div className={`fw-split${id ? ' has-detail' : ''}`}>
        <div className="fw-split__list">
          <Load state={list} label="cards">
            {(page) =>
              page.items.length ? (
                <ul className="fw-card-tiles" data-testid="cards-list">
                  {page.items.map((c) => (
                    <li key={c.id}>
                      <button
                        className="fw-card-tile"
                        data-testid={`card-${c.id}`}
                        aria-current={c.id === id ? 'true' : undefined}
                        onClick={() => navigate(`/cards/${c.id}`)}
                      >
                        <CardFace {...faceOf(c)} selected={c.id === id} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t('app.cards.empty_title')}>{t('app.cards.empty_text')}</EmptyState>
              )
            }
          </Load>
        </div>
        <div>
          {id && (
            <>
              <Button variant="ghost" onClick={() => navigate('/cards')}>
                {t('app.cards.back')}
              </Button>
              <CardDetail id={id} onListChanged={() => setVersion((x) => x + 1)} />
            </>
          )}
          {!id && <SplitHint title={t('app.cards.hint_title')}>{t('app.cards.hint_text')}</SplitHint>}
        </div>
      </div>
    </>
  );
}

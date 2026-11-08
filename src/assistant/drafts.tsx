import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, errorText } from '../api/errors';
import type { AssistantDraft } from '../api/types';
import { useToast } from '../design-system';
import { t } from '../i18n';
import { REGION_CONFIG } from '../region';
import { useSession } from '../session';

/** An id the API issued (acc_..., rcp_..., crd_..., tkt_...); anything else from a draft is dropped, never routed to. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const id = (v: unknown) => (typeof v === 'string' && ID.test(v) ? v : undefined);
const minor = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : undefined);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/**
 * Where each draft kind is completed by the founder: the normal screen, prefilled (OG-031 R3, R4). Draft params come from
 * the model, so every value is checked and encoded: a draft can never open a screen other than its own kind's.
 */
export function routeFor(d: AssistantDraft): string {
  const r = (d.params ?? {}) as Record<string, unknown>;
  const p = {
    fromAccountId: id(r.fromAccountId),
    toAccountId: id(r.toAccountId),
    recipientId: id(r.recipientId),
    cardId: id(r.cardId),
    ticketId: id(r.ticketId),
    amountMinor: minor(r.amountMinor),
    name: text(r.name, 200),
    subject: text(r.subject, 200),
    category: id(r.category),
    body: text(r.body, 2000),
  };
  const q = (o: Record<string, string | number | undefined | null>) =>
    new URLSearchParams(
      Object.entries(o)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
  switch (d.kind) {
    case 'PAYMENT':
      return `/payments/new?${q({ kind: REGION_CONFIG.rails[0]!.rail.toLowerCase(), from: p.fromAccountId, recipient: p.recipientId, amount: p.amountMinor })}`;
    case 'INTERNAL_TRANSFER':
      return `/payments/new?${q({ kind: 'internal', from: p.fromAccountId, to: p.toAccountId, amount: p.amountMinor })}`;
    case 'RECIPIENT_ADD':
      return `/recipients?${q({ add: 1, name: p.name })}`;
    case 'RECIPIENT_ARCHIVE':
      return '/recipients';
    case 'CARD_FREEZE':
    case 'CARD_UNFREEZE':
      return p.cardId ? `/cards/${encodeURIComponent(p.cardId)}` : '/cards';
    case 'TICKET_REPLY':
      return p.ticketId ? `/support/${encodeURIComponent(p.ticketId)}?${q({ reply: p.body })}` : '/support';
    default:
      return `/support/new?${q({ subject: p.subject, category: p.category, body: p.body })}`;
  }
}

/** True when every value the draft set, for the keys the screen reports, is what the founder did. */
export function matches(d: AssistantDraft, facts: Record<string, unknown>): boolean {
  const params = (d.params ?? {}) as Record<string, unknown>;
  return Object.entries(facts).every(
    ([k, v]) => params[k] === undefined || params[k] === null || params[k] === v,
  );
}

interface Drafts {
  pending: AssistantDraft | null;
  decided: Record<string, AssistantDraft['state']>;
  review(d: AssistantDraft): void;
  dismiss(d: AssistantDraft): Promise<void>;
  /**
   * A screen finished an action of one of [kinds] with result [ref]: confirm the pending draft only when it is that kind
   * and [facts] (what the founder actually did) agree with every value the draft set.
   */
  done(kinds: string[], ref: string, facts?: Record<string, unknown>): Promise<void>;
}

const DraftContext = createContext<Drafts>({
  pending: null,
  decided: {},
  review: () => undefined,
  dismiss: () => Promise.resolve(),
  done: () => Promise.resolve(),
});

export function DraftProvider({ children }: { children: ReactNode }) {
  const { api } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState<AssistantDraft | null>(null);
  const [decided, setDecided] = useState<Record<string, AssistantDraft['state']>>({});
  const review = useCallback(
    (d: AssistantDraft) => {
      setPending(d);
      navigate(routeFor(d));
    },
    [navigate],
  );
  const dismiss = useCallback(
    async (d: AssistantDraft) => {
      await api.abandonAssistantDraft(d.id);
      setDecided((x) => ({ ...x, [d.id]: 'ABANDONED' }));
      setPending((p) => (p?.id === d.id ? null : p));
    },
    [api],
  );
  const done = useCallback(
    async (kinds: string[], ref: string, facts: Record<string, unknown> = {}) => {
      if (!pending || !kinds.includes(pending.kind)) return;
      if (!matches(pending, facts)) {
        setPending(null);
        toast.show(t('app.assistant.toast.not_drafted'), 'info');
        return;
      }
      try {
        await api.confirmAssistantDraft(pending.id, ref);
        setDecided((x) => ({ ...x, [pending.id]: 'CONFIRMED' }));
        toast.show(t('app.assistant.toast.confirmed'), 'success');
      } catch (e) {
        // CORE-ASST-01, 05: the API checks the result against the draft and refuses an old or different one.
        const refused = e instanceof ApiError && e.code?.startsWith('draft_');
        toast.show(
          t('app.assistant.toast.done', {
            reason: refused ? errorText(e) : t('app.assistant.toast.not_recorded'),
          }),
          'info',
        );
      }
      setPending(null);
    },
    [api, pending, toast],
  );
  const value = useMemo(
    () => ({ pending, decided, review, dismiss, done }),
    [pending, decided, review, dismiss, done],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export const useDrafts = () => useContext(DraftContext);

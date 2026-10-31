import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssistantDraft } from '../api/types';
import { useToast } from '../design-system';
import { useSession } from '../session';

/** Where each draft kind is completed by the founder: the normal screen, prefilled (OG-031 R3, R4). */
export function routeFor(d: AssistantDraft): string {
  const p = d.params as Record<string, string | number | undefined>;
  const q = (o: Record<string, string | number | undefined | null>) =>
    new URLSearchParams(
      Object.entries(o)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
  switch (d.kind) {
    case 'PAYMENT':
      return `/payments/new?${q({ kind: 'ach', from: p.fromAccountId, recipient: p.recipientId, amount: p.amountMinor })}`;
    case 'INTERNAL_TRANSFER':
      return `/payments/new?${q({ kind: 'internal', from: p.fromAccountId, to: p.toAccountId, amount: p.amountMinor })}`;
    case 'RECIPIENT_ADD':
      return `/recipients?${q({ add: 1, name: p.name })}`;
    case 'RECIPIENT_ARCHIVE':
      return '/recipients';
    case 'CARD_FREEZE':
    case 'CARD_UNFREEZE':
      return p.cardId ? `/cards/${p.cardId}` : '/cards';
    case 'TICKET_REPLY':
      return p.ticketId ? `/support/${p.ticketId}?${q({ reply: p.body })}` : '/support';
    default:
      return `/support/new?${q({ subject: p.subject, category: p.category, body: p.body })}`;
  }
}

interface Drafts {
  pending: AssistantDraft | null;
  decided: Record<string, AssistantDraft['state']>;
  review(d: AssistantDraft): void;
  dismiss(d: AssistantDraft): Promise<void>;
  /** A screen finished an action of one of [kinds] with result [ref]: confirm the pending draft, if it is that kind. */
  done(kinds: string[], ref: string): Promise<void>;
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
    async (kinds: string[], ref: string) => {
      if (!pending || !kinds.includes(pending.kind)) return;
      try {
        await api.confirmAssistantDraft(pending.id, ref);
        setDecided((x) => ({ ...x, [pending.id]: 'CONFIRMED' }));
        toast.show('Done. The assistant recorded that you confirmed it.', 'success');
      } catch {
        toast.show('Done. The assistant could not record your confirmation.', 'info');
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

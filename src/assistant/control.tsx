import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Who opens the assistant (OG-035 R9): its floating button on a phone, and the command search on a desktop, which can
 * hand over the typed query to be sent as the first message.
 */
interface AssistantControl {
  open: boolean;
  setOpen(open: boolean | ((was: boolean) => boolean)): void;
  /** Opens the assistant and sends [query]. */
  ask(query: string): void;
  /** The query waiting to be sent, taken once by the assistant. */
  pending: string | null;
  clearPending(): void;
}

const Ctx = createContext<AssistantControl | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const ask = useCallback((query: string) => {
    setPending(query);
    setOpen(true);
  }, []);
  const clearPending = useCallback(() => setPending(null), []);
  const value = useMemo(
    () => ({ open, setOpen, ask, pending, clearPending }),
    [open, ask, pending, clearPending],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The control, or a local one when no provider is mounted (tests that render the widget alone). */
export function useAssistantControl(): AssistantControl {
  const shared = useContext(Ctx);
  const [open, setOpen] = useState(false);
  return (
    shared ?? {
      open,
      setOpen,
      ask: () => setOpen(true),
      pending: null,
      clearPending: () => undefined,
    }
  );
}

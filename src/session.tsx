import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { permissionsOf, type OnGemApi } from './api/client';
import { DemoOnGemApi } from './api/demo';
import { LiveOnGemApi } from './api/live';
import { useAuthSession } from './auth';
import { Button, Field, Input, Modal } from './design-system';

export type Mode = 'none' | 'demo' | 'live';

export interface Session {
  mode: Mode;
  api: OnGemApi;
  role: string | null;
  permissions: Set<string>;
  can(permission: string): boolean;
  enterDemo(): void;
  leave(): void;
  setRole(role: string | null): void;
}

const SessionContext = createContext<Session | null>(null);

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api-dev';

interface Ask {
  purpose: string;
  resolve(ok: boolean): void;
}

/** Demo step-up: the same dialog as live (OG-003), and any six digits confirm it. */
function DemoReverify({ ask, onDone }: { ask: Ask | null; onDone(ok: boolean): void }) {
  const [code, setCode] = useState('');
  const valid = /^\d{6}$/.test(code);
  const close = (ok: boolean) => {
    setCode('');
    onDone(ok);
  };
  return (
    <Modal
      open={Boolean(ask)}
      title="Confirm it is you"
      onClose={() => close(false)}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button data-testid="reverify-confirm" disabled={!valid} onClick={() => close(true)}>
            Confirm
          </Button>
        </>
      }
    >
      <p>Enter the 6-digit code from your authenticator app. In demo mode any 6 digits work.</p>
      <Field label="Verification code">
        <Input
          data-testid="reverify-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
    </Modal>
  );
}

export function SessionProvider({ children, initialMode = 'none', api: injected }: { children: ReactNode; initialMode?: Mode; api?: OnGemApi }) {
  const auth = useAuthSession();
  const [demoMode, setDemoMode] = useState(initialMode === 'demo');
  const [role, setRole] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const askRef = useRef<(purpose: string) => Promise<boolean>>(() => Promise.resolve(false));
  askRef.current = (purpose) => new Promise<boolean>((resolve) => setAsk({ purpose, resolve }));

  const demo = useMemo(() => injected ?? new DemoOnGemApi({ stepUp: (p) => askRef.current(p) }), [injected, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useMemo(
    () =>
      new LiveOnGemApi({
        baseUrl: API_BASE_URL,
        getToken: (o) => auth.getToken(o),
        reverify: (hint) => (auth.reverify ? auth.reverify(hint) : Promise.resolve(false)),
      }),
    [auth],
  );
  const mode: Mode = demoMode ? 'demo' : auth.signedIn ? 'live' : 'none';
  const api = mode === 'live' ? live : demo;
  const permissions = useMemo(() => permissionsOf(role), [role]);
  const leave = useCallback(() => {
    setDemoMode(false);
    setRole(null);
    if (auth.signedIn) void auth.signOut();
  }, [auth]);

  const value = useMemo<Session>(
    () => ({
      mode,
      api,
      role,
      permissions,
      can: (p) => permissions.has(p),
      enterDemo: () => setDemoMode(true),
      leave,
      setRole,
    }),
    [mode, api, role, permissions, leave],
  );
  return (
    <SessionContext.Provider value={value}>
      {children}
      <DemoReverify
        ask={ask}
        onDone={(ok) => {
          ask?.resolve(ok);
          setAsk(null);
        }}
      />
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { permissionsOf, type OnGemApi } from './api/client';
import { DemoOnGemApi } from './api/demo';
import { defaultDeviceKeys } from './api/device';
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
  /** The company the person picked in the switcher (G-69), or null for their default company. */
  companyId: string | null;
  /** Moves every screen to [companyId] with a new client, so nothing loaded for the previous company is kept. */
  switchCompany(companyId: string | null): void;
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

export function SessionProvider({
  children,
  initialMode = 'none',
  api: injected,
}: {
  children: ReactNode;
  initialMode?: Mode;
  api?: OnGemApi;
}) {
  const auth = useAuthSession();
  const [demoMode, setDemoMode] = useState(initialMode === 'demo');
  const [role, setRole] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const askRef = useRef<(purpose: string) => Promise<boolean>>(() => Promise.resolve(false));
  askRef.current = (purpose) => new Promise<boolean>((resolve) => setAsk({ purpose, resolve }));

  // A new demo API each time demo mode is entered, so a fresh demo starts from the sample data.
  const demo = useMemo(
    () =>
      injected ??
      new DemoOnGemApi({
        stepUp: (p) => askRef.current(p),
        // `?demo=solo` shows the demo as a one-person company, where OnGem approves (Q-091; videos, OG-032 R16).
        approvalBy:
          typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'solo'
            ? 'ONGEM'
            : 'COMPANY',
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [injected, demoMode],
  );
  // One live client for the signed-in person: the auth value changes on many Clerk renders, and a new client would
  // reload every screen and start a new recording session each time. It reads the current auth through a ref.
  const authRef = useRef(auth);
  authRef.current = auth;
  const userId = auth.user?.id ?? null;
  const [deviceKeys] = useState(defaultDeviceKeys);
  const live = useMemo(
    () =>
      new LiveOnGemApi({
        baseUrl: API_BASE_URL,
        personId: userId,
        deviceKeys,
        getToken: (o) => authRef.current.getToken(o),
        reverify: (hint) => {
          const r = authRef.current.reverify;
          return r ? r(hint) : Promise.resolve(false);
        },
      }),
    // A new client only when the person or the signed-in state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, auth.signedIn],
  );
  const mode: Mode = demoMode ? 'demo' : auth.signedIn ? 'live' : 'none';
  const base: OnGemApi = mode === 'live' ? live : demo;
  // The pick belongs to the client it was made on: a new person, demo or sign-in starts on the default company again.
  const [pick, setPick] = useState<{ base: OnGemApi; companyId: string } | null>(null);
  const picked = pick && pick.base === base ? pick : null;
  const api = useMemo(() => (picked ? base.forCompany(picked.companyId) : base), [base, picked]);
  const switchCompany = useCallback(
    (companyId: string | null) => {
      setRole(null);
      setPick(companyId ? { base, companyId } : null);
    },
    [base],
  );
  const permissions = useMemo(() => permissionsOf(role), [role]);
  const leave = useCallback(() => {
    setDemoMode(false);
    setRole(null);
    setPick(null);
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
      companyId: picked?.companyId ?? null,
      switchCompany,
    }),
    [mode, api, role, permissions, leave, picked, switchCompany],
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

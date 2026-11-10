import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { permissionsOf, READ_ONLY, type OnGemApi } from './api/client';
import type { CompanyState, Membership } from './api/types';
import { DemoOnGemApi } from './api/demo';
import { defaultDeviceKeys } from './api/device';
import { LiveOnGemApi } from './api/live';
import { useAuthSession } from './auth';
import { Button, Field, Input, Modal } from './design-system';
import { REGION } from './region';
import { t } from './i18n';

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
  /**
   * Moves every screen to [companyId] with a new client, so nothing loaded for the previous company is kept. With a
   * [region] other than the client's, the new client calls that region's API (OG-023 R12).
   */
  switchCompany(companyId: string | null, region?: string | null): void;
  /** The person's client in their default company and home region: the switcher asks every region from it. */
  homeApi: OnGemApi;
  /** The person's ACTIVE companies in every region that answered (OG-023 R12), as the shell last loaded them. */
  companies: Membership[];
  setCompanies(companies: Membership[]): void;
  /** OG-023 R13: the current company's lifecycle; anything but ACTIVE keeps only the reading permissions. */
  companyState: CompanyState;
  setCompanyState(state: CompanyState): void;
  /** The company the screens run in, as the shell read it from GET /v1/me. */
  currentCompanyId: string | null;
  setCurrentCompanyId(companyId: string | null): void;
}

const SessionContext = createContext<Session | null>(null);

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api-dev';

/**
 * OG-022 R11: the API base for banking calls once whereami has answered. The build's base stays when the company
 * lives in the build's own region (or whereami fails); otherwise the region's base, if it is https on an OnGem host.
 */
export function regionApiBase(
  answer: { region?: string | null; apiBaseUrl?: string | null } | null,
  fallback: string = API_BASE_URL,
): string {
  if (!answer?.region || answer.region === REGION || !answer.apiBaseUrl) return fallback;
  try {
    const u = new URL(answer.apiBaseUrl);
    const onGem = u.hostname === 'ongem.com' || u.hostname.endsWith('.ongem.com');
    return u.protocol === 'https:' && onGem ? u.origin : fallback;
  } catch {
    return fallback;
  }
}

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
      title={t('app.session.reverify.title')}
      onClose={() => close(false)}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            {t('app.common.cancel')}
          </Button>
          <Button data-testid="reverify-confirm" disabled={!valid} onClick={() => close(true)}>
            {t('app.common.confirm')}
          </Button>
        </>
      }
    >
      <p>{t('app.session.reverify.text')}</p>
      <Field label={t('app.session.reverify.code')}>
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
  const [apiBase, setApiBase] = useState({ url: API_BASE_URL, region: REGION as string });
  const live = useMemo(
    () =>
      new LiveOnGemApi({
        baseUrl: apiBase.url,
        region: apiBase.region,
        personId: userId,
        deviceKeys,
        getToken: (o) => authRef.current.getToken(o),
        reverify: (hint) => {
          const r = authRef.current.reverify;
          return r ? r(hint) : Promise.resolve(false);
        },
      }),
    // A new client only when the person, the signed-in state or the region's API base changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, auth.signedIn, apiBase],
  );
  // After sign-in, ask where the company lives (OG-022 R11); the build's base is the first and the fallback.
  useEffect(() => {
    if (!auth.signedIn || injected) {
      setApiBase({ url: API_BASE_URL, region: REGION });
      return;
    }
    let gone = false;
    live
      .whereami()
      .then((w) => {
        if (gone) return;
        const url = regionApiBase(w);
        setApiBase({ url, region: url !== API_BASE_URL && w.region ? w.region : REGION });
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, auth.signedIn]);
  const mode: Mode = demoMode ? 'demo' : auth.signedIn ? 'live' : 'none';
  const base: OnGemApi = mode === 'live' ? live : demo;
  // The pick belongs to the client it was made on: a new person, demo or sign-in starts on the default company again.
  const [companies, setCompanies] = useState<Membership[]>([]);
  const [companyState, setCompanyState] = useState<CompanyState>('ACTIVE');
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [pick, setPick] = useState<{ base: OnGemApi; companyId: string; region: string | null } | null>(null);
  const picked = pick && pick.base === base ? pick : null;
  const api = useMemo(() => {
    if (!picked) return base;
    // Another region's company is served by that region's API only (OG-023 R12, ADR-0050).
    const regional = picked.region && picked.region !== base.region ? base.forRegion(picked.region) : base;
    return (regional ?? base).forCompany(picked.companyId);
  }, [base, picked]);
  const switchCompany = useCallback(
    (companyId: string | null, region?: string | null) => {
      setRole(null);
      setCompanyState('ACTIVE');
      setPick(companyId ? { base, companyId, region: region ?? null } : null);
    },
    [base],
  );
  const permissions = useMemo(() => {
    const all = permissionsOf(role);
    return companyState === 'ACTIVE' ? all : new Set([...all].filter((p) => READ_ONLY.has(p)));
  }, [role, companyState]);
  const leave = useCallback(() => {
    setDemoMode(false);
    setRole(null);
    setPick(null);
    setCompanyState('ACTIVE');
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
      homeApi: base,
      companies,
      setCompanies,
      companyState,
      setCompanyState,
      currentCompanyId,
      setCurrentCompanyId,
    }),
    [
      mode,
      api,
      role,
      permissions,
      leave,
      picked,
      switchCompany,
      base,
      companies,
      companyState,
      currentCompanyId,
    ],
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

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
import { DemoOnGemApi, type StepUpDetail } from './api/demo';
import { defaultDeviceKeys } from './api/device';
import { LiveOnGemApi, type Whereami } from './api/live';
import { useAuthSession } from './auth';
import { Button, Field, Input, Modal } from './design-system';
import { IS_AE, REGION } from './region';
import { t } from './i18n';
import { formatMinor } from './lib/format';

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
  /** Signed in and still finding the person's region (OG-022 R25): no other call is made until it is known. */
  regionPending: boolean;
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

/**
 * OG-022 R25: the other region's API base, asked when the build's region knows no company for the person. From
 * `VITE_OTHER_REGION_API_BASE_URL`, else the other region's dev API (ADR-0050 names); a 409 wrong_region names it too.
 */
export const OTHER_REGION_API_BASE_URL =
  import.meta.env.VITE_OTHER_REGION_API_BASE_URL?.trim() ||
  (IS_AE
    ? import.meta.env.VITE_API_BASE_URL_US?.trim() || 'https://api-dev.ongem.com'
    : import.meta.env.VITE_API_BASE_URL_AE?.trim() || 'https://api-dev.ae.platform.ongem.com');

/**
 * OG-022 R24, R25 (ADR-0052): the API base for the signed-in person. The build's region is asked first; a company there,
 * or 409 wrong_region naming another region, settles it. When it knows no company (it may never have seen the person,
 * and then records nothing), the other region is asked the same way. Neither knowing the person, or a failure, keeps
 * the build's base. whereami never binds a device, so the region that does not hold the person is left with no record.
 */
export async function findRegionBase(
  ask: (base: string) => Promise<Whereami>,
  own: string = API_BASE_URL,
  other: string = OTHER_REGION_API_BASE_URL,
): Promise<{ url: string; region: string }> {
  const stay = { url: own, region: REGION as string };
  const settle = (w: Whereami) => {
    const url = regionApiBase(w, own);
    return url !== own && w.region ? { url, region: w.region } : stay;
  };
  let here: Whereami;
  try {
    here = await ask(own);
  } catch {
    return stay;
  }
  if (here.region) return settle(here);
  const otherRegion = IS_AE ? 'US' : 'AE';
  const otherBase = regionApiBase({ region: otherRegion, apiBaseUrl: other }, own);
  if (otherBase === own) return stay;
  try {
    const there = await ask(otherBase);
    return there.region ? settle(there) : stay;
  } catch {
    return stay;
  }
}

interface Ask {
  purpose: string;
  detail?: StepUpDetail;
  resolve(ok: boolean): void;
}

/**
 * FA-032: the step-up dialog names what the code confirms ("Send US$1,250.00 to Acme Supplies LLC"), from the action the
 * API asked it for; without one it falls back to the general title.
 */
export function stepUpTitle(detail?: StepUpDetail): string {
  if (!detail) return t('app.session.reverify.title');
  return t(`app.session.reverify.action.${detail.action}`, {
    amount: detail.amount ? formatMinor(detail.amount) : '',
    payee: detail.payee ?? t('app.session.reverify.payee_unknown'),
    last4: detail.last4 ?? '',
  });
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
      title={<span data-testid="reverify-title">{stepUpTitle(ask?.detail)}</span>}
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
      <p>
        {ask?.detail && <strong className="fw-reverify__lead">{t('app.session.reverify.title')}. </strong>}
        {t('app.session.reverify.text')}
      </p>
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

/** FA-056: `?state=readonly|slow|error` puts the demo in a state its data never reaches, for reviews and e2e. */
function demoScenario(): 'readonly' | 'slow' | 'error' | null {
  if (typeof window === 'undefined') return null;
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'readonly' || s === 'slow' || s === 'error' ? s : null;
}

const DEMO_FLAG = 'ongem.demo';
function demoFlag(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(DEMO_FLAG) === '1';
  } catch {
    return false;
  }
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
  // FA-053: demo mode lasts for the tab, so a reload stays in the demo (a flag only; no data is kept).
  const [demoMode, setDemoModeState] = useState(
    () => initialMode === 'demo' || (initialMode === 'none' && demoFlag()),
  );
  const setDemoMode = useCallback((on: boolean) => {
    setDemoModeState(on);
    try {
      if (on) sessionStorage.setItem(DEMO_FLAG, '1');
      else sessionStorage.removeItem(DEMO_FLAG);
    } catch {
      /* storage unavailable: demo lasts for this page */
    }
  }, []);
  const [role, setRole] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const askRef = useRef<(purpose: string, detail?: StepUpDetail) => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  askRef.current = (purpose, detail) =>
    new Promise<boolean>((resolve) => setAsk({ purpose, detail, resolve }));

  // A new demo API each time demo mode is entered, so a fresh demo starts from the sample data.
  const demo = useMemo(
    () =>
      injected ??
      new DemoOnGemApi({
        stepUp: (p, d) => askRef.current(p, d),
        // `?demo=solo` shows the demo as a one-person company, where OnGem approves (Q-091; videos, OG-032 R16).
        approvalBy:
          typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'solo'
            ? 'ONGEM'
            : 'COMPANY',
        scenario: demoScenario(),
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
  // The person whose region is known; until it is this person, the signed-in screens wait (OG-022 R25).
  const [regionFor, setRegionFor] = useState<string | null>(null);
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
  // After sign-in, find the person's region before any other call (OG-022 R11, R25): the build's region first, then the
  // other region; the build's base is the fallback. whereami binds no device, so nothing is left where they are unknown.
  useEffect(() => {
    if (!auth.signedIn || injected) {
      setApiBase({ url: API_BASE_URL, region: REGION });
      setRegionFor(null);
      return;
    }
    let gone = false;
    const ask = (baseUrl: string) =>
      new LiveOnGemApi({
        baseUrl,
        getToken: (o) => authRef.current.getToken(o),
        reverify: () => Promise.resolve(false),
      }).whereami();
    void findRegionBase(ask).then((found) => {
      if (gone) return;
      setApiBase(found);
      setRegionFor(userId);
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, auth.signedIn]);
  const regionPending = auth.signedIn && !demoMode && !injected && regionFor !== userId;
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
  }, [auth, setDemoMode]);

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
      regionPending,
    }),
    [
      mode,
      api,
      role,
      permissions,
      leave,
      setDemoMode,
      picked,
      switchCompany,
      base,
      companies,
      companyState,
      currentCompanyId,
      regionPending,
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

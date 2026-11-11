import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { InviteScreen } from './screens/Invite';
import { Button, Logo, Notice, Skeleton } from './design-system';
import { useAsync } from './lib/useAsync';
import { ApiError, errorText } from './api/errors';
import { CompanySwitcher } from './CompanySwitcher';
import { companyState, currentMembership, loadCompanies, switchable } from './lib/company';
import { AccountsScreen } from './screens/Accounts';
import { CardsScreen } from './screens/Cards';
import { HomeScreen } from './screens/Home';
import { OnboardingScreen } from './screens/Onboarding';
import { PaymentsScreen } from './screens/Payments';
import { SettingsScreen } from './screens/Settings';
import { SupportScreen } from './screens/Support';
import { NoticeBell, NotificationsScreen } from './screens/Notifications';
import { useSession } from './session';
import { AssistantWidget } from './assistant/AssistantWidget';
import { DraftProvider } from './assistant/drafts';
import { AssistantProvider } from './assistant/control';
import { CommandSearch } from './CommandSearch';
import { useWide } from './lib/useWide';
import { useAppearance } from './lib/appearance';
import { TeamScreen } from './screens/Team';
import { DocumentsScreen } from './screens/Documents';
import { MoreScreen } from './screens/More';
import { RECORDING_ENABLED, Recorder } from './recording/Recorder';
import { MORE, NAV, PHONE_TABS, pageTitle } from './nav';
import { t, useContent } from './i18n';
import './app-shell.css';

/** Every route names its page in the browser tab (WCAG 2.4.2, UI review 2026-11-07). */
function usePageTitle() {
  const { pathname } = useLocation();
  const locale = useContent();
  useEffect(() => {
    document.title = t('app.nav.document_title', { page: pageTitle(pathname) });
  }, [pathname, locale]);
}

/** Settings and sign out behind one button in the desktop top bar (a phone has More for both, OG-035 R8). */
function ProfileMenu({ onLeave }: { onLeave(): void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="fw-profile" ref={root}>
      <button
        type="button"
        className="fw-icon-button"
        data-testid="profile-menu"
        aria-label={t('app.shell.profile_menu')}
        aria-expanded={open}
        aria-controls="profile-menu-list"
        onClick={() => setOpen((x) => !x)}
      >
        <span aria-hidden="true" className="fw-profile__glyph" />
      </button>
      {open && (
        <div className="fw-profile__menu" id="profile-menu-list" data-testid="profile-menu-list">
          <NavLink to="/settings" className="fw-profile__item" data-testid="profile-settings">
            {t('app.nav.settings')}
          </NavLink>
          <button type="button" className="fw-profile__item" onClick={onLeave}>
            {t('app.common.sign_out')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Screens that end in a form's primary action: no floating button over them on a phone (FA-016). */
const FORM_ROUTES = [/^\/payments\/(new|top-up|schedules)/, /^\/support\/new/, /^\/onboarding/];

/** One glyph per phone tab; Pay is the centre tab, drawn larger (OG-035 R8). */
const TAB_ICON: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', // content-check: ignore (SVG path)
  accounts: 'M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18M12 3l9 5H3z', // content-check: ignore (SVG path)
  pay: 'M12 5v14M5 12h14', // content-check: ignore (SVG path)
  cards: 'M3 6h18v12H3zM3 10h18', // content-check: ignore (SVG path)
  more: 'M5 12h.01M12 12h.01M19 12h.01', // content-check: ignore (SVG path)
};

function Shell({ children, recording }: { children: ReactNode; recording: string | null }) {
  const {
    api,
    homeApi,
    mode,
    setRole,
    leave,
    companyId,
    switchCompany,
    setCompanies,
    setCompanyState,
    setCurrentCompanyId,
  } = useSession();
  const navigate = useNavigate();
  const wide = useWide();
  const { pathname } = useLocation();
  // More stays marked while one of its screens is open on a phone.
  const inMore = MORE.some((m) => pathname.startsWith(m.to));
  usePageTitle();
  // FA-030: a System appearance follows the device on every screen.
  useAppearance();
  const me = useAsync(() => api.me(), [api]);
  // OG-023 R12: the switcher lists the person's companies in every region, each asked with the same sign-in.
  const all = useAsync(() => loadCompanies(homeApi), [homeApi]);
  const person = me.status === 'success' ? me.data : null;
  const found = currentMembership(person);
  const merged = all.status === 'success' ? all.data.items : null;
  const membership = found && {
    ...(merged?.find((m) => m.companyId === found.companyId) ?? {}),
    ...found,
    region: api.region,
  };
  const companies =
    merged && merged.length ? merged : switchable(person).map((m) => ({ ...m, region: api.region }));
  const partial = all.status === 'success' && all.data.partial;
  const state = companyState(membership);
  useEffect(() => {
    if (me.status === 'success') setRole(membership?.role ?? null);
  }, [me.status, membership?.role, setRole]);
  useEffect(() => {
    if (me.status === 'success') setCompanyState(state);
  }, [me.status, state, setCompanyState]);
  useEffect(() => {
    if (me.status === 'success') setCurrentCompanyId(membership?.companyId ?? null);
  }, [me.status, membership?.companyId, setCurrentCompanyId]);
  useEffect(() => {
    if (merged) setCompanies(merged);
  }, [merged, setCompanies]);
  // A company the person was removed from since they picked it: back to the default company.
  const notMember =
    me.status === 'error' && me.error instanceof ApiError && me.error.code === 'company_not_member';
  useEffect(() => {
    if (notMember && companyId) switchCompany(null);
  }, [notMember, companyId, switchCompany]);
  const pick = (id: string, region: string | null) => {
    switchCompany(id, region);
    navigate('/');
  };
  // OG-035 R1: the company shows once, as the switcher: the top of the side bar, or the top bar on a phone.
  const switcher = (
    <CompanySwitcher companies={companies} current={membership} onPick={pick} partial={partial} />
  );
  const ready = me.status === 'success';
  const demoBadge = (
    <span className={`og-env og-env--${mode === 'demo' ? 'mock' : 'live'}`} data-testid="env-badge">
      {mode === 'demo' ? t('app.shell.env_demo') : t('app.shell.env_live')}
    </span>
  );
  // FA-016: on a phone the floating assistant stays off screens whose primary action sits at the bottom of a form.
  const formRoute = FORM_ROUTES.some((re) => re.test(pathname));
  return (
    <div className="fw-shell" data-testid="shell">
      <a href="#main" className="og-skip">
        {t('app.common.skip')}
      </a>
      <aside className="fw-side">
        {/* FA-005, FA-010: the wordmark lines up with the nav text on both sides; Demo sits next to it. */}
        <div className="fw-side__brand">
          <Logo />
          {wide && demoBadge}
        </div>
        {wide && (
          <div className="fw-side__company" data-testid="side-company">
            {switcher}
          </div>
        )}
        <nav aria-label={t('app.shell.main_nav')}>
          <ul className="og-nav">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  data-testid={`nav-${n.id}`}
                  className={({ isActive }) => (isActive ? 'og-nav__link is-active' : 'og-nav__link')}
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {/* FA-055: which bank holds the money, in every signed-in screen (no bank name in the AE build). */}
        <p className="fw-side__disclosure" data-testid="side-disclosure">
          {t('app.shell.disclosure')}
        </p>
      </aside>
      <div className="fw-main">
        <header className="og-topbar fw-topbar">
          {wide ? (
            // FA-010: the page's name starts the desktop bar.
            <span className="fw-topbar__title" data-testid="top-title">
              {pageTitle(pathname)}
            </span>
          ) : (
            // FA-004 (UX-12, Karim 2026-11-07): the wordmark on every size; the company switcher is the bar's second line.
            <span className="fw-topbar__brand" data-testid="top-brand">
              <span className="fw-topbar__logo">
                <Logo />
              </span>
              {demoBadge}
            </span>
          )}
          {!wide && (
            <span className="fw-topbar__company" data-testid="top-company">
              {switcher}
            </span>
          )}
          <span className="og-topbar__right">
            {ready && wide && <CommandSearch />}
            {ready && <NoticeBell />}
            {wide && <ProfileMenu onLeave={leave} />}
          </span>
        </header>
        <main className="fw-content" id="main">
          {me.status === 'loading' ? (
            <Skeleton label={t('app.shell.loading_company')} />
          ) : me.status === 'error' ? (
            <Notice
              status="failure"
              action={
                <span className="fw-actions">
                  <Button variant="secondary" onClick={me.reload}>
                    {t('app.common.try_again')}
                  </Button>
                  <Button variant="ghost" onClick={leave}>
                    {t('app.common.sign_out')}
                  </Button>
                </span>
              }
            >
              <span data-testid="me-error">
                {t('app.shell.company_error', { error: errorText(me.error) })}
              </span>
            </Notice>
          ) : (
            <>
              {state !== 'ACTIVE' && (
                <Notice status="info">
                  <span data-testid="company-read-only">
                    {t(`app.shell.read_only.${state.toLowerCase()}`)}
                  </span>
                </Notice>
              )}
              {children}
            </>
          )}
        </main>
      </div>
      <nav aria-label={t('app.nav.tab_bar')} className="fw-bottom" data-testid="bottom-nav">
        <ul className="og-nav fw-bottom__list">
          {PHONE_TABS.map((n) => (
            <li key={n.id}>
              <NavLink
                to={n.to}
                end={n.end || n.id === 'pay'}
                data-testid={`tab-${n.id}`}
                className={({ isActive }) =>
                  `og-nav__link fw-tab${n.id === 'pay' ? ' fw-tab--pay' : ''}${
                    isActive || (n.id === 'more' && inMore) ? ' is-active' : ''
                  }`
                }
              >
                <svg
                  aria-hidden="true"
                  className="fw-tab__icon"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={n.id === 'more' ? 3 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={TAB_ICON[n.id]} />
                </svg>
                <span className="fw-tab__label">{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {ready && <AssistantWidget fab={!wide && !formRoute} recordingSessionId={recording} />}
    </div>
  );
}

export default function SignedIn() {
  const { companyId } = useSession();
  const { search } = useLocation();
  if (new URLSearchParams(search).has('company')) return <LinkCompany />;
  return <CompanyScope key={companyId ?? 'default'} />;
}

/**
 * OG-023 R14: a link that names its company (`?company=<id>`, from a notice) opens that company first, in its region,
 * when it is one of the person's; then the page itself, without the parameter. Any other id is ignored.
 */
function LinkCompany() {
  const { companyId, homeApi, switchCompany } = useSession();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(search);
  const wanted = params.get('company');
  params.delete('company');
  const rest = params.toString();
  useEffect(() => {
    let gone = false;
    const open = () =>
      !gone && navigate({ pathname, search: rest ? `?${rest}` : '', hash }, { replace: true });
    loadCompanies(homeApi)
      .then((c) => {
        if (gone) return;
        const m = c.items.find((x) => x.companyId === wanted);
        const here = companyId ?? c.defaultCompanyId;
        if (m && m.companyId !== here) switchCompany(m.companyId, m.region ?? null);
      })
      .catch(() => undefined)
      .finally(open);
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);
  return <Skeleton label={t('app.shell.opening_company')} />;
}

/** Everything under one company (G-69): a switch remounts it, so no screen, draft or recording outlives the company. */
function CompanyScope() {
  const [recording, setRecording] = useState<string | null>(null);
  return (
    <DraftProvider>
      <AssistantProvider>
        <Shell recording={recording}>
          {RECORDING_ENABLED && <Recorder onSession={setRecording} />}
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/accounts" element={<AccountsScreen />} />
            <Route path="/accounts/:id" element={<AccountsScreen />} />
            <Route path="/payments" element={<PaymentsScreen />} />
            <Route path="/payments/new" element={<PaymentsScreen />} />
            <Route path="/payments/top-up" element={<PaymentsScreen />} />
            <Route path="/payments/schedules" element={<PaymentsScreen />} />
            <Route path="/payments/recipients" element={<PaymentsScreen />} />
            <Route path="/payments/approvals" element={<PaymentsScreen />} />
            <Route path="/payments/:id" element={<PaymentsScreen />} />
            <Route path="/recipients" element={<ToRecipients />} />
            <Route path="/cards" element={<CardsScreen />} />
            <Route path="/cards/:id" element={<CardsScreen />} />
            <Route path="/team" element={<TeamScreen />} />
            <Route path="/documents" element={<DocumentsScreen />} />
            <Route path="/more" element={<MoreScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="/support" element={<SupportScreen />} />
            <Route path="/support/new" element={<SupportScreen />} />
            <Route path="/support/:id" element={<SupportScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/notifications" element={<NotificationsScreen />} />
            <Route path="/invite/:token" element={<InviteScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </AssistantProvider>
    </DraftProvider>
  );
}

/** OG-035 R6: Recipients moved into Payments; the old route keeps working, with its query (`?add=1`, `?name=`). */
function ToRecipients() {
  const { search } = useLocation();
  return <Navigate to={`/payments/recipients${search}`} replace />;
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, Logo, Notice, Skeleton } from './design-system';
import { useAsync } from './lib/useAsync';
import { ApiError, errorText } from './api/errors';
import { CompanySwitcher } from './CompanySwitcher';
import { currentMembership, switchable } from './lib/company';
import { AccountsScreen } from './screens/Accounts';
import { CardsScreen } from './screens/Cards';
import { HomeScreen } from './screens/Home';
import { OnboardingScreen } from './screens/Onboarding';
import { PaymentsScreen } from './screens/Payments';
import { RecipientsScreen } from './screens/Recipients';
import { SettingsScreen } from './screens/Settings';
import { SupportScreen } from './screens/Support';
import { NoticeBell, NotificationsScreen } from './screens/Notifications';
import { useSession } from './session';
import { AssistantWidget } from './assistant/AssistantWidget';
import { DraftProvider } from './assistant/drafts';
import { RECORDING_ENABLED, Recorder } from './recording/Recorder';
import { NAV, pageTitle } from './nav';
import { t, useContent } from './i18n';

/** Every route names its page in the browser tab (WCAG 2.4.2, UI review 2026-11-07). */
function usePageTitle() {
  const { pathname } = useLocation();
  const locale = useContent();
  useEffect(() => {
    document.title = t('app.nav.document_title', { page: pageTitle(pathname) });
  }, [pathname, locale]);
}

/** Settings, the company switch and sign out, behind one button on a phone where the bottom bar has five tabs. */
function ProfileMenu({ children, onLeave }: { children?: ReactNode; onLeave(): void }) {
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
          {children}
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

function Shell({ children, assistant }: { children: ReactNode; assistant?: ReactNode }) {
  const { api, mode, setRole, leave, companyId, switchCompany } = useSession();
  const navigate = useNavigate();
  usePageTitle();
  const me = useAsync(() => api.me(), [api]);
  const person = me.status === 'success' ? me.data : null;
  const membership = currentMembership(person);
  useEffect(() => {
    if (me.status === 'success') setRole(membership?.role ?? null);
  }, [me.status, membership?.role, setRole]);
  // A company the person was removed from since they picked it: back to the default company.
  const notMember =
    me.status === 'error' && me.error instanceof ApiError && me.error.code === 'company_not_member';
  useEffect(() => {
    if (notMember && companyId) switchCompany(null);
  }, [notMember, companyId, switchCompany]);
  const pick = (id: string) => {
    switchCompany(id);
    navigate('/');
  };
  const link = (n: (typeof NAV)[number]) => (
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
  );
  const links = NAV.map(link);
  // A phone keeps five tabs; Settings moves to the profile menu (UI review 2026-11-07).
  const bottomLinks = NAV.filter((n) => n.to !== '/settings').map(link);
  return (
    <div className="fw-shell" data-testid="shell">
      <a href="#main" className="og-skip">
        {t('app.common.skip')}
      </a>
      <aside className="fw-side">
        <Logo />
        {membership?.companyName && <span className="fw-company">{membership.companyName}</span>}
        <nav aria-label={t('app.shell.main_nav')}>
          <ul className="og-nav">{links}</ul>
        </nav>
      </aside>
      <div className="fw-main">
        <header className="og-topbar fw-topbar">
          <span className="fw-topbar__logo" aria-hidden="true">
            <Logo />
          </span>
          <span className={`og-env og-env--${mode === 'demo' ? 'mock' : 'live'}`} data-testid="env-badge">
            {mode === 'demo' ? t('app.shell.env_demo') : t('app.shell.env_live')}
          </span>
          <span className="og-topbar__right">
            <span className="fw-topbar__company">
              <CompanySwitcher companies={switchable(person)} current={membership} onPick={pick} />
            </span>
            {me.status === 'success' && <NoticeBell />}
            {me.status === 'success' && assistant}
            <ProfileMenu onLeave={leave}>
              {switchable(person).length > 1 && (
                <CompanySwitcher companies={switchable(person)} current={membership} onPick={pick} />
              )}
            </ProfileMenu>
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
            children
          )}
        </main>
      </div>
      <nav aria-label={t('app.shell.main_nav')} className="fw-bottom" data-testid="bottom-nav">
        <ul className="og-nav fw-bottom__list">{bottomLinks}</ul>
      </nav>
    </div>
  );
}

export default function SignedIn() {
  const { companyId } = useSession();
  return <CompanyScope key={companyId ?? 'default'} />;
}

/** Everything under one company (G-69): a switch remounts it, so no screen, draft or recording outlives the company. */
function CompanyScope() {
  const [recording, setRecording] = useState<string | null>(null);
  return (
    <DraftProvider>
      <Shell assistant={<AssistantWidget recordingSessionId={recording} />}>
        {RECORDING_ENABLED && <Recorder onSession={setRecording} />}
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/accounts" element={<AccountsScreen />} />
          <Route path="/accounts/:id" element={<AccountsScreen />} />
          <Route path="/payments" element={<PaymentsScreen />} />
          <Route path="/payments/new" element={<PaymentsScreen />} />
          <Route path="/payments/top-up" element={<PaymentsScreen />} />
          <Route path="/payments/schedules" element={<PaymentsScreen />} />
          <Route path="/payments/:id" element={<PaymentsScreen />} />
          <Route path="/recipients" element={<RecipientsScreen />} />
          <Route path="/cards" element={<CardsScreen />} />
          <Route path="/cards/:id" element={<CardsScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/support" element={<SupportScreen />} />
          <Route path="/support/new" element={<SupportScreen />} />
          <Route path="/support/:id" element={<SupportScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/notifications" element={<NotificationsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </DraftProvider>
  );
}

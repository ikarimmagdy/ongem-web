import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
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
import { useSession } from './session';
import { AssistantWidget } from './assistant/AssistantWidget';
import { DraftProvider } from './assistant/drafts';
import { RECORDING_ENABLED, Recorder } from './recording/Recorder';
import { NAV } from './nav';

function Shell({ children }: { children: ReactNode }) {
  const { api, mode, setRole, leave, companyId, switchCompany } = useSession();
  const navigate = useNavigate();
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
  const links = NAV.map((n) => (
    <li key={n.to}>
      <NavLink
        to={n.to}
        end={n.end}
        data-testid={`nav-${n.label.toLowerCase()}`}
        className={({ isActive }) => (isActive ? 'og-nav__link is-active' : 'og-nav__link')}
      >
        {n.label}
      </NavLink>
    </li>
  ));
  return (
    <div className="fw-shell" data-testid="shell">
      <a href="#main" className="og-skip">
        Skip to content
      </a>
      <aside className="fw-side">
        <Logo />
        {membership?.companyName && <span className="fw-company">{membership.companyName}</span>}
        <nav aria-label="Main">
          <ul className="og-nav">{links}</ul>
        </nav>
      </aside>
      <div className="fw-main">
        <header className="og-topbar">
          <span className={`og-env og-env--${mode === 'demo' ? 'mock' : 'live'}`} data-testid="env-badge">
            {mode === 'demo' ? 'Demo' : 'Live'}
          </span>
          <CompanySwitcher companies={switchable(person)} current={membership} onPick={pick} />
        </header>
        <main className="fw-content" id="main">
          {me.status === 'loading' ? (
            <Skeleton label="Loading your company" />
          ) : me.status === 'error' ? (
            <Notice
              status="failure"
              action={
                <span className="fw-actions">
                  <Button variant="secondary" onClick={me.reload}>
                    Try again
                  </Button>
                  <Button variant="ghost" onClick={leave}>
                    Sign out
                  </Button>
                </span>
              }
            >
              <span data-testid="me-error">We could not load your company. {errorText(me.error)}</span>
            </Notice>
          ) : (
            children
          )}
        </main>
      </div>
      <nav aria-label="Main" className="fw-bottom" data-testid="bottom-nav">
        <ul className="og-nav fw-bottom__list">{links}</ul>
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
      <Shell>
        {RECORDING_ENABLED && <Recorder onSession={setRecording} />}
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/accounts" element={<AccountsScreen />} />
          <Route path="/accounts/:id" element={<AccountsScreen />} />
          <Route path="/payments" element={<PaymentsScreen />} />
          <Route path="/payments/new" element={<PaymentsScreen />} />
          <Route path="/payments/top-up" element={<PaymentsScreen />} />
          <Route path="/payments/:id" element={<PaymentsScreen />} />
          <Route path="/recipients" element={<RecipientsScreen />} />
          <Route path="/cards" element={<CardsScreen />} />
          <Route path="/cards/:id" element={<CardsScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/support" element={<SupportScreen />} />
          <Route path="/support/new" element={<SupportScreen />} />
          <Route path="/support/:id" element={<SupportScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AssistantWidget recordingSessionId={recording} />
      </Shell>
    </DraftProvider>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Button, Logo, Notice, Skeleton } from './design-system';
import { useAsync } from './lib/useAsync';
import { errorText } from './api/errors';
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
import { Recorder } from './recording/Recorder';
import { NAV } from './nav';

function Shell({ children }: { children: ReactNode }) {
  const { api, mode, setRole, leave } = useSession();
  const me = useAsync(() => api.me(), [api]);
  const membership = me.status === 'success' ? me.data.memberships[0] : undefined;
  useEffect(() => {
    if (me.status === 'success') setRole(membership?.role ?? null);
  }, [me.status, membership?.role, setRole]);
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
          <span className="fw-company">{membership?.companyName}</span>
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
  const [recording, setRecording] = useState<string | null>(null);
  return (
    <DraftProvider>
      <Shell>
        <Recorder onSession={setRecording} />
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/accounts" element={<AccountsScreen />} />
          <Route path="/accounts/:id" element={<AccountsScreen />} />
          <Route path="/payments" element={<PaymentsScreen />} />
          <Route path="/payments/new" element={<PaymentsScreen />} />
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

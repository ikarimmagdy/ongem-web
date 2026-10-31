import { useEffect, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthSession } from './auth';
import { Button, Logo, Notice, Skeleton, ThemeProvider, ToastProvider } from './design-system';
import { useAsync } from './lib/useAsync';
import { AccountsScreen } from './screens/Accounts';
import { CardsScreen } from './screens/Cards';
import { HomeScreen } from './screens/Home';
import { OnboardingScreen } from './screens/Onboarding';
import { PaymentsScreen } from './screens/Payments';
import { RecipientsScreen } from './screens/Recipients';
import { SettingsScreen } from './screens/Settings';
import { SupportScreen } from './screens/Support';
import { SessionProvider, useSession, type Mode } from './session';
import './web.css';

export const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/accounts', label: 'Accounts' },
  { to: '/payments', label: 'Payments' },
  { to: '/cards', label: 'Cards' },
  { to: '/support', label: 'Support' },
  { to: '/settings', label: 'Settings' },
];

/** Sign-in with the Clerk customer instance; with no key the build says so and offers demo mode (OG-030 R1). */
export function SignInScreen() {
  const auth = useAuthSession();
  const { enterDemo } = useSession();
  return (
    <main className="fw-signin" id="main">
      <div className="fw-signin__panel">
        <Logo />
        <h1>Business banking for founders</h1>
        {!auth.available ? (
          <Notice status="info">
            <strong>Sign-in is not configured for this build</strong>. This build has no sign-in key. You can explore
            the app with sample data.
          </Notice>
        ) : !auth.loaded || !auth.SignIn ? (
          <Skeleton label="Loading sign-in" />
        ) : (
          <auth.SignIn />
        )}
        <Button data-testid="explore-demo" variant={auth.available ? 'secondary' : 'primary'} onClick={enterDemo}>
          Explore demo
        </Button>
      </div>
    </main>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { api, mode, setRole } = useSession();
  const me = useAsync(() => api.me(), [api]);
  const membership = me.status === 'success' ? me.data.memberships[0] : undefined;
  useEffect(() => {
    if (me.status === 'success') setRole(membership?.role ?? null);
  }, [me.status, membership?.role, setRole]);
  const links = NAV.map((n) => (
    <li key={n.to}>
      <NavLink to={n.to} end={n.end} data-testid={`nav-${n.label.toLowerCase()}`} className={({ isActive }) => (isActive ? 'og-nav__link is-active' : 'og-nav__link')}>
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
          {me.status === 'loading' ? <Skeleton label="Loading your company" /> : children}
        </main>
      </div>
      <nav aria-label="Main" className="fw-bottom" data-testid="bottom-nav">
        <ul className="og-nav fw-bottom__list">
          {links}
        </ul>
      </nav>
    </div>
  );
}

export function Routed() {
  const { mode } = useSession();
  if (mode === 'none') return <SignInScreen />;
  return (
    <Shell>
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
    </Shell>
  );
}

export function App({ initialMode }: { initialMode?: Mode } = {}) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SessionProvider initialMode={initialMode}>
          <Routed />
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

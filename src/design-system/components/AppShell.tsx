import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { t } from '../../i18n/store';
import { PRODUCT_NAME } from '../theme/branding';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Logo } from './Logo';
import { Select } from './Select';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export interface AppShellProps {
  nav: NavItem[];
  environment: { label: string; tone: 'mock' | 'live' };
  user?: { name: string; role: string };
  /** Shown when a session is signed in. */
  onSignOut?: () => void;
  onManageAccount?: () => void;
  /** Shown when nobody is signed in and signing in is possible. */
  onSignIn?: () => void;
  children: ReactNode;
}

export function AppShell({
  nav,
  environment,
  user,
  onSignOut,
  onManageAccount,
  onSignIn,
  children,
}: AppShellProps) {
  const { theme, themes, setTheme } = useTheme();
  return (
    <div className="og-shell">
      <a href="#main" className="og-skip">
        {t('app.common.skip')}
      </a>
      <aside className="og-shell__side">
        <div className="og-shell__brand">
          <Logo />
          <span className="og-shell__product">{PRODUCT_NAME}</span>
        </div>
        <nav aria-label={t('app.shell.main_nav')}>
          <ul className="og-nav">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'og-nav__link is-active' : 'og-nav__link')}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="og-shell__main">
        <header className="og-topbar">
          <span className={`og-env og-env--${environment.tone}`} data-testid="env-badge">
            {environment.label}
          </span>
          <div className="og-topbar__right">
            <label className="og-topbar__theme">
              <span className="og-visually-hidden">{t('app.settings.theme')}</span>
              <Select
                aria-label={t('app.settings.theme')}
                value={theme.id}
                onChange={(e) => setTheme(e.target.value)}
                options={themes.map((t) => ({ value: t.id, label: t.name }))}
              />
            </label>
            {user && (
              <span className="og-user">
                <span className="og-user__avatar" aria-hidden="true">
                  {user.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')}
                </span>
                <span className="og-user__text">
                  <span className="og-user__name">{user.name}</span>
                  <span className="og-user__role">{user.role}</span>
                </span>
              </span>
            )}
            {onManageAccount && (
              <Button variant="ghost" size="sm" onClick={onManageAccount}>
                {t('app.ds.account')}
              </Button>
            )}
            {onSignOut && (
              <Button variant="secondary" size="sm" onClick={onSignOut}>
                {t('app.common.sign_out')}
              </Button>
            )}
            {onSignIn && (
              <Button size="sm" onClick={onSignIn}>
                {t('app.ds.sign_in')}
              </Button>
            )}
          </div>
        </header>
        <main id="main" className="og-shell__content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

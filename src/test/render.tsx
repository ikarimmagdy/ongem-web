import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Routed } from '../App';
import type { OnGemApi } from '../api/client';
import { AuthProvider, NO_AUTH, type AuthSession } from '../auth';
import { ThemeProvider, ToastProvider } from '../design-system';
import { SessionProvider, type Mode } from '../session';

/** The whole founder web at [route], in demo mode by default, with no sign-in key (as this build has). */
export function renderApp(route = '/', opts: { api?: OnGemApi; mode?: Mode; auth?: AuthSession } = {}) {
  return render(
    <AuthProvider value={opts.auth ?? NO_AUTH}>
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider>
          <ToastProvider timeoutMs={0}>
            <SessionProvider initialMode={opts.mode ?? 'demo'} api={opts.api}>
              <Routed />
            </SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

/**
 * A phone-width layout for the shell (OG-035): `useWide` reads matchMedia, which jsdom lacks, so without this the
 * desktop layout renders (side bar switcher, command search, no floating assistant button). Returns the undo.
 */
export function asPhone(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({
    matches: !q.includes('min-width'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

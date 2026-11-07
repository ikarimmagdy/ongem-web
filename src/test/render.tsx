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

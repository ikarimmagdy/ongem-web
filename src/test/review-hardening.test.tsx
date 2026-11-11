import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { Routed } from '../App';
import { DemoOnGemApi } from '../api/demo';
import { ApiError } from '../api/errors';
import { taskReturnUrl } from '../auth/ClerkAuth';
import { AuthProvider, NO_AUTH, type AuthSession } from '../auth';
import { ThemeProvider, ToastProvider } from '../design-system';
import { SessionProvider } from '../session';
import { asPhone, renderApp } from './render';

const at = (pathname: string, search = '') => ({ origin: 'https://web.ongem.com', pathname, search });

describe('review fixes: sign-in, shell, widget and headers', () => {
  it('WEB-SEC-07 Clerk returns to this origin only, whatever the path looks like', () => {
    expect(taskReturnUrl(at('/payments', '?x=1'))).toBe('https://web.ongem.com/payments?x=1');
    for (const p of ['//evil.example/x', '/\\evil.example', '///evil.example'])
      expect(new URL(taskReturnUrl(at(p))).origin).toBe('https://web.ongem.com');
  });

  it('WEB-COR-07 a pending Clerk task shows its form in place of sign-in', () => {
    const auth: AuthSession = {
      ...NO_AUTH,
      available: true,
      pendingTask: 'setup-mfa',
      Task: ({ task }) => <p data-testid="clerk-task">{task}</p>,
      SignIn: () => <p data-testid="clerk-sign-in" />,
    };
    render(
      <AuthProvider value={auth}>
        <MemoryRouter>
          <ThemeProvider>
            <ToastProvider timeoutMs={0}>
              <SessionProvider>
                <Routed />
              </SessionProvider>
            </ToastProvider>
          </ThemeProvider>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(screen.getByTestId('clerk-task')).toHaveTextContent('setup-mfa');
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('WEB-COR-06 a failed /v1/me shows the reason, a retry and sign out, not empty screens', async () => {
    const api = new DemoOnGemApi();
    let fail = true;
    const real = api.me.bind(api);
    api.me = () =>
      fail ? Promise.reject(new ApiError(401, 'mfa_required', 'Set up two-step verification.')) : real();
    renderApp('/', { api });
    expect(await screen.findByTestId('me-error')).toHaveTextContent('Set up two-step verification.');
    expect(screen.queryByTestId('home-total')).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('home-total')).toBeInTheDocument();
  });

  it('WEB-COR-05 a failed statement or dismiss shows an error instead of failing silently', async () => {
    // OG-035 R9: the floating button is the phone's way to the assistant.
    const undo = asPhone();
    try {
      const api = new DemoOnGemApi();
      api.statement = () => Promise.reject(new ApiError(503, 'bank_unavailable', 'The bank did not answer.'));
      api.abandonAssistantDraft = () => Promise.reject(new ApiError(0, 'network'));
      renderApp('/accounts/acc_demo_ops', { api });
      await userEvent.click(await screen.findByTestId('statement-2026-09'));
      expect(await screen.findByText('The bank did not answer.')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('assistant-open'));
      await userEvent.type(screen.getByTestId('assistant-input'), 'Freeze my card');
      await userEvent.click(screen.getByTestId('assistant-send'));
      await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
      expect(
        await screen.findByText('Could not reach OnGem. Check your connection and try again.'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('assistant-review')).toBeInTheDocument();
    } finally {
      undo();
    }
  });

  it('WEB-A11Y-01 the widget takes focus when opened and Escape closes it back to its button', async () => {
    // OG-035 R9: the floating button is the phone's way to the assistant.
    const undo = asPhone();
    try {
      renderApp('/');
      const open = await screen.findByTestId('assistant-open');
      expect(open).toHaveAttribute('aria-controls', 'assistant-panel');
      open.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(screen.getByTestId('assistant-input')).toHaveFocus());
      expect(screen.getByLabelText('Message the assistant')).toBe(screen.getByTestId('assistant-input'));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
      expect(screen.getByTestId('assistant-open')).toHaveFocus();
    } finally {
      undo();
    }
  });

  it('WEB-SEC-05 the CloudFront headers policy carries a strict CSP and the security headers', () => {
    const p = JSON.parse(readFileSync('security-headers.json', 'utf8'));
    const csp: string = p.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
    const directives = Object.fromEntries(
      csp
        .split(';')
        .map((d) => d.trim().split(/\s+/))
        .map(([k, ...v]) => [k, v]),
    );
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
    expect(directives['script-src']).not.toContain("'unsafe-eval'");
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
    expect(p.SecurityHeadersConfig.StrictTransportSecurity.AccessControlMaxAgeSec).toBeGreaterThanOrEqual(
      31536000,
    );
    expect(p.SecurityHeadersConfig.FrameOptions.FrameOption).toBe('DENY');
  });

  it('WEB-SEC-05 the CSP lets the Clerk customer instance load its script and call its Frontend API', () => {
    const p = JSON.parse(readFileSync('security-headers.json', 'utf8'));
    const csp: string = p.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
    const directives = Object.fromEntries(
      csp
        .split(';')
        .map((d) => d.trim().split(/\s+/))
        .map(([k, ...v]) => [k, v]),
    );
    const hosts = ['https://clerk.ongem.com', 'https://obliging-hermit-8825.clerk.accounts.dev'];
    // A publishable key is pk_<env>_ then base64 of the Frontend API host and a trailing $.
    const key = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim();
    if (key) hosts.push(`https://${atob(key.split('_')[2] ?? '').replace(/\$$/, '')}`);
    for (const h of hosts) {
      expect(directives['script-src']).toContain(h);
      expect(directives['connect-src']).toContain(h);
    }
  });
});

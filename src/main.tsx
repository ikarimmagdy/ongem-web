import { StrictMode, useEffect, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import './fonts';
import { App } from './App';
import { CLERK_PUBLISHABLE_KEY } from './auth/key';
import { clerkFirst } from './auth/defer';
import { AuthProvider, NO_AUTH } from './auth/session';
import { initContent } from './i18n';
import { isAppPath } from './public/content';
import { startTelemetry, telemetryConfig } from './telemetry';

const el = document.getElementById('root');
if (!el) throw new Error('Missing #root');
const root = createRoot(el);

function NoAuth({ children }: { children: ReactNode }) {
  return <AuthProvider value={NO_AUTH}>{children}</AuthProvider>;
}

// Clerk is on its way (PS-013): the public site shows as signed out, sign-in as loading.
const CLERK_PENDING = { ...NO_AUTH, available: true, loaded: false };
function ClerkPending({ children }: { children: ReactNode }) {
  return <AuthProvider value={CLERK_PENDING}>{children}</AuthProvider>;
}

/** Calls [onEnter] when the visitor opens an app path, such as Sign in or Get started. */
function OnAppPath({ onEnter }: { onEnter: () => void }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (isAppPath(pathname)) onEnter();
  }, [pathname, onEnter]);
  return null;
}

// The prerendered home in index.html shows until this first render replaces it (OG-030-N3).
function mount(Auth: ComponentType<{ children: ReactNode }>, onAppPath?: () => void) {
  root.render(
    <StrictMode>
      <Auth>
        <BrowserRouter>
          {onAppPath && <OnAppPath onEnter={onAppPath} />}
          <App />
        </BrowserRouter>
      </Auth>
    </StrictMode>,
  );
}

// OG-037: uncaught errors from now on; the exporter loads after load and idle (blank VITE_OTEL_ENDPOINT: off).
startTelemetry(
  telemetryConfig(import.meta.env, {
    service: 'ongem-web',
    version: __APP_VERSION__,
    secretAfter: ['invite'],
    demo: () => {
      try {
        return sessionStorage.getItem('ongem.demo') === '1';
      } catch {
        return false;
      }
    },
  }),
);

// The remembered language (Arabic loads its texts first) and newer texts kept from the API, before the first render
// (OG-033). A build without a sign-in key never downloads Clerk; a signed-out visitor on the public site downloads it
// only on the way to sign-in (PS-013).
void initContent().then(() => {
  if (!CLERK_PUBLISHABLE_KEY) return mount(NoAuth);
  let asked = false;
  const clerk = () => {
    if (asked) return;
    asked = true;
    void import('./auth/ClerkAuth').then(({ ClerkAuth }) => mount(ClerkAuth));
  };
  if (clerkFirst(window.location.pathname, document.cookie)) clerk();
  else mount(ClerkPending, clerk);
});

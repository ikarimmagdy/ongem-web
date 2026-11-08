import { StrictMode, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './fonts';
import { App } from './App';
import { CLERK_PUBLISHABLE_KEY } from './auth/key';
import { AuthProvider, NO_AUTH } from './auth/session';
import { initContent } from './i18n';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

function NoAuth({ children }: { children: ReactNode }) {
  return <AuthProvider value={NO_AUTH}>{children}</AuthProvider>;
}

// The prerendered sign-in screen in index.html shows until this first render replaces it (OG-030-N3).
function mount(Auth: ComponentType<{ children: ReactNode }>) {
  createRoot(root!).render(
    <StrictMode>
      <Auth>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Auth>
    </StrictMode>,
  );
}

// The remembered language (Arabic loads its texts first) and newer texts kept from the API, before the first render
// (OG-033). A build without a sign-in key never downloads Clerk.
void initContent().then(() => {
  if (CLERK_PUBLISHABLE_KEY) void import('./auth/ClerkAuth').then(({ ClerkAuth }) => mount(ClerkAuth));
  else mount(NoAuth);
});

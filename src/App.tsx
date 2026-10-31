import { lazy, Suspense, useEffect } from 'react';
import { useAuthSession } from './auth';
import { Button, Logo, Notice, Skeleton, ThemeProvider, ToastProvider } from './design-system';
import { SessionProvider, useSession, type Mode } from './session';
import { PRIVACY_LINE } from './recording/privacy';
import './web.css';

export { NAV } from './nav';

// The signed-in shell and its screens are a separate chunk, so the first screen loads only what sign-in needs (OG-030-N3).
const loadSignedIn = () => import('./SignedIn');
const SignedIn = lazy(loadSignedIn);

/** Sign-in with the Clerk customer instance; with no key the build says so and offers demo mode (OG-030 R1). */
export function SignInScreen() {
  const auth = useAuthSession();
  const { enterDemo } = useSession();
  // Fetch the shell while the founder reads the sign-in screen, so entering stays instant.
  useEffect(() => {
    void loadSignedIn();
  }, []);
  return (
    <main className="fw-signin" id="main">
      <div className="fw-signin__panel">
        <Logo />
        <h1>Business banking for founders</h1>
        {auth.pendingTask && auth.Task ? (
          <auth.Task task={auth.pendingTask} />
        ) : !auth.available ? (
          <Notice status="info">
            <strong>Sign-in is not configured for this build</strong>. This build has no sign-in key. You can
            explore the app with sample data.
          </Notice>
        ) : !auth.loaded || !auth.SignIn ? (
          <Skeleton label="Loading sign-in" />
        ) : (
          <auth.SignIn />
        )}
        <Button
          data-testid="explore-demo"
          variant={auth.available ? 'secondary' : 'primary'}
          onClick={enterDemo}
        >
          Explore demo
        </Button>
        <p className="fw-privacy" data-testid="privacy-line">
          {PRIVACY_LINE}
        </p>
      </div>
    </main>
  );
}

export function Routed() {
  const { mode } = useSession();
  if (mode === 'none') return <SignInScreen />;
  return (
    <Suspense fallback={<Skeleton label="Loading your company" />}>
      <SignedIn />
    </Suspense>
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

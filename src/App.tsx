import { lazy, Suspense, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthSession } from './auth';
import { Button, Logo, Notice, Skeleton, ThemeProvider, ToastProvider } from './design-system';
import { SessionProvider, useSession, type Mode } from './session';
import { PRIVACY_LINE } from './recording/privacy';
import { isPublicPath } from './public/content';
import { PublicSite } from './public/PublicSite';
import './web.css';

export { NAV } from './nav';

// The signed-in shell and its screens are a separate chunk, so the first screen loads only what sign-in needs (OG-030-N3).
const loadSignedIn = () => import('./SignedIn');
const SignedIn = lazy(loadSignedIn);

/** Loads [load] once the page has loaded and a short pause has passed, so it never competes with the first screen. */
function prefetchAfterLoad(load: () => Promise<unknown>, delayMs = 1500): () => void {
  let timer: number | undefined;
  const start = () => {
    timer = window.setTimeout(() => void load(), delayMs);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
  return () => {
    window.removeEventListener('load', start);
    window.clearTimeout(timer);
  };
}

/** Sign-in with the Clerk customer instance; with no key the build says so and offers demo mode (OG-030 R1). */
export function SignInScreen() {
  const auth = useAuthSession();
  const { enterDemo } = useSession();
  const signUp = new URLSearchParams(useLocation().search).get('mode') === 'sign-up';
  // Fetch the shell while the founder reads the sign-in screen, so entering stays instant; after the page has loaded, so
  // it does not compete with the first screen for bandwidth (OG-030-N3).
  useEffect(() => prefetchAfterLoad(loadSignedIn), []);
  return (
    <main className="fw-signin" id="main">
      <div className="fw-signin__panel">
        <Link to="/" aria-label="OnGem home">
          <Logo />
        </Link>
        <h1>{signUp ? 'Create your OnGem account' : 'Business banking for founders'}</h1>
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
  const { pendingTask } = useAuthSession();
  const { pathname } = useLocation();
  // Signed out, the public site answers its own paths (OG-032 R1, R5); every other path is sign-in, as before. A
  // sign-in that still has a task to finish (WEB-COR-07) always shows sign-in, so the task form is never hidden.
  if (mode === 'none')
    return isPublicPath(pathname) && !pendingTask ? <PublicSite path={pathname} /> : <SignInScreen />;
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

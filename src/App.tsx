import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthSession } from './auth';
import { Md, t, tList, useChannels, useContent } from './i18n';
import { Button, Notice, Skeleton, ThemeProvider, ToastProvider } from './design-system';
import { SessionProvider, useSession, type Mode } from './session';
import { privacyLine } from './recording/privacy';
import { isAppPath, isPublicPath } from './public/content';
import { Footer, Header, PublicSite } from './public/PublicSite';
import { usePageHead } from './public/seo';
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

/**
 * Sign-in and sign-up with the Clerk customer instance, in the same frame as the public site: its header and footer, the
 * form as the one card on the page beside a short reminder of what is inside (UX-04). With no key the build says so and
 * offers demo mode (OG-030 R1); `?mode=sign-up` shows the sign-up form (OG-032 R5).
 */
export function SignInScreen() {
  const auth = useAuthSession();
  const { enterDemo } = useSession();
  const signUp = new URLSearchParams(useLocation().search).get('mode') === 'sign-up';
  // Fetch the shell while the founder reads the sign-in screen, so entering stays instant; after the page has loaded, so
  // it does not compete with the first screen for bandwidth (OG-030-N3).
  useEffect(() => prefetchAfterLoad(loadSignedIn), []);
  useChannels('web_public', 'legal');
  // Its own title and description, out of search (PS-035); the missing key is a note for developers only (PS-009).
  const page = signUp ? 'sign_up' : 'sign_in';
  usePageHead(
    '/sign-in',
    { title: t(`web.page.${page}.title`), description: t(`web.page.${page}.description`) },
    [],
    { noindex: true },
  );
  useEffect(() => {
    if (!auth.available) console.info('sign-in: this build has no VITE_CLERK_PUBLISHABLE_KEY; demo only');
  }, [auth.available]);
  const Form = signUp ? (auth.SignUp ?? auth.SignIn) : auth.SignIn;
  return (
    <div className="pub fw-auth">
      <Header />
      <main className="fw-auth__main" id="main">
        <div className="pub-wrap fw-auth__grid">
          {/* Not a landmark of its own: the form section beside it carries the same name (axe landmark-unique). */}
          <div className="fw-auth__intro">
            <p className="pub-eyebrow">{t('web.auth.eyebrow')}</p>
            <h1 id="auth-title" className="pub-display fw-auth__title">
              {signUp ? t('web.auth.sign_up_title') : t('web.auth.sign_in_title')}
            </h1>
            <p className="pub-lede">{signUp ? t('web.auth.sign_up_lede') : t('web.auth.sign_in_intro')}</p>
            <ul className="pub-list fw-auth__points">
              {tList('web.auth.promises').map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <section
            className="fw-auth__form"
            aria-label={signUp ? t('web.auth.sign_up_title') : t('web.auth.sign_in_title')}
          >
            {auth.pendingTask && auth.Task ? (
              <auth.Task task={auth.pendingTask} />
            ) : !auth.available ? (
              <Notice status="info">
                <Md k="web.auth.not_configured" />
              </Notice>
            ) : !auth.loaded || !Form ? (
              <Skeleton label={t('web.auth.loading')} />
            ) : (
              <div data-testid={signUp ? 'auth-sign-up' : 'auth-sign-in'}>
                <Form />
              </div>
            )}
            <div className="fw-auth__demo">
              <Button
                data-testid="explore-demo"
                variant={auth.available ? 'secondary' : 'primary'}
                onClick={enterDemo}
              >
                {t('web.auth.demo')}
              </Button>
              <p className="fw-auth__hint">{t('web.auth.demo_hint')}</p>
            </div>
            <p className="fw-privacy" data-testid="privacy-line">
              {privacyLine()}
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function Routed() {
  // Every text is read by key; a new language or a newer text from the API renders the page again (OG-033).
  useContent();
  const { mode, regionPending } = useSession();
  const { pendingTask } = useAuthSession();
  const { pathname } = useLocation();
  // Signed out, the public site answers its own paths (OG-032 R1, R5); every other path is sign-in, as before. A
  // sign-in that still has a task to finish (WEB-COR-07) always shows sign-in, so the task form is never hidden.
  // A path that is neither public nor the app's is the public not-found page, never sign-in (PS-008).
  if (mode === 'none')
    return (isPublicPath(pathname) || !isAppPath(pathname)) && !pendingTask ? (
      <PublicSite path={pathname} />
    ) : (
      <SignInScreen />
    );
  // OG-022 R25: no screen calls the API until the person's region is known.
  if (regionPending) return <Skeleton label={t('app.shell.loading_company')} />;
  return (
    <Suspense fallback={<Skeleton label={t('app.shell.loading_company')} />}>
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

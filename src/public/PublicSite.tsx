import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { t, useChannels } from '../i18n';
import {
  capOfPath,
  faqFor,
  isLegalPath,
  isPagePath,
  isPublicPath,
  movedPath,
  pageMeta,
  whoOfPath,
} from './content';
import { LegalPage, legalMeta } from './LegalPage';
import { isMediaPath } from './media/paths';
import { MediaPage, mediaMeta } from './media/MediaPages';
import { NotFound, notFoundMeta } from './pages/NotFound';
import { Footer, Header } from './Nav';
import { Home } from './pages/Home';
import {
  Contact,
  DemoEntry,
  FaqPage,
  Guides,
  Partners,
  Pricing,
  Security,
  Status,
  WhoPage,
} from './pages/Info';
import { CapabilityPage, ProductOverview } from './pages/Product';
import { usePageHead } from './seo';
import './public.css';

export { DEMO, Footer, Header, SIGN_IN, SIGN_UP } from './Nav';

/**
 * Sections rise a little as they scroll into view (OG-032 R13). They are never hidden or transparent (OG-034 R1): the
 * animation moves only, so a full-page capture, print or a page without script shows everything. Reduced motion turns
 * it off.
 */
function useReveal(path: string) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.pub');
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-rising');
            io.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      items.forEach((el) => el.classList.remove('is-rising'));
    };
  }, [path]);
}

/**
 * A new page starts at its top; a link to /product#cards lands on that section, below the sticky header (UX-02). Every
 * navigation counts, a link to the page you are on too (PS-007): it has a new location key, not a new path.
 */
function useScrollToTop(path: string) {
  const { hash, key } = useLocation();
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView?.({ block: 'start' });
    else window.scrollTo?.(0, 0);
  }, [path, hash, key]);
}

const STATIC_PAGES: Record<string, () => ReactNode> = {
  '/': Home,
  '/product': ProductOverview,
  '/security': Security,
  '/partners': Partners,
  '/pricing': Pricing,
  '/guides': Guides,
  '/faq': FaqPage,
  '/status': Status,
  '/contact': Contact,
  '/demo': DemoEntry,
};

function Page({ path }: { path: string }) {
  const cap = capOfPath(path);
  if (cap) return <CapabilityPage id={cap} />;
  const w = whoOfPath(path);
  if (w) return <WhoPage id={w} />;
  const Static = STATIC_PAGES[path];
  if (Static) return <Static />;
  if (isLegalPath(path)) return <LegalPage slug={path.slice(7)} />;
  if (isMediaPath(path)) return <MediaPage path={path} />;
  return <NotFound />;
}

function metaOf(path: string) {
  if (isPagePath(path)) return pageMeta(path);
  if (isLegalPath(path)) return legalMeta(path);
  if (isMediaPath(path)) return mediaMeta(path);
  return notFoundMeta();
}

/**
 * The signed-out public site (OG-032, OG-034): one page per path, header and footer around it. An old path this build
 * moved goes to its page; any other path it does not know is the not-found page, never sign-in (PS-008).
 */
export function PublicSite({ path }: { path: string }) {
  const moved = movedPath(path);
  if (moved) return <Navigate to={moved} replace />;
  return <PublicPage path={path} />;
}

function PublicPage({ path }: { path: string }) {
  useChannels(
    'web_public',
    'faq',
    'legal',
    ...(path.startsWith('/blog') || path === '/guides' ? (['blog'] as const) : []),
  );
  const known = isPublicPath(path);
  usePageHead(path, metaOf(path), faqFor(path), { noindex: !known || path === '/demo' });
  useReveal(path);
  useScrollToTop(path);
  return (
    <div className="pub">
      <a href="#main" className="pub-skip">
        {t('web.labels.skip')}
      </a>
      <Header path={path} />
      <main id="main">
        <Page path={path} />
      </main>
      <Footer path={path} />
    </div>
  );
}

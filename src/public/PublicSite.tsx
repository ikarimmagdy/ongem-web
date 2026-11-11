import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { t, useChannels } from '../i18n';
import { capOfPath, faqFor, isLegalPath, isPagePath, pageMeta, whoOfPath } from './content';
import { LegalPage, legalMeta } from './LegalPage';
import { MediaPage, mediaMeta } from './media/MediaPages';
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

/** A new page starts at its top; a link to /product#cards lands on that section, below the sticky header (UX-02). */
function useScrollToTop(path: string) {
  const { hash } = useLocation();
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView?.({ block: 'start' });
    else window.scrollTo?.(0, 0);
  }, [path, hash]);
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
  return <MediaPage path={path} />;
}

/** The signed-out public site (OG-032, OG-034): one page per path, header and footer around it. */
export function PublicSite({ path }: { path: string }) {
  useChannels(
    'web_public',
    'faq',
    'legal',
    ...(path.startsWith('/blog') || path === '/guides' ? (['blog'] as const) : []),
  );
  const meta = isPagePath(path) ? pageMeta(path) : isLegalPath(path) ? legalMeta(path) : mediaMeta(path);
  usePageHead(path, meta, faqFor(path));
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
      <Footer />
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo, useTheme } from '../design-system';
import { US_MEDIA } from '../region';
import { BrowserFrame, CapabilityArt, GemGlow, HeroArt, PartnerArt, PhoneFrame, ShieldArt } from './art';
import {
  capabilities,
  facts,
  faq,
  feature,
  FEATURE_ROWS,
  HOME_CARDS,
  isLegalPath,
  isPagePath,
  legalSlugs,
  navLinks,
  pageMeta,
  securityControls,
  securityFacts,
  steps,
  trustParties,
  type ArtName,
  type Fact,
  type PagePath,
  type PublicPath,
} from './content';
import { LanguageSwitch, t, tList, useChannels, useContent } from '../i18n';
import { LegalPage, legalMeta } from './LegalPage';
import { Gallery, MediaPage, mediaMeta, VideoStrip } from './media/MediaPages';
import { PHONE_SCREENS, SCREEN_ART, SCREENSHOTS, shotAlt, type ScreenName } from './screenshots';
import './public.css';

export const SIGN_IN = '/sign-in';
export const SIGN_UP = '/sign-in?mode=sign-up';

/** Title and meta description per page (OG-032 R8). */
function usePageMeta(path: PublicPath) {
  const locale = useContent();
  useEffect(() => {
    const meta = isPagePath(path) ? pageMeta(path) : isLegalPath(path) ? legalMeta(path) : mediaMeta(path);
    document.title = meta.title;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.appendChild(tag);
    }
    tag.content = meta.description;
  }, [path, locale]);
  // A new page starts at its very top, header included (scrolling to #main hid the page's first lines under the sticky
  // header, UX-02); a link to /product#cards lands on that section, below the header (scroll-margin-top in CSS).
  const { hash } = useLocation();
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView?.({ block: 'start' });
    else window.scrollTo?.(0, 0);
  }, [path, hash]);
}

/**
 * Sections fade and rise into place as they scroll into view (OG-032 R13). Nothing is hidden before this runs, so the
 * prerendered page and browsers without IntersectionObserver show everything; reduced motion turns it off.
 */
function useReveal(path: PublicPath) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.pub');
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    root.classList.add('pub--motion');
    items.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove('pub--motion');
      items.forEach((el) => el.classList.remove('is-in'));
    };
  }, [path]);
}

function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();
  const dark = theme.mode === 'dark';
  const target = themes.find((t) => (dark ? !t.id.endsWith('-dark') : t.id.endsWith('-dark')));
  if (!target) return null;
  return (
    <button
      type="button"
      className="pub-icon-btn"
      onClick={() => setTheme(target.id)}
      aria-label={dark ? t('web.labels.light_theme') : t('web.labels.dark_theme')}
      data-testid="theme-toggle"
    >
      <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
    </button>
  );
}

/** The site header; sign-in uses it too, with no page marked current. */
export function Header({ path }: { path?: PublicPath }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="pub-header">
      <div className="pub-wrap pub-header__row">
        <Link to="/" className="pub-brand" aria-label={t('web.labels.home_link')}>
          <Logo />
        </Link>
        <nav
          aria-label={t('web.labels.site_nav')}
          className={open ? 'pub-nav pub-nav--open' : 'pub-nav'}
          id="pub-nav"
        >
          {navLinks().map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="pub-nav__link"
              aria-current={
                l.to === path || (l.to === '/blog' && !!path?.startsWith('/blog/')) ? 'page' : undefined
              }
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to={SIGN_IN}
            className="og-btn og-btn--ghost og-btn--md pub-nav__signin"
            data-testid="pub-sign-in"
          >
            {t('web.hero.secondary')}
          </Link>
          <Link to={SIGN_UP} className="og-btn og-btn--primary og-btn--md" data-testid="pub-get-started">
            {t('web.hero.primary')}
          </Link>
        </nav>
        <div className="pub-header__tools">
          <LanguageSwitch className="pub-icon-btn pub-lang" />
          <ThemeToggle />
          <button
            type="button"
            className="pub-icon-btn pub-menu-btn"
            aria-expanded={open}
            aria-controls="pub-nav"
            aria-label={open ? t('web.labels.close_menu') : t('web.labels.open_menu')}
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** The site footer with the draft disclosures; sign-in uses it too. */
export function Footer() {
  const legal = legalSlugs();
  return (
    <footer className="pub-footer">
      <div className="pub-wrap">
        <div className="pub-footer__top">
          <Logo />
          <nav aria-label={t('web.labels.footer_nav')} className="pub-footer__links">
            {navLinks().map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label}
              </Link>
            ))}
            <Link to={SIGN_IN}>{t('web.hero.secondary')}</Link>
            <Link to={SIGN_UP}>{t('web.hero.primary')}</Link>
          </nav>
          {legal.length > 0 && (
            <nav aria-label={t('web.legal.nav')} className="pub-footer__links" data-testid="pub-legal-links">
              {legal.map((slug) => (
                <Link key={slug} to={`/legal/${slug}`}>
                  {t(`legal.${slug}.title`)}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <section aria-labelledby="pub-disclosures" className="pub-disclosures" data-testid="pub-disclosures">
          <h2 id="pub-disclosures" className="pub-disclosures__title">
            {t('web.labels.disclosures')}
          </h2>
          <p className="pub-draft" data-testid="pub-draft-note">
            {t('web.disclosures.note')}
          </p>
          <ol>
            {tList('web.disclosures').map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ol>
          <p className="pub-copyright">{t('web.footer.copyright', { year: new Date().getFullYear() })}</p>
        </section>
      </div>
    </footer>
  );
}

function Cta({ children, testid }: { children?: ReactNode; testid?: string }) {
  return (
    <div className="pub-cta-row">
      <Link to={SIGN_UP} className="og-btn og-btn--primary og-btn--md" data-testid={testid}>
        {t('web.hero.primary')}
      </Link>
      {children}
    </div>
  );
}

function Soon({ items }: { items: string[] }) {
  return (
    <ul className="pub-soon" aria-label={t('web.labels.coming_soon')}>
      {items.map((s) => (
        <li key={s}>
          <span className="pub-badge">{t('web.labels.coming_soon')}</span> {s}
        </li>
      ))}
    </ul>
  );
}

function Shot({
  name,
  frame = 'browser',
  eager = false,
}: {
  name: ScreenName;
  frame?: 'browser' | 'phone' | 'none';
  /** The first screen below the hero loads at once, so it is never an empty frame (OG-032 R17). */
  eager?: boolean;
}) {
  if (!US_MEDIA) return <CapabilityArt name={SCREEN_ART[name]} />;
  const s = SCREENSHOTS[name];
  const loading = eager ? 'eager' : 'lazy';
  const img = (
    <img
      src={s.src}
      alt={shotAlt(name)}
      width={s.width}
      height={s.height}
      loading={loading}
      decoding="async"
    />
  );
  if (frame === 'phone') return <PhoneFrame>{img}</PhoneFrame>;
  if (frame === 'none') return <figure className="pub-shot">{img}</figure>;
  const phone = PHONE_SCREENS[name];
  if (!phone) return <BrowserFrame address="app.ongem.com">{img}</BrowserFrame>;
  // Wide pages show the desktop screen in a browser; narrow pages show the phone screen in a phone (UX-08). The hidden
  // one is display: none, so its lazy image is never fetched.
  return (
    <>
      <div className="pub-shot--wide" data-testid={`shot-wide-${name}`}>
        <BrowserFrame address="app.ongem.com">{img}</BrowserFrame>
      </div>
      <div className="pub-shot--narrow" data-testid={`shot-narrow-${name}`}>
        <PhoneFrame>
          <img src={phone} alt={shotAlt(name)} width={390} height={844} loading={loading} decoding="async" />
        </PhoneFrame>
      </div>
    </>
  );
}

function Home() {
  const all = capabilities();
  const cards = HOME_CARDS.map((id) => all.find((c) => c.id === id)).filter((c) => c !== undefined);
  return (
    <>
      <section className="pub-hero" data-testid="public-home">
        <GemGlow className="pub-hero__glow" />
        <div className="pub-wrap pub-hero__grid">
          <div className="pub-hero__copy">
            <p className="pub-eyebrow pub-eyebrow--on-dark">{t('web.hero.eyebrow')}</p>
            <h1 className="pub-display">{t('web.hero.title')}</h1>
            <p className="pub-lede pub-lede--full">{t('web.hero.lede')}</p>
            <p className="pub-lede pub-lede--short">{t('web.hero.lede_short')}</p>
            <Cta testid="hero-get-started">
              <Link to={SIGN_IN} className="og-btn og-btn--secondary og-btn--md">
                {t('web.hero.secondary')}
              </Link>
            </Cta>
            <ul className="pub-proof" data-testid="hero-proof">
              {tList('web.hero.proof').map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          {US_MEDIA ? (
            <div className="pub-hero__stage" data-testid="hero-stage">
              <div className="pub-hero__desk">
                <BrowserFrame address="app.ongem.com">
                  <img
                    src={SCREENSHOTS.home.src}
                    alt={t('web.shots.home.alt')}
                    width={SCREENSHOTS.home.width}
                    height={SCREENSHOTS.home.height}
                    fetchPriority="high"
                    decoding="async"
                  />
                </BrowserFrame>
              </div>
              <div className="pub-hero__phone">
                <Shot name="homePhone" frame="phone" eager />
              </div>
            </div>
          ) : (
            <div className="pub-hero__stage" data-testid="hero-stage">
              <HeroArt />
            </div>
          )}
        </div>
      </section>

      <section className="pub-trust" aria-labelledby="home-trust">
        <div className="pub-wrap">
          <h2 id="home-trust" className="pub-trust__title">
            {t('web.labels.trust_title')}
          </h2>
          <ul className="pub-trust__list" aria-label={t('web.trust.label')}>
            {trustParties().map((p) => (
              <li key={p.name}>
                <span className="pub-trust__name">{p.name}</span>
                <span className="pub-trust__role">{p.role}</span>
              </li>
            ))}
          </ul>
          <p className="pub-bank" data-testid="pub-bank-statement">
            {t('web.bank_statement')}
          </p>
        </div>
      </section>

      <section className="pub-section" aria-labelledby="home-what">
        <div className="pub-wrap">
          <h2 id="home-what" className="pub-h2" data-reveal>
            {t('web.labels.home_what')}
          </h2>
          <div className="pub-cards">
            {cards.map((c) => (
              <Link
                key={c.id}
                to={`/product#${c.id}`}
                className="pub-card"
                data-testid={`home-card-${c.id}`}
                data-reveal
              >
                <CapabilityArt name={c.id} />
                <h3>{c.title}</h3>
                <p>{c.summary}</p>
                <span className="pub-more">{t('web.labels.see_how')}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {FEATURE_ROWS.map(({ id, screen }) => ({ id, screen, ...feature(id) })).map((f, i) => (
        <section
          key={f.id}
          className={i % 2 ? 'pub-section pub-band' : 'pub-section pub-section--tint'}
          aria-labelledby={`row-${f.id}`}
          data-testid={`feature-row-${f.id}`}
        >
          <div className={i % 2 ? 'pub-wrap pub-feature pub-feature--flip' : 'pub-wrap pub-feature'}>
            <div data-reveal>
              <p className={i % 2 ? 'pub-eyebrow pub-eyebrow--on-dark' : 'pub-eyebrow'}>{f.eyebrow}</p>
              <h2 id={`row-${f.id}`} className="pub-h2">
                {f.title}
              </h2>
              <p className="pub-lede">{f.text}</p>
              <ul className="pub-ticks">
                {f.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="pub-feature__shot" data-reveal>
              <Shot name={f.screen} eager={i === 0} />
            </div>
          </div>
        </section>
      ))}

      <section className="pub-section" aria-labelledby="home-steps">
        <div className="pub-wrap">
          <h2 id="home-steps" className="pub-h2" data-reveal>
            {t('web.labels.home_steps')}
          </h2>
          <ol className="pub-steps">
            {steps().map((s, i) => (
              <li key={s.title} data-reveal>
                <span className="pub-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Facts />

      <section className="pub-section pub-band pub-band--glow" aria-labelledby="home-sec">
        <GemGlow className="pub-band__glow" />
        <div className="pub-wrap pub-split">
          <div data-reveal>
            <p className="pub-eyebrow pub-eyebrow--on-dark">{t('web.labels.security_link')}</p>
            <h2 id="home-sec" className="pub-h2">
              {t('web.labels.home_security')}
            </h2>
            <ul className="pub-ticks">
              {securityControls()
                .slice(0, 4)
                .map((s) => (
                  <li key={s.title}>
                    <strong>{t('web.labels.tick_title', { title: s.title })}</strong> {s.text}
                  </li>
                ))}
            </ul>
            <Link to="/security" className="pub-link-light">
              {t('web.labels.security_link')}
            </Link>
          </div>
          <div data-reveal>
            <ShieldArt />
          </div>
        </div>
      </section>

      <section className="pub-section" aria-labelledby="home-partner">
        <div className="pub-wrap pub-split">
          <div data-reveal>
            <PartnerArt />
          </div>
          <div data-reveal>
            <h2 id="home-partner" className="pub-h2">
              {t('web.partner.title')}
            </h2>
            <p className="pub-lede">{t('web.partner.text')}</p>
            <Link to="/partners" className="pub-more">
              {t('web.labels.partner_link')}
            </Link>
          </div>
        </div>
      </section>

      <VideoStrip />
      <Faq />
      <FinalCta />
    </>
  );
}

function Facts({ items = facts() }: { items?: Fact[] }) {
  return (
    <section className="pub-section pub-band" aria-labelledby="home-facts" data-testid="pub-facts">
      <div className="pub-wrap">
        <h2 id="home-facts" className="pub-h2" data-reveal>
          {t('web.labels.facts_title')}
        </h2>
        <dl className="pub-facts">
          {items.map((f) => (
            <div key={f.label} className="pub-fact" data-reveal data-source={f.source}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="pub-section pub-section--tint" aria-labelledby="home-faq" data-testid="pub-faq">
      <div className="pub-wrap pub-faq">
        <h2 id="home-faq" className="pub-h2">
          {t('web.labels.faq_title')}
        </h2>
        <div className="pub-faq__list">
          {faq().map((f) => (
            <details key={f.q} className="pub-faq__item">
              <summary>
                <span>{f.q}</span>
                <span className="pub-faq__mark" aria-hidden="true" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
          <div className="pub-faq__next" data-testid="faq-next">
            <h3 className="pub-h3">{t('web.faq_next.title')}</h3>
            <p>{t('web.faq_next.text')}</p>
            <Cta>
              <Link to="/security" className="og-btn og-btn--secondary og-btn--md">
                {t('web.faq_next.security')}
              </Link>
            </Cta>
          </div>
          <div className="pub-pricing" data-testid="pub-pricing">
            <h3 className="pub-h3">{t('web.pricing.title')}</h3>
            <p>
              <strong>{t('web.labels.tick_title', { title: t('web.pricing.label') })}</strong>{' '}
              {t('web.pricing.text')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="pub-final" aria-labelledby="final-cta">
      <GemGlow className="pub-final__glow" />
      <div className="pub-wrap">
        <h2 id="final-cta" className="pub-h2">
          {t('web.final_cta.title')}
        </h2>
        <p>{t('web.final_cta.text')}</p>
        <Cta testid="final-get-started" />
      </div>
    </section>
  );
}

function PageHead({ title, lede }: { title: string; lede: string }) {
  return (
    <section className="pub-pagehead">
      <div className="pub-wrap">
        <h1 className="pub-display">{title}</h1>
        <p className="pub-lede">{lede}</p>
        <Cta />
      </div>
    </section>
  );
}

/** Capabilities shown with a real screen on the product page; the rest keep their illustration. */
const PRODUCT_SCREENS: Partial<Record<ArtName, ScreenName>> = {
  accounts: 'home',
  payments: 'schedules',
  cards: 'cards',
  support: 'support',
  notifications: 'notifications',
};

function Product() {
  return (
    <div data-testid="public-product">
      <PageHead title={t('web.labels.product_title')} lede={t('web.product.lede')} />
      {capabilities().map((c, i) => (
        <section
          key={c.id}
          id={c.id}
          className={i % 2 ? 'pub-section pub-section--tint' : 'pub-section'}
          aria-labelledby={`cap-${c.id}`}
          data-testid={`cap-${c.id}`}
        >
          <div className={i % 2 ? 'pub-wrap pub-feature pub-feature--flip' : 'pub-wrap pub-feature'}>
            <div data-reveal>
              <h2 id={`cap-${c.id}`} className="pub-h2">
                {c.title}
              </h2>
              <p className="pub-lede">{c.summary}</p>
              <ul className="pub-list">
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {c.soon.length > 0 && <Soon items={c.soon} />}
            </div>
            <div data-reveal>
              {PRODUCT_SCREENS[c.id] ? <Shot name={PRODUCT_SCREENS[c.id]!} /> : <CapabilityArt name={c.id} />}
            </div>
          </div>
        </section>
      ))}
      <VideoStrip />
      <Gallery />
      <section className="pub-section">
        <div className="pub-wrap pub-split">
          <div data-reveal>
            <h2 className="pub-h2">{t('web.labels.home_shot_title')}</h2>
            <p className="pub-lede">{t('web.labels.home_shot_text')}</p>
            <p className="pub-bank">{t('web.bank_statement')}</p>
          </div>
          <div className="pub-phones" data-reveal>
            <Shot name="homePhone" frame="phone" />
            <Shot name="paymentsPhone" frame="phone" />
          </div>
        </div>
      </section>
      <Faq />
      <FinalCta />
    </div>
  );
}

function Security() {
  return (
    <div data-testid="public-security">
      <PageHead title={t('web.labels.security_title')} lede={t('web.meta.security.description')} />
      <section className="pub-section pub-band pub-band--glow">
        <GemGlow className="pub-band__glow" />
        <div className="pub-wrap pub-split">
          <div className="pub-grid2">
            {securityControls().map((s) => (
              <article
                key={s.title}
                className="pub-tile pub-tile--dark"
                data-testid="security-control"
                data-reveal
              >
                <h2 className="pub-h3">{s.title}</h2>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
          <div data-reveal>
            <ShieldArt />
          </div>
        </div>
      </section>
      <Facts items={securityFacts()} />
      <Faq />
      <FinalCta />
    </div>
  );
}

function Partners() {
  return (
    <div data-testid="public-partners">
      <PageHead title={t('web.partner.title')} lede={t('web.partner.text')} />
      <section className="pub-section">
        <div className="pub-wrap pub-split">
          <div>
            <ul className="pub-list">
              {tList('web.partner.points').map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div data-reveal>
            <PartnerArt />
          </div>
        </div>
      </section>
      <section className="pub-section pub-band" aria-labelledby="partner-api">
        <div className="pub-wrap pub-split">
          <div data-reveal>
            <h2 id="partner-api" className="pub-h2">
              {t('web.partner.api_title')}
            </h2>
            <p className="pub-lede">{t('web.partner.api_text')}</p>
          </div>
          <ol className="pub-steps pub-steps--dark" data-reveal>
            {steps().map((st, i) => (
              <li key={st.title}>
                <span className="pub-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{st.title}</h3>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <Faq />
      <FinalCta />
    </div>
  );
}

const PAGES: Record<PagePath, () => ReactNode> = {
  '/': Home,
  '/product': Product,
  '/security': Security,
  '/partners': Partners,
};

/** The signed-out public site (OG-032): one page per path, header and footer around it. */
export function PublicSite({ path }: { path: PublicPath }) {
  useChannels('web_public', 'faq', 'legal', ...(path.startsWith('/blog') ? (['blog'] as const) : []));
  usePageMeta(path);
  useReveal(path);
  const Page = isPagePath(path)
    ? PAGES[path]
    : isLegalPath(path)
      ? () => <LegalPage slug={path.slice(7)} />
      : () => <MediaPage path={path} />;
  return (
    <div className="pub">
      <a href="#main" className="pub-skip">
        {t('web.labels.skip')}
      </a>
      <Header path={path} />
      <main id="main">
        <Page />
      </main>
      <Footer />
    </div>
  );
}

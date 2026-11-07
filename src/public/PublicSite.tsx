import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo, useTheme } from '../design-system';
import { BrowserFrame, CapabilityArt, GemGlow, PartnerArt, PhoneFrame, ShieldArt } from './art';
import {
  BANK_STATEMENT,
  CAPABILITIES,
  DISCLOSURES,
  FACTS,
  FAQ,
  FEATURE_ROWS,
  DISCLOSURES_NOTE,
  FINAL_CTA,
  HERO,
  HOME_CARDS,
  LABELS,
  LABELS_V2,
  NAV_LINKS,
  PAGE_META,
  PARTNER,
  SECURITY,
  STEPS,
  TRUST,
  type ArtName,
  type PublicPath,
} from './content';
import { SCREENSHOTS, type ScreenName } from './screenshots';
import './public.css';

export const SIGN_IN = '/sign-in';
export const SIGN_UP = '/sign-in?mode=sign-up';

/** Title and meta description per page (OG-032 R8). */
function usePageMeta(path: PublicPath) {
  useEffect(() => {
    const meta = PAGE_META[path];
    document.title = meta.title;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.appendChild(tag);
    }
    tag.content = meta.description;
  }, [path]);
  // A new page starts at its top; a link to /product#cards lands on that section.
  const { hash } = useLocation();
  useEffect(() => {
    const target = (hash && document.getElementById(hash.slice(1))) || document.getElementById('main');
    target?.scrollIntoView?.({ block: 'start' });
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
      aria-label={dark ? LABELS.lightTheme : LABELS.darkTheme}
      data-testid="theme-toggle"
    >
      <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
    </button>
  );
}

function Header({ path }: { path: PublicPath }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="pub-header">
      <div className="pub-wrap pub-header__row">
        <Link to="/" className="pub-brand" aria-label={LABELS.homeLink}>
          <Logo />
        </Link>
        <nav aria-label="Site" className={open ? 'pub-nav pub-nav--open' : 'pub-nav'} id="pub-nav">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="pub-nav__link"
              aria-current={l.to === path ? 'page' : undefined}
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
            {HERO.secondary}
          </Link>
          <Link to={SIGN_UP} className="og-btn og-btn--primary og-btn--md" data-testid="pub-get-started">
            {HERO.primary}
          </Link>
        </nav>
        <div className="pub-header__tools">
          <ThemeToggle />
          <button
            type="button"
            className="pub-icon-btn pub-menu-btn"
            aria-expanded={open}
            aria-controls="pub-nav"
            aria-label={open ? LABELS.closeMenu : LABELS.openMenu}
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="pub-footer">
      <div className="pub-wrap">
        <div className="pub-footer__top">
          <Logo />
          <nav aria-label="Footer" className="pub-footer__links">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label}
              </Link>
            ))}
            <Link to={SIGN_IN}>{HERO.secondary}</Link>
            <Link to={SIGN_UP}>{HERO.primary}</Link>
          </nav>
        </div>
        <section aria-labelledby="pub-disclosures" className="pub-disclosures" data-testid="pub-disclosures">
          <h2 id="pub-disclosures" className="pub-disclosures__title">
            {LABELS.disclosures}
          </h2>
          <p className="pub-draft" data-testid="pub-draft-note">
            {DISCLOSURES_NOTE}
          </p>
          <ol>
            {DISCLOSURES.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ol>
          <p className="pub-copyright">© {new Date().getFullYear()} OnGem</p>
        </section>
      </div>
    </footer>
  );
}

function Cta({ children, testid }: { children?: ReactNode; testid?: string }) {
  return (
    <div className="pub-cta-row">
      <Link to={SIGN_UP} className="og-btn og-btn--primary og-btn--md" data-testid={testid}>
        {HERO.primary}
      </Link>
      {children}
    </div>
  );
}

function Soon({ items }: { items: string[] }) {
  return (
    <ul className="pub-soon" aria-label={LABELS.comingSoon}>
      {items.map((s) => (
        <li key={s}>
          <span className="pub-badge">{LABELS.comingSoon}</span> {s}
        </li>
      ))}
    </ul>
  );
}

function Shot({ name, frame = 'browser' }: { name: ScreenName; frame?: 'browser' | 'phone' | 'none' }) {
  const s = SCREENSHOTS[name];
  const img = (
    <img src={s.src} alt={s.alt} width={s.width} height={s.height} loading="lazy" decoding="async" />
  );
  if (frame === 'phone') return <PhoneFrame>{img}</PhoneFrame>;
  if (frame === 'none') return <figure className="pub-shot">{img}</figure>;
  return <BrowserFrame address="app.ongem.com">{img}</BrowserFrame>;
}

function Home() {
  const cards = HOME_CARDS.map((id) => CAPABILITIES.find((c) => c.id === id)!);
  return (
    <>
      <section className="pub-hero" data-testid="public-home">
        <GemGlow className="pub-hero__glow" />
        <div className="pub-wrap">
          <div className="pub-hero__copy">
            <p className="pub-eyebrow pub-eyebrow--on-dark">{HERO.eyebrow}</p>
            <h1 className="pub-display">{HERO.title}</h1>
            <p className="pub-lede">{HERO.lede}</p>
            <Cta testid="hero-get-started">
              <Link to={SIGN_IN} className="og-btn og-btn--secondary og-btn--md">
                {HERO.secondary}
              </Link>
            </Cta>
          </div>
          <div className="pub-hero__stage">
            <div className="pub-hero__desk">
              <BrowserFrame address="app.ongem.com">
                <img
                  src={SCREENSHOTS.home.src}
                  alt={SCREENSHOTS.home.alt}
                  width={SCREENSHOTS.home.width}
                  height={SCREENSHOTS.home.height}
                  decoding="async"
                />
              </BrowserFrame>
            </div>
            <div className="pub-hero__phone">
              <Shot name="homePhone" frame="phone" />
            </div>
          </div>
        </div>
      </section>

      <section className="pub-trust" aria-labelledby="home-trust">
        <div className="pub-wrap">
          <h2 id="home-trust" className="pub-trust__title">
            {LABELS_V2.trustTitle}
          </h2>
          <ul className="pub-trust__list">
            {TRUST.parties.map((p) => (
              <li key={p.name}>
                <span className="pub-trust__name">{p.name}</span>
                <span className="pub-trust__role">{p.role}</span>
              </li>
            ))}
          </ul>
          <p className="pub-bank" data-testid="pub-bank-statement">
            {BANK_STATEMENT}
          </p>
        </div>
      </section>

      <section className="pub-section" aria-labelledby="home-what">
        <div className="pub-wrap">
          <h2 id="home-what" className="pub-h2" data-reveal>
            {LABELS.homeWhat}
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
                <span className="pub-more">{LABELS.seeHow}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {FEATURE_ROWS.map((f, i) => (
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
              <Shot name={f.screen} />
            </div>
          </div>
        </section>
      ))}

      <section className="pub-section" aria-labelledby="home-steps">
        <div className="pub-wrap">
          <h2 id="home-steps" className="pub-h2" data-reveal>
            {LABELS.homeSteps}
          </h2>
          <ol className="pub-steps">
            {STEPS.map((s, i) => (
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
            <p className="pub-eyebrow pub-eyebrow--on-dark">{LABELS.securityLink}</p>
            <h2 id="home-sec" className="pub-h2">
              {LABELS.homeSecurity}
            </h2>
            <ul className="pub-ticks">
              {SECURITY.slice(0, 4).map((s) => (
                <li key={s.title}>
                  <strong>{s.title}.</strong> {s.text}
                </li>
              ))}
            </ul>
            <Link to="/security" className="pub-link-light">
              {LABELS.securityLink}
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
              {PARTNER.title}
            </h2>
            <p className="pub-lede">{PARTNER.text}</p>
            <Link to="/partners" className="pub-more">
              {LABELS.partnerLink}
            </Link>
          </div>
        </div>
      </section>

      <Faq />
      <FinalCta />
    </>
  );
}

function Facts() {
  return (
    <section className="pub-section pub-band" aria-labelledby="home-facts" data-testid="pub-facts">
      <div className="pub-wrap">
        <h2 id="home-facts" className="pub-h2" data-reveal>
          {LABELS_V2.factsTitle}
        </h2>
        <dl className="pub-facts">
          {FACTS.map((f) => (
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
          {LABELS_V2.faqTitle}
        </h2>
        <div className="pub-faq__list">
          {FAQ.map((f) => (
            <details key={f.q} className="pub-faq__item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
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
          {FINAL_CTA.title}
        </h2>
        <p>{FINAL_CTA.text}</p>
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
      <PageHead title={LABELS.productTitle} lede={PAGE_META['/product'].description} />
      {CAPABILITIES.map((c, i) => (
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
              {c.soon && <Soon items={c.soon} />}
            </div>
            <div data-reveal>
              {PRODUCT_SCREENS[c.id] ? <Shot name={PRODUCT_SCREENS[c.id]!} /> : <CapabilityArt name={c.id} />}
            </div>
          </div>
        </section>
      ))}
      <section className="pub-section">
        <div className="pub-wrap pub-split">
          <div data-reveal>
            <h2 className="pub-h2">{LABELS.homeShotTitle}</h2>
            <p className="pub-lede">{LABELS.homeShotText}</p>
            <p className="pub-bank">{BANK_STATEMENT}</p>
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
      <PageHead title={LABELS.securityTitle} lede={PAGE_META['/security'].description} />
      <section className="pub-section pub-band pub-band--glow">
        <GemGlow className="pub-band__glow" />
        <div className="pub-wrap pub-split">
          <div className="pub-grid2">
            {SECURITY.map((s) => (
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
      <Facts />
      <Faq />
      <FinalCta />
    </div>
  );
}

function Partners() {
  return (
    <div data-testid="public-partners">
      <PageHead title={PARTNER.title} lede={PARTNER.text} />
      <section className="pub-section">
        <div className="pub-wrap pub-split">
          <div>
            <ul className="pub-list">
              {PARTNER.points.map((p) => (
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
              {PARTNER.apiTitle}
            </h2>
            <p className="pub-lede">{PARTNER.apiText}</p>
          </div>
          <ol className="pub-steps pub-steps--dark" data-reveal>
            {STEPS.map((st, i) => (
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

const PAGES: Record<PublicPath, () => ReactNode> = {
  '/': Home,
  '/product': Product,
  '/security': Security,
  '/partners': Partners,
};

/** The signed-out public site (OG-032): one page per path, header and footer around it. */
export function PublicSite({ path }: { path: PublicPath }) {
  usePageMeta(path);
  useReveal(path);
  const Page = PAGES[path];
  return (
    <div className="pub">
      <a href="#main" className="pub-skip">
        {LABELS.skip}
      </a>
      <Header path={path} />
      <main id="main">
        <Page />
      </main>
      <Footer />
    </div>
  );
}

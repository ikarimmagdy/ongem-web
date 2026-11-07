import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo, useTheme } from '../design-system';
import { CapabilityArt, HeroArt, PartnerArt, ShieldArt } from './art';
import {
  BANK_STATEMENT,
  CAPABILITIES,
  DISCLOSURES,
  DISCLOSURES_NOTE,
  FINAL_CTA,
  HERO,
  HOME_CARDS,
  LABELS,
  NAV_LINKS,
  PAGE_META,
  PARTNER,
  SECURITY,
  STEPS,
  type PublicPath,
} from './content';
import { SCREENSHOTS } from './screenshots';
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

function Home() {
  const cards = HOME_CARDS.map((id) => CAPABILITIES.find((c) => c.id === id)!);
  return (
    <>
      <section className="pub-hero" data-testid="public-home">
        <div className="pub-wrap pub-hero__grid">
          <div>
            <p className="pub-eyebrow">{HERO.eyebrow}</p>
            <h1 className="pub-display">{HERO.title}</h1>
            <p className="pub-lede">{HERO.lede}</p>
            <Cta testid="hero-get-started">
              <Link to={SIGN_IN} className="og-btn og-btn--secondary og-btn--md">
                {HERO.secondary}
              </Link>
            </Cta>
          </div>
          <HeroArt />
        </div>
      </section>

      <section className="pub-section" aria-labelledby="home-what">
        <div className="pub-wrap">
          <h2 id="home-what" className="pub-h2">
            {LABELS.homeWhat}
          </h2>
          <div className="pub-cards">
            {cards.map((c) => (
              <Link key={c.id} to={`/product#${c.id}`} className="pub-card" data-testid={`home-card-${c.id}`}>
                <CapabilityArt name={c.id} />
                <h3>{c.title}</h3>
                <p>{c.summary}</p>
                <span className="pub-more">{LABELS.seeHow}</span>
              </Link>
            ))}
          </div>
          <p className="pub-bank" data-testid="pub-bank-statement">
            {BANK_STATEMENT}
          </p>
        </div>
      </section>

      <section className="pub-section pub-section--tint" aria-labelledby="home-shot">
        <div className="pub-wrap pub-split">
          <div>
            <h2 id="home-shot" className="pub-h2">
              {LABELS.homeShotTitle}
            </h2>
            <p className="pub-lede">{LABELS.homeShotText}</p>
          </div>
          <Screenshot name="home" />
        </div>
      </section>

      <section className="pub-section" aria-labelledby="home-steps">
        <div className="pub-wrap">
          <h2 id="home-steps" className="pub-h2">
            {LABELS.homeSteps}
          </h2>
          <ol className="pub-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
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

      <section className="pub-section pub-section--dark" aria-labelledby="home-sec">
        <div className="pub-wrap pub-split">
          <div>
            <h2 id="home-sec" className="pub-h2">
              {LABELS.homeSecurity}
            </h2>
            <ul className="pub-list">
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
          <ShieldArt />
        </div>
      </section>

      <section className="pub-section" aria-labelledby="home-partner">
        <div className="pub-wrap pub-split">
          <PartnerArt />
          <div>
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

      <FinalCta />
    </>
  );
}

function FinalCta() {
  return (
    <section className="pub-final" aria-labelledby="final-cta">
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

function Screenshot({ name }: { name: keyof typeof SCREENSHOTS }) {
  const s = SCREENSHOTS[name];
  return (
    <figure className="pub-shot">
      <img src={s.src} alt={s.alt} width={s.width} height={s.height} loading="lazy" decoding="async" />
    </figure>
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
          <div className="pub-wrap pub-split">
            <div>
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
            <CapabilityArt name={c.id} />
          </div>
        </section>
      ))}
      <section className="pub-section">
        <div className="pub-wrap">
          <Screenshot name="payments" />
          <p className="pub-bank">{BANK_STATEMENT}</p>
        </div>
      </section>
      <FinalCta />
    </div>
  );
}

function Security() {
  return (
    <div data-testid="public-security">
      <PageHead title={LABELS.securityTitle} lede={PAGE_META['/security'].description} />
      <section className="pub-section">
        <div className="pub-wrap pub-split">
          <div className="pub-grid2">
            {SECURITY.map((s) => (
              <article key={s.title} className="pub-tile" data-testid="security-control">
                <h2 className="pub-h3">{s.title}</h2>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
          <ShieldArt />
        </div>
      </section>
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
            <h2 className="pub-h2">{PARTNER.apiTitle}</h2>
            <p className="pub-lede">{PARTNER.apiText}</p>
          </div>
          <PartnerArt />
        </div>
      </section>
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

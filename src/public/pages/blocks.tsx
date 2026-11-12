import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../i18n';
import { US_MEDIA } from '../../region';
import { BrowserFrame, CapabilityArt, PhoneFrame } from '../art';
import { facts as allFacts, type ArtName, type Fact } from '../content';
import { DEMO, DemoLink, PrimaryCta } from '../Nav';
import {
  BLANK_IMAGE,
  NARROW,
  PHONE_SCREENS,
  SCREEN_ART,
  SCREENSHOTS,
  screenSrcSet,
  SHOT_SIZES,
  shotAlt,
  WIDE,
  type ScreenName,
} from '../screenshots';
import { useFirstPaint } from '../first-paint';
import { SITE } from '../site';

/** Get started (Talk to us where accounts are not open) and Try the demo (OG-034 R4, R7). */
export function Cta({ testid, demoTestid }: { testid?: string; demoTestid?: string }) {
  return (
    <div className="pub-cta-row">
      <PrimaryCta testid={testid} />
      <DemoLink testid={demoTestid} />
    </div>
  );
}

/**
 * The UAE build's note that accounts are not open yet (OG-034 R7), said once as a notice, not a badge plus the same
 * sentence (PS-039); nothing where accounts are open.
 */
export function SoonNote() {
  if (SITE.live) return null;
  return (
    <p className="pub-soon-note" role="note" data-testid="soon-note">
      {t('web.soon.note')}
    </p>
  );
}

/**
 * The demo as one more tile, where the capability tiles would leave an empty slot in a row of three (PS-031).
 */
export function DemoTile({ count }: { count: number }) {
  if (count % 3 === 0) return null;
  return (
    <Link to={DEMO} className="pub-card pub-card--demo" data-testid="demo-tile" data-reveal>
      <h3>{t('web.nav.demo')}</h3>
      <p>{t('web.home.demo_text')}</p>
      <span className="pub-more">{t('web.labels.open_demo')}</span>
    </Link>
  );
}

/** What is still coming, each with a neutral Coming soon label (PS-050). */
export function Soon({ items }: { items: string[] }) {
  if (!items.length) return null;
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

export function PageHead({
  title,
  lede,
  eyebrow,
  cta = true,
  testid,
}: {
  title: string;
  lede: string;
  eyebrow?: string;
  cta?: boolean;
  testid?: string;
}) {
  return (
    <section className="pub-pagehead">
      <div className="pub-wrap">
        {eyebrow && <p className="pub-eyebrow">{eyebrow}</p>}
        <h1 className="pub-display">{title}</h1>
        <p className="pub-lede">{lede}</p>
        <SoonNote />
        {cta && <Cta testid={testid} demoTestid={testid ? `${testid}-demo` : undefined} />}
      </div>
    </section>
  );
}

/**
 * A real product screen (OG-032 R10): the desktop screen in a browser frame on wide pages and the phone screen on
 * narrow ones. Eager unless [lazy], so a full-page capture or print never shows an empty frame (OG-034 R1). Each width
 * downloads only its own image (PS-013, PS-036): the frame the width hides gets a blank source, and the desktop
 * screen comes at 1x and 2x for the width it is shown at. Where the build has no screens (AE), the drawing stands in.
 */
export function Shot({
  name,
  frame = 'browser',
  lazy = false,
  priority,
  phoneHidden = false,
}: {
  name: ScreenName;
  frame?: 'browser' | 'phone';
  lazy?: boolean;
  priority?: 'high' | 'low';
  /** The screen sits in a band phones hide (PS-038), so a phone never downloads it (PS-013). */
  phoneHidden?: boolean;
}) {
  // The prerendered first screen carries only the hero's screens; the app puts the others in (PS-013).
  const deferred = useFirstPaint() && priority !== 'high';
  if (!US_MEDIA) return <CapabilityArt name={SCREEN_ART[name]} />;
  const s = SCREENSHOTS[name];
  const loading = lazy ? 'lazy' : 'eager';
  const desktop = (
    <img
      src={deferred ? BLANK_IMAGE : s.src}
      srcSet={deferred ? undefined : screenSrcSet(name)}
      sizes={SHOT_SIZES}
      alt={shotAlt(name)}
      width={s.width}
      height={s.height}
      loading={loading}
      decoding="async"
      fetchPriority={priority}
    />
  );
  if (frame === 'phone') return <PhoneFrame>{desktop}</PhoneFrame>;
  const phone = PHONE_SCREENS[name];
  if (!phone)
    return (
      <BrowserFrame address="app.ongem.com">
        {phoneHidden ? (
          <picture>
            <source media={NARROW} srcSet={BLANK_IMAGE} />
            {desktop}
          </picture>
        ) : (
          desktop
        )}
      </BrowserFrame>
    );
  return (
    <>
      <div className="pub-shot--wide" data-testid={`shot-wide-${name}`}>
        <BrowserFrame address="app.ongem.com">
          <picture>
            <source media={NARROW} srcSet={BLANK_IMAGE} />
            {desktop}
          </picture>
        </BrowserFrame>
      </div>
      <div className="pub-shot--narrow" data-testid={`shot-narrow-${name}`}>
        <PhoneFrame>
          <picture>
            <source media={WIDE} srcSet={BLANK_IMAGE} />
            <img
              src={deferred ? BLANK_IMAGE : phone}
              alt={shotAlt(name)}
              width={390}
              height={844}
              loading={loading}
              decoding="async"
              fetchPriority={priority}
            />
          </picture>
        </PhoneFrame>
      </div>
    </>
  );
}

export function Art({ name }: { name: ArtName }) {
  return <CapabilityArt name={name} />;
}

export function Facts({ items = allFacts() }: { items?: Fact[] }) {
  return (
    <section className="pub-section" aria-labelledby="home-facts" data-testid="pub-facts">
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

/** A FAQ list (OG-032 R12); the page's FAQPage data is written from the same list (OG-034 R9). */
export function Faq({
  items,
  title = t('web.labels.faq_title'),
  id = 'page-faq',
  children,
  tint = true,
  aside = true,
}: {
  items: Array<{ q: string; a: string }>;
  title?: string;
  id?: string;
  children?: ReactNode;
  tint?: boolean;
  /** A short line and the next step under the heading, so its column is not empty (PS-034); off on the FAQ page. */
  aside?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section
      className={tint ? 'pub-section pub-section--tint' : 'pub-section'}
      aria-labelledby={id}
      data-testid="pub-faq"
    >
      <div className={aside ? 'pub-wrap pub-faq' : 'pub-wrap pub-faq pub-faq--single'}>
        <div className="pub-faq__side">
          <h2 id={id} className="pub-h2">
            {title}
          </h2>
          {aside && (
            <>
              <p className="pub-faq__side-text">{t('web.faq.side_text')}</p>
              <div className="pub-cta-row">
                <DemoLink className="og-btn og-btn--secondary og-btn--md" />
                <Link to="/faq" className="og-btn og-btn--ghost og-btn--md" data-testid="faq-all">
                  {t('web.faq.all')}
                </Link>
              </div>
            </>
          )}
        </div>
        <div className="pub-faq__list">
          {items.map((f) => (
            <details key={f.q} className="pub-faq__item">
              <summary>
                <span>{f.q}</span>
                <span className="pub-faq__mark" aria-hidden="true" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
          {children}
        </div>
      </div>
    </section>
  );
}

export function DemoBand() {
  return (
    <section className="pub-section pub-demo-band" aria-labelledby="demo-band" data-testid="demo-band">
      <div className="pub-wrap pub-demo-band__row">
        <div>
          <h2 id="demo-band" className="pub-h2">
            {t('web.home.demo_title')}
          </h2>
          <p className="pub-lede">{t('web.home.demo_text')}</p>
        </div>
        <DemoLink testid="demo-band-link" className="og-btn og-btn--primary og-btn--md" />
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="pub-final" aria-labelledby="final-cta">
      <div className="pub-wrap">
        <h2 id="final-cta" className="pub-h2">
          {t('web.close.title')}
        </h2>
        <p>{t('web.close.text')}</p>
        <div className="pub-cta-row">
          <PrimaryCta testid="final-get-started" />
          <DemoLink className="og-btn og-btn--secondary og-btn--md" />
        </div>
      </div>
    </section>
  );
}

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="pub-more">
      {children}
    </Link>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../i18n';
import { US_MEDIA } from '../../region';
import { BrowserFrame, CapabilityArt, GemGlow, PhoneFrame } from '../art';
import { facts as allFacts, type ArtName, type Fact } from '../content';
import { DemoLink, PrimaryCta } from '../Nav';
import { PHONE_SCREENS, SCREEN_ART, SCREENSHOTS, shotAlt, type ScreenName } from '../screenshots';
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

/** The UAE build's note that accounts are not open yet (OG-034 R7); nothing where accounts are open. */
export function SoonNote() {
  if (SITE.live) return null;
  return (
    <p className="pub-soon-note" data-testid="soon-note">
      <span className="pub-badge">{t('web.soon.badge')}</span> {t('web.soon.note')}
    </p>
  );
}

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
 * narrow ones. Eager unless [lazy], so a full-page capture or print never shows an empty frame (OG-034 R1). Where the
 * build has no screens (AE), the drawing stands in.
 */
export function Shot({
  name,
  frame = 'browser',
  lazy = false,
  priority,
}: {
  name: ScreenName;
  frame?: 'browser' | 'phone';
  lazy?: boolean;
  priority?: 'high' | 'low';
}) {
  if (!US_MEDIA) return <CapabilityArt name={SCREEN_ART[name]} />;
  const s = SCREENSHOTS[name];
  const loading = lazy ? 'lazy' : 'eager';
  const img = (
    <img
      src={s.src}
      alt={shotAlt(name)}
      width={s.width}
      height={s.height}
      loading={loading}
      decoding="async"
      fetchPriority={priority}
    />
  );
  if (frame === 'phone') return <PhoneFrame>{img}</PhoneFrame>;
  const phone = PHONE_SCREENS[name];
  if (!phone) return <BrowserFrame address="app.ongem.com">{img}</BrowserFrame>;
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

export function Art({ name }: { name: ArtName }) {
  return <CapabilityArt name={name} />;
}

export function Facts({ items = allFacts() }: { items?: Fact[] }) {
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

/** A FAQ list (OG-032 R12); the page's FAQPage data is written from the same list (OG-034 R9). */
export function Faq({
  items,
  title = t('web.labels.faq_title'),
  id = 'page-faq',
  children,
  tint = true,
}: {
  items: Array<{ q: string; a: string }>;
  title?: string;
  id?: string;
  children?: ReactNode;
  tint?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section
      className={tint ? 'pub-section pub-section--tint' : 'pub-section'}
      aria-labelledby={id}
      data-testid="pub-faq"
    >
      <div className="pub-wrap pub-faq">
        <h2 id={id} className="pub-h2">
          {title}
        </h2>
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
      <GemGlow className="pub-final__glow" />
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

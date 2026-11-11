import { Link } from 'react-router-dom';
import { t, tList } from '../../i18n';
import { US_MEDIA } from '../../region';
import { BrowserFrame, CapabilityArt, GemGlow, HeroArt, ShieldArt } from '../art';
import { capabilities, capability, faq, securityControls, trustParties, who, WHO_IDS } from '../content';
import { VideoStrip } from '../media/MediaPages';
import { BLANK_IMAGE, HERO_SIZES, NARROW, SCREENSHOTS, screenSrcSet } from '../screenshots';
import { SITE } from '../site';
import { Cta, DemoBand, DemoTile, Facts, Faq, FinalCta, Shot } from './blocks';

/** Two capabilities shown large on the home page, each with its real screen. */
const HIGHLIGHTS = [
  { id: 'payments', screen: 'payments' },
  { id: 'approvals', screen: 'approvals' },
] as const;

export function Home() {
  return (
    <>
      <section className="pub-hero" data-testid="public-home">
        <GemGlow className="pub-hero__glow" />
        <div className="pub-wrap pub-hero__grid">
          <div className="pub-hero__copy">
            {/* One eyebrow line; where accounts are not open the coming-soon badge sits in it (PS-023). */}
            <p className="pub-eyebrow pub-eyebrow--on-dark pub-hero__eyebrow">
              {!SITE.live && (
                <span className="pub-badge pub-badge--hero" data-testid="hero-soon">
                  {t('web.soon.badge')}
                </span>
              )}
              <span>{t('web.hero.eyebrow')}</span>
            </p>
            <h1 className="pub-display">{t('web.hero.title')}</h1>
            <p className="pub-lede pub-lede--full">{t('web.hero.intro')}</p>
            <p className="pub-lede pub-lede--short">{t('web.hero.intro_short')}</p>
            <Cta testid="hero-get-started" demoTestid="hero-demo" />
            <ul className="pub-proof" data-testid="hero-proof">
              {tList('web.hero.points').map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          {US_MEDIA ? (
            <div className="pub-hero__stage" data-testid="hero-stage">
              <div className="pub-hero__desk">
                <BrowserFrame address="app.ongem.com">
                  {/* A phone hides the desktop screen, so it never downloads it (PS-013). */}
                  <picture>
                    <source media={NARROW} srcSet={BLANK_IMAGE} />
                    <img
                      src={SCREENSHOTS.home.src}
                      srcSet={screenSrcSet('home')}
                      sizes={HERO_SIZES}
                      alt={t('web.shots.home.alt')}
                      width={SCREENSHOTS.home.width}
                      height={SCREENSHOTS.home.height}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </picture>
                </BrowserFrame>
              </div>
              <div className="pub-hero__phone">
                <Shot name="homePhone" frame="phone" priority="high" />
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
          <div className="pub-cards pub-cards--3">
            {capabilities().map((c) => (
              <Link key={c.id} to={c.path} className="pub-card" data-testid={`home-card-${c.id}`} data-reveal>
                <CapabilityArt name={c.id} />
                <h3>{c.nav}</h3>
                <p>{c.lede}</p>
                <span className="pub-more">{t('web.labels.see_how')}</span>
              </Link>
            ))}
            <DemoTile count={capabilities().length} />
          </div>
        </div>
      </section>

      {HIGHLIGHTS.map(({ id, screen }, i) => {
        const c = capability(id);
        return (
          <section
            key={id}
            className={i % 2 ? 'pub-section pub-band pub-phone-hide' : 'pub-section pub-section--tint'}
            aria-labelledby={`row-${id}`}
            data-testid={`feature-row-${id}`}
          >
            <div className={i % 2 ? 'pub-wrap pub-feature pub-feature--flip' : 'pub-wrap pub-feature'}>
              <div data-reveal>
                <p className={i % 2 ? 'pub-eyebrow pub-eyebrow--on-dark' : 'pub-eyebrow'}>{c.nav}</p>
                <h2 id={`row-${id}`} className="pub-h2">
                  {c.title}
                </h2>
                <p className="pub-lede">{c.lede}</p>
                <ul className="pub-ticks">
                  {c.points.slice(0, 3).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Link to={c.path} className={i % 2 ? 'pub-link-light' : 'pub-more'}>
                  {t('web.labels.read_more_about', { topic: c.nav })}
                </Link>
              </div>
              <div className="pub-feature__shot" data-reveal>
                <Shot name={screen} />
              </div>
            </div>
          </section>
        );
      })}

      <DemoBand />

      <section className="pub-section" aria-labelledby="home-who" data-testid="home-who">
        <div className="pub-wrap">
          <h2 id="home-who" className="pub-h2" data-reveal>
            {t('web.home.who_title')}
          </h2>
          <div className="pub-cards pub-cards--3">
            {WHO_IDS.map((id) => {
              const w = who(id);
              return (
                <Link key={id} to={w.path} className="pub-card" data-reveal>
                  <h3>{w.nav}</h3>
                  <p>{w.lede}</p>
                  <span className="pub-more">{t('web.labels.read_more_about', { topic: w.nav })}</span>
                </Link>
              );
            })}
            <Link to="/partners" className="pub-card" data-reveal>
              <h3>{t('web.nav.formation_partners')}</h3>
              <p>{t('web.partner.text')}</p>
              <span className="pub-more">{t('web.labels.partner_link')}</span>
            </Link>
          </div>
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

      <VideoStrip />
      <Faq items={faq()} id="home-faq" />
      <FinalCta />
    </>
  );
}

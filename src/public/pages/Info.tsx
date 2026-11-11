import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { t, tList } from '../../i18n';
import { useSession } from '../../session';
import { CapabilityArt, GemGlow, PartnerArt, ShieldArt } from '../art';
import {
  capabilities,
  faq,
  productLink,
  securityControls,
  securityFacts,
  steps,
  who,
  type CapId,
  type WhoId,
} from '../content';
import { posts } from '../media/blog';
import { DemoLink, PrimaryCta, SIGN_IN } from '../Nav';
import { SITE } from '../site';
import { DemoBand, Facts, Faq, FinalCta, PageHead } from './blocks';

/** The capabilities each audience cares about most, linked from its page. */
const WHO_CAPS: Record<WhoId, CapId[]> = {
  new_companies: ['accounts', 'payments', 'approvals'],
  several_companies: ['companies', 'approvals', 'accounts'],
};

export function WhoPage({ id }: { id: WhoId }) {
  const w = who(id);
  const caps = capabilities().filter((c) => WHO_CAPS[id].includes(c.id));
  return (
    <div data-testid={`public-who-${id}`}>
      <PageHead eyebrow={t('web.nav.who')} title={w.title} lede={w.lede} testid="who-get-started" />
      <section className="pub-section pub-section--tint">
        <div className="pub-wrap pub-split">
          <ul className="pub-ticks pub-ticks--dark-text">
            {w.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div data-reveal>
            <CapabilityArt name={id === 'new_companies' ? 'approvals' : 'companies'} />
          </div>
        </div>
      </section>
      {id === 'new_companies' && (
        <section className="pub-section" aria-labelledby="who-steps" data-testid="who-steps">
          <div className="pub-wrap">
            <h2 id="who-steps" className="pub-h2" data-reveal>
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
      )}
      <section className="pub-section pub-section--tint" aria-labelledby="who-caps">
        <div className="pub-wrap">
          <h2 id="who-caps" className="pub-h2">
            {t('web.labels.more_product')}
          </h2>
          <div className="pub-cards pub-cards--3">
            {caps.map((c) => (
              <Link key={c.id} to={c.path} className="pub-card" data-reveal>
                <CapabilityArt name={c.id} />
                <h3>{c.nav}</h3>
                <p>{c.lede}</p>
                <span className="pub-more">{t('web.labels.see_how')}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <DemoBand />
      <Faq items={faq()} />
      <FinalCta />
    </div>
  );
}

export function Pricing() {
  return (
    <div data-testid="public-pricing">
      <PageHead title={t('web.pricing.title')} lede={t('web.pricing.text')} />
      <section className="pub-section pub-section--tint">
        <div className="pub-wrap">
          <div className="pub-pricing" data-testid="pub-pricing">
            <p>
              <strong>{t('web.pricing.label')}</strong>
            </p>
            <ul className="pub-list">
              {tList('web.pricing.points').map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="pub-cta-row">
              <Link to="/contact" className="og-btn og-btn--secondary og-btn--md">
                {t('web.nav.contact')}
              </Link>
              <DemoLink />
            </div>
          </div>
        </div>
      </section>
      <Faq items={faq()} tint={false} />
      <FinalCta />
    </div>
  );
}

export function Security() {
  return (
    <div data-testid="public-security">
      <PageHead title={t('web.labels.security_title')} lede={t('web.page.security.description')} />
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
      <Faq items={faq()} />
      <FinalCta />
    </div>
  );
}

export function Partners() {
  return (
    <div data-testid="public-partners">
      <PageHead
        eyebrow={t('web.nav.formation_partners')}
        title={t('web.partner.title')}
        lede={t('web.partner.text')}
      />
      <section className="pub-section">
        <div className="pub-wrap pub-split">
          <ul className="pub-list">
            {tList('web.partner.points').map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
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
      <Faq items={faq()} />
      <FinalCta />
    </div>
  );
}

/** Guides (OG-034 R12): today's how-to posts with their product page, and the guides being written. */
export function Guides() {
  const guides = posts().filter((p) => p.product);
  return (
    <div data-testid="public-guides">
      <PageHead title={t('web.guides.title')} lede={t('web.guides.lede')} cta={false} />
      <section className="pub-section pub-section--tint">
        <div className="pub-wrap">
          <ul className="pub-posts">
            {guides.map((p) => (
              <li key={p.slug} className="pub-card pub-post-card" data-testid={`guide-${p.slug}`}>
                <h2 className="pub-h3">
                  <Link to={`/blog/${p.slug}`}>{p.title}</Link>
                </h2>
                <p>{p.summary}</p>
                <p className="pub-more">
                  <Link to={`/blog/${p.slug}`}>{t('web.guides.read')}</Link>
                  {p.product && (
                    <>
                      {' · '}
                      <Link to={productLink(p.product)}>{t('web.media.see_product')}</Link>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <h2 className="pub-h3">{t('web.guides.soon_title')}</h2>
          <ul className="pub-soon">
            {tList('web.guides.soon').map((s) => (
              <li key={s}>
                <span className="pub-badge">{t('web.labels.coming_soon')}</span> {s}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <DemoBand />
    </div>
  );
}

/** Every question on one page: the general ones, then each capability's (OG-034 R12). */
export function FaqPage() {
  return (
    <div data-testid="public-faq">
      <PageHead title={t('web.labels.faq_title')} lede={t('web.faq_page.lede')} cta={false} />
      <Faq items={faq()} title={t('web.faq_page.general')} id="faq-general" tint={false} />
      {capabilities().map((c, i) => (
        <Faq key={c.id} items={faq(c.id)} title={c.nav} id={`faq-${c.id}`} tint={i % 2 === 0} />
      ))}
      <FinalCta />
    </div>
  );
}

/** A placeholder until the public status page exists; it depends on the observability work (OG-002). */
export function Status() {
  return (
    <div data-testid="public-status">
      <PageHead title={t('web.status.title')} lede={t('web.status.lede')} cta={false} />
      <section className="pub-section pub-section--tint">
        <div className="pub-wrap">
          <p className="pub-lede" data-testid="status-placeholder">
            {t('web.status.text')}
          </p>
          <Link to={SIGN_IN} className="og-btn og-btn--secondary og-btn--md">
            {t('web.hero.secondary')}
          </Link>
        </div>
      </section>
    </div>
  );
}

export function Contact() {
  const email = SITE.contactEmail;
  return (
    <div data-testid="public-contact">
      <PageHead title={t('web.contact.title')} lede={t('web.contact.lede')} cta={false} />
      <section className="pub-section pub-section--tint">
        <div className="pub-wrap pub-cards pub-cards--3">
          <article className="pub-card">
            <h2 className="pub-h3">{t('web.contact.customers_title')}</h2>
            <p>{t('web.contact.customers_text')}</p>
            <Link to={SIGN_IN} className="og-btn og-btn--secondary og-btn--md">
              {t('web.hero.secondary')}
            </Link>
          </article>
          <article className="pub-card">
            <h2 className="pub-h3">{t('web.contact.new_title')}</h2>
            <p>{t('web.contact.new_text')}</p>
            <div className="pub-cta-row">
              {SITE.live && <PrimaryCta />}
              <DemoLink />
            </div>
          </article>
          <article className="pub-card">
            <h2 className="pub-h3">{t('web.contact.partners_title')}</h2>
            <p>{t('web.contact.partners_text')}</p>
            <Link to="/partners" className="pub-more">
              {t('web.labels.partner_link')}
            </Link>
          </article>
        </div>
        {email && (
          <div className="pub-wrap">
            <a
              href={`mailto:${email}`}
              className="og-btn og-btn--primary og-btn--md"
              data-testid="contact-email"
            >
              {t('web.contact.write', { email })}
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

/** /demo (OG-034 R4): opens the demo on sample data, as Explore the demo on the sign-in screen does. */
export function DemoEntry() {
  const { enterDemo } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
    enterDemo();
  }, [enterDemo, navigate]);
  return (
    <section className="pub-pagehead">
      <p className="pub-wrap pub-lede" role="status">
        {t('web.demo.opening')}
      </p>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { t } from '../../i18n';
import { CapabilityArt } from '../art';
import { capabilities, capability, faq, type CapId } from '../content';
import { Gallery, VideoStrip } from '../media/MediaPages';
import type { ScreenName } from '../screenshots';
import { DemoBand, Faq, FinalCta, PageHead, Shot, Soon } from './blocks';

/** The real screen of each capability page (OG-034 R2). */
const CAP_SCREEN: Record<CapId, ScreenName> = {
  accounts: 'home',
  payments: 'payments',
  cards: 'cards',
  approvals: 'approvals',
  companies: 'companies',
  assistant: 'assistant',
};

/** /product: an overview that sends the visitor to one page per capability (OG-034 R2). */
export function ProductOverview() {
  return (
    <div data-testid="public-product">
      <PageHead title={t('web.labels.product_title')} lede={t('web.product.intro')} />
      <section className="pub-section pub-section--tint" aria-label={t('web.nav.product')}>
        <div className="pub-wrap">
          <div className="pub-cards pub-cards--3">
            {capabilities().map((c) => (
              <Link
                key={c.id}
                id={c.id}
                to={c.path}
                className="pub-card"
                data-testid={`cap-card-${c.id}`}
                data-reveal
              >
                <CapabilityArt name={c.id} />
                <h2 className="pub-h3">{c.nav}</h2>
                <p>{c.lede}</p>
                <span className="pub-more">{t('web.labels.see_how')}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <DemoBand />
      <VideoStrip />
      <Gallery />
      <FinalCta />
    </div>
  );
}

/** One capability: headline, one sentence, its real screen, what it does, what is coming, the demo and its FAQ. */
export function CapabilityPage({ id }: { id: CapId }) {
  const c = capability(id);
  const others = capabilities().filter((o) => o.id !== id);
  return (
    <div data-testid={`public-cap-${id}`}>
      <PageHead eyebrow={t('web.nav.product')} title={c.title} lede={c.lede} testid="cap-get-started" />
      <section className="pub-section pub-section--tint" aria-labelledby="cap-what">
        <div className="pub-wrap pub-feature">
          <div data-reveal>
            <h2 id="cap-what" className="pub-h2">
              {t('web.labels.what_it_does')}
            </h2>
            <ul className="pub-ticks">
              {c.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Soon items={c.soon} />
          </div>
          <div className="pub-feature__shot" data-testid="cap-screen" data-reveal>
            <Shot name={CAP_SCREEN[id]} priority="high" />
          </div>
        </div>
      </section>
      <DemoBand />
      <Faq items={faq(id)} tint={false} />
      <section className="pub-section pub-section--tint" aria-labelledby="cap-more">
        <div className="pub-wrap">
          <h2 id="cap-more" className="pub-h3">
            {t('web.labels.more_product')}
          </h2>
          <ul className="pub-chips" data-testid="cap-more">
            {others.map((o) => (
              <li key={o.id}>
                <Link to={o.path}>{o.nav}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <FinalCta />
    </div>
  );
}

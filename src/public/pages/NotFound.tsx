import { Link } from 'react-router-dom';
import { t } from '../../i18n';
import { DemoLink } from '../Nav';

export const notFoundMeta = () => ({
  title: t('web.page.not_found.title'),
  description: t('web.page.not_found.description'),
});

/** A path the public site does not have (PS-008): a plain not-found page with the way back, kept out of search. */
export function NotFound() {
  return (
    <section className="pub-pagehead pub-notfound" data-testid="public-not-found">
      <div className="pub-wrap">
        <h1 className="pub-display">{t('web.not_found.title')}</h1>
        <p className="pub-lede">{t('web.not_found.lede')}</p>
        <div className="pub-cta-row">
          <Link to="/" className="og-btn og-btn--primary og-btn--md" data-testid="not-found-home">
            {t('web.not_found.home')}
          </Link>
          <Link to="/product" className="og-btn og-btn--secondary og-btn--md">
            {t('web.nav.overview')}
          </Link>
          <DemoLink className="og-btn og-btn--secondary og-btn--md" />
        </div>
      </div>
    </section>
  );
}

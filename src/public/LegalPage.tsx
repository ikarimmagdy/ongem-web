import { Link } from 'react-router-dom';
import { has, Md, metaOf, t } from '../i18n';
import { formatDay } from '../lib/schedule';
import { legalTitle } from './content';

/** A legal page's meta: on its title or its body entry (version, effective date). */
function legalInfo(slug: string) {
  const m = { ...metaOf(`legal.${slug}.body`), ...metaOf(`legal.${slug}.title`) };
  return { version: m.version ?? '', effective: m.effective ?? m.effective_date ?? m.effectiveDate ?? '' };
}

export const legalMeta = (path: string) => {
  const title = legalTitle(path.slice(7));
  return {
    title: t('web.legal.meta_title', { title }),
    description: t('web.legal.meta_description', { title }),
  };
};

/**
 * /legal/<slug> (OG-033 R14, PS-001): the published text of the `legal` channel, with its version and effective date.
 * Until OnGem's legal team publishes it, a holding line and a way to reach OnGem; never text written here.
 */
export function LegalPage({ slug }: { slug: string }) {
  const { version, effective } = legalInfo(slug);
  const published = has(`legal.${slug}.body`);
  return (
    <article data-testid="public-legal">
      <section className="pub-pagehead">
        <div className="pub-wrap pub-post__head">
          <h1 className="pub-display pub-display--page">{legalTitle(slug)}</h1>
          {published && (
            <p className="pub-post__meta" data-testid="legal-meta">
              {version && <span data-testid="legal-version">{t('web.legal.version', { version })}</span>}
              {version && effective && <span aria-hidden="true"> · </span>}
              {effective && (
                <span data-testid="legal-effective">
                  {t('web.legal.effective', { date: formatDay(effective) || effective })}
                </span>
              )}
            </p>
          )}
        </div>
      </section>
      <section className="pub-section">
        <div className="pub-wrap pub-post">
          {published ? (
            <div className="pub-prose" data-testid="legal-body">
              <Md k={`legal.${slug}.body`} />
            </div>
          ) : (
            <div className="pub-prose" data-testid="legal-holding">
              <p className="pub-lede">{t('web.legal.holding')}</p>
              <p>
                {t('web.legal.holding_contact')}{' '}
                <Link to="/contact" className="pub-more" data-testid="legal-contact">
                  {t('web.legal.contact_link')}
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}

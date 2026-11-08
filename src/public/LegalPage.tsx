import { Md, metaOf, t } from '../i18n';
import { formatDay } from '../lib/schedule';

/** A legal page's meta: on its title or its body entry (version, effective date). */
function legalInfo(slug: string) {
  const m = { ...metaOf(`legal.${slug}.body`), ...metaOf(`legal.${slug}.title`) };
  return { version: m.version ?? '', effective: m.effective ?? m.effective_date ?? m.effectiveDate ?? '' };
}

export const legalMeta = (path: string) => {
  const slug = path.slice(7);
  return {
    title: t('web.legal.meta_title', { title: t(`legal.${slug}.title`) }),
    description: t('web.legal.meta_description', { title: t(`legal.${slug}.title`) }),
  };
};

/** /legal/<slug> (OG-033 R14): the published text of the `legal` channel, with its version and effective date. */
export function LegalPage({ slug }: { slug: string }) {
  const { version, effective } = legalInfo(slug);
  return (
    <article data-testid="public-legal">
      <section className="pub-pagehead">
        <div className="pub-wrap pub-post__head">
          <h1 className="pub-display">{t(`legal.${slug}.title`)}</h1>
          <p className="pub-post__meta" data-testid="legal-meta">
            {version && <span data-testid="legal-version">{t('web.legal.version', { version })}</span>}
            {version && effective && <span aria-hidden="true"> · </span>}
            {effective && (
              <span data-testid="legal-effective">
                {t('web.legal.effective', { date: formatDay(effective) || effective })}
              </span>
            )}
          </p>
        </div>
      </section>
      <section className="pub-section">
        <div className="pub-wrap pub-post">
          <div className="pub-prose" data-testid="legal-body">
            <Md k={`legal.${slug}.body`} />
          </div>
        </div>
      </section>
    </article>
  );
}

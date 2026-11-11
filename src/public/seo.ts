import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getLocale, setLocale, t, useContent } from '../i18n';
import { isPagePath } from './content';
import { HREFLANG, SITE, siteOf } from './site';

/**
 * The head of a public page (OG-034 R9): title, description, canonical, hreflang alternates for pages both builds
 * have, and JSON-LD (Organization on every page, FAQPage where the page has questions). Written by an effect, so the
 * SPA keeps one set per page; the prerendered home carries the Organization data before the script runs.
 */

export const ORG_LD_ID = 'ld-organization';
const FAQ_LD_ID = 'ld-faq';

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization', // content-check: ignore
  name: 'OnGem',
  url: `${SITE.url}/`,
  description: t('web.page.home.description'),
});

export const faqLd = (qa: Array<{ q: string; a: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map((x) => ({
    '@type': 'Question', // content-check: ignore
    name: x.q,
    acceptedAnswer: { '@type': 'Answer', text: x.a }, // content-check: ignore
  })),
});

/** Pages both builds have, so their alternates point at real pages; the card page, posts and videos differ. */
export const inBothBuilds = (path: string) =>
  (isPagePath(path) && path !== '/product/cards' && path !== '/demo') || path === '/blog';

function setLd(id: string, data: object | null) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function setMeta(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setLinks(path: string) {
  document.head.querySelectorAll('link[data-pub-head]').forEach((l) => l.remove());
  const add = (rel: string, href: string, hreflang?: string) => {
    const l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    if (hreflang) l.hreflang = hreflang;
    l.setAttribute('data-pub-head', '');
    document.head.appendChild(l);
  };
  add('canonical', `${SITE.url}${path}`);
  if (!inBothBuilds(path)) return;
  for (const h of HREFLANG)
    add('alternate', `${siteOf(h.region)}${path}${h.locale === 'ar' ? '?lang=ar' : ''}`, h.lang);
  add('alternate', `${siteOf('US')}${path}`, 'x-default');
}

export function usePageHead(
  path: string,
  meta: { title: string; description: string },
  qa: Array<{ q: string; a: string }>,
) {
  const locale = useContent();
  const { search } = useLocation();
  // `?lang=ar` (the ar-AE alternate) opens the page in Arabic; `?lang=en` in English.
  useEffect(() => {
    const lang = new URLSearchParams(search).get('lang');
    if ((lang === 'ar' || lang === 'en') && lang !== getLocale()) void setLocale(lang);
  }, [search]);
  const faqKey = qa.map((x) => x.q).join('\n');
  useEffect(() => {
    document.title = meta.title;
    setMeta('description', meta.description);
    setLinks(path);
    setLd(ORG_LD_ID, organizationLd());
    setLd(FAQ_LD_ID, qa.length ? faqLd(qa) : null);
    // qa is read through faqKey, its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, locale, meta.title, meta.description, faqKey]);
}

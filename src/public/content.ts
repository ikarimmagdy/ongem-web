import { has, keysUnder, metaOf, t, tList } from '../i18n';
import { US_MEDIA } from '../region';
import { isMediaPath } from './media/paths';

/**
 * The public site's structure (OG-032): which pages, sections and items exist. Every word is a content entry in the
 * `web_public` and `faq` channels (OG-033 R1), read when a page renders, so a newer text or another language shows
 * without a release. Region differences are in each region's content (the AE seed names a licensed UAE bank); lists
 * are as long as the content has numbered items (`web.hero.proof.1`, `.2`, ...).
 */

export type ArtName =
  | 'accounts'
  | 'payments'
  | 'topup'
  | 'cards'
  | 'approvals'
  | 'recipients'
  | 'support'
  | 'assistant'
  | 'notifications';

export interface Capability {
  id: ArtName;
  title: string;
  summary: string;
  points: string[];
  soon: string[];
}

export const PUBLIC_PATHS = ['/', '/product', '/security', '/partners'] as const;
/** The site's pages, plus the blog, its posts, the videos (OG-032 R15, R16) and the legal pages (OG-033 R14). */
export type PublicPath =
  (typeof PUBLIC_PATHS)[number] | '/blog' | '/videos' | `/blog/${string}` | `/legal/${string}`;
export type PagePath = (typeof PUBLIC_PATHS)[number];

/** The legal pages in the footer, in this order first; any other `legal.<slug>.title` follows. */
const LEGAL_ORDER = ['terms', 'privacy', 'cookies', 'disclosures'];

export function legalSlugs(): string[] {
  const slugs = keysUnder('legal.')
    .filter((k) => k.endsWith('.title'))
    .map((k) => k.slice(6, -6))
    .filter((s) => /^[a-z0-9-]+$/.test(s) && has(`legal.${s}.body`));
  const rank = (s: string) => (LEGAL_ORDER.includes(s) ? LEGAL_ORDER.indexOf(s) : LEGAL_ORDER.length);
  return [...new Set(slugs)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export const isLegalPath = (path: string) =>
  path.startsWith('/legal/') && legalSlugs().includes(path.slice(7));

export function isPublicPath(path: string): path is PublicPath {
  return (PUBLIC_PATHS as readonly string[]).includes(path) || isMediaPath(path) || isLegalPath(path);
}

export const isPagePath = (path: string): path is PagePath =>
  (PUBLIC_PATHS as readonly string[]).includes(path);

const PAGE_KEY: Record<PagePath, string> = {
  '/': 'home',
  '/product': 'product',
  '/security': 'security',
  '/partners': 'partners',
};

export const pageMeta = (path: PagePath) => ({
  title: t(`web.meta.${PAGE_KEY[path]}.title`),
  description: t(`web.meta.${PAGE_KEY[path]}.description`),
});

/** The site menu; the videos were recorded on the US demo, so the AE build has none (OG-022 R18). */
export function navLinks(): Array<{ to: PublicPath; label: string }> {
  const links: Array<{ to: PublicPath; key: string }> = [
    { to: '/product', key: 'web.nav.product' },
    { to: '/security', key: 'web.nav.security' },
    { to: '/partners', key: 'web.nav.partners' },
    ...(US_MEDIA ? [{ to: '/videos' as const, key: 'web.nav.videos' }] : []),
    { to: '/blog', key: 'web.nav.blog' },
  ];
  return links.map((l) => ({ to: l.to, label: t(l.key) }));
}

/** Numbered items with fields: `<prefix>.1.<field>`, `<prefix>.2.<field>`, ... as many as the content has. */
export function items<F extends string>(prefix: string, fields: readonly F[]): Array<Record<F, string>> {
  const out: Array<Record<F, string>> = [];
  for (let i = 1; has(`${prefix}.${i}.${fields[0]}`); i++)
    out.push(Object.fromEntries(fields.map((f) => [f, t(`${prefix}.${i}.${f}`)])) as Record<F, string>);
  return out;
}

const CAPABILITY_IDS: ArtName[] = [
  'accounts',
  'payments',
  'topup',
  'cards',
  'approvals',
  'recipients',
  'support',
  'notifications',
  'assistant',
];

export const capabilities = (): Capability[] =>
  CAPABILITY_IDS.filter((id) => has(`web.cap.${id}.title`)).map((id) => ({
    id,
    title: t(`web.cap.${id}.title`),
    summary: t(`web.cap.${id}.summary`),
    points: tList(`web.cap.${id}.points`),
    soon: tList(`web.cap.${id}.soon`),
  }));

export const HOME_CARDS: ArtName[] = ['accounts', 'payments', 'cards', 'approvals'];

export const steps = () => items('web.steps', ['title', 'text'] as const);
export const securityControls = () => items('web.security', ['title', 'text'] as const);
export const trustParties = () => items('web.trust', ['name', 'role'] as const);
export const faq = () => items('faq', ['q', 'a'] as const);

/** Large product rows on the home page, each with a real screen from demo mode (OG-032 R10). */
export const FEATURE_ROWS = [
  { id: 'payments', screen: 'payments' },
  { id: 'cards', screen: 'cards' },
  { id: 'notifications', screen: 'notifications' },
] as const;

export const feature = (id: string) => ({
  eyebrow: t(`web.feature.${id}.eyebrow`),
  title: t(`web.feature.${id}.title`),
  text: t(`web.feature.${id}.text`),
  points: tList(`web.feature.${id}.points`),
});

export interface Fact {
  value: string;
  label: string;
  source: string;
}

/** Facts with a source each (OG-032 R11, R19); the source is the value entry's meta. */
export const facts = (): Fact[] =>
  items('web.facts', ['value', 'label'] as const).map((f, i) => ({
    ...f,
    source: metaOf(`web.facts.${i + 1}.value`).source ?? '',
  }));

/** The security page leads with the facts after the first, plus the engineering fact (OG-032 R19). */
export const securityFacts = (): Fact[] => [
  ...facts().slice(1),
  {
    value: t('web.facts.security.value'),
    label: t('web.facts.security.label'),
    source: metaOf('web.facts.security.value').source ?? '',
  },
];

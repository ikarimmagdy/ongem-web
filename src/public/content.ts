import { has, keysUnder, metaOf, t, tList } from '../i18n';
import { US_MEDIA } from '../region';
import { posts } from './media/blog';
import { isMediaPath } from './media/paths';
import { SITE } from './site';

/**
 * The public site's structure (OG-032, OG-034): which pages exist, what the menus hold and the readers of their texts.
 * Every word is a content entry in the `web_public` and `faq` channels (OG-033 R1), read when a page renders. Region
 * differences are each region's content plus `SITE` (no card page where the bank has no cards); lists are as long as
 * the content has numbered items (`web.hero.points.1`, `.2`, ...).
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
  | 'notifications'
  | 'companies';

/** One page per capability (OG-034 R2). */
export type CapId = 'accounts' | 'payments' | 'cards' | 'approvals' | 'companies' | 'assistant';
const CAP_ORDER: CapId[] = ['accounts', 'payments', 'cards', 'approvals', 'companies', 'assistant'];
export const capIds = (): CapId[] => CAP_ORDER.filter((id) => id !== 'cards' || SITE.cards);
export const capPath = (id: CapId) => `/product/${id}`;

/** Who it's for (OG-034 R11); formation partners is the partners page. */
export type WhoId = 'new_companies' | 'several_companies';
export const WHO_IDS: WhoId[] = ['new_companies', 'several_companies'];
export const whoPath = (id: WhoId) => `/for/${id.replace('_', '-')}`;

/** Page id per path: its meta is `web.page.<id>.title` and `.description`. */
const STATIC: Record<string, string> = {
  '/': 'home',
  '/product': 'product',
  '/security': 'security',
  '/partners': 'partners',
  '/pricing': 'pricing',
  '/guides': 'guides',
  '/faq': 'faq',
  '/status': 'status',
  '/contact': 'contact',
  '/demo': 'demo',
};

function pageIds(): Record<string, string> {
  const ids: Record<string, string> = { ...STATIC };
  for (const id of capIds()) ids[capPath(id)] = id;
  for (const id of WHO_IDS) ids[whoPath(id)] = id;
  return ids;
}

export type PublicPath = string;
export type PagePath = string;

/**
 * The legal pages (PS-001): terms, privacy, cookies and disclosures always exist, so the footer never holds an anchor
 * only; any other published `legal.<slug>.title` follows. Their text is the `legal` channel, written by OnGem's legal
 * team (OG-033); until a page is published it shows a holding line.
 */
export const LEGAL_PAGES = ['terms', 'privacy', 'cookies', 'disclosures'];

export function legalSlugs(): string[] {
  const published = keysUnder('legal.')
    .filter((k) => k.endsWith('.title'))
    .map((k) => k.slice(6, -6))
    .filter((s) => /^[a-z0-9-]+$/.test(s) && has(`legal.${s}.body`) && !LEGAL_PAGES.includes(s))
    .sort((a, b) => a.localeCompare(b));
  return [...LEGAL_PAGES, ...new Set(published)];
}

/** The page's own published title, else its name from the site's texts. */
export const legalTitle = (slug: string) =>
  has(`legal.${slug}.title`) ? t(`legal.${slug}.title`) : t(`web.legal.page.${slug}`);

export const isLegalPath = (path: string) =>
  path.startsWith('/legal/') && legalSlugs().includes(path.slice(7));

export const isPagePath = (path: string): boolean => path in pageIds();
export const pageId = (path: string): string | undefined => pageIds()[path];
export const capOfPath = (path: string): CapId | undefined => capIds().find((id) => capPath(id) === path);
export const whoOfPath = (path: string): WhoId | undefined => WHO_IDS.find((id) => whoPath(id) === path);

export function isPublicPath(path: string): boolean {
  return isPagePath(path) || isMediaPath(path) || isLegalPath(path);
}

/** Old paths a build does not have, to the page that now holds them (PS-008): no card page or videos in the UAE. */
export function movedPath(path: string): string | undefined {
  if (path === '/product/cards' && !SITE.cards) return '/product';
  if (path === '/videos' && !US_MEDIA) return '/blog';
  return undefined;
}

/**
 * The signed-in app's paths and sign-in's own (`src/SignedIn.tsx` routes): signed out, they show sign-in so the
 * founder lands there after it. Any other unknown path is the public not-found page (PS-008).
 */
export const APP_SEGMENTS = [
  'sign-in',
  'sign-up',
  'sso-callback',
  'accounts',
  'payments',
  'recipients',
  'cards',
  'team',
  'documents',
  'more',
  'onboarding',
  'support',
  'settings',
  'notifications',
  'invite',
];
const APP_PATHS = new RegExp(`^/(${APP_SEGMENTS.join('|')})(/|$)`);
export const isAppPath = (path: string) => APP_PATHS.test(path);

export const pageMeta = (path: string) => {
  const id = pageId(path) ?? 'home';
  return { title: t(`web.page.${id}.title`), description: t(`web.page.${id}.description`) };
};

/** The paths of every page the build has, for the sitemap of tests and captures. */
export const pagePaths = (): string[] => Object.keys(pageIds());

/**
 * Every path this build answers with a page, and the app's first path segments (PS-008): the build writes them to
 * `routes.json`, from which the edge (ongem-infra FounderWebStack) answers 200 for these and 404 for anything else. A
 * post or legal page published after the build is a 404 at the edge until the next build.
 */
export function siteRoutes(): { pages: string[]; app: string[] } {
  const pages = new Set([
    ...pagePaths(),
    ...legalSlugs().map((s) => `/legal/${s}`),
    '/blog',
    ...posts().map((p) => `/blog/${p.slug}`),
    ...['/videos', '/product/cards'].filter((p) => isMediaPath(p) || movedPath(p)),
  ]);
  return { pages: [...pages].sort(), app: [...APP_SEGMENTS] };
}

export interface NavLink {
  to: string;
  label: string;
}
export interface NavGroup {
  id: 'product' | 'who' | 'resources';
  label: string;
  links: NavLink[];
}

/** The header and footer menus (OG-034 R3, R5). Videos were recorded on the US demo, so the AE build has none. */
export function navGroups(): NavGroup[] {
  return [
    {
      id: 'product',
      label: t('web.nav.product'),
      links: [
        { to: '/product', label: t('web.nav.overview') },
        ...capIds().map((id) => ({ to: capPath(id), label: t(`web.product.${id}.nav`) })),
      ],
    },
    {
      id: 'who',
      label: t('web.nav.who'),
      links: [
        ...WHO_IDS.map((id) => ({ to: whoPath(id), label: t(`web.who.${id}.nav`) })),
        { to: '/partners', label: t('web.nav.formation_partners') },
      ],
    },
    {
      id: 'resources',
      label: t('web.nav.resources'),
      links: [
        { to: '/guides', label: t('web.nav.guides') },
        { to: '/blog', label: t('web.nav.blog') },
        ...(US_MEDIA ? [{ to: '/videos', label: t('web.nav.videos') }] : []),
        { to: '/faq', label: t('web.nav.faq') },
        // Status stays out of the menus until the monitoring work (OG-002) gives it a real page (PS-029).
      ],
    },
  ];
}

/** Top-level links between the menus: Pricing and Security. */
export const navLinks = (): NavLink[] => [
  { to: '/pricing', label: t('web.nav.pricing') },
  { to: '/security', label: t('web.nav.security') },
];

/** The group that holds [path], so its menu button is marked as holding the current page. */
export const groupOf = (path: string | undefined) =>
  path
    ? navGroups().find((g) =>
        g.links.some((l) => l.to === path || (l.to === '/blog' && path.startsWith('/blog/'))),
      )?.id
    : undefined;

/** Numbered items with fields: `<prefix>.1.<field>`, `<prefix>.2.<field>`, ... as many as the content has. */
export function items<F extends string>(prefix: string, fields: readonly F[]): Array<Record<F, string>> {
  const out: Array<Record<F, string>> = [];
  for (let i = 1; has(`${prefix}.${i}.${fields[0]}`); i++)
    out.push(Object.fromEntries(fields.map((f) => [f, t(`${prefix}.${i}.${f}`)])) as Record<F, string>);
  return out;
}

export interface Capability {
  id: CapId;
  path: string;
  nav: string;
  title: string;
  lede: string;
  points: string[];
  soon: string[];
}

export const capability = (id: CapId): Capability => ({
  id,
  path: capPath(id),
  nav: t(`web.product.${id}.nav`),
  title: t(`web.product.${id}.title`),
  lede: t(`web.product.${id}.lede`),
  points: tList(`web.product.${id}.points`),
  soon: tList(`web.product.${id}.soon`),
});
export const capabilities = (): Capability[] => capIds().map(capability);

export const who = (id: WhoId) => ({
  id,
  path: whoPath(id),
  nav: t(`web.who.${id}.nav`),
  title: t(`web.who.${id}.title`),
  lede: t(`web.who.${id}.lede`),
  points: tList(`web.who.${id}.points`),
});

export const steps = () => items('web.how', ['title', 'text'] as const);
export const securityControls = () => items('web.protect', ['title', 'text'] as const);
export const trustParties = () => items('web.trust', ['name', 'role'] as const);
/** The general questions, and each capability's (`faq.general`, `faq.<capability>`). */
export const faq = (group: 'general' | CapId = 'general') => items(`faq.${group}`, ['q', 'a'] as const);

/** The questions a page shows, and so its FAQPage data (OG-034 R2, R9). */
export function faqFor(path: string): Array<{ q: string; a: string }> {
  if (path === '/faq') return [...faq(), ...capIds().flatMap((id) => faq(id))];
  const cap = capOfPath(path);
  if (cap) return faq(cap);
  return ['/', '/security', '/partners', '/pricing', ...WHO_IDS.map(whoPath)].includes(path) ? faq() : [];
}

export interface Fact {
  value: string;
  label: string;
  source: string;
}

/** The numbers band (OG-034 R8): facts true today, each with its source in the value entry's meta. */
export const facts = (): Fact[] =>
  items('web.numbers', ['value', 'label'] as const).map((f, i) => ({
    ...f,
    source: metaOf(`web.numbers.${i + 1}.value`).source ?? '',
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

/** Old product anchors (`/product#topup`, kept in blog posts' meta) to the page that now holds them (AC-R2.3). */
const ANCHOR: Record<string, string> = {
  accounts: 'accounts',
  notifications: 'accounts',
  payments: 'payments',
  topup: 'payments',
  recipients: 'payments',
  cards: 'cards',
  approvals: 'approvals',
  assistant: 'assistant',
};

export function productLink(to: string): string {
  const m = /^\/product#([a-z]+)$/.exec(to);
  if (!m) return to;
  const id = ANCHOR[m[1]!] as CapId | undefined;
  return id && capIds().includes(id) ? capPath(id) : '/product';
}

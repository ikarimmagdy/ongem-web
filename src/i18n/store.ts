import BUILT from 'virtual:ongem-content';
import type { Channel, ChannelContent, Locale, RegionContent } from './types';

/**
 * Every text the web shows is a content entry (OG-033 R1), read by key. The build carries a snapshot of the public
 * channels (English in the main bundle, Arabic in its own chunk); on load the page asks the API for each channel it
 * needs with the version it holds as If-None-Match, and keeps a newer answer in localStorage by version (R7).
 */

// Read from the build's env, not region.ts: region.ts reads its texts from here, so importing it would be a cycle.
const REGION_KEY = import.meta.env.VITE_REGION === 'AE' ? 'ae' : 'us';
const LOCALE_KEY = 'ongem.locale';
const cacheKey = (locale: Locale, channel: string) => `ongem.content.${REGION_KEY}.${locale}.${channel}`;

/** The content API: the build's API base (OG-022 R11 keeps banking calls on whereami's base; content stays public). */
export const CONTENT_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || '/api-dev';

const channels: Record<Locale, RegionContent> = { en: { ...BUILT[REGION_KEY] }, ar: {} };
let builtAr: RegionContent | null = null;
let locale: Locale = 'en';
let merged: Record<Locale, Record<string, string>> = { en: {}, ar: {} };
let mergedMeta: Record<string, Record<string, string>> = {};
let revision = 0;
const listeners = new Set<() => void>();

function rebuild() {
  merged = { en: {}, ar: {} };
  mergedMeta = {};
  // The build's snapshot first, so a key the API does not serve yet (a web release ahead of the core's seed, OG-034)
  // keeps its built text instead of showing the key; the API's texts then replace it key by key.
  for (const l of ['en', 'ar'] as Locale[])
    for (const c of Object.values<ChannelContent | undefined>(
      (l === 'en' ? BUILT[REGION_KEY] : builtAr) ?? {},
    )) {
      if (!c) continue;
      Object.assign(merged[l], c.entries);
      if (l === locale) Object.assign(mergedMeta, c.meta);
    }
  for (const l of ['en', 'ar'] as Locale[])
    for (const c of Object.values(channels[l])) {
      if (!c) continue;
      Object.assign(merged[l], c.entries);
      if (l === locale) Object.assign(mergedMeta, c.meta);
    }
  if (locale === 'ar')
    for (const c of Object.values(channels.en))
      for (const [k, m] of Object.entries(c?.meta ?? {})) mergedMeta[k] ??= m;
  revision++;
  listeners.forEach((l) => l());
}
rebuild();

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const contentRevision = () => revision;
export const getLocale = (): Locale => locale;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const warned = new Set<string>();

/** The text of [key] in the current locale (English when it has none), with `{name}` placeholders filled in. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = merged[locale][key] ?? merged.en[key];
  if (raw === undefined) {
    if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`content: no entry ${key}`);
    }
    return key;
  }
  return vars ? fill(raw, vars) : raw;
}

export function fill(raw: string, vars: Record<string, string | number>): string {
  return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export const has = (key: string): boolean => key in merged[locale] || key in merged.en;

/** A count: `<key>.<plural category>` in the current locale's rules, else `<key>.other`; `{count}` is the number. */
export function tn(key: string, count: number, vars: Record<string, string | number> = {}): string {
  const cat = new Intl.PluralRules(locale).select(count);
  const k = has(`${key}.${cat}`) ? `${key}.${cat}` : `${key}.other`;
  return t(k, { count, ...vars });
}

/** A list kept as numbered entries `<prefix>.1`, `<prefix>.2`, ...: as many as the content has. */
export function tList(prefix: string): string[] {
  const out: string[] = [];
  for (let i = 1; has(`${prefix}.${i}`); i++) out.push(t(`${prefix}.${i}`));
  return out;
}

/** The keys under [prefix] (any locale), for content that is a set of items, such as blog posts and legal pages. */
export function keysUnder(prefix: string): string[] {
  return Object.keys({ ...merged.en, ...merged[locale] }).filter((k) => k.startsWith(prefix));
}

/** The meta of an entry (a blog post's date and tags, a legal page's version and effective date). */
export const metaOf = (key: string): Record<string, string> => mergedMeta[key] ?? {};

/** The locale for dates: month names in the reader's language, Latin digits always (OG-033 R10). */
export const dateLocale = () => (locale === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB');

function applyDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

async function loadArabic() {
  if (builtAr) return;
  const mod = await import('virtual:ongem-content-ar');
  builtAr = mod.default[REGION_KEY] ?? {};
  channels.ar = { ...builtAr, ...channels.ar };
}

function readCache(l: Locale) {
  const s = storage();
  if (!s) return;
  for (const ch of ['web_public', 'web_app', 'blog', 'faq', 'legal'] as Channel[]) {
    try {
      const raw = s.getItem(cacheKey(l, ch));
      if (raw) channels[l][ch] = JSON.parse(raw) as ChannelContent;
    } catch {
      /* a broken cache entry is ignored */
    }
  }
}

/** Switches the language: Arabic loads its texts first, then the page turns right to left; the choice is kept. */
export async function setLocale(next: Locale): Promise<void> {
  if (next === 'ar') await loadArabic();
  locale = next;
  try {
    storage()?.setItem(LOCALE_KEY, next);
  } catch {
    /* not kept in a private window */
  }
  fetched.clear();
  applyDocument();
  rebuild();
}

/** Before the first render: the remembered language, its cached texts and the document's lang and dir. */
export async function initContent(): Promise<void> {
  let stored: string | null = null;
  try {
    stored = storage()?.getItem(LOCALE_KEY) ?? null;
  } catch {
    stored = null;
  }
  readCache('en');
  if (stored === 'ar') {
    try {
      await loadArabic();
      readCache('ar');
      locale = 'ar';
    } catch {
      locale = 'en';
    }
  }
  applyDocument();
  rebuild();
}

const fetched = new Set<string>();

/**
 * Asks the API for one channel in the current locale with the held version as If-None-Match: 304 keeps it, 200
 * replaces it and is cached in localStorage. A failure keeps what the page has; it never blanks a text.
 */
export async function refreshChannel(
  channel: Channel,
  opts: { base?: string; fetchImpl?: typeof fetch; locale?: Locale } = {},
): Promise<ChannelContent | undefined> {
  const l = opts.locale ?? locale;
  const have = channels[l][channel];
  const url = `${(opts.base ?? CONTENT_API_BASE).replace(/\/$/, '')}/v1/public/content/${channel}?locale=${l}`;
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      headers: have ? { 'If-None-Match': have.etag ?? have.version } : {},
      credentials: 'omit',
    });
    if (res.status === 304 || !res.ok) return have;
    const body = (await res.json()) as Partial<ChannelContent>;
    if (!body.entries) return have;
    const next: ChannelContent = {
      channel,
      locale: l,
      version: body.version ?? '',
      entries: body.entries,
      meta: body.meta ?? {},
      fallback: body.fallback ?? [],
      etag: res.headers.get('ETag') ?? body.version,
    };
    channels[l][channel] = next;
    try {
      storage()?.setItem(cacheKey(l, channel), JSON.stringify(next));
    } catch {
      /* full or unavailable storage: the page still shows the new text */
    }
    rebuild();
    return next;
  } catch {
    return have;
  }
}

/** The texts of a channel as held, with the keys the API served in English for want of Arabic. */
export const channelContent = (channel: Channel, l: Locale = locale) => channels[l][channel];

/** Refreshes [list] once per page load and locale; the tests run on the build's snapshot only. */
export function refreshOnce(list: Channel[]) {
  if (import.meta.env.MODE === 'test' || typeof window === 'undefined') return;
  for (const ch of list) {
    const id = `${locale}:${ch}`;
    if (fetched.has(id)) continue;
    fetched.add(id);
    void refreshChannel(ch);
  }
}

/** Tests: back to English and the built snapshot. */
export function resetContent() {
  channels.en = { ...BUILT[REGION_KEY] };
  channels.ar = builtAr ? { ...builtAr } : {};
  locale = 'en';
  fetched.clear();
  applyDocument();
  rebuild();
}

/** Tests: replace a channel's texts with a fixture. */
export function setChannel(l: Locale, channel: Channel, content: ChannelContent) {
  channels[l][channel] = content;
  rebuild();
}

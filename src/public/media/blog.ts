import { has, keysUnder, metaOf, t } from '../../i18n';
import { formatDay } from '../../lib/schedule';
import { SITE } from '../site';

/**
 * The founder blog (OG-032 R15): each post is entries of the `blog` channel (`blog.<slug>.title`, `.summary`,
 * `.author`, `.body` in markdown); the title's meta holds the date, tags, the walkthrough video and the product page.
 * Each region's content holds its own posts (the AE build has no US-only post, OG-022 R18).
 */
export interface Post {
  slug: string;
  title: string;
  date: string;
  summary: string;
  author: string;
  tags: string[];
  video?: string;
  product?: string;
  body: string;
}

/** A post's text in the current language: the `blog` channel (OG-033), one entry each for title, summary, author and body. */
export function postBySlug(slug: string): Post | undefined {
  if (!has(`blog.${slug}.title`) || !has(`blog.${slug}.body`)) return undefined;
  const meta = metaOf(`blog.${slug}.title`);
  const tags = (meta.tags ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  // A post about cards is left out where the bank has no cards (the UAE in v0, OG-034 R7).
  if (!SITE.cards && tags.includes('cards')) return undefined;
  return {
    slug,
    title: t(`blog.${slug}.title`),
    date: meta.date ?? '',
    summary: t(`blog.${slug}.summary`),
    author: t(`blog.${slug}.author`),
    tags,
    video: meta.video || undefined,
    product: meta.product || undefined,
    body: t(`blog.${slug}.body`),
  };
}

/** Every post the content has, newest first. */
export function posts(): Post[] {
  return keysUnder('blog.')
    .filter((k) => k.endsWith('.title'))
    .map((k) => postBySlug(k.slice(5, -6)))
    .filter((p): p is Post => p !== undefined)
    .sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date)));
}

/** 7 Nov 2026, as the rest of the app writes dates (Arabic month names in Arabic); a calendar day never shifts. */
export const formatPostDate = (iso: string): string => formatDay(iso) || iso;

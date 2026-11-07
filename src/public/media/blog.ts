import { IS_AE } from '../../region';

/**
 * The founder blog (OG-032 R15): one markdown file per post in src/public/blog/, with front matter for the title,
 * date, summary, author, tags, the walkthrough video it links and the product page. Newest first.
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

/**
 * The AE build (OG-022 R18) reads only blog/ae/: the posts that hold for the UAE, without US bank, rail or partner names.
 * US-only posts (the partner, where your money lives, adding money, limits) are not in it.
 */
const files = (
  IS_AE
    ? import.meta.glob('../blog/ae/*.md', { query: '?raw', import: 'default', eager: true })
    : import.meta.glob('../blog/*.md', { query: '?raw', import: 'default', eager: true })
) as Record<string, string>;

export function parsePost(slug: string, raw: string): Post {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`Blog post ${slug} has no front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const k of ['title', 'date', 'summary', 'author'])
    if (!meta[k]) throw new Error(`Blog post ${slug} has no ${k}`);
  return {
    slug,
    title: meta.title!,
    date: meta.date!,
    summary: meta.summary!,
    author: meta.author!,
    tags: (meta.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    video: meta.video,
    product: meta.product,
    body: m[2]!.trim(),
  };
}

export const POSTS: Post[] = Object.entries(files)
  .map(([path, raw]) => parsePost(path.replace(/^.*\/|\.md$/g, ''), raw))
  .sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date)));

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

/** 7 Nov 2026, as the rest of the app writes dates; the date is a calendar day, so it never shifts by time zone. */
export function formatPostDate(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo! - 1];
  return `${d} ${month} ${y}`;
}

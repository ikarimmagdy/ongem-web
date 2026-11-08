// OG-033: the content snapshot the web is built with. Every text the site shows is a content entry served by
// ongem-core (GET /v1/public/content/{channel}?locale=); the build pulls a snapshot of the public channels in both
// locales, and the dev server and the tests read the seed files in content-seed/<region>/ converted to the same form.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PUBLIC_CHANNELS = ['web_public', 'web_app', 'blog', 'faq', 'legal'];
export const LOCALES = ['en', 'ar'];

/** Each region's dev API, the build's default source (VITE_REGION picks the region, OG-022 R18). */
export const DEFAULT_API = {
  us: 'https://api-dev.ongem.com',
  ae: 'https://api-dev.ae.platform.ongem.com',
};

export const regionOf = (env = process.env) => (env.VITE_REGION === 'AE' ? 'ae' : 'us');

const version = (value) => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

/** The seed entries of one region, per channel, as the core imports them (contract: seed files). */
export function readSeed(root, region) {
  const dir = join(root, 'content-seed', region);
  const channels = {};
  if (existsSync(dir))
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const seed = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      channels[seed.channel] = [...(channels[seed.channel] ?? []), ...seed.entries];
    }
  return channels;
}

export const channelOf = (key) =>
  ({ web: 'web_public', app: 'web_app', blog: 'blog', faq: 'faq', legal: 'legal', notice: 'notice' })[
    key.split('.')[0]
  ] ?? 'unknown';

/**
 * The seed as the public API would answer it, per locale and channel: every key, Arabic where the seed has it, else
 * English and the key listed in `fallback` (AC-R7.1). The seed's Arabic is in review, so a real API serves English
 * until it is published; the snapshot from the seed shows it for development and tests.
 */
export function seedSnapshot(root, region) {
  const seed = readSeed(root, region);
  const locales = {};
  for (const locale of LOCALES) {
    const channels = {};
    for (const channel of PUBLIC_CHANNELS) {
      const entries = {};
      const meta = {};
      const fallback = [];
      for (const e of seed[channel] ?? []) {
        const text = locale === 'en' ? e.en : e.ar;
        entries[e.key] = text ?? e.en;
        if (text == null) fallback.push(e.key);
        if (e.meta && Object.keys(e.meta).length) meta[e.key] = e.meta;
      }
      channels[channel] = { channel, locale, version: version(entries), entries, meta, fallback };
    }
    locales[locale] = channels;
  }
  return { region, source: 'seed', locales };
}

/** Pulls every public channel in both locales from [apiBase]; throws on any failure, so a build never ships no text. */
export async function fetchSnapshot(apiBase, region, fetchImpl = fetch) {
  const locales = {};
  for (const locale of LOCALES) {
    locales[locale] = {};
    for (const channel of PUBLIC_CHANNELS) {
      const url = `${apiBase.replace(/\/$/, '')}/v1/public/content/${channel}?locale=${locale}`;
      let res;
      try {
        res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
      } catch (e) {
        throw new Error(`content: ${url} unreachable (${e.message})`);
      }
      if (!res.ok) throw new Error(`content: ${url} answered ${res.status}`);
      const body = await res.json();
      locales[locale][channel] = {
        channel,
        locale,
        version: body.version,
        entries: body.entries ?? {},
        meta: body.meta ?? {},
        fallback: body.fallback ?? [],
      };
    }
  }
  return { region, source: apiBase, locales };
}

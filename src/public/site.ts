import { IS_AE, REGION, type Region } from '../region';

/**
 * What the public site of this build may say and where the other build lives (OG-034 R6, R7, R9). The UAE build is
 * not live: no account is open there and the UAE bank has no cards in v0 (Karim, 2026-11-11), so it says coming soon
 * and has no card page. URLs are configuration; the defaults are the dev sites (hub `env-links.md`).
 */
const US_SITE = 'https://app-dev.platform.ongem.com';
const AE_SITE = 'https://ongemuaedevweb.z1.web.core.windows.net';

const env = (v: string | undefined) => v?.trim().replace(/\/$/, '') || undefined;

export const SITE = {
  region: REGION,
  /** Accounts are open in this region. */
  live: !IS_AE,
  /** The bank issues cards in this region. */
  cards: !IS_AE,
  /** This build's public origin. */
  url: env(import.meta.env.VITE_SITE_URL) ?? (IS_AE ? AE_SITE : US_SITE),
  /** The other region's public origin, for the region chooser and hreflang. */
  otherUrl: env(import.meta.env.VITE_OTHER_SITE_URL) ?? (IS_AE ? US_SITE : AE_SITE),
  /** Public contact address; empty until OnGem names one (OG-034 open question 1). */
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '',
};

export const OTHER_REGION: Region = IS_AE ? 'US' : 'AE';

export const siteOf = (region: Region) => (region === SITE.region ? SITE.url : SITE.otherUrl);

/** Search alternates (OG-034 R9): English in the US, English and Arabic in the UAE; x-default is the US site. */
export const HREFLANG: Array<{ lang: string; region: Region; locale: 'en' | 'ar' }> = [
  { lang: 'en-US', region: 'US', locale: 'en' },
  { lang: 'en-AE', region: 'AE', locale: 'en' },
  { lang: 'ar-AE', region: 'AE', locale: 'ar' },
];

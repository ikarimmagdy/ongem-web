import { brand, brandServed, isDefaultBrand } from '../lib/brand';
import { IS_AE, REGION, type Region } from '../region';

/**
 * What the public site of this build may say and where the other build lives (OG-034 R6, R7, R9). The UAE build is
 * not live: no account is open there and the UAE bank has no cards in v0 (Karim, 2026-11-11), so it says coming soon
 * and has no card page. URLs are configuration; the defaults are the dev sites (hub `env-links.md`).
 */
const US_SITE = 'https://app-dev.platform.ongem.com';
const AE_SITE = 'https://ongemuaedevweb.z1.web.core.windows.net';

const env = (v: string | undefined) => v?.trim().replace(/\/$/, '') || undefined;

/** Another brand's own site, so its pages never name the default brand's hosts. */
const brandSite = (): string | undefined =>
  isDefaultBrand() ? undefined : `https://${brand().domains.web.replace(/\/$/, '')}`;

export const SITE = {
  region: REGION,
  /** Accounts are open in this region. */
  live: !IS_AE,
  /** The bank issues cards in this region. */
  cards: !IS_AE,
  /** This build's public origin; under another brand than the default, that brand's web domain (OG-079). */
  get url(): string {
    return env(import.meta.env.VITE_SITE_URL) ?? brandSite() ?? (IS_AE ? AE_SITE : US_SITE);
  },
  /** The other region's public origin, for the region chooser and hreflang. */
  get otherUrl(): string {
    return env(import.meta.env.VITE_OTHER_SITE_URL) ?? brandSite() ?? (IS_AE ? US_SITE : AE_SITE);
  },
  /**
   * Public contact address: VITE_CONTACT_EMAIL, else the support address of the brand ongem-core serves (OG-082); empty
   * until one is named (OG-034 open question 1, PS-010), so a bundled brand never invents one.
   */
  get contactEmail(): string {
    return import.meta.env.VITE_CONTACT_EMAIL?.trim() || (brandServed() ? (brand().support.email ?? '') : '');
  },
};

/**
 * A production build (`VITE_ENVIRONMENT=production`); anything else (dev, preview, tests) is not. A production build
 * hides the draft disclosures and their draft note (PS-002), which stay on every other build for legal review.
 */
export const isProduction = () => import.meta.env.VITE_ENVIRONMENT?.trim().toLowerCase() === 'production';

/**
 * Demo mode for the legal pages (OG-079): a demo site (`VITE_DEMO_SITE=true`) or a tab in demo mode, under another
 * brand than the default. There the legal pages show sample texts that name the brand, never the operator's own legal
 * texts, which name the operator and are written by its legal team.
 */
export function demoLegal(): boolean {
  if (isDefaultBrand()) return false;
  if (import.meta.env.VITE_DEMO_SITE?.trim() === 'true') return true;
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem('ongem.demo') === '1';
  } catch {
    return false;
  }
}

export const OTHER_REGION: Region = IS_AE ? 'US' : 'AE';

export const siteOf = (region: Region) => (region === SITE.region ? SITE.url : SITE.otherUrl);

/** Search alternates (OG-034 R9): English in the US, English and Arabic in the UAE; x-default is the US site. */
export const HREFLANG: Array<{ lang: string; region: Region; locale: 'en' | 'ar' }> = [
  { lang: 'en-US', region: 'US', locale: 'en' },
  { lang: 'en-AE', region: 'AE', locale: 'en' },
  { lang: 'ar-AE', region: 'AE', locale: 'ar' },
];

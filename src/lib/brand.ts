// content-check: data (the brand record and its bundled defaults; every screen reads names, domains and support from here)
import { useSyncExternalStore } from 'react';
import BUNDLE from './brands.json';

/**
 * The white-label brand (OG-082, ADR-0058): the record ongem-core serves at `GET /v1/public/brand`. The web starts from
 * the brand it bundles (`VITE_BRAND`, default ongem) and switches to the served one when ongem-core answers; nulls in
 * the served record mean "use the bundled value".
 */
export interface Brand {
  id: string;
  version: number;
  names: { product: string; short: string; legal: string; assistant: string };
  /** Absolute image URLs; null means the active theme's own logo files. */
  logo: { wordmark: string | null; mark: string | null; favicon: string | null } | null;
  theme: {
    light: string;
    dark: string | null;
    tokens: { light: unknown; dark: unknown } | null;
  };
  domains: { web: string; marketing: string; api: string };
  support: { email: string | null; phone: string | null; url: string | null };
  legal: { entity: string; address: string; bankDisclosureKey: string | null };
  messaging: { emailFrom: string; emailFromName: string; smsPrefix: string; pushTitle: string };
  apps: {
    iosBundleId: string | null;
    androidApplicationId: string | null;
    appStoreUrl: string | null;
    playStoreUrl: string | null;
  };
  auth: { clerkPublishableKey: string | null };
  /**
   * The partners behind the service and the BaaS provider's products texts name; null names none, and texts say the
   * generic definition instead (OG-079, OG-086).
   */
  partners: BrandPartners | null;
}

export interface BrandPartners {
  sponsorBank: string | null;
  baasProvider: string | null;
  formationPartner: string | null;
  baasConsole?: string | null;
  baasComplianceService?: string | null;
  baasPayoutRail?: string | null;
}

export const BUNDLED_BRANDS: Record<string, Brand> = BUNDLE.brands as unknown as Record<string, Brand>;

const BRAND_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** The environment's brand (ongem-infra `-c brand=<id>` sets `VITE_BRAND` for the build), else the bundle's default. */
export const DEFAULT_BRAND_ID: string = (() => {
  const id = import.meta.env.VITE_BRAND?.trim();
  return id && BUNDLED_BRANDS[id] ? id : BUNDLE.default;
})();

export const bundledBrand = (id: string = DEFAULT_BRAND_ID): Brand =>
  BUNDLED_BRANDS[id] ?? BUNDLED_BRANDS[DEFAULT_BRAND_ID]!;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Served values over the bundled ones, section by section; a null or missing value keeps the bundled one. */
function merge<T>(base: T, served: unknown): T {
  if (!isObj(served) || !isObj(base)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(served)) {
    if (v === null || v === undefined) continue;
    const b = out[k];
    // A served partners section is taken whole: there a null means the generic definition, not the bundled name.
    out[k] = isObj(b) && isObj(v) && k !== 'tokens' && k !== 'partners' ? merge(b, v) : v;
  }
  return out as T;
}

/** A served brand, or null when it is not one (no id or product name). */
export function parseBrand(body: unknown): Brand | null {
  if (!isObj(body) || typeof body.id !== 'string' || !BRAND_ID.test(body.id)) return null;
  const names = body.names;
  if (!isObj(names) || typeof names.product !== 'string' || !names.product.trim()) return null;
  const base = BUNDLED_BRANDS[body.id] ?? bundledBrand();
  const merged = merge(base, body);
  // A served brand that sets no logo uses its theme's logo, never the default brand's files.
  if (!BUNDLED_BRANDS[body.id] && !isObj(body.logo)) merged.logo = null;
  // Nor does it name the default brand's partners.
  if (!BUNDLED_BRANDS[body.id] && !isObj(body.partners)) merged.partners = null;
  return merged;
}

let current: Brand = bundledBrand();
let served = false;
const listeners = new Set<() => void>();

export const brand = (): Brand => current;

/**
 * True for the bundle's default brand, the operator's own. Screenshots, the gallery, the walkthrough videos and the share
 * images were recorded under it, so another brand never shows them (OG-079).
 */
export const isDefaultBrand = (b: Pick<Brand, 'id'> = current): boolean => b.id === BUNDLE.default;
/** True once ongem-core answered with the brand (a bundled brand never invents a contact address). */
export const brandServed = (): boolean => served;

export function setBrand(next: Brand, fromServer = false) {
  if (next === current && fromServer === served) return;
  current = next;
  served = fromServer;
  listeners.forEach((l) => l());
}

export const subscribeBrand = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The brand for a component, re-rendered when ongem-core's answer or a demo brand arrives. */
export const useBrandConfig = (): Brand => useSyncExternalStore(subscribeBrand, brand, brand);

/** What a text says for a partner, product or contact the brand does not name, per locale (English for any other). */
const DEFINITIONS: Record<string, Record<keyof BrandPartners | 'supportEmail' | 'webDomain', string>> = {
  en: {
    sponsorBank: 'our sponsor bank',
    baasProvider: 'our BaaS partner',
    formationPartner: 'a company formation partner',
    baasConsole: "BaaS partner's console",
    baasComplianceService: "our BaaS partner's managed compliance service",
    baasPayoutRail: "our BaaS partner's international payout rail",
    supportEmail: 'our support team',
    webDomain: 'our website',
  },
  ar: {
    sponsorBank: 'بنكنا الراعي',
    baasProvider: 'منصتنا المصرفية الشريكة',
    formationPartner: 'شركة تأسيس شريكة',
    baasConsole: 'لوحة تحكم المنصة المصرفية الشريكة',
    baasComplianceService: 'خدمة الامتثال المُدارة لدى منصتنا المصرفية الشريكة',
    baasPayoutRail: 'شبكة المدفوعات الدولية لدى منصتنا المصرفية الشريكة',
    supportEmail: 'فريق الدعم لدينا',
    webDomain: 'موقعنا الإلكتروني',
  },
};

const definition = (key: keyof BrandPartners | 'supportEmail' | 'webDomain', locale: string): string =>
  (DEFINITIONS[locale] ?? DEFINITIONS.en!)[key];

/** The partner and product placeholders; a value of one that starts a sentence is written with a capital letter. */
export const PARTNER_VARS: ReadonlySet<string> = new Set([
  'sponsorBank',
  'baasProvider',
  'formationPartner',
  'baasConsole',
  'baasComplianceService',
  'baasPayoutRail',
]);

/** A partner's name in [locale]: the brand's, else the generic definition ("our sponsor bank"). */
export const partnerName = (key: keyof BrandPartners, locale: string = 'en', b: Brand = current): string =>
  b.partners?.[key] ?? definition(key, locale);

/**
 * The words a content text may carry as placeholders: `{brand}` (product name), `{legalName}`, the partners'
 * `{sponsorBank}`, `{baasProvider}` and `{formationPartner}`, the BaaS provider's products `{baasConsole}`,
 * `{baasComplianceService}` and `{baasPayoutRail}`, and the brand's `{supportEmail}` and `{webDomain}`, in [locale].
 */
export const brandVars = (b: Brand = current, locale: string = 'en') => ({
  brand: b.names.product,
  legalName: b.names.legal,
  sponsorBank: partnerName('sponsorBank', locale, b),
  baasProvider: partnerName('baasProvider', locale, b),
  formationPartner: partnerName('formationPartner', locale, b),
  baasConsole: partnerName('baasConsole', locale, b),
  baasComplianceService: partnerName('baasComplianceService', locale, b),
  baasPayoutRail: partnerName('baasPayoutRail', locale, b),
  supportEmail: b.support.email ?? definition('supportEmail', locale),
  webDomain: b.domains.web || definition('webDomain', locale),
});

const OVERRIDE_KEY = 'ongem.brand';
const DEMO_FLAG = 'ongem.demo';

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * `?brand=<id>` (ADR-0058 decision 2): only in a development build or in demo mode, never for a production visitor.
 * The choice lasts for the tab, so moving between pages keeps it; `?brand=` with no id drops it.
 */
export function brandOverride(
  loc: Pick<Location, 'search' | 'pathname'> | null = typeof window === 'undefined' ? null : window.location,
  env: { VITE_ENVIRONMENT?: string } = import.meta.env,
): string | null {
  const s = session();
  let demo = false;
  try {
    demo = s?.getItem(DEMO_FLAG) === '1';
  } catch {
    demo = false;
  }
  const production = env.VITE_ENVIRONMENT?.trim().toLowerCase() === 'production';
  if (production && !demo && loc?.pathname !== '/demo') return null;
  const asked = loc ? new URLSearchParams(loc.search).get('brand') : null;
  try {
    if (asked !== null) {
      const id = asked.trim().toLowerCase();
      if (id && BRAND_ID.test(id)) s?.setItem(OVERRIDE_KEY, id);
      else s?.removeItem(OVERRIDE_KEY);
    }
    const kept = s?.getItem(OVERRIDE_KEY) ?? null;
    return kept && BRAND_ID.test(kept) ? kept : null;
  } catch {
    const id = asked?.trim().toLowerCase();
    return id && BRAND_ID.test(id) ? id : null;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || '/api-dev';

/**
 * Reads `GET /v1/public/brand` once at start (`?brand=` passes an allowed override through). Until it answers, and
 * whenever it cannot, the bundled brand stays: the override's when this build bundles it, else the environment's.
 */
export async function loadBrand(
  base: string = API_BASE,
  fetcher: typeof fetch = fetch,
  override: string | null = brandOverride(),
): Promise<Brand> {
  const fallback = bundledBrand(override ?? undefined);
  if (fallback !== current) setBrand(fallback);
  try {
    const q = override ? `?brand=${encodeURIComponent(override)}` : '';
    const res = await fetcher(`${base.replace(/\/$/, '')}/v1/public/brand${q}`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const next = parseBrand(await res.json());
      // A server that does not allow the override answers its own brand; the asked-for bundled one stays.
      if (next && (!override || next.id === override)) {
        setBrand(next, true);
        return next;
      }
    }
  } catch {
    // Unreachable server: the bundled brand stays.
  }
  return current;
}

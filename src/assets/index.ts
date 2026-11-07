import ongemFavicon from './ongem-favicon.png';
import ongemWordmark from './ongem-wordmark.png';
import ongemWordmarkLight from './ongem-wordmark-light.png';

/** Brand files a theme can name in `logo.wordmark` or `logo.favicon`. */
export const BRAND_ASSETS: Record<string, string> = {
  'ongem-wordmark.png': ongemWordmark,
  'ongem-wordmark-light.png': ongemWordmarkLight,
  'ongem-favicon.png': ongemFavicon,
};

/** Intrinsic sizes, so the page reserves the wordmark's box before the image arrives (no layout shift). */
export const BRAND_ASSET_SIZES: Record<string, { width: number; height: number }> = {
  'ongem-wordmark.png': { width: 650, height: 168 },
  'ongem-wordmark-light.png': { width: 650, height: 168 },
};

/** Light-ink versions for dark themes, so the wordmark sits on the dark surface without a plate (UI review 2026-11-07). */
export const BRAND_ASSET_ON_DARK: Record<string, string> = {
  'ongem-wordmark.png': 'ongem-wordmark-light.png',
};

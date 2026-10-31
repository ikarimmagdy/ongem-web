import ongemFavicon from './ongem-favicon.png';
import ongemWordmark from './ongem-wordmark.png';

/** Brand files a theme can name in `logo.wordmark` or `logo.favicon`. */
export const BRAND_ASSETS: Record<string, string> = {
  'ongem-wordmark.png': ongemWordmark,
  'ongem-favicon.png': ongemFavicon,
};

/** Intrinsic sizes, so the page reserves the wordmark's box before the image arrives (no layout shift). */
export const BRAND_ASSET_SIZES: Record<string, { width: number; height: number }> = {
  'ongem-wordmark.png': { width: 650, height: 168 },
};

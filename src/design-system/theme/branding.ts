import { BRAND_ASSETS } from '../../assets';
import type { Theme } from './types';

export const PRODUCT_NAME = 'Console';

/** The brand shown in copy: the logo alt text, else the theme name. */
export function brandName(theme: Theme): string {
  return theme.logo.alt.trim() || theme.name;
}

export function documentTitle(theme: Theme): string {
  return `${brandName(theme)} ${PRODUCT_NAME}`;
}

const escapeXml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );

/** The theme's favicon file, else a square letter mark in its brand colours as an SVG data URL. */
export function faviconHref(theme: Theme): string {
  const file = theme.logo.favicon ? BRAND_ASSETS[theme.logo.favicon] : undefined;
  if (file) return file;
  const letter = escapeXml(brandName(theme).charAt(0).toUpperCase());
  const font = escapeXml(theme.typography.display.family);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="${Math.min(theme.radius.lg * 1.5, 20)}" fill="${theme.color.brand.primary}"/>` +
    `<text x="32" y="44" text-anchor="middle" font-family="${font}" font-weight="700" font-size="38" ` +
    `fill="${theme.color.action.primaryText}">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

let active: Theme | null = null;

/** The theme last applied to the document, for code outside the React tree (Clerk's account modal). */
export function activeTheme(): Theme | null {
  return active;
}

export function applyBranding(theme: Theme, doc: Document = document): void {
  active = theme;
  doc.title = documentTitle(theme);
  const icons = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'));
  let link = icons[0];
  for (const extra of icons.slice(1)) extra.remove();
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'icon';
    doc.head.appendChild(link);
  }
  const href = faviconHref(theme);
  link.removeAttribute('sizes');
  link.type = href.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/png';
  link.href = href;
  const color = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (color) color.content = theme.color.surface.canvas;
}

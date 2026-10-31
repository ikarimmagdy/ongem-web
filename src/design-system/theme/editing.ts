import type { Theme } from './types';

export interface ThemeEdits {
  primary: string;
  secondary: string;
  signature: string;
  canvas: string;
  text: string;
  displayFont: string;
  bodyFont: string;
  radiusScale: number;
}

export function darken(hex: string, amount = 0.15): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * (1 - amount)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function editsFrom(theme: Theme, base: Theme): ThemeEdits {
  const scale = base.radius.md > 0 ? theme.radius.md / base.radius.md : 1;
  return {
    primary: theme.color.brand.primary,
    secondary: theme.color.brand.secondary,
    signature: theme.color.brand.signature,
    canvas: theme.color.surface.canvas,
    text: theme.color.text.primary,
    displayFont: theme.typography.display.family,
    bodyFont: theme.typography.body.family,
    radiusScale: Math.round(scale * 100) / 100,
  };
}

export function applyEdits(base: Theme, e: ThemeEdits): Theme {
  const t: Theme = structuredClone(base);
  const hover = darken(e.primary);
  t.color.brand.primary = e.primary;
  t.color.brand.primaryHover = hover;
  t.color.action.primaryBg = e.primary;
  t.color.action.primaryHoverBg = hover;
  // Dark themes keep their lighter focus ring so it stays visible on navy.
  t.color.border.focus = base.mode === 'dark' ? base.color.border.focus : e.primary;
  t.color.text.link = base.mode === 'dark' ? base.color.text.link : e.primary;
  t.color.brand.secondary = e.secondary;
  t.color.brand.signature = e.signature;
  t.color.surface.canvas = e.canvas;
  t.color.text.primary = e.text;
  t.color.text.money = e.text;
  t.typography.display.family = e.displayFont;
  t.typography.body.family = e.bodyFont;
  t.typography.bodyStrong.family = e.bodyFont;
  t.typography.money.family = e.bodyFont;
  for (const k of ['sm', 'md', 'lg', 'xl'] as const) t.radius[k] = Math.round(base.radius[k] * e.radiusScale);
  return t;
}

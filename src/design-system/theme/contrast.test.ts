import { BUNDLED_THEMES } from './sources';
import type { Theme } from './types';

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT = 4.5;
const UI = 3;

/** Colour pairs the stylesheet actually draws, with the WCAG AA minimum for each. */
function pairs(t: Theme): Array<[string, string, string, number]> {
  const c = t.color;
  const dark = t.mode === 'dark';
  const surfaces = {
    canvas: c.surface.canvas,
    card: c.surface.card,
    sunken: c.surface.sunken,
    raised: c.surface.raised,
  };
  const out: Array<[string, string, string, number]> = [];
  for (const [name, bg] of Object.entries(surfaces)) {
    out.push([`text on ${name}`, c.text.primary, bg, TEXT]);
    out.push([`secondary text on ${name}`, c.text.secondary, bg, TEXT]);
    out.push([`link on ${name}`, c.text.link, bg, TEXT]);
    out.push([`input border on ${name}`, c.border.strong, bg, UI]);
    out.push([`focus ring on ${name}`, c.border.focus, bg, UI]);
  }
  out.push(['field error', c.status.failure, c.surface.card, TEXT]);
  out.push(['primary button', c.action.primaryText, c.action.primaryBg, TEXT]);
  out.push(['primary button hover', c.action.primaryText, c.action.primaryHoverBg, TEXT]);
  out.push(['secondary button', c.action.secondaryText, c.action.secondaryBg, TEXT]);
  out.push(['danger button', c.action.dangerText, c.action.dangerBg, TEXT]);
  out.push([
    'active nav',
    dark ? c.text.link : c.brand.primary,
    dark ? c.surface.raised : c.surface.tintBlue,
    TEXT,
  ]);
  out.push(['selected tab', c.text.link, c.surface.canvas, TEXT]);
  for (const s of ['success', 'pending', 'failure', 'info', 'neutral'] as const) {
    out.push([`${s} chip and notice text`, c.text.primary, c.status[`${s}Bg`], TEXT]);
    out.push([`${s} marker on card`, c.status[s], c.surface.card, UI]);
  }
  for (const tint of ['tintBlue', 'tintViolet', 'tintMint'] as const)
    out.push([`deep text on ${tint}`, c.brand.deep, c.surface[tint], TEXT]);
  return out;
}

describe('bundled themes meet WCAG AA contrast', () => {
  for (const theme of BUNDLED_THEMES) {
    it(`${theme.id}`, () => {
      const failing = pairs(theme)
        .map(([label, fg, bg, min]) => ({ label, fg, bg, min, r: ratio(fg, bg) }))
        .filter((p) => p.r < p.min)
        .map((p) => `${p.label}: ${p.fg} on ${p.bg} is ${p.r.toFixed(2)}:1, needs ${p.min}:1`);
      expect(failing).toEqual([]);
    });
  }
});

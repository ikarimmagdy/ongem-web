/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUNDLED_THEMES } from '../design-system/theme/sources';
import type { Theme } from '../design-system/theme/types';

/** Helpers for the UI and UX review of 2026-11-12 (FA-xxx): read the stylesheets the signed-in app draws with. */
const root = join(__dirname, '..');
export const css = (file: string) => readFileSync(join(root, file), 'utf8');
export const SIGNED_IN_SHEETS = ['web.css', 'app-shell.css'];

/** Every declaration block for [selector] in [sheet], in source order (the last one wins at equal specificity). */
export function rules(sheet: string, selector: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css(sheet).matchAll(re)) {
    const sels = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim());
    if (sels.includes(selector)) out.push(m[2]!);
  }
  return out;
}

/** The last value of [prop] for [selector] across [sheets]. */
export function prop(sheets: string[], selector: string, name: string): string | undefined {
  let v: string | undefined;
  for (const s of sheets)
    for (const block of rules(s, selector)) {
      const m = new RegExp(`(?:^|;|\\s)${name}:\\s*([^;]+);`).exec(block);
      if (m) v = m[1]!.trim();
    }
  return v;
}

const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** A `--color-<group>-<key>` variable's value in [theme]. */
export function colorVar(theme: Theme, v: string): string {
  const m = /--color-([a-z]+)-([a-z0-9-]+)/.exec(v);
  if (!m) throw new Error(`not a colour variable: ${v}`);
  const group = theme.color[m[1] as keyof Theme['color']] as Record<string, string>;
  const value = group?.[camel(m[2]!)];
  if (!value) throw new Error(`${v} is not in theme ${theme.id}`);
  return value;
}

/** Resolves `calc()` over space, radius and font-size variables to pixels in [theme]. */
export function px(theme: Theme, expr: string): number {
  const sub = expr
    .replace(/var\(--space-([a-z0-9]+)\)/g, (_, k: string) => String(theme.space[k as never]))
    .replace(/var\(--font-size-([a-z0-9]+)\)/g, (_, k: string) => String(theme.typography.scale[k as never]))
    .replace(/calc/g, '')
    .replace(/px/g, '');
  if (!/^[\d\s+\-*/().]+$/.test(sub)) throw new Error(`cannot resolve ${expr}`);
  return Function(`return (${sub});`)() as number;
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

export { BUNDLED_THEMES };

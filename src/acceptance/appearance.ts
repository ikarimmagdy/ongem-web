import type { Theme } from '../design-system/theme';

/**
 * The processor's elements styled from OnGem's theme tokens (OG-039): light or dark from the theme's mode, the accent
 * from the theme's primary brand colour (the elements take a named palette, so the nearest hue is used), the corner
 * radius and the body font family. No colour, radius or font is written here; all come from the active theme.
 */

/** The elements' accent palette by approximate hue in degrees (Radix colour scales, from their published palettes). */
const ACCENT_HUES: Array<[string, number]> = [
  ['red', 358],
  ['tomato', 10],
  ['orange', 24],
  ['amber', 40],
  ['yellow', 53],
  ['lime', 81],
  ['grass', 131],
  ['green', 151],
  ['jade', 162],
  ['teal', 173],
  ['cyan', 190],
  ['sky', 197],
  ['blue', 206],
  ['indigo', 226],
  ['iris', 240],
  ['violet', 252],
  ['purple', 272],
  ['plum', 292],
  ['pink', 322],
  ['crimson', 336],
];

/** The hue of a CSS colour written as #rrggbb (the theme schema's colour format), or null for anything else. */
export function hueOf(colour: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function nearestAccent(colour: string): string {
  const hue = hueOf(colour);
  if (hue == null) return 'gray';
  const dist = (a: number) => Math.min(Math.abs(a - hue), 360 - Math.abs(a - hue));
  return ACCENT_HUES.reduce((best, cur) => (dist(cur[1]) < dist(best[1]) ? cur : best))[0];
}

export function elementsAppearance(theme: Theme) {
  return {
    theme: {
      appearance: theme.mode === 'dark' ? ('dark' as const) : ('light' as const),
      accentColor: nearestAccent(theme.color.brand.primary),
      grayColor: 'auto',
    },
    variables: {
      '--radius': `${theme.radius.md}px`,
      '--default-font-family': theme.typography.body.family,
    },
  };
}

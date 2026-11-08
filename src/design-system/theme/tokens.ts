import type { Theme } from './types';

/**
 * The Arabic face (OG-033 R10), placed after the theme's own faces and before the generic family, so Latin text keeps
 * the brand face and Arabic letters, which the brand faces do not have, use IBM Plex Sans Arabic.
 */
export const ARABIC_FACE = "'IBM Plex Sans Arabic'"; // content-check: ignore (a font name)
const GENERIC = /^(system-ui|sans-serif|serif|monospace|ui-\w+|-apple-system)$/;

export function withArabic(family: string): string {
  if (family.includes(ARABIC_FACE)) return family;
  const faces = family.split(',').map((f) => f.trim());
  const at = faces.findIndex((f) => GENERIC.test(f));
  faces.splice(at < 0 ? faces.length : at, 0, ARABIC_FACE);
  return faces.join(', ');
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [group, values] of Object.entries(theme.color)) {
    for (const [key, value] of Object.entries(values)) vars[`--color-${group}-${kebab(key)}`] = value;
  }
  vars['--gradient-brand'] = `linear-gradient(135deg, ${theme.gradient.brand.join(', ')})`;

  for (const role of ['display', 'label', 'body', 'bodyStrong', 'money'] as const) {
    const r = theme.typography[role];
    const name = kebab(role);
    vars[`--font-${name}`] = withArabic(r.family);
    vars[`--font-${name}-weight`] = String(r.weight);
    if (r.transform) vars[`--font-${name}-transform`] = r.transform;
    if (r.tracking) vars[`--font-${name}-tracking`] = r.tracking;
    if (r.numeric) vars[`--font-${name}-numeric`] = r.numeric;
  }
  for (const [k, v] of Object.entries(theme.typography.scale)) vars[`--font-size-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.space)) vars[`--space-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.radius)) vars[`--radius-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.shadow)) vars[`--shadow-${k}`] = v;

  const dark = theme.mode === 'dark';
  vars['--logo-plate-bg'] = dark ? theme.color.surface.inverse : 'transparent';
  vars['--color-scheme'] = dark ? 'dark' : 'light';
  return vars;
}

export function applyTheme(theme: Theme, el: HTMLElement = document.documentElement): void {
  const vars = themeToCssVars(theme);
  for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
  el.style.setProperty('color-scheme', vars['--color-scheme'] ?? 'light');
  el.dataset.theme = theme.id;
  el.dataset.themeMode = theme.mode ?? 'light';
}

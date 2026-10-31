import {
  ACTION_KEYS,
  BORDER_KEYS,
  BRAND_KEYS,
  CATEGORY_KEYS,
  FONT_ROLES,
  RADIUS_KEYS,
  SCALE_KEYS,
  SHADOW_KEYS,
  SPACE_KEYS,
  STATUS_KEYS,
  SURFACE_KEYS,
  TEXT_KEYS,
  THEME_SCHEMA,
  type Theme,
} from './types';

export type ValidationResult = { ok: true; theme: Theme } | { ok: false; errors: string[] };

const COLOR = /^(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isColor(v: unknown): v is string {
  return typeof v === 'string' && COLOR.test(v.trim());
}

export function validateTheme(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ['Theme must be a JSON object.'] };
  const t = input;

  if (t.$schema !== THEME_SCHEMA) errors.push(`$schema must be "${THEME_SCHEMA}".`);
  if (typeof t.id !== 'string' || !ID.test(t.id))
    errors.push('id must be lower-case letters, digits and dashes.');
  if (typeof t.name !== 'string' || t.name.trim() === '') errors.push('name is required.');
  if (typeof t.version !== 'number') errors.push('version must be a number.');
  if (t.mode !== undefined && t.mode !== 'light' && t.mode !== 'dark')
    errors.push('mode must be light or dark.');

  const groups: Array<[string, readonly string[]]> = [
    ['brand', BRAND_KEYS],
    ['surface', SURFACE_KEYS],
    ['text', TEXT_KEYS],
    ['border', BORDER_KEYS],
    ['action', ACTION_KEYS],
    ['status', STATUS_KEYS],
    ['category', CATEGORY_KEYS],
  ];
  if (!isObject(t.color)) errors.push('color is required.');
  else {
    for (const [group, keys] of groups) {
      const g = t.color[group];
      if (!isObject(g)) {
        errors.push(`color.${group} is required.`);
        continue;
      }
      for (const k of keys) if (!isColor(g[k])) errors.push(`color.${group}.${k} must be a colour.`);
    }
  }

  if (!isObject(t.gradient) || !Array.isArray(t.gradient.brand) || !t.gradient.brand.every(isColor))
    errors.push('gradient.brand must be a list of colours.');

  if (!isObject(t.typography)) errors.push('typography is required.');
  else {
    for (const role of FONT_ROLES) {
      const r = t.typography[role];
      if (
        !isObject(r) ||
        typeof r.family !== 'string' ||
        r.family.trim() === '' ||
        typeof r.weight !== 'number'
      )
        errors.push(`typography.${role} needs a family and a weight.`);
    }
    const scale = t.typography.scale;
    if (!isObject(scale)) errors.push('typography.scale is required.');
    else
      for (const k of SCALE_KEYS)
        if (typeof scale[k] !== 'number') errors.push(`typography.scale.${k} must be a number.`);
  }

  const numberGroup = (name: string, keys: readonly string[]) => {
    const g = t[name];
    if (!isObject(g)) return errors.push(`${name} is required.`);
    for (const k of keys)
      if (typeof g[k] !== 'number' || (g[k] as number) < 0)
        errors.push(`${name}.${k} must be a positive number.`);
  };
  numberGroup('space', SPACE_KEYS);
  numberGroup('radius', RADIUS_KEYS);

  if (!isObject(t.shadow)) errors.push('shadow is required.');
  else
    for (const k of SHADOW_KEYS)
      if (typeof t.shadow[k] !== 'string') errors.push(`shadow.${k} must be text.`);

  if (
    !isObject(t.logo) ||
    typeof t.logo.alt !== 'string' ||
    !(t.logo.wordmark === null || typeof t.logo.wordmark === 'string')
  )
    errors.push('logo needs alt text and a wordmark file name or null.');
  else if (!(t.logo.favicon == null || typeof t.logo.favicon === 'string'))
    errors.push('logo.favicon must be a file name or null.');

  return errors.length ? { ok: false, errors } : { ok: true, theme: input as unknown as Theme };
}

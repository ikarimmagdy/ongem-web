import bundle from '../../themes/ongem-themes.json';
import { validateTheme } from './schema';
import type { Theme, ThemeBundle } from './types';

export interface ThemeSource {
  readonly name: string;
  load(): Promise<Theme[]>;
}

export interface LoadReport {
  themes: Theme[];
  rejected: Array<{ id: string; errors: string[] }>;
}

export function validateAll(list: unknown[]): LoadReport {
  const report: LoadReport = { themes: [], rejected: [] };
  for (const item of list) {
    const r = validateTheme(item);
    if (r.ok) report.themes.push(r.theme);
    else {
      const id =
        typeof item === 'object' && item && 'id' in item ? String((item as { id: unknown }).id) : '?';
      report.rejected.push({ id, errors: r.errors });
    }
  }
  return report;
}

const raw = bundle as unknown as ThemeBundle;
const bundled = validateAll(raw.themes);

export const BUNDLED_THEMES: Theme[] = bundled.themes;
export const DEFAULT_THEME_ID: string = raw.default;

export function defaultTheme(): Theme {
  const t = BUNDLED_THEMES.find((x) => x.id === DEFAULT_THEME_ID) ?? BUNDLED_THEMES[0];
  if (!t) throw new Error('No valid bundled theme.');
  return t;
}

export class BundledThemeSource implements ThemeSource {
  readonly name = 'bundled';
  async load(): Promise<Theme[]> {
    return BUNDLED_THEMES;
  }
}

/** Planned: GET /v1/app/config returns the tenant theme. Used only when the flag is on. */
export class ApiThemeSource implements ThemeSource {
  readonly name = 'api';
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  async load(): Promise<Theme[]> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/v1/app/config`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { theme?: unknown };
    if (!body.theme) return [];
    return validateAll([body.theme]).themes;
  }
}

export interface ThemeStorage {
  getSelected(): string | null;
  setSelected(id: string): void;
  getOverrides(): Record<string, Theme>;
  setOverrides(map: Record<string, Theme>): void;
}

const SELECTED_KEY = 'ongem-admin.theme.selected';
const OVERRIDES_KEY = 'ongem-admin.theme.overrides';

export class LocalThemeStorage implements ThemeStorage {
  getSelected(): string | null {
    try {
      return localStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  }
  setSelected(id: string): void {
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* storage unavailable */
    }
  }
  getOverrides(): Record<string, Theme> {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}');
      if (typeof parsed !== 'object' || parsed === null) return {};
      const out: Record<string, Theme> = {};
      for (const value of Object.values(parsed)) {
        const r = validateTheme(value);
        if (r.ok) out[r.theme.id] = r.theme;
      }
      return out;
    } catch {
      return {};
    }
  }
  setOverrides(map: Record<string, Theme>): void {
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
    } catch {
      /* storage unavailable */
    }
  }
}

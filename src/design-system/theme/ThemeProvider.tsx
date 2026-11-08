import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applyBranding, brandName } from './branding';
import { validateTheme, type ValidationResult } from './schema';
import {
  BUNDLED_THEMES,
  DEFAULT_THEME_ID,
  LocalThemeStorage,
  defaultTheme,
  type ThemeSource,
  type ThemeStorage,
} from './sources';
import { applyTheme } from './tokens';
import type { Theme } from './types';

export interface ThemeContextValue {
  theme: Theme;
  baseTheme: Theme;
  themes: Array<{ id: string; name: string }>;
  hasOverride: boolean;
  setTheme(id: string): void;
  saveOverride(theme: Theme): ValidationResult;
  resetOverride(): void;
  importTheme(json: string): ValidationResult;
  exportTheme(): string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function themeFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('theme');
  } catch {
    return null;
  }
}

export interface ThemeProviderProps {
  children: ReactNode;
  storage?: ThemeStorage;
  /** Extra sources loaded after mount, such as the tenant theme from the API. */
  remoteSources?: ThemeSource[];
  initialThemeId?: string;
}

export function ThemeProvider({ children, storage, remoteSources, initialThemeId }: ThemeProviderProps) {
  const store = useMemo(() => storage ?? new LocalThemeStorage(), [storage]);
  const [baseThemes, setBaseThemes] = useState<Theme[]>(BUNDLED_THEMES);
  const [tenantDefault, setTenantDefault] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Theme>>(() => store.getOverrides());
  const [selectedId, setSelectedId] = useState<string>(
    () => initialThemeId ?? themeFromUrl() ?? store.getSelected() ?? DEFAULT_THEME_ID,
  );

  useEffect(() => {
    if (!remoteSources?.length) return;
    let alive = true;
    void (async () => {
      for (const source of remoteSources) {
        try {
          const loaded = await source.load();
          if (!alive || loaded.length === 0) continue;
          setBaseThemes((prev) => [...prev.filter((p) => !loaded.some((l) => l.id === p.id)), ...loaded]);
          const first = loaded[0];
          if (first) setTenantDefault((cur) => cur ?? first.id);
        } catch {
          /* fall back to bundled themes */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [remoteSources]);

  const allThemes = useMemo(() => {
    const extra = Object.values(overrides).filter((o) => !baseThemes.some((b) => b.id === o.id));
    return [...baseThemes, ...extra];
  }, [baseThemes, overrides]);

  const resolvedId = allThemes.some((t) => t.id === selectedId)
    ? selectedId
    : (tenantDefault ?? DEFAULT_THEME_ID);
  const baseTheme = baseThemes.find((t) => t.id === resolvedId) ?? overrides[resolvedId] ?? defaultTheme();
  const theme = overrides[resolvedId] ?? baseTheme;

  // Before the first paint: the layout reads the theme's spacing variables, so applying them after paint moved the
  // whole shell once on every load (layout shift).
  useLayoutEffect(() => {
    applyTheme(theme);
    applyBranding(theme);
  }, [theme]);

  const setTheme = useCallback(
    (id: string) => {
      setSelectedId(id);
      store.setSelected(id);
    },
    [store],
  );

  const persist = useCallback(
    (next: Record<string, Theme>) => {
      setOverrides(next);
      store.setOverrides(next);
    },
    [store],
  );

  const saveOverride = useCallback(
    (candidate: Theme): ValidationResult => {
      const r = validateTheme(candidate);
      if (r.ok) persist({ ...overrides, [r.theme.id]: r.theme });
      return r;
    },
    [overrides, persist],
  );

  const resetOverride = useCallback(() => {
    const next = { ...overrides };
    delete next[resolvedId];
    persist(next);
    if (!baseThemes.some((t) => t.id === resolvedId)) setTheme(DEFAULT_THEME_ID);
  }, [overrides, resolvedId, persist, baseThemes, setTheme]);

  const importTheme = useCallback(
    (json: string): ValidationResult => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { ok: false, errors: ['The file is not valid JSON.'] }; // content-check: ignore (console theme import only)
      }
      const r = validateTheme(parsed);
      if (r.ok) {
        persist({ ...overrides, [r.theme.id]: r.theme });
        setTheme(r.theme.id);
      }
      return r;
    },
    [overrides, persist, setTheme],
  );

  const exportTheme = useCallback(() => JSON.stringify(theme, null, 2), [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      baseTheme,
      themes: allThemes.map((t) => ({ id: t.id, name: t.name })),
      hasOverride: Boolean(overrides[resolvedId]),
      setTheme,
      saveOverride,
      resetOverride,
      importTheme,
      exportTheme,
    }),
    [
      theme,
      baseTheme,
      allThemes,
      overrides,
      resolvedId,
      setTheme,
      saveOverride,
      resetOverride,
      importTheme,
      exportTheme,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** The active brand name for copy, so screens never hard-code one. */
export function useBrand(): string {
  return brandName(useTheme().theme);
}

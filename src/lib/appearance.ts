import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, useTheme } from '../design-system';

/** FA-030: a founder picks Light, Dark or System; white-label themes are not offered. */
export type Appearance = 'light' | 'dark' | 'system';

const KEY = 'ongem.appearance';
const EVENT = 'ongem-appearance';
const DARK_QUERY = '(prefers-color-scheme: dark)'; // content-check: ignore (media query)
/** The default brand's themes; a white-label brand names its own (ThemeProvider `lightId`, `darkId`). */
export const LIGHT_THEME = DEFAULT_LIGHT_THEME;
export const DARK_THEME = DEFAULT_DARK_THEME;

function stored(): Appearance | null {
  try {
    return localStorage.getItem(KEY) === 'system' ? 'system' : null;
  } catch {
    return null;
  }
}

function store(a: Appearance) {
  try {
    if (a === 'system') localStorage.setItem(KEY, 'system');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the choice lasts for this page */
  }
  window.dispatchEvent(new Event(EVENT));
}

const systemDark = () => typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;

/**
 * The founder's appearance and a setter. Light and Dark are the brand's themes (the theme provider keeps them); System
 * follows the device and changes with it. Call it once in the shell so System applies on every screen.
 */
export function useAppearance(): [Appearance, (a: Appearance) => void] {
  const { theme, setTheme, lightId, darkId } = useTheme();
  const dark = darkId ?? lightId;
  const [system, setSystem] = useState(() => stored() === 'system');
  useEffect(() => {
    const on = () => setSystem(stored() === 'system');
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!system) return;
    const apply = () => setTheme(systemDark() ? dark : lightId);
    apply();
    const m = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
    m?.addEventListener?.('change', apply);
    return () => m?.removeEventListener?.('change', apply);
  }, [system, setTheme, dark, lightId]);
  const set = useCallback(
    (a: Appearance) => {
      store(a);
      setSystem(a === 'system');
      if (a !== 'system') setTheme(a === 'dark' ? dark : lightId);
    },
    [setTheme, dark, lightId],
  );
  return [system ? 'system' : theme.mode === 'dark' ? 'dark' : 'light', set];
}

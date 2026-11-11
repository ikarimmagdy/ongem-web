import { useEffect, useState } from 'react';

/** The width from which the side bar shows instead of the phone tab bar (the shell's CSS breakpoint, 901 px). */
export const WIDE_QUERY = '(min-width: 901px)'; // content-check: ignore (media query)

/** True on a wide screen; without matchMedia (tests, old browsers) the desktop layout is assumed. */
export function useWide(): boolean {
  const query = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null);
  const [wide, setWide] = useState(() => query()?.matches ?? true);
  useEffect(() => {
    const m = query();
    if (!m) return;
    const on = () => setWide(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return wide;
}

/**
 * OG-042 idle logout (Volume 7, Table 7.12 "Idle logout"): a signed-in session ends after a period with no pointer, key
 * or focus activity, with a warning before it. The last activity time is shared through localStorage, so activity in
 * any tab of this browser keeps every tab signed in, and every tab ends at the same moment. The clock is checked every
 * second against the wall clock, so a laptop that slept past the limit signs out on wake.
 */

export type IdlePhase = 'active' | 'warning' | 'expired';

export interface IdleState {
  phase: IdlePhase;
  /** Milliseconds until sign-out, never below zero. */
  remainingMs: number;
}

export interface IdleOptions {
  timeoutMs: number;
  /** How long before the timeout the warning shows. */
  warnMs: number;
  /** localStorage key holding the last activity time (epoch ms), shared by every tab. */
  storageKey: string;
  onChange(state: IdleState): void;
  /** The window to listen on (tests pass jsdom's). */
  target?: Window;
}

export interface IdleWatch {
  /** Records activity now, as a pointer, key or focus event does. */
  touch(): void;
  stop(): void;
}

export const IDLE_TICK_MS = 1000;
/** Pointer moves come in bursts; record at most one per this many milliseconds. */
export const IDLE_WRITE_EVERY_MS = 1000;
/** `focus` counts only when the window itself gains focus (the person comes back to the tab), never when the page moves focus. */
export const IDLE_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'focus'] as const;

export function idleState(lastActivity: number, now: number, timeoutMs: number, warnMs: number): IdleState {
  const remainingMs = Math.max(0, lastActivity + timeoutMs - now);
  const phase: IdlePhase = remainingMs === 0 ? 'expired' : remainingMs <= warnMs ? 'warning' : 'active';
  return { phase, remainingMs };
}

function readShared(key: string): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeShared(key: string, at: number) {
  try {
    localStorage.setItem(key, String(at));
  } catch {
    // Storage blocked: this tab keeps its own clock.
  }
}

export function startIdleWatch({
  timeoutMs,
  warnMs,
  storageKey,
  onChange,
  target = window,
}: IdleOptions): IdleWatch {
  let local = Date.now();
  let last: IdlePhase | null = null;
  let expired = false;
  writeShared(storageKey, local);

  const check = () => {
    if (expired) return;
    const state = idleState(Math.max(local, readShared(storageKey)), Date.now(), timeoutMs, warnMs);
    if (state.phase === 'expired') expired = true;
    if (state.phase !== 'active' || last !== 'active') onChange(state);
    last = state.phase;
  };

  const touch = () => {
    if (expired) return;
    const now = Date.now();
    if (now - local < IDLE_WRITE_EVERY_MS && last === 'active') return;
    local = now;
    writeShared(storageKey, now);
    check();
  };

  const onEvent = (e: Event) => {
    if (e.type === 'focus' && e.target !== e.currentTarget) return;
    touch();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey) check();
  };

  for (const name of IDLE_EVENTS) target.addEventListener(name, onEvent, { passive: true, capture: true });
  target.addEventListener('storage', onStorage);
  const timer = setInterval(check, IDLE_TICK_MS);
  check();

  return {
    touch,
    stop() {
      clearInterval(timer);
      for (const name of IDLE_EVENTS) target.removeEventListener(name, onEvent, { capture: true });
      target.removeEventListener('storage', onStorage);
    },
  };
}

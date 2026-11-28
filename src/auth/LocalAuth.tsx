// content-check: data (a local developer tool, English only, never in a product build)
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Notice } from '../design-system';
import { AuthProvider, type AuthSession } from './session';

/**
 * OG-100: sign-in through the workspace's local identity issuer (bin/local-identity.mjs), for the unified local platform
 * only. main.tsx imports this module only when the build sets VITE_LOCAL_IDENTITY=true, so a normal build carries none of
 * it (src/test/liveBuild.test.ts); it also refuses to run on any host but this machine.
 */
export const LOCAL_IDENTITY_BASE = '/local-identity';
const APP = 'web';

export interface LocalPersona {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(LOCAL_IDENTITY_BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`local identity ${path}: ${r.status}`);
  return (await r.json()) as T;
}

function LocalSignIn({ onChoose }: { onChoose(id: string): Promise<void> }) {
  const [personas, setPersonas] = useState<LocalPersona[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    call<{ personas: LocalPersona[] }>(`/personas?app=${APP}`)
      .then((r) => setPersonas(r.personas))
      .catch(() => setFailed(true));
  }, []);
  if (failed) return <Notice status="failure">The local identity issuer does not answer.</Notice>;
  return (
    <div data-testid="local-sign-in" className="og-stack">
      <p>Local sign-in: choose who you are.</p>
      {(personas ?? []).map((p) => (
        <Button
          key={p.id}
          variant="secondary"
          data-testid={`persona-${p.id}`}
          onClick={() => void onChoose(p.id)}
        >
          {p.name}, {p.role}
        </Button>
      ))}
    </div>
  );
}

export function LocalAuth({ children }: { children: ReactNode }) {
  const allowed = typeof window !== 'undefined' && isLoopbackHost(window.location.hostname);
  const [persona, setPersona] = useState<LocalPersona | null>(null);
  const [loaded, setLoaded] = useState(!allowed);
  const cache = useRef<{ token: string; exp: number } | null>(null);
  const current = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await call<{ persona: LocalPersona | null }>(`/session?app=${APP}`).catch(() => ({
      persona: null,
    }));
    const next = r.persona?.id ?? null;
    // The launcher switched who this app is signed in as: start again as that person.
    if (current.current !== null && next !== current.current) window.location.reload();
    current.current = next;
    cache.current = null;
    setPersona(r.persona);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [allowed, refresh]);

  const getToken = useCallback(async (opts?: { fresh?: boolean }) => {
    if (!current.current) return null;
    const now = Date.now() / 1000;
    if (!opts?.fresh && cache.current && cache.current.exp - 60 > now) return cache.current.token;
    const r = await call<{ token: string; expiresAt: number }>('/token', {
      method: 'POST',
      body: JSON.stringify({ app: APP }),
    }).catch(() => null);
    cache.current = r ? { token: r.token, exp: r.expiresAt } : null;
    return r?.token ?? null;
  }, []);

  const choose = useCallback(
    async (id: string | null) => {
      await call('/session', { method: 'POST', body: JSON.stringify({ app: APP, persona: id }) });
      current.current = id;
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthSession>(
    () => ({
      available: allowed,
      loaded,
      signedIn: !!persona,
      // Every token carries a second factor verified just now, so step-up is a fresh token.
      reverify: async () => {
        cache.current = null;
        return true;
      },
      user: persona ? { id: persona.id, name: persona.name, email: persona.email, twoStep: true } : undefined,
      getToken,
      signOut: () => choose(null),
      SignIn: () => <LocalSignIn onChoose={(id) => choose(id)} />,
      SignUp: () => <LocalSignIn onChoose={(id) => choose(id)} />,
    }),
    [allowed, loaded, persona, getToken, choose],
  );

  if (!allowed) {
    return (
      <main id="main">
        <Notice status="failure">This local build signs in only on this machine (localhost).</Notice>
      </main>
    );
  }
  return <AuthProvider value={value}>{children}</AuthProvider>;
}

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { OnGemApi } from '../api/client';
import type { RecordedEvent } from '../api/types';
import { useSession } from '../session';
import { maskAll, maskHref, maskNodeText, maskProps, maskText } from './mask';

/**
 * rrweb's options (OG-031 R6): every input is masked, every text node goes through [maskNodeText] (all of it inside
 * `[data-mask]`, digit runs and amounts anywhere else), and Clerk's own dialogs are not recorded at all.
 */
export const RRWEB_OPTIONS = {
  maskAllInputs: true,
  maskTextSelector: '*',
  maskTextFn: maskNodeText,
  maskInputFn: maskAll,
  blockSelector: '[data-block], .cl-rootBox, .cl-modalBackdrop, .cl-userProfile-root',
  recordCanvas: false,
  collectFonts: false,
  sampling: { mousemove: false, scroll: 500, input: 'last' as const },
};

/**
 * The one switch for screen and action recording in the founder web app (`privacy.ts`): off, the signed-in shell never
 * mounts [Recorder], so no session starts and nothing is sent to /v1/recording, and the privacy line says so.
 */
export { RECORDING_ENABLED } from './privacy';

const RRWEB_META = 4;

/** rrweb's Meta event carries the page URL; the query of a prefilled form holds amounts and messages, so it goes. */
function maskMeta(event: unknown): unknown {
  const e = event as { type?: number; data?: { href?: unknown } } | null;
  if (e?.type !== RRWEB_META || typeof e.data?.href !== 'string') return event;
  return { ...e, data: { ...e.data, href: maskHref(e.data.href) } };
}

/** Buffers masked events and sends them in batches of up to 200 (OG-031 R5). */
export class EventQueue {
  private seq = 0;
  private buffer: RecordedEvent[] = [];

  constructor(
    private readonly api: Pick<OnGemApi, 'recordEvents'>,
    private readonly session: () => string | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  screen(name: string) {
    this.push({ type: 'SCREEN', name: maskText(name) });
  }

  action(name: string, props: Record<string, unknown> = {}) {
    this.push({ type: 'ACTION', name: maskText(name).slice(0, 120), props: maskProps(props) });
  }

  rrweb(event: unknown) {
    this.push({ type: 'RRWEB', name: 'rrweb', payload: maskMeta(event) });
  }

  private push(e: Omit<RecordedEvent, 'seq' | 'at'>) {
    this.buffer.push({ ...e, seq: this.seq++, at: this.now().toISOString() });
    if (this.buffer.length >= 50) void this.flush();
  }

  get pending(): readonly RecordedEvent[] {
    return this.buffer;
  }

  async flush() {
    const id = this.session();
    if (!id || !this.buffer.length) return;
    const batch = this.buffer.splice(0, 200);
    try {
      await this.api.recordEvents(id, batch);
    } catch {
      this.buffer.unshift(...batch);
    }
  }
}

/** The name an action is recorded under: the control's test id, label or text, masked. */
export function controlName(el: Element): string | null {
  const c = el.closest('button, a, [role="button"], input[type="submit"]');
  if (!c) return null;
  return (
    c.getAttribute('data-testid') ||
    c.getAttribute('aria-label') ||
    (c.textContent ?? '').trim().slice(0, 60) ||
    c.tagName.toLowerCase()
  );
}

/** Mounted in the signed-in shell: starts a session, records screens, actions and masked rrweb snapshots. */
export function Recorder({ onSession }: { onSession?(id: string): void }) {
  const { api } = useSession();
  const location = useLocation();
  const [session, setSession] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const queue = useRef<EventQueue | null>(null);
  if (!queue.current) queue.current = new EventQueue(api, () => sessionRef.current);

  useEffect(() => {
    let alive = true;
    api.startRecording('WEB', 'web').then(
      (s) => {
        if (!alive) return;
        sessionRef.current = s.id;
        setSession(s.id);
        onSession?.(s.id);
      },
      () => undefined,
    );
    const onClick = (e: MouseEvent) => {
      const name = e.target instanceof Element ? controlName(e.target) : null;
      if (name) queue.current?.action(name, { screen: window.location.pathname });
    };
    document.addEventListener('click', onClick, true);
    const timer = setInterval(() => void queue.current?.flush(), 3000);
    let stop: (() => void) | undefined;
    if (typeof navigator !== 'undefined' && !/jsdom/.test(navigator.userAgent)) {
      void import('rrweb').then(({ record }) => {
        if (!alive) return;
        stop = record({ ...RRWEB_OPTIONS, emit: (ev) => queue.current?.rrweb(ev) }) ?? undefined;
      });
    }
    return () => {
      alive = false;
      document.removeEventListener('click', onClick, true);
      clearInterval(timer);
      stop?.();
      void queue.current?.flush();
    };
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    queue.current?.screen(location.pathname);
  }, [location.pathname]);

  return session ? <span hidden data-testid="recording-session" data-session={session} /> : null;
}

export { privacyLine } from './privacy';

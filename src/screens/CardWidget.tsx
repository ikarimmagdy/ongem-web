import { useEffect, useRef, useState } from 'react';
import type { CardWidgetKind, CardWidgetSession } from '../api/types';
import { Button, KeyValue, Notice } from '../design-system';
import { IS_AE } from '../region';

export const WIDGET_TITLES: Record<CardWidgetKind, string> = {
  REVEAL: 'Card details',
  GET_PIN: 'Card PIN',
  SET_PIN: 'Set a new PIN',
  ACTIVATE: 'Activate the card',
};

/**
 * Only the bank's own asset hosts may serve a widget script (the CSP allows no other). The AE bank has no card widget
 * yet (OG-022 R13), so the AE build allows none.
 */
const ALLOWED_SCRIPT = IS_AE
  ? /^$/
  : /^https:\/\/assets(-sandbox)?\.synctera\.com\/widgets\/[a-z-]+\/v\d+\.\d+\.\d+\/index\.js$/;
const ALLOWED_ELEMENT = /^[a-z]+-[a-z-]+$/;

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => {
        loaded.delete(src);
        reject(new Error('widget_script_failed'));
      };
      document.head.appendChild(s);
    });
    loaded.set(src, p);
  }
  return p;
}

type Phase = 'loading' | 'ready' | 'done' | 'failed' | 'expired';

/**
 * The bank's card widget (docs/synctera/cards.md s6): its script draws the number, CVV, expiry or PIN inside the bank's
 * own frame, so none of it reaches this page, OnGem or a recording (the host is `data-block`, so rrweb records neither
 * the frame nor the token attribute). The simulator has no bank script: it shows sample data, labelled as such.
 */
export function CardWidget({ session, onClose }: { session: CardWidgetSession; onClose(): void }) {
  const host = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const simulator = !session.scriptUrl || !session.element;

  useEffect(() => {
    const left = Date.parse(session.expiresAt) - Date.now();
    const t = window.setTimeout(() => setPhase('expired'), Math.max(0, left));
    return () => window.clearTimeout(t);
  }, [session.expiresAt]);

  useEffect(() => {
    if (simulator) {
      setPhase('ready');
      return;
    }
    const src = session.scriptUrl!;
    const tag = session.element!;
    if (!ALLOWED_SCRIPT.test(src) || !ALLOWED_ELEMENT.test(tag)) {
      setPhase('failed');
      return;
    }
    let el: HTMLElement | null = null;
    let cancelled = false;
    const on = (next: Phase) => () => {
      if (!cancelled) setPhase(next);
    };
    loadScript(src)
      .then(() => {
        if (cancelled || !host.current) return;
        el = document.createElement(tag);
        el.setAttribute('token', session.token);
        el.setAttribute('env', session.environment === 'production' ? 'production' : 'sandbox');
        if (session.kind === 'REVEAL') {
          el.setAttribute('last-four', session.last4);
          el.setAttribute('card-form', 'virtual');
          el.setAttribute('show-toggle', '');
          el.setAttribute('toggle-label', 'Show card details');
        }
        if (session.kind === 'GET_PIN') el.setAttribute('show-toggle', '');
        el.addEventListener('load', on('ready'));
        el.addEventListener('error', on('failed'));
        el.addEventListener('failure', on('failed'));
        el.addEventListener(
          'success',
          on(session.kind === 'SET_PIN' || session.kind === 'ACTIVATE' ? 'done' : 'ready'),
        );
        host.current.replaceChildren(el);
      })
      .catch(() => {
        if (!cancelled) setPhase('failed');
      });
    return () => {
      cancelled = true;
      el?.remove();
    };
  }, [session, simulator]);

  const title = WIDGET_TITLES[session.kind];
  if (phase === 'expired') {
    return (
      <Notice
        status="info"
        action={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <span data-testid="card-widget-expired">
          {title} closed after 5 minutes. Open it again to see it.
        </span>
      </Notice>
    );
  }
  return (
    <section className="fw-widget" aria-label={title} data-testid="card-widget">
      <h3 className="fw-widget__title">{title}</h3>
      {simulator ? (
        <SampleWidget session={session} />
      ) : (
        <>
          {phase === 'loading' && <p role="status">Opening the bank's secure view.</p>}
          <div ref={host} className="fw-widget__frame" data-block="" data-testid="card-widget-host" />
        </>
      )}
      {phase === 'failed' && (
        <Notice status="failure">
          <span data-testid="card-widget-failed">
            The bank's secure view did not open. Try again in a moment.
          </span>
        </Notice>
      )}
      {phase === 'done' && (
        <Notice status="success">
          <span data-testid="card-widget-done">
            {session.kind === 'SET_PIN' ? 'Your new PIN is set.' : 'Your card is active.'}
          </span>
        </Notice>
      )}
      <p className="fw-widget__note">Shown by the bank. OnGem never sees or stores these numbers.</p>
      <div className="fw-actions">
        <Button variant="secondary" data-testid="card-widget-close" onClick={onClose}>
          Hide
        </Button>
      </div>
    </section>
  );
}

/** Sample data from the simulator: never a real card, and masked in recordings like any card value. */
function SampleWidget({ session }: { session: CardWidgetSession }) {
  const items =
    session.kind === 'REVEAL'
      ? [
          { label: 'Card number', value: `4000 0000 0000 ${session.last4}` },
          { label: 'Expires', value: '12/29' },
          { label: 'Security code', value: '123' },
        ]
      : session.kind === 'GET_PIN'
        ? [{ label: 'PIN', value: '1234' }]
        : session.kind === 'SET_PIN'
          ? [{ label: 'New PIN', value: 'Entered in the bank’s view' }]
          : [{ label: 'Card', value: `Ending ${session.last4}` }];
  return (
    <div data-mask="" data-testid="card-widget-sample">
      <Notice status="info">Sample data from the simulator, not a real card.</Notice>
      <KeyValue items={items} />
    </div>
  );
}

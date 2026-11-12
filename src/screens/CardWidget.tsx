import { useEffect, useRef, useState } from 'react';
import type { CardWidgetKind, CardWidgetSession } from '../api/types';
import { Button, KeyValue, Notice } from '../design-system';
import { t } from '../i18n';
import { IS_AE } from '../region';

/** The content key of each widget's title. */
export const WIDGET_TITLES: Record<CardWidgetKind, string> = {
  REVEAL: 'app.cards.widget_title_reveal',
  GET_PIN: 'app.cards.widget_title_get_pin',
  SET_PIN: 'app.cards.widget_title_set_pin',
  ACTIVATE: 'app.cards.widget_title_activate',
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
  const [copied, setCopied] = useState(0);
  const simulator = !session.scriptUrl || !session.element;

  useEffect(() => {
    const left = Date.parse(session.expiresAt) - Date.now();
    const timer = window.setTimeout(() => setPhase('expired'), Math.max(0, left));
    return () => window.clearTimeout(timer);
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
          el.setAttribute('toggle-label', t('app.cards.widget_reveal'));
        }
        if (session.kind === 'GET_PIN') el.setAttribute('show-toggle', '');
        el.addEventListener('load', on('ready'));
        // FA-003: the bank's widget has its own copy buttons (the copy stays in its frame); say that it was copied.
        el.addEventListener('copy', () => {
          if (!cancelled) setCopied((x) => x + 1);
        });
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

  const title = t(WIDGET_TITLES[session.kind]);
  if (phase === 'expired') {
    return (
      <Notice
        status="info"
        action={
          <Button variant="secondary" onClick={onClose}>
            {t('app.cards.widget_close')}
          </Button>
        }
      >
        <span data-testid="card-widget-expired">{t('app.cards.widget_expired', { title })}</span>
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
          {phase === 'loading' && <p role="status">{t('app.cards.widget_opening')}</p>}
          <div ref={host} className="fw-widget__frame" data-block="" data-testid="card-widget-host" />
        </>
      )}
      <span role="status" className="og-visually-hidden" data-testid="card-widget-copied">
        {copied ? t('app.cards.widget_copied') : ''}
      </span>
      {phase === 'failed' && (
        <Notice status="failure">
          <span data-testid="card-widget-failed">{t('app.cards.widget_failed')}</span>
        </Notice>
      )}
      {phase === 'done' && (
        <Notice status="success">
          <span data-testid="card-widget-done">
            {t(session.kind === 'SET_PIN' ? 'app.cards.widget_pin_set' : 'app.cards.widget_activated')}
          </span>
        </Notice>
      )}
      <p className="fw-widget__note">{t('app.cards.widget_note')}</p>
      <div className="fw-actions">
        <Button variant="secondary" data-testid="card-widget-close" onClick={onClose}>
          {t('app.cards.widget_hide')}
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
          { label: t('app.cards.sample_number'), value: `4000 0000 0000 ${session.last4}` },
          { label: t('app.cards.sample_expires'), value: '12/29' },
          { label: t('app.cards.sample_cvv'), value: '123' },
        ]
      : session.kind === 'GET_PIN'
        ? [{ label: t('app.cards.sample_pin'), value: '1234' }]
        : session.kind === 'SET_PIN'
          ? [{ label: t('app.cards.sample_new_pin'), value: t('app.cards.sample_new_pin_value') }]
          : [{ label: t('app.cards.card'), value: t('app.cards.sample_ending', { last4: session.last4 }) }];
  return (
    <div data-mask="" data-testid="card-widget-sample">
      <Notice status="info">{t('app.cards.sample_notice')}</Notice>
      <KeyValue items={items} />
    </div>
  );
}

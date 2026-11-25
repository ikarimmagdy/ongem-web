import { IS_AE } from '../region';
import { recordingSettings } from './privacy';

/**
 * Masking at capture (OG-031 R6, OG-073): digit runs of three or more by default (account, routing, card and identity
 * numbers, last fours and short codes; not ids like acc_9f12345, not ISO dates; the length is ongem-core's
 * `ongem.assistant.recording.mask-digit-run`) and money amounts. Applied when an event is created.
 */
const AMOUNT = /(US\$|\$|USD\s?|AED\s?|€|£)\s?\d[\d,]*(\.\d{1,2})?|\b\d[\d,]*\.\d{2}\s?(USD|EUR|GBP|AED)\b/gi;
/** A run of [min] digits or more, spaced or dashed; the parts of an ISO date are left alone. */
const digitRun = (min: number) =>
  new RegExp(
    `(?<![A-Za-z0-9_]|\\d-)(?!\\d{4}-\\d{2}-\\d{2}\\b)\\d(?:[\\s-]?\\d){${min - 1},}(?![A-Za-z0-9_])`,
    'g',
  );
const SENSITIVE = IS_AE
  ? /(account.?number|iban|tax.?id|id.?number|emirates.?id|passport|licen[cs]e|document.?number|birth|balance|amount|card.?number|cvv)/i
  : /(account.?number|routing|tax.?id|id.?number|passport|licen[cs]e|document.?number|birth|balance|amount|card.?number|ssn|cvv)/i;

export function maskText(value: string, minDigits = recordingSettings().maskDigitRun, bare = false): string {
  const amounts = value.replace(AMOUNT, '[amount]');
  return (bare ? amounts.replace(BARE_AMOUNT, '[amount]') : amounts).replace(digitRun(minDigits), '[digits]');
}

export function maskProps(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [
      k,
      SENSITIVE.test(k) ? '[masked]' : typeof v === 'string' ? maskText(v) : v,
    ]),
  );
}

/** rrweb's text mask: every character of a masked element becomes `*`, so the layout stays and the value goes. */
export const maskAll = (text: string) => text.replace(/\S/g, '*');

/**
 * rrweb's mask for every text node: inside `[data-mask]` every character goes, anywhere else digit runs and amounts go, so
 * text that nobody marked (an assistant reply, a server message) still never carries a number or a balance.
 */
export function maskNodeText(text: string, el: Element | null): string {
  return el?.closest('[data-mask]') ? maskAll(text) : maskText(text, undefined, true);
}

/** A decimal with cents and no currency (1,250.00): screen text only, stricter than the server's Masker. */
const BARE_AMOUNT = /(?<![\w.])\d[\d,]*\.\d{2}(?![\w.])/g;

/** A URL as it may be recorded: path only, because prefilled forms carry amounts and messages in the query. */
export function maskHref(href: string): string {
  try {
    const u = new URL(href);
    return maskText(u.origin + u.pathname);
  } catch {
    return maskText(href.split(/[?#]/)[0] ?? '');
  }
}

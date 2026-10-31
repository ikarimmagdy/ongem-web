/**
 * Masking at capture (OG-031 R6), the same rules as ongem-core's Masker: digit runs of five or more (account, routing,
 * card and identity numbers; not ids like acc_9f12345, not ISO dates) and money amounts. Applied when an event is created.
 */
const AMOUNT = /(US\$|\$|USD\s?|€|£)\s?\d[\d,]*(\.\d{1,2})?|\b\d[\d,]*\.\d{2}\s?(USD|EUR|GBP)\b/gi;
const DIGITS = /(?<![A-Za-z0-9_])(?!\d{4}-\d{2}-\d{2}\b)\d(?:[\s-]?\d){4,}(?![A-Za-z0-9_])/g;
const SENSITIVE =
  /(account.?number|routing|tax.?id|id.?number|passport|licen[cs]e|document.?number|birth|balance|amount|card.?number|ssn|cvv)/i;

export function maskText(value: string): string {
  return value.replace(AMOUNT, '[amount]').replace(DIGITS, '[digits]');
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
  return el?.closest('[data-mask]') ? maskAll(text) : maskText(text).replace(BARE_AMOUNT, '[amount]');
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

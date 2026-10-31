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

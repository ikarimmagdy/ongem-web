import { formatDay } from './schedule';
import { dateLocale, t } from '../i18n/store';
import { IS_AE, REGION_CONFIG } from '../region';

export interface MoneyValue {
  amount: string | number;
  currency: string;
}

/** Money keeps Latin digits and the en-US grouping in every language (OG-033 R10). US$ in the US build; every currency by its code in the AE build (AED 1,250.00). */
const currencyPrefix = (currency: string) => (!IS_AE && currency === 'USD' ? 'US$' : `${currency} `);

const number2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney({ amount, currency }: MoneyValue): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '';
  const prefix = currencyPrefix(currency);
  return `${n < 0 ? '-' : ''}${prefix}${number2.format(Math.abs(n))}`;
}

/** Bank time for this build's region: New York (ET) or Dubai (GST). */
const ET = REGION_CONFIG.timeZone;
const ET_LABEL = REGION_CONFIG.zoneLabel;

function parts(iso: string | Date, withTime: boolean, timeZone: string) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  // English 20 Oct 2026; Arabic names the month in Arabic, with Latin digits (OG-033 R10).
  const fmt = new Intl.DateTimeFormat(dateLocale(), {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return p as Record<string, string>;
}

/** 20 Oct 2026, or 20 Oct 2026 10:42 ET with time (GST in the AE build). */
/** A bank date (YYYY-MM-DD) as its calendar day; a full timestamp falls back to [formatDate]. */
export function formatBankDate(v: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDay(v) : formatDate(v);
}

export function formatDate(iso: string | Date, opts: { time?: boolean; timeZone?: string } = {}): string {
  const tz = opts.timeZone ?? ET;
  const p = parts(iso, Boolean(opts.time), tz);
  if (!p) return '';
  const date = `${p.day} ${p.month} ${p.year}`;
  if (!opts.time) return date;
  const label = tz === ET ? ET_LABEL : tz === 'UTC' ? 'UTC' : tz;
  return `${date} ${p.hour}:${p.minute} ${label}`;
}

export function formatTime(iso: string | Date, timeZone = ET): string {
  const p = parts(iso, true, timeZone);
  if (!p) return '';
  return `${p.hour}:${p.minute} ${timeZone === ET ? ET_LABEL : timeZone}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function since(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return t('app.common.since.minutes', { count: min });
  const h = Math.round(min / 60);
  if (h < 48) return t('app.common.since.hours', { count: h });
  return t('app.common.since.days', { count: Math.round(h / 24) });
}

/** An amount in minor units with its currency, as the API sends money. */
export interface MinorValue {
  amountMinor: number;
  currency: string;
}

/** The ISO 4217 minor-unit exponent: 2 for USD, 0 for JPY, 3 for BHD. */
export function currencyExponent(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Minor units to a decimal string without floating point: 125000 USD is "1250.00". */
export function minorToDecimal({ amountMinor, currency }: MinorValue): string {
  const exp = currencyExponent(currency);
  const neg = amountMinor < 0;
  const digits = String(Math.abs(Math.trunc(amountMinor))).padStart(exp + 1, '0');
  const whole = exp ? digits.slice(0, -exp) : digits;
  const frac = exp ? `.${digits.slice(-exp)}` : '';
  return `${neg ? '-' : ''}${whole}${frac}`;
}

/** A typed decimal amount to minor units, or null when it is not a valid amount for the currency. */
export function decimalToMinor(text: string, currency: string): number | null {
  const exp = currencyExponent(currency);
  const t = text.trim().replace(/,/g, '');
  const re = exp ? new RegExp(`^\\d+(\\.\\d{1,${exp}})?$`) : /^\d+$/;
  if (!re.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  const n = Number(`${whole}${frac.padEnd(exp, '0')}`);
  return Number.isSafeInteger(n) ? n : null;
}

/** US$1,250.00 (AED 1,250.00 in the AE build) from minor units, with the currency's own exponent. */
export function formatMinor(m: MinorValue): string {
  const exp = currencyExponent(m.currency);
  const dec = minorToDecimal(m);
  const neg = dec.startsWith('-');
  const [whole, frac] = dec.replace('-', '').split('.');
  const grouped = Number(whole).toLocaleString('en-US');
  const prefix = currencyPrefix(m.currency);
  return `${neg ? '-' : ''}${prefix}${grouped}${exp ? `.${frac}` : ''}`;
}

/** The viewer's own time zone, for dates the console shows in the user's time. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ET;
  } catch {
    return ET;
  }
}

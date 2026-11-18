import type { CurrencyInfo } from '../api/types';

/**
 * OG-054: the minor units of each currency as `GET /v1/currencies` gives them. Amounts are formatted and parsed with
 * these (JPY 0, KWD and BHD 3), never with a fixed 2; until the API has answered, ISO 4217 as the browser knows it.
 */
const known = new Map<string, number>();

export function setCurrencies(items: CurrencyInfo[]): void {
  known.clear();
  for (const c of items)
    if (Number.isInteger(c.minorUnits) && c.minorUnits >= 0) known.set(c.code.toUpperCase(), c.minorUnits);
}

/** The minor units from the API's table, or undefined when it has not answered or does not list the currency. */
export function apiMinorUnits(currency: string): number | undefined {
  return known.get(currency.toUpperCase());
}

/** Whether the API's table lists [currency]; true before the table is known, so nothing is refused early. */
export function currencySupported(currency: string): boolean {
  return known.size === 0 || known.has(currency.toUpperCase());
}

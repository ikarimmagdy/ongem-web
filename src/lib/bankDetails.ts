import type { BankScheme, Corridor, CreateInternationalRecipient } from '../api/types';
import { abaValid } from './aba';

/**
 * OG-054: bank details abroad checked as ongem-core's InternationalBankDetails checks them, so the founder hears about a
 * typing mistake before any call: an IBAN (ISO 13616 length for its country and mod 97, its country the beneficiary's),
 * a BIC (ISO 9362), a UK sort code and account number, a US ABA routing number with its checksum, or a named local scheme.
 */

/** ISO 13616 IBAN lengths by country (the same table as ongem-core); a country not listed takes 15 to 34 characters. */
export const IBAN_LENGTH: Record<string, number> = {
  AD: 24, AE: 23, AT: 20, BA: 20, BE: 16, BG: 22, BH: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, EG: 29,
  ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30,
  KW: 30, LB: 28, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25,
  QA: 29, RO: 24, RS: 22, SA: 24, SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26, UA: 29,
};

/** Upper case without spaces, as IBANs, BICs and codes are often typed in groups. */
export const compact = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** Two letters, two check digits, the BBAN; its length for the country, and mod 97 of the moved digits is 1. */
export function ibanValid(raw: string): boolean {
  const iban = compact(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const length = IBAN_LENGTH[iban.slice(0, 2)];
  if (length !== undefined && iban.length !== length) return false;
  const moved = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of moved) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** ISO 9362: 4 letters (bank), 2 letters (country), 2 letters or digits (location), optional 3 (branch). */
export const bicValid = (raw: string) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compact(raw));

/** A UK sort code: 6 digits, dashes allowed. */
export const sortCodeValid = (raw: string) => /^\d{6}$/.test(raw.replace(/[-\s]/g, ''));

/** The account scheme a corridor's required fields call for; an IBAN where nothing narrower is asked. */
export function schemeFor(required: readonly string[]): BankScheme {
  if (required.includes('IBAN')) return 'IBAN';
  if (required.includes('SORT_CODE')) return 'UK_SORT_CODE';
  if (required.includes('ABA_ROUTING')) return 'US_ABA';
  if (required.includes('LOCAL_BANK_CODE')) return 'LOCAL';
  return 'IBAN';
}

/** What the founder typed, as strings (nothing is kept after the form is sent). */
export interface RecipientForm {
  kind: 'BUSINESS' | 'PERSON';
  name: string;
  iban: string;
  bic: string;
  sortCode: string;
  routingNumber: string;
  accountNumber: string;
  localScheme: string;
  bankCode: string;
  line1: string;
  city: string;
  postalCode: string;
}

export type RecipientFieldName =
  | 'name'
  | 'iban'
  | 'bic'
  | 'sortCode'
  | 'routingNumber'
  | 'accountNumber'
  | 'localScheme'
  | 'bankCode'
  | 'address';

/** Each failing field and the API's code for it: `<field>_invalid`, `recipient_field_required` or `validation_failed`. */
export type RecipientErrors = Partial<Record<RecipientFieldName, string>>;

/**
 * The checks ongem-core runs on POST /v1/international-recipients with a corridor: the scheme's own checks, the IBAN's
 * country the corridor's destination, a BIC when given or required, and an address when the corridor needs one.
 */
export function recipientFormErrors(f: RecipientForm, corridor: Corridor): RecipientErrors {
  const e: RecipientErrors = {};
  const required = corridor.requiredFields;
  const scheme = schemeFor(required);
  const name = f.name.trim();
  if (!name || name.length > 140) e.name = 'validation_failed';
  const bic = compact(f.bic);
  if (bic && !bicValid(bic)) e.bic = 'bic_invalid';
  else if (!bic && required.includes('BIC')) e.bic = 'recipient_field_required';
  const account = compact(f.accountNumber);
  if (scheme === 'IBAN') {
    const iban = compact(f.iban);
    if (!iban) e.iban = 'recipient_field_required';
    else if (!ibanValid(iban) || iban.slice(0, 2) !== corridor.destinationCountry) e.iban = 'iban_invalid';
  } else if (scheme === 'UK_SORT_CODE') {
    if (!f.sortCode.trim()) e.sortCode = 'recipient_field_required';
    else if (!sortCodeValid(f.sortCode)) e.sortCode = 'sort_code_invalid';
    if (!account) e.accountNumber = 'recipient_field_required';
    else if (!/^\d{8}$/.test(account)) e.accountNumber = 'account_number_invalid';
  } else if (scheme === 'US_ABA') {
    const routing = compact(f.routingNumber);
    if (!routing) e.routingNumber = 'recipient_field_required';
    else if (!abaValid(routing)) e.routingNumber = 'routing_number_invalid';
    if (!account) e.accountNumber = 'recipient_field_required';
    else if (!/^\d{4,17}$/.test(account)) e.accountNumber = 'account_number_invalid';
  } else {
    const local = f.localScheme.trim();
    if (!local) e.localScheme = 'recipient_field_required';
    else if (local.length < 2 || local.length > 20) e.localScheme = 'validation_failed';
    const code = compact(f.bankCode);
    if (!code) e.bankCode = 'recipient_field_required';
    else if (!/^[A-Z0-9]{1,20}$/.test(code)) e.bankCode = 'validation_failed';
    if (!account) e.accountNumber = 'recipient_field_required';
    else if (!/^[A-Z0-9]{4,34}$/.test(account)) e.accountNumber = 'account_number_invalid';
  }
  const anyAddress = [f.line1, f.city, f.postalCode].some((x) => x.trim());
  const fullAddress = [f.line1, f.city, f.postalCode].every((x) => x.trim());
  if ((required.includes('ADDRESS') || anyAddress) && !fullAddress) e.address = 'recipient_field_required';
  else if ([f.line1, f.city, f.postalCode].some((x) => x.length > 100)) e.address = 'validation_failed';
  return e;
}

/** The request for a valid form: only the scheme's fields, normalised as the API keeps them. */
export function recipientRequest(f: RecipientForm, corridor: Corridor): CreateInternationalRecipient {
  const scheme = schemeFor(corridor.requiredFields);
  const bic = compact(f.bic);
  const hasAddress = [f.line1, f.city, f.postalCode].every((x) => x.trim());
  const base: CreateInternationalRecipient = {
    corridorId: corridor.id,
    kind: f.kind,
    name: f.name.trim(),
    country: corridor.destinationCountry,
    currency: corridor.destinationCurrency,
    scheme,
    ...(bic ? { bic } : {}),
    address: hasAddress
      ? {
          line1: f.line1.trim(),
          city: f.city.trim(),
          postalCode: f.postalCode.trim(),
          country: corridor.destinationCountry,
        }
      : null,
  };
  const account = compact(f.accountNumber);
  if (scheme === 'IBAN') return { ...base, iban: compact(f.iban) };
  if (scheme === 'UK_SORT_CODE')
    return { ...base, sortCode: f.sortCode.replace(/[-\s]/g, ''), accountNumber: account };
  if (scheme === 'US_ABA') return { ...base, routingNumber: compact(f.routingNumber), accountNumber: account };
  return { ...base, localScheme: f.localScheme.trim(), bankCode: compact(f.bankCode), accountNumber: account };
}

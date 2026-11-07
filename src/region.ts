/**
 * The region this build serves (OG-022 R18): `VITE_REGION` is US (the default) or AE. Every region difference is data
 * here or a region variant beside the content it replaces (`public/content.ae.ts`, `api/demoData.ae.ts`), picked with
 * `IS_AE ? ae : us`. Written as that ternary, the bundler drops the other region's words, so an AE build carries no US
 * names (a helper function would keep both).
 */
export type Region = 'US' | 'AE';

export const IS_AE: boolean = import.meta.env.VITE_REGION === 'AE';
export const REGION: Region = IS_AE ? 'AE' : 'US';

/** Public screenshots, the gallery and the walkthrough videos were recorded on the US demo, so the AE build leaves them out. */
export const US_MEDIA: boolean = !IS_AE;

export interface RailOption {
  /** The form's value and the API rail. */
  rail: 'ACH' | 'AANI' | 'UAEFTS';
  /** The option on the new payment form. */
  option: string;
  /** How it moves, on the review. */
  how: string;
  achTiming?: string;
}

export interface OwnerIdType {
  idType: string;
  label: string;
  hint: string;
  pattern: RegExp;
  /** The demo API's refusal of a number that does not match. */
  error: string;
  maxLength: number;
  numeric: boolean;
  /** Fixed issuing country; none means the founder enters it. */
  country?: string;
}

export interface RegionConfig {
  currency: string;
  /** Bank time: payment and timeline times are shown in it. */
  timeZone: string;
  zoneLabel: string;
  /** The ways to pay a recipient, the first the default. */
  rails: RailOption[];
  /** The rail of a scheduled payment. */
  scheduleRail: 'ACH' | 'UAEFTS';
  /** Words for an API rail on lists and statements. */
  railNames: Record<string, string>;
  /** The rail of a payment to a recipient, in words. */
  paymentRail(rail: string): string;
  /** The amount field's label. */
  amountLabel: string;
  /** How a scheduled payment goes, after "as". */
  scheduleAs: string;
  /** The refusal of a scheduled internal transfer. */
  scheduleInstead: string;
  recipientsSubtitle: string;
  /** The assistant's recipient draft: what the founder types in. */
  recipientDraftHint: string;
  topUpHow: string;
  topUpRail: string;
  /** Top-up limits in minor units. */
  topUpLimit: number;
  topUpDailyLimit: number;
  ownerIds: OwnerIdType[];
  /** An account number's last four, as shown. */
  accountMask(last4: string): string;
}

const US: RegionConfig = {
  currency: 'USD',
  timeZone: 'America/New_York',
  zoneLabel: 'ET',
  rails: [
    {
      rail: 'ACH',
      option: 'ACH to a recipient',
      how: 'Standard ACH, 1 to 2 business days',
      achTiming: 'STANDARD',
    },
  ],
  scheduleRail: 'ACH',
  railNames: { ACH: 'ACH', BOOK: 'Transfer', CARD: 'Card', WIRE: 'Wire' },
  paymentRail: () => 'ACH',
  amountLabel: 'Amount in US$',
  scheduleAs: 'a standard ACH',
  scheduleInstead: 'Schedule an ACH instead.',
  recipientsSubtitle: 'Saved ACH payees, screened by the bank. Account numbers show as their last four.',
  recipientDraftHint: 'You enter the routing and account numbers in the form.',
  topUpHow: 'ACH debit, 1 to 3 business days',
  topUpRail: 'ACH debit from your account at another bank',
  topUpLimit: 2_500_000,
  topUpDailyLimit: 5_000_000,
  ownerIds: [
    {
      idType: 'SSN',
      label: 'Social Security number',
      hint: '9 digits. Only the last four are shown back.',
      pattern: /^\d{9}$/,
      error: 'An SSN has 9 digits.',
      maxLength: 9,
      numeric: true,
      country: 'US',
    },
  ],
  accountMask: (last4) => `•••• ${last4}`,
};

const AE: RegionConfig = {
  currency: 'AED',
  timeZone: 'Asia/Dubai',
  zoneLabel: 'GST',
  rails: [
    { rail: 'AANI', option: 'Aani to a recipient, instant', how: 'Aani, arrives in seconds' },
    { rail: 'UAEFTS', option: 'UAEFTS to a recipient', how: 'UAEFTS, the same or next business day' },
  ],
  scheduleRail: 'UAEFTS',
  railNames: { AANI: 'Aani', UAEFTS: 'UAEFTS', BOOK: 'Transfer', CARD: 'Card' },
  paymentRail: (rail) => ({ AANI: 'Aani', UAEFTS: 'UAEFTS' })[rail] ?? 'Bank transfer',
  amountLabel: 'Amount in AED',
  scheduleAs: 'a UAEFTS payment',
  scheduleInstead: 'Schedule a UAEFTS payment instead.',
  recipientsSubtitle:
    'Saved payees, paid to their UAE IBAN and screened by the bank. IBANs show as their last four.',
  recipientDraftHint: 'You enter the IBAN in the form.',
  topUpHow: 'Pulled from your other bank, 1 to 3 business days',
  topUpRail: 'Pulled from your account at another bank',
  topUpLimit: 9_000_000,
  topUpDailyLimit: 18_000_000,
  ownerIds: [
    {
      idType: 'EMIRATES_ID',
      label: 'Emirates ID number',
      hint: '15 digits starting 784. Only the last four are shown back.',
      pattern: /^784\d{12}$/,
      error: 'An Emirates ID has 15 digits and starts 784.',
      maxLength: 15,
      numeric: true,
      country: 'AE',
    },
    {
      idType: 'PASSPORT',
      label: 'Passport number',
      hint: '6 to 9 letters and digits. Only the last four are shown back.',
      pattern: /^[A-Z0-9]{6,9}$/,
      error: 'A passport number has 6 to 9 letters and digits.',
      maxLength: 9,
      numeric: false,
    },
  ],
  accountMask: (last4) => `AE•• •••• ${last4}`,
};

export const REGION_CONFIG: RegionConfig = IS_AE ? AE : US;

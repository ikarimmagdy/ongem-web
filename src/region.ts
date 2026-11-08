/**
 * The region this build serves (OG-022 R18): `VITE_REGION` is US (the default) or AE. Every region difference is data
 * here or a region variant beside the content it replaces (`public/content.ae.ts`, `api/demoData.ae.ts`), picked with
 * `IS_AE ? ae : us`. Written as that ternary, the bundler drops the other region's words, so an AE build carries no US
 * names (a helper function would keep both).
 */
import { t } from './i18n/store';

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

// The words are content entries (OG-033 R1): one key per text, the US text in the US seed and the AE text in the AE
// seed. They are getters, so a text is read when it is shown, in the reader's language.
const US: RegionConfig = {
  currency: 'USD',
  timeZone: 'America/New_York',
  zoneLabel: 'ET',
  rails: [
    {
      rail: 'ACH',
      get option() {
        return t('app.region.rail.ach.option');
      },
      get how() {
        return t('app.region.rail.ach.how');
      },
      achTiming: 'STANDARD',
    },
  ],
  scheduleRail: 'ACH',
  get railNames() {
    return {
      ACH: 'ACH',
      BOOK: t('app.region.rail_name.book'),
      CARD: t('app.region.rail_name.card'),
      WIRE: t('app.region.rail_name.wire'),
    };
  },
  paymentRail: () => 'ACH',
  get amountLabel() {
    return t('app.region.amount_label');
  },
  get scheduleAs() {
    return t('app.region.schedule_as');
  },
  get scheduleInstead() {
    return t('app.region.schedule_instead');
  },
  get recipientsSubtitle() {
    return t('app.region.recipients_subtitle');
  },
  get recipientDraftHint() {
    return t('app.region.recipient_draft_hint');
  },
  get topUpHow() {
    return t('app.region.top_up_how');
  },
  get topUpRail() {
    return t('app.region.top_up_rail');
  },
  topUpLimit: 2_500_000,
  topUpDailyLimit: 5_000_000,
  ownerIds: [
    {
      idType: 'SSN',
      get label() {
        return t('app.region.owner_id.ssn.label');
      },
      get hint() {
        return t('app.region.owner_id.ssn.hint');
      },
      pattern: /^\d{9}$/,
      get error() {
        return t('app.region.owner_id.ssn.error');
      },
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
    {
      rail: 'AANI',
      get option() {
        return t('app.region.rail.aani.option');
      },
      get how() {
        return t('app.region.rail.aani.how');
      },
    },
    {
      rail: 'UAEFTS',
      get option() {
        return t('app.region.rail.uaefts.option');
      },
      get how() {
        return t('app.region.rail.uaefts.how');
      },
    },
  ],
  scheduleRail: 'UAEFTS',
  get railNames() {
    return {
      AANI: t('app.region.rail_name.aani'),
      UAEFTS: 'UAEFTS',
      BOOK: t('app.region.rail_name.book'),
      CARD: t('app.region.rail_name.card'),
    };
  },
  paymentRail: (rail) =>
    ({ AANI: t('app.region.rail_name.aani'), UAEFTS: 'UAEFTS' })[rail] ??
    t('app.region.rail_name.bank_transfer'),
  get amountLabel() {
    return t('app.region.amount_label');
  },
  get scheduleAs() {
    return t('app.region.schedule_as');
  },
  get scheduleInstead() {
    return t('app.region.schedule_instead');
  },
  get recipientsSubtitle() {
    return t('app.region.recipients_subtitle');
  },
  get recipientDraftHint() {
    return t('app.region.recipient_draft_hint');
  },
  get topUpHow() {
    return t('app.region.top_up_how');
  },
  get topUpRail() {
    return t('app.region.top_up_rail');
  },
  topUpLimit: 9_000_000,
  topUpDailyLimit: 18_000_000,
  ownerIds: [
    {
      idType: 'EMIRATES_ID',
      get label() {
        return t('app.region.owner_id.emirates_id.label');
      },
      get hint() {
        return t('app.region.owner_id.emirates_id.hint');
      },
      pattern: /^784\d{12}$/,
      get error() {
        return t('app.region.owner_id.emirates_id.error');
      },
      maxLength: 15,
      numeric: true,
      country: 'AE',
    },
    {
      idType: 'PASSPORT',
      get label() {
        return t('app.region.owner_id.passport.label');
      },
      get hint() {
        return t('app.region.owner_id.passport.hint');
      },
      pattern: /^[A-Z0-9]{6,9}$/,
      get error() {
        return t('app.region.owner_id.passport.error');
      },
      maxLength: 9,
      numeric: false,
    },
  ],
  accountMask: (last4) => `AE•• •••• ${last4}`,
};

export const REGION_CONFIG: RegionConfig = IS_AE ? AE : US;

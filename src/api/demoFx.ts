// content-check: data (sample corridors, banks, names and amounts; sentences shown as UI copy are content keys)
import type {
  Account,
  Amount,
  Corridor,
  CreateInternationalRecipient,
  CreateMovement,
  CreateQuote,
  CurrencyAccountOptions,
  CurrencyInfo,
  FxQuote,
  InternationalRecipient,
  Movement,
  MovementFx,
  MovementLeg,
  MovementReceipt,
  ReceivingDetails,
  Transaction,
} from './types';
import { ApiError } from './errors';
import { bicValid, compact, ibanValid, sortCodeValid } from '../lib/bankDetails';
import { abaValid } from '../lib/aba';
import { currencyExponent, formatMinor } from '../lib/format';
import { IS_AE } from '../region';

/**
 * OG-054 demo mode: the currencies table, corridors, currency accounts at a sample bank, international recipients,
 * quotes and movements, following ongem-core's shapes and rules (multi-currency-api.md). Nothing leaves the browser.
 */

export const DEMO_CURRENCIES: CurrencyInfo[] = [
  { code: 'AED', minorUnits: 2, name: 'UAE Dirham' },
  { code: 'BHD', minorUnits: 3, name: 'Bahraini Dinar' },
  { code: 'EUR', minorUnits: 2, name: 'Euro' },
  { code: 'GBP', minorUnits: 2, name: 'Pound Sterling' },
  { code: 'INR', minorUnits: 2, name: 'Indian Rupee' },
  { code: 'JPY', minorUnits: 0, name: 'Yen' },
  { code: 'KWD', minorUnits: 3, name: 'Kuwaiti Dinar' },
  { code: 'USD', minorUnits: 2, name: 'US Dollar' },
];

/** The sample bank that holds the demo's currency accounts (the API names it; never FDIC wording). */
export const DEMO_GLOBAL_BANK = 'Harbour Global Bank (sample)';

const amt = (amountMinor: number, currency: string): Amount => ({
  amountMinor,
  currency,
  display: formatMinor({ amountMinor, currency }),
});

const HOME = IS_AE ? 'AED' : 'USD';
const ID = IS_AE ? 'ae' : 'us';

export const demoCorridors = (): Corridor[] => [
  {
    id: `cor_${ID}_de_eur_sepa`,
    sourceCurrency: HOME,
    destinationCurrency: 'EUR',
    destinationCountry: 'DE',
    rail: 'SEPA',
    cutoff: { time: '14:00', zone: 'Europe/Berlin' },
    settlement: { minHours: 4, maxHours: 24 },
    minAmount: amt(100, 'EUR'),
    maxAmount: amt(5_000_000, 'EUR'),
    requiredFields: ['IBAN', 'BIC'],
  },
  {
    id: `cor_${ID}_gb_gbp_fps`,
    sourceCurrency: HOME,
    destinationCurrency: 'GBP',
    destinationCountry: 'GB',
    rail: 'FPS',
    cutoff: { time: '16:00', zone: 'Europe/London' },
    settlement: { minHours: 1, maxHours: 4 },
    minAmount: amt(100, 'GBP'),
    maxAmount: amt(2_500_000, 'GBP'),
    requiredFields: ['SORT_CODE', 'ACCOUNT_NUMBER'],
  },
  {
    id: `cor_${ID}_jp_jpy_swift`,
    sourceCurrency: HOME,
    destinationCurrency: 'JPY',
    destinationCountry: 'JP',
    rail: 'SWIFT',
    cutoff: { time: '15:00', zone: 'Asia/Tokyo' },
    settlement: { minHours: 24, maxHours: 72 },
    minAmount: amt(1_000, 'JPY'),
    maxAmount: amt(7_500_000, 'JPY'),
    requiredFields: ['LOCAL_BANK_CODE', 'ACCOUNT_NUMBER', 'BIC', 'ADDRESS'],
  },
  {
    id: `cor_${ID}_kw_kwd_swift`,
    sourceCurrency: HOME,
    destinationCurrency: 'KWD',
    destinationCountry: 'KW',
    rail: 'SWIFT',
    cutoff: { time: '12:00', zone: 'Asia/Kuwait' },
    settlement: { minHours: 24, maxHours: 48 },
    minAmount: amt(10_000, 'KWD'),
    maxAmount: amt(15_000_000, 'KWD'),
    requiredFields: ['IBAN', 'BIC', 'ADDRESS'],
  },
];

/** Sample prices (sell to buy); a pair not listed is priced through its reverse, else refused. */
const RATES: Record<string, Record<string, string>> = {
  USD: { EUR: '0.92', GBP: '0.79', JPY: '151.2', KWD: '0.3075', BHD: '0.376', AED: '3.6725', INR: '83.12' },
  AED: { EUR: '0.2505', GBP: '0.2151', JPY: '41.17', KWD: '0.0837', USD: '0.2723', INR: '22.63' },
  EUR: { USD: '1.087', GBP: '0.8587', AED: '3.99' },
  GBP: { USD: '1.266', EUR: '1.1645', AED: '4.65' },
};

function rateOf(sell: string, buy: string): { text: string; n: number } | null {
  const direct = RATES[sell]?.[buy];
  if (direct) return { text: direct, n: Number(direct) };
  const back = RATES[buy]?.[sell];
  if (!back) return null;
  const n = 1 / Number(back);
  return { text: n.toPrecision(6).replace(/0+$/, ''), n };
}

export const demoRecipientsAbroad = (): InternationalRecipient[] => [
  {
    id: 'rci_demo_muster',
    kind: 'BUSINESS',
    name: 'Muster GmbH',
    country: 'DE',
    currency: 'EUR',
    scheme: 'IBAN',
    accountLast4: '3000',
    bic: 'COBADEFFXXX',
    address: { line1: 'Musterstrasse 1', city: 'Berlin', postalCode: '10115', country: 'DE' },
    screening: 'CLEAR',
    status: 'ACTIVE',
    createdAt: '2026-10-12T09:00:00Z',
  },
  {
    id: 'rci_demo_thames',
    kind: 'BUSINESS',
    name: 'Thames Studio Ltd',
    country: 'GB',
    currency: 'GBP',
    scheme: 'UK_SORT_CODE',
    accountLast4: '4410',
    sortCode: '608371',
    screening: 'CLEAR',
    status: 'ACTIVE',
    createdAt: '2026-10-20T11:30:00Z',
  },
];

const OPTIONS = ['USD', 'EUR', 'GBP'];

/** The details the sample bank gives each new currency account (valid formats; fictional). */
const RECEIVING: Record<string, Omit<ReceivingDetails, 'accountId' | 'beneficiaryName' | 'bankName'>> = {
  EUR: {
    currency: 'EUR',
    scheme: 'IBAN',
    iban: 'DE89370400440532013000',
    bic: 'HGBKDEFFXXX',
    accountNumber: null,
    sortCode: null,
    routingNumber: null,
  },
  GBP: {
    currency: 'GBP',
    scheme: 'UK_SORT_CODE',
    iban: null,
    bic: null,
    accountNumber: '41927730',
    sortCode: '608371',
    routingNumber: null,
  },
  USD: {
    currency: 'USD',
    scheme: 'US_ABA',
    iban: null,
    bic: null,
    accountNumber: '8800412266',
    sortCode: null,
    routingNumber: '021000021',
  },
};

const NAMES: Record<string, string> = { EUR: 'Euro account', GBP: 'Sterling account', USD: 'Dollar account' };

const legsOf = (m: Movement) => m.legs;

/** A quote's lines as a movement carries them. */
const fxOf = (q: FxQuote): MovementFx => ({
  quoteId: q.id,
  pair: `${q.sell.currency}-${q.buy.currency}`,
  side: q.side,
  rate: q.rate,
  sell: q.sell,
  buy: q.buy,
  providerFee: q.providerFee,
  marginBps: q.marginBps,
  margin: q.margin,
  totalDebit: q.totalDebit,
});

export interface DemoFxHost {
  accounts(): Account[];
  setAccounts(a: Account[]): void;
  companyName(): string;
  stepUp(
    purpose: string,
    detail?: { action: string; amount?: Amount; payee?: string; last4?: string },
  ): Promise<void>;
  require(permission: string): void;
  now(): string;
  next(prefix: string): string;
}

/** The sample movement that settled, so a receipt and an FX transaction show from the start. */
function seededMovements(): { movements: Movement[]; quotes: FxQuote[] } {
  const settled: FxQuote = quoteFor('fxq_demo_settled', HOME, 'EUR', 'BUY', 500_000, '2026-10-27T10:00:00Z');
  const waiting: FxQuote = quoteFor('fxq_demo_waiting', HOME, 'GBP', 'BUY', 240_000, '2026-10-29T13:20:00Z');
  const base = (
    q: FxQuote,
    id: string,
    at: string,
    state: string,
    recipientId: string,
    corridor: string,
  ) => ({
    id,
    intent: 'PAY_ABROAD',
    state,
    fromAccountId: 'acc_demo_ops',
    toAccountId: null,
    viaAccountId: null,
    recipientId,
    beneficiaryCountry: corridor.split('_')[2]!.toUpperCase(),
    quoteId: q.id,
    debit: q.totalDebit,
    deliver: q.buy,
    reference: null,
    failureCode: null,
    createdAt: at,
    updatedAt: at,
    corridorId: corridor,
    fx: fxOf(q),
  });
  return {
    quotes: [
      { ...settled, state: 'USED', acceptedAt: settled.createdAt },
      { ...waiting, state: 'USED', acceptedAt: waiting.createdAt },
    ],
    movements: [
      {
        ...base(
          settled,
          'mov_demo_abroad_settled',
          settled.createdAt,
          'SETTLED',
          'rci_demo_muster',
          `cor_${ID}_de_eur_sepa`,
        ),
        reference: 'Invoice 4411',
        legs: [
          leg('mvl_demo_s1', 1, 'REMITTANCE', 'SETTLED', settled.sell),
          leg('mvl_demo_s2', 2, 'MARGIN', 'SETTLED', settled.margin),
        ],
      },
      {
        ...base(
          waiting,
          'mov_demo_abroad_approval',
          waiting.createdAt,
          'PENDING_APPROVAL',
          'rci_demo_thames',
          `cor_${ID}_gb_gbp_fps`,
        ),
        reference: 'Studio fees, October',
        legs: [
          leg('mvl_demo_w1', 1, 'REMITTANCE', 'PLANNED', waiting.sell),
          leg('mvl_demo_w2', 2, 'MARGIN', 'PLANNED', waiting.margin),
        ],
      },
    ],
  };
}

const leg = (id: string, seq: number, capability: string, state: string, amount: Amount): MovementLeg => ({
  id,
  seq,
  capability,
  state,
  amount,
  quoteId: null,
  failureCode: null,
  inTransit: false,
});

/** A sample price: the provider's fee 0.25% and OnGem's margin 40 basis points of the amount sold, both in the sold currency. */
function quoteFor(
  id: string,
  sell: string,
  buy: string,
  side: 'BUY' | 'SELL',
  amountMinor: number,
  at: string,
  ttlMs = 60_000,
) {
  const rate = rateOf(sell, buy);
  if (!rate) throw new ApiError(422, 'fx_pair_unavailable');
  const es = 10 ** currencyExponent(sell);
  const eb = 10 ** currencyExponent(buy);
  const sellMinor = side === 'SELL' ? amountMinor : Math.ceil(((amountMinor / eb) * es) / rate.n);
  const buyMinor = side === 'BUY' ? amountMinor : Math.floor((amountMinor / es) * eb * rate.n);
  const fee = Math.round(sellMinor * 0.0025);
  const marginBps = 40;
  const margin = Math.round((sellMinor * marginBps) / 10_000);
  const q: FxQuote = {
    id,
    state: 'OPEN',
    side,
    sell: amt(sellMinor, sell),
    buy: amt(buyMinor, buy),
    rate: rate.text,
    providerFee: amt(fee, sell),
    marginBps,
    margin: amt(margin, sell),
    totalDebit: amt(sellMinor + fee + margin, sell),
    expiresAt: new Date(Date.parse(at) + ttlMs).toISOString(),
    expired: false,
    acceptedAt: null,
    createdAt: at,
  };
  return q;
}

/** Movements over this (in the home currency) wait for a second person, as the demo's approval rule. */
const APPROVAL_OVER = 1_000_000;

export class DemoFx {
  private options = OPTIONS.map((currency) => ({ currency, institutionName: DEMO_GLOBAL_BANK, open: false }));
  private recipients = demoRecipientsAbroad();
  private quotes: FxQuote[];
  private movementsState: Movement[];
  private receiving = new Map<string, ReceivingDetails>();
  /** Movements this person made: approving one of them is self approval. */
  private mine = new Set<string>();
  /** When each running movement last moved on (real time), so the screens see a leg in transit before it lands. */
  private moved = new Map<string, number>();
  /** How long a demo leg takes per step; 0 in tests moves one step per read. */
  stepMs = 2500;
  /** How long a demo quote is good for. */
  quoteTtlMs = 60_000;

  constructor(private readonly host: DemoFxHost) {
    const seeded = seededMovements();
    this.quotes = seeded.quotes;
    this.movementsState = seeded.movements;
  }

  currencies = () => DEMO_CURRENCIES;
  corridors = () => demoCorridors();

  corridor(id: string): Corridor {
    const c = demoCorridors().find((x) => x.id === id);
    if (!c) throw new ApiError(404, 'corridor_not_found');
    return c;
  }

  currencyAccountOptions(): CurrencyAccountOptions {
    return { enabled: true, items: this.options.map((o) => ({ ...o })) };
  }

  private institutionOf(a: Account) {
    return a.institution ?? a.institutionName ?? null;
  }

  async openCurrencyAccount(r: { currency: string; nickname?: string | null }): Promise<Account> {
    this.host.require('account:open');
    const currency = r.currency.toUpperCase();
    if (!DEMO_CURRENCIES.some((c) => c.code === currency)) throw new ApiError(422, 'currency_unsupported');
    const option = this.options.find((o) => o.currency === currency);
    if (!option) throw new ApiError(422, 'currency_account_unavailable');
    if (option.open) throw new ApiError(409, 'currency_account_exists');
    const nickname = (r.nickname ?? '').trim();
    if (nickname.length > 40) throw new ApiError(422, 'validation_failed');
    await this.host.stepUp('account_open', { action: 'account_open', payee: currency });
    const details = RECEIVING[currency]!;
    const id = this.host.next('acc');
    const last4 = (details.iban ?? details.accountNumber ?? '').slice(-4);
    const account: Account = {
      id,
      name: nickname || NAMES[currency] || currency,
      last4,
      status: 'ACTIVE',
      currency,
      balance: { posted: amt(0, currency), available: amt(0, currency), asOf: this.host.now() },
      institution: null,
      institutionName: option.institutionName,
      receiving: { scheme: details.scheme, last4 },
    };
    this.receiving.set(id, {
      ...details,
      accountId: id,
      beneficiaryName: this.host.companyName(),
      bankName: option.institutionName,
    });
    option.open = true;
    this.host.setAccounts([...this.host.accounts(), account]);
    return account;
  }

  receivingDetails(accountId: string): ReceivingDetails {
    const a = this.host.accounts().find((x) => x.id === accountId);
    if (!a) throw new ApiError(404, 'account_not_found');
    const d = this.receiving.get(accountId);
    if (!d) throw new ApiError(404, 'receiving_details_unavailable');
    return d;
  }

  internationalRecipients = () => this.recipients.filter((r) => r.status === 'ACTIVE');

  internationalRecipient(id: string): InternationalRecipient {
    const r = this.recipients.find((x) => x.id === id);
    if (!r) throw new ApiError(404, 'recipient_not_found');
    return r;
  }

  /** The API's checks, in its order: the corridor, then each bank detail, then the corridor's required fields. */
  async createInternationalRecipient(r: CreateInternationalRecipient): Promise<InternationalRecipient> {
    this.host.require('recipient:manage');
    const name = r.name.trim();
    if (!name || name.length > 140) throw new ApiError(422, 'validation_failed');
    if (!DEMO_CURRENCIES.some((c) => c.code === r.currency)) throw new ApiError(422, 'currency_unsupported');
    const corridor = r.corridorId ? this.corridor(r.corridorId) : null;
    if (
      corridor &&
      (corridor.destinationCountry !== r.country || corridor.destinationCurrency !== r.currency)
    )
      throw new ApiError(422, 'recipient_corridor_mismatch');
    const bic = compact(r.bic ?? '');
    if (bic && !bicValid(bic)) throw new ApiError(422, 'bic_invalid');
    const account = compact(r.accountNumber ?? '');
    const need = (v: string | undefined) => {
      if (!v || !v.trim()) throw new ApiError(422, 'recipient_field_required');
    };
    if (r.scheme === 'IBAN') {
      need(r.iban);
      const iban = compact(r.iban!);
      if (!ibanValid(iban) || iban.slice(0, 2) !== r.country) throw new ApiError(422, 'iban_invalid');
    } else if (r.scheme === 'UK_SORT_CODE') {
      need(r.sortCode);
      if (!sortCodeValid(r.sortCode!)) throw new ApiError(422, 'sort_code_invalid');
      need(r.accountNumber);
      if (!/^\d{8}$/.test(account)) throw new ApiError(422, 'account_number_invalid');
    } else if (r.scheme === 'US_ABA') {
      need(r.routingNumber);
      if (!abaValid(compact(r.routingNumber!))) throw new ApiError(422, 'routing_number_invalid');
      need(r.accountNumber);
      if (!/^\d{4,17}$/.test(account)) throw new ApiError(422, 'account_number_invalid');
    } else {
      need(r.localScheme);
      need(r.bankCode);
      need(r.accountNumber);
      if (!/^[A-Z0-9]{4,34}$/.test(account)) throw new ApiError(422, 'account_number_invalid');
    }
    if (corridor) {
      const missing = corridor.requiredFields.some((f) =>
        f === 'BIC' ? !bic : f === 'ADDRESS' ? !r.address?.line1 : false,
      );
      if (missing) throw new ApiError(422, 'recipient_field_required');
    }
    await this.host.stepUp('recipient', { action: 'recipient', payee: name });
    const created: InternationalRecipient = {
      id: this.host.next('rci'),
      kind: r.kind,
      name,
      country: r.country,
      currency: r.currency,
      scheme: r.scheme,
      accountLast4: (r.scheme === 'IBAN' ? compact(r.iban ?? '') : account).slice(-4),
      bic: bic || null,
      sortCode: r.sortCode ?? null,
      routingNumber: r.routingNumber ?? null,
      localScheme: r.localScheme ?? null,
      bankCode: r.bankCode ?? null,
      address: r.address ?? null,
      screening: 'PENDING',
      status: 'ACTIVE',
      createdAt: this.host.now(),
    };
    this.recipients = [created, ...this.recipients];
    return created;
  }

  archiveInternationalRecipient(id: string): InternationalRecipient {
    this.host.require('recipient:manage');
    const r = this.internationalRecipient(id);
    const archived = { ...r, status: 'ARCHIVED' };
    this.recipients = this.recipients.map((x) => (x.id === id ? archived : x));
    return archived;
  }

  createQuote(r: CreateQuote): FxQuote {
    for (const c of [r.sellCurrency, r.buyCurrency])
      if (!DEMO_CURRENCIES.some((x) => x.code === c)) throw new ApiError(422, 'currency_unsupported');
    if (r.corridorId && r.toAccountId) throw new ApiError(422, 'validation_failed');
    if (r.corridorId) {
      const c = this.corridor(r.corridorId);
      if (c.destinationCurrency !== r.buyCurrency || c.sourceCurrency !== r.sellCurrency)
        throw new ApiError(422, 'validation_failed');
    }
    if (r.toAccountId && !this.host.accounts().some((a) => a.id === r.toAccountId))
      throw new ApiError(404, 'account_not_found');
    if (!Number.isSafeInteger(r.amountMinor) || r.amountMinor <= 0)
      throw new ApiError(422, 'validation_failed');
    const q = quoteFor(
      this.host.next('fxq'),
      r.sellCurrency,
      r.buyCurrency,
      r.side,
      r.amountMinor,
      new Date().toISOString(),
      this.quoteTtlMs,
    );
    this.quotes.push(q);
    return q;
  }

  private quote(id: string): FxQuote {
    const q = this.quotes.find((x) => x.id === id);
    if (!q) throw new ApiError(404, 'fx_quote_not_found');
    if (q.state === 'OPEN' && Date.parse(q.expiresAt) <= Date.now()) {
      q.state = 'EXPIRED';
      q.expired = true;
    }
    return q;
  }

  async acceptQuote(id: string): Promise<FxQuote> {
    this.host.require('payment:create');
    const q = this.quote(id);
    if (q.expired) throw new ApiError(409, 'fx_quote_expired');
    await this.host.stepUp('payment', { action: 'fx_accept', amount: q.totalDebit });
    if (this.quote(id).expired) throw new ApiError(409, 'fx_quote_expired');
    q.state = 'ACCEPTED';
    q.acceptedAt = new Date().toISOString();
    return { ...q };
  }

  movements = () => [...this.movementsState].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  private find(id: string): Movement {
    const m = this.movementsState.find((x) => x.id === id);
    if (!m) throw new ApiError(404, 'movement_not_found');
    return m;
  }

  private usable(id: string | null | undefined): FxQuote {
    if (!id) throw new ApiError(422, 'validation_failed');
    const q = this.quote(id);
    if (q.expired) throw new ApiError(409, 'fx_quote_expired');
    if (q.state === 'USED') throw new ApiError(409, 'fx_quote_in_use');
    if (q.state !== 'ACCEPTED') throw new ApiError(409, 'fx_quote_not_accepted');
    return q;
  }

  createMovement(r: CreateMovement): Movement {
    this.host.require('payment:create');
    const accounts = this.host.accounts();
    const from = accounts.find((a) => a.id === r.fromAccountId);
    if (!from) throw new ApiError(404, 'movement_account_not_found');
    const q = this.usable(r.quoteId);
    if (from.currency !== q.sell.currency) throw new ApiError(422, 'fx_quote_mismatch');
    const at = this.host.now();
    const id = this.host.next('mov');
    let legs: MovementLeg[];
    let corridorId: string | null = null;
    let country: string | null = null;
    if (r.intent === 'PAY_ABROAD') {
      const c = this.corridor(r.corridorId ?? '');
      const rec = this.recipients.find((x) => x.id === r.recipientId && x.status === 'ACTIVE');
      if (!rec) throw new ApiError(404, 'recipient_not_found');
      if (
        rec.country !== c.destinationCountry ||
        rec.currency !== c.destinationCurrency ||
        from.currency !== c.sourceCurrency
      )
        throw new ApiError(422, 'recipient_corridor_mismatch');
      if (q.side !== 'BUY' || q.buy.currency !== c.destinationCurrency)
        throw new ApiError(422, 'fx_quote_mismatch');
      if (q.buy.amountMinor < c.minAmount.amountMinor || q.buy.amountMinor > c.maxAmount.amountMinor)
        throw new ApiError(422, 'corridor_amount_out_of_range');
      corridorId = c.id;
      country = c.destinationCountry;
      legs = [leg(`${id}_l1`, 1, 'REMITTANCE', 'PLANNED', q.sell)];
    } else if (r.intent === 'CONVERT') {
      const to = accounts.find((a) => a.id === r.toAccountId);
      if (!to) throw new ApiError(404, 'movement_account_not_found');
      if (to.currency !== q.buy.currency) throw new ApiError(422, 'fx_quote_mismatch');
      const via = r.viaAccountId ? accounts.find((a) => a.id === r.viaAccountId) : null;
      if (r.viaAccountId && !via) throw new ApiError(404, 'movement_account_not_found');
      const crossBank = this.institutionOf(from) !== this.institutionOf(to);
      if (crossBank) {
        if (
          !via ||
          via.currency !== q.sell.currency ||
          !via.receiving ||
          this.institutionOf(via) !== this.institutionOf(to)
        )
          throw new ApiError(409, 'first_party_unavailable');
        legs = [
          leg(`${id}_l1`, 1, 'FIRST_PARTY', 'PLANNED', q.totalDebit),
          leg(`${id}_l2`, 2, 'FX', 'PLANNED', q.sell),
        ];
      } else {
        legs = [
          ...(via ? [leg(`${id}_l0`, 1, 'INTERNAL', 'PLANNED', q.totalDebit)] : []),
          leg(`${id}_l1`, via ? 2 : 1, 'FX', 'PLANNED', q.sell),
        ];
      }
    } else {
      throw new ApiError(422, 'validation_failed');
    }
    if (q.margin.amountMinor > 0) legs.push(leg(`${id}_lm`, legs.length + 1, 'MARGIN', 'PLANNED', q.margin));
    legs = legs.map((l) => ({ ...l, quoteId: l.capability === 'FX' ? q.id : null }));
    q.state = 'USED';
    const m: Movement = {
      id,
      intent: r.intent,
      state: 'PLANNED',
      fromAccountId: from.id,
      toAccountId: r.toAccountId ?? null,
      viaAccountId: r.viaAccountId ?? null,
      recipientId: r.recipientId ?? null,
      beneficiaryCountry: country,
      quoteId: q.id,
      debit: q.totalDebit,
      deliver: q.buy,
      reference: r.reference?.trim() || null,
      failureCode: null,
      legs,
      createdAt: at,
      updatedAt: at,
      corridorId,
      fx: fxOf(q),
    };
    this.movementsState.push(m);
    this.mine.add(id);
    return structuredClone(m);
  }

  private payee(m: Movement) {
    if (m.recipientId) return this.recipients.find((r) => r.id === m.recipientId)?.name;
    return this.host.accounts().find((a) => a.id === m.toAccountId)?.name;
  }

  async submitMovement(id: string): Promise<Movement> {
    this.host.require('payment:create');
    const m = this.find(id);
    if (m.state !== 'PLANNED') throw new ApiError(409, 'movement_wrong_state');
    await this.host.stepUp('payment', { action: 'movement_submit', amount: m.debit, payee: this.payee(m) });
    const available = this.host.accounts().find((a) => a.id === m.fromAccountId)?.balance?.available;
    if (available && available.amountMinor < m.debit.amountMinor)
      throw new ApiError(409, 'insufficient_funds');
    if (m.debit.amountMinor > APPROVAL_OVER && m.debit.currency === HOME) m.state = 'PENDING_APPROVAL';
    else this.run(m);
    m.updatedAt = this.host.now();
    return structuredClone(m);
  }

  private run(m: Movement) {
    m.state = 'RUNNING';
    this.moved.set(m.id, Date.now());
    this.step(m);
  }

  /** One leg moves on: PLANNED to SUBMITTED (a first-party leg is then in transit), SUBMITTED to SETTLED. */
  private step(m: Movement) {
    const l = legsOf(m).find((x) => x.state !== 'SETTLED');
    if (!l) {
      m.state = 'SETTLED';
      this.settle(m);
      return;
    }
    if (l.state === 'PLANNED') {
      l.state = 'SUBMITTED';
      l.inTransit = l.capability === 'FIRST_PARTY';
    } else {
      l.state = 'SETTLED';
      l.inTransit = false;
      if (legsOf(m).every((x) => x.state === 'SETTLED')) {
        m.state = 'SETTLED';
        this.settle(m);
      }
    }
  }

  /** Balances move once the movement settled: the total debit leaves, the bought amount arrives in an own account. */
  private settle(m: Movement) {
    m.updatedAt = this.host.now();
    const change = (a: Account, delta: number): Account =>
      a.balance
        ? {
            ...a,
            balance: {
              ...a.balance,
              posted: amt(a.balance.posted.amountMinor + delta, a.currency),
              available: amt(a.balance.available.amountMinor + delta, a.currency),
            },
          }
        : a;
    this.host.setAccounts(
      this.host
        .accounts()
        .map((a) =>
          a.id === m.fromAccountId
            ? change(a, -m.debit.amountMinor)
            : a.id === m.toAccountId
              ? change(a, m.deliver.amountMinor)
              : a,
        ),
    );
  }

  movement(id: string): Movement {
    const m = this.find(id);
    if (m.state === 'RUNNING' && Date.now() - (this.moved.get(id) ?? 0) >= this.stepMs) {
      this.step(m);
      this.moved.set(id, Date.now());
    }
    return structuredClone(m);
  }

  async approveMovement(id: string): Promise<Movement> {
    this.host.require('payment:approve');
    const m = this.find(id);
    if (m.state !== 'PENDING_APPROVAL') throw new ApiError(409, 'movement_not_pending_approval');
    if (this.mine.has(id)) throw new ApiError(403, 'self_approval_forbidden');
    await this.host.stepUp('payment', { action: 'movement_approve', amount: m.debit, payee: this.payee(m) });
    this.run(m);
    return structuredClone(m);
  }

  rejectMovement(id: string): Movement {
    this.host.require('payment:approve');
    const m = this.find(id);
    if (m.state !== 'PENDING_APPROVAL') throw new ApiError(409, 'movement_not_pending_approval');
    m.state = 'REJECTED';
    m.legs = m.legs.map((l) => ({ ...l, state: 'VOID' }));
    return structuredClone(m);
  }

  async cancelMovement(id: string): Promise<Movement> {
    this.host.require('payment:create');
    const m = this.find(id);
    if (!['PLANNED', 'PENDING_APPROVAL', 'AWAITING_QUOTE'].includes(m.state))
      throw new ApiError(409, 'movement_wrong_state');
    await this.host.stepUp('payment', { action: 'movement_cancel', amount: m.debit, payee: this.payee(m) });
    m.state = 'CANCELLED';
    m.legs = m.legs.map((l) => (l.state === 'PLANNED' ? { ...l, state: 'VOID' } : l));
    return structuredClone(m);
  }

  async requoteMovement(id: string, quoteId: string): Promise<Movement> {
    this.host.require('payment:create');
    const m = this.find(id);
    if (m.state !== 'AWAITING_QUOTE') throw new ApiError(409, 'movement_wrong_state');
    const q = this.usable(quoteId);
    if (q.sell.currency !== m.debit.currency || q.buy.currency !== m.deliver.currency)
      throw new ApiError(422, 'fx_quote_mismatch');
    q.state = 'USED';
    m.quoteId = q.id;
    m.fx = fxOf(q);
    m.debit = q.totalDebit;
    m.deliver = q.buy;
    m.state = 'PLANNED';
    return structuredClone(m);
  }

  /** A movement left waiting for a new quote (review state `?state=awaiting_quote`): its first-party leg arrived. */
  parkForQuote(id: string) {
    const m = this.find(id);
    m.state = 'AWAITING_QUOTE';
  }

  receipt(id: string): MovementReceipt {
    const m = this.find(id);
    const accounts = this.host.accounts();
    const acc = (aid?: string | null) => {
      const a = accounts.find((x) => x.id === aid);
      return a ? { id: a.id, last4: a.last4 ?? null, currency: a.currency } : null;
    };
    const c = m.corridorId ? demoCorridors().find((x) => x.id === m.corridorId) : null;
    const r = m.recipientId ? this.recipients.find((x) => x.id === m.recipientId) : null;
    return {
      movementId: m.id,
      intent: m.intent,
      state: m.state,
      reference: m.reference ?? null,
      debit: m.debit,
      deliver: m.deliver,
      fx: m.fx ?? null,
      corridor: c ? { id: c.id, destinationCountry: c.destinationCountry, rail: c.rail } : null,
      recipient: r
        ? { id: r.id, name: r.name, accountLast4: r.accountLast4 ?? null, country: r.country }
        : null,
      fromAccount: acc(m.fromAccountId),
      toAccount: acc(m.toAccountId),
      createdAt: m.createdAt,
      settledAt: m.state === 'SETTLED' ? m.updatedAt : null,
    };
  }

  /** The transactions settled movements made on [accountId], each with its FX. */
  transactions(accountId: string): Transaction[] {
    return this.movements()
      .filter((m) => m.state === 'SETTLED')
      .flatMap((m) => {
        const fx = m.fx
          ? {
              quoteId: m.fx.quoteId,
              pair: m.fx.pair,
              rate: m.fx.rate,
              providerFee: m.fx.providerFee,
              marginBps: m.fx.marginBps,
              margin: m.fx.margin,
            }
          : null;
        const date = m.updatedAt.slice(0, 10);
        const out: Transaction[] = [];
        if (m.fromAccountId === accountId)
          out.push({
            id: `txn_${m.id}_out`,
            stage: 'POSTED',
            direction: 'DEBIT',
            amount: m.debit,
            rail: m.intent === 'PAY_ABROAD' ? 'INTERNATIONAL' : 'FX',
            origin: 'ONGEM',
            effectiveDate: date,
            counterparty: this.payee(m) ?? null,
            movementId: m.id,
            fx,
          });
        if (m.toAccountId === accountId)
          out.push({
            id: `txn_${m.id}_in`,
            stage: 'POSTED',
            direction: 'CREDIT',
            amount: m.deliver,
            rail: 'FX',
            origin: 'ONGEM',
            effectiveDate: date,
            counterparty: null,
            movementId: m.id,
            fx,
          });
        return out;
      });
  }
}

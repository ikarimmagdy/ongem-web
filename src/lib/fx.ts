import type { Account, Corridor, FxQuote, Movement, MovementLeg } from '../api/types';
import { dateLocale, has, t } from '../i18n/store';
import type { Status } from '../design-system';

/**
 * OG-054 words and rules shared by the multi-currency screens. A provider or bank adapter is never named: the only
 * institution a founder reads is the one the API names (`institution` content key, else `institutionName`).
 */

/** The institution to show for an account: the content key when set, else the API's literal name, else none. */
export function institutionLabel(a: Pick<Account, 'institution' | 'institutionName'>): string | null {
  if (a.institution && has(a.institution)) return t(a.institution);
  return a.institutionName?.trim() || null;
}

/** Which bank holds an account, for telling a move between two banks from one inside a bank. */
export const bankOf = (a: Pick<Account, 'institution' | 'institutionName'>) =>
  a.institution ?? a.institutionName ?? null;

/** A country by its ISO code in the reader's language ("Germany", "ألمانيا"); the code when the browser has no name. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([dateLocale()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const railName = (rail: string) => {
  const k = `app.fx.rail.${rail.toLowerCase()}`;
  return has(k) ? t(k) : rail;
};

/** 1 USD = 0.92 EUR: the provider's rate text as it came, never computed with. */
export const rateLine = (q: { rate: string; sell: { currency: string }; buy: { currency: string } }) =>
  t('app.fx.rate_line', { sell: q.sell.currency, buy: q.buy.currency, rate: q.rate });

/** The pair from a transaction's FX ("USD-EUR"), in words with its rate. */
export function pairRate(pair: string, rate: string) {
  const [sell = '', buy = ''] = pair.split('-');
  return rateLine({ rate, sell: { currency: sell }, buy: { currency: buy } });
}

/** Whole seconds left on a quote at [now]; 0 once it has expired. */
export function secondsLeft(q: Pick<FxQuote, 'expiresAt'>, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(q.expiresAt) - now) / 1000));
}

/** A corridor in words: "Germany, EUR by SEPA". */
export const corridorLabel = (c: Corridor) =>
  t('app.fx.corridor_option', {
    country: countryName(c.destinationCountry),
    currency: c.destinationCurrency,
    rail: railName(c.rail),
  });

/** How long a corridor takes, in hours as the catalogue gives them. */
export const settlementLine = (c: Corridor) =>
  c.settlement
    ? t('app.fx.settlement_hours', { min: c.settlement.minHours, max: c.settlement.maxHours })
    : null;

const MOVEMENT_TONE: Record<string, Status> = {
  PLANNED: 'pending',
  PENDING_APPROVAL: 'pending',
  AWAITING_QUOTE: 'pending',
  RUNNING: 'info',
  PARKED: 'info',
  SETTLED: 'success',
  FAILED: 'failure',
  NEEDS_OPS: 'pending',
  REJECTED: 'failure',
  REFUSED: 'failure',
  CANCELLED: 'neutral',
};

export const movementTone = (state: string): Status => MOVEMENT_TONE[state] ?? 'pending';

/** A movement's state in plain words; a running movement with money between banks says it is in transit. */
export function movementLabel(m: Pick<Movement, 'state' | 'legs'>): string {
  if (m.state === 'RUNNING' && m.legs.some((l) => l.inTransit)) return t('app.fx.movement.state.in_transit');
  const k = `app.fx.movement.state.${m.state.toLowerCase()}`;
  return has(k) ? t(k) : m.state;
}

/** The sentence under a movement's status. */
export function movementSentence(m: Pick<Movement, 'state' | 'legs'>): string {
  const transit = m.state === 'RUNNING' && m.legs.some((l) => l.inTransit);
  const k = `app.fx.movement.sentence.${transit ? 'in_transit' : m.state.toLowerCase()}`;
  return has(k) ? t(k) : '';
}

export const legTone = (l: MovementLeg): Status =>
  l.inTransit
    ? 'info'
    : l.state === 'SETTLED'
      ? 'success'
      : l.state === 'FAILED'
        ? 'failure'
        : l.state === 'VOID'
          ? 'neutral'
          : l.state === 'SUBMITTED' || l.state === 'UNKNOWN'
            ? 'info'
            : 'pending';

/** A leg's state in plain words ("In transit between your banks", "Done"). */
export function legStateLabel(l: MovementLeg): string {
  if (l.inTransit) return t('app.fx.leg.state.in_transit');
  const k = `app.fx.leg.state.${l.state.toLowerCase()}`;
  return has(k) ? t(k) : l.state;
}

/** What a leg does, in words, with the names the screen knows. */
export function legLabel(
  l: MovementLeg,
  names: {
    from?: string;
    to?: string;
    via?: string;
    payee?: string;
    sell?: string;
    buy?: string;
    amount: string;
  },
): string {
  const k = `app.fx.leg.${l.capability.toLowerCase()}`;
  if (!has(k)) return l.capability;
  return t(k, {
    amount: names.amount,
    from: names.from ?? t('app.fx.your_account'),
    to: names.to ?? t('app.fx.your_account'),
    via: names.via ?? t('app.fx.your_account'),
    payee: names.payee ?? t('app.fx.recipient_unknown'),
    sell: names.sell ?? '',
    buy: names.buy ?? '',
  });
}

/** Movement states a founder can still cancel, and states the screen reads again on its own. */
export const CANCELLABLE = new Set(['PLANNED', 'PENDING_APPROVAL', 'AWAITING_QUOTE']);
export const MOVING = new Set(['RUNNING', 'PARKED']);

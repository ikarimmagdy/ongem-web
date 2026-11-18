import { DEMO_CURRENCIES } from '../api/demoFx';
import type { Account, MovementLeg } from '../api/types';
import { viaFor } from '../screens/Convert';
import { withinCorridor } from '../screens/SendAbroad';
import { setCurrencies } from './currencies';
import { decimalToMinor, formatMinor, formatMoney } from './format';
import { institutionLabel, legStateLabel, movementLabel, secondsLeft } from './fx';

const leg = (l: Partial<MovementLeg>): MovementLeg => ({
  id: 'l',
  seq: 1,
  capability: 'FIRST_PARTY',
  state: 'SUBMITTED',
  amount: { amountMinor: 1, currency: 'USD' },
  ...l,
});

describe('OG-054 money in each currency’s own minor units', () => {
  afterEach(() => setCurrencies([]));

  it('OG054_JPY has no decimals, KWD and BHD three', () => {
    setCurrencies(DEMO_CURRENCIES);
    expect(formatMinor({ amountMinor: 150_000, currency: 'JPY' })).toBe('JPY 150,000');
    expect(formatMinor({ amountMinor: 20_500, currency: 'KWD' })).toBe('KWD 20.500');
    expect(formatMinor({ amountMinor: 1, currency: 'BHD' })).toBe('BHD 0.001');
    expect(formatMinor({ amountMinor: 125_000, currency: 'USD' })).toBe('US$1,250.00');
    expect(formatMoney({ amount: 1500, currency: 'JPY' })).toBe('JPY 1,500');
    expect(decimalToMinor('1500', 'JPY')).toBe(1500);
    expect(decimalToMinor('1500.5', 'JPY')).toBeNull();
    expect(decimalToMinor('20.5', 'KWD')).toBe(20_500);
    expect(decimalToMinor('20.5001', 'KWD')).toBeNull();
  });

  it('OG054_the API table wins over the browser', () => {
    setCurrencies([{ code: 'USD', minorUnits: 3, name: 'US Dollar' }]);
    expect(formatMinor({ amountMinor: 1_000, currency: 'USD' })).toBe('US$1.000');
    expect(decimalToMinor('1.25', 'USD')).toBe(1_250);
    setCurrencies([]);
    expect(formatMinor({ amountMinor: 1_000, currency: 'USD' })).toBe('US$10.00');
  });
});

describe('OG-054 words and rules', () => {
  it('OG054_a quote counts down and stops at zero', () => {
    expect(secondsLeft({ expiresAt: '2026-11-19T10:00:30Z' }, Date.parse('2026-11-19T10:00:00Z'))).toBe(30);
    expect(secondsLeft({ expiresAt: '2026-11-19T10:00:00Z' }, Date.parse('2026-11-19T10:00:05Z'))).toBe(0);
  });

  it('OG054_a first-party leg on its way reads in transit', () => {
    expect(movementLabel({ state: 'RUNNING', legs: [leg({ inTransit: true })] })).toBe('In transit');
    expect(movementLabel({ state: 'RUNNING', legs: [leg({})] })).toBe('On its way');
    expect(legStateLabel(leg({ inTransit: true }))).toBe('In transit between your banks');
    expect(legStateLabel(leg({ state: 'SETTLED' }))).toBe('Done');
  });

  it('OG054_the institution is the content key, else the API name, never invented', () => {
    expect(institutionLabel({ institution: null, institutionName: 'Harbour Global Bank (sample)' })).toBe(
      'Harbour Global Bank (sample)',
    );
    expect(institutionLabel({ institution: null, institutionName: null })).toBeNull();
    expect(institutionLabel({ institution: 'app.accounts.institution.home_bank' })).toMatch(/Bank/);
  });

  it('OG054_a conversion across banks goes through an own account in the sold currency there', () => {
    const a = (id: string, currency: string, bank: string | null, receiving = false): Account => ({
      id,
      name: id,
      status: 'ACTIVE',
      currency,
      institutionName: bank,
      receiving: receiving ? { scheme: 'US_ABA', last4: '1' } : null,
    });
    const home = a('home', 'USD', 'Home');
    const eur = a('eur', 'EUR', 'Global', true);
    const usdThere = a('usd', 'USD', 'Global', true);
    expect(viaFor(home, eur, [home, eur])).toEqual({ via: null, missing: true });
    expect(viaFor(home, eur, [home, eur, usdThere])).toEqual({ via: usdThere, missing: false });
    expect(viaFor(usdThere, eur, [home, eur, usdThere])).toEqual({ via: null, missing: false });
  });

  it('OG054_an amount must sit inside the corridor limits', () => {
    const c = {
      minAmount: { amountMinor: 10_000, currency: 'KWD' },
      maxAmount: { amountMinor: 15_000_000, currency: 'KWD' },
    } as Parameters<typeof withinCorridor>[0];
    expect(withinCorridor(c, null)).toBeNull();
    expect(withinCorridor(c, 9_999)).toBe('low');
    expect(withinCorridor(c, 15_000_001)).toBe('high');
    expect(withinCorridor(c, 20_500)).toBe('ok');
  });
});

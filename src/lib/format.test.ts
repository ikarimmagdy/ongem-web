import { decimalToMinor, formatDate, formatMinor, formatMoney, minorToDecimal } from './format';

describe('format', () => {
  it('formats US dollars as US$1,250.00', () => {
    expect(formatMoney({ amount: '1250', currency: 'USD' })).toBe('US$1,250.00');
    expect(formatMoney({ amount: -120.5, currency: 'USD' })).toBe('-US$120.50');
    expect(formatMoney({ amount: 10, currency: 'AED' })).toBe('AED 10.00');
  });

  it('formats dates as 20 Oct 2026 and times in ET', () => {
    expect(formatDate('2026-10-20T14:42:00Z')).toBe('20 Oct 2026');
    expect(formatDate('2026-10-20T14:42:00Z', { time: true })).toBe('20 Oct 2026 10:42 ET');
    expect(formatDate('2026-10-20T14:42:00Z', { time: true, timeZone: 'UTC' })).toBe('20 Oct 2026 14:42 UTC');
  });
});

describe('minor units', () => {
  it('formats minor units with the currency exponent and no rounding', async () => {
    const { formatMinor, minorToDecimal, decimalToMinor } = await import('./format');
    expect(formatMinor({ amountMinor: 125000, currency: 'USD' })).toBe('US$1,250.00');
    expect(formatMinor({ amountMinor: 7, currency: 'USD' })).toBe('US$0.07');
    expect(formatMinor({ amountMinor: -4999, currency: 'USD' })).toBe('-US$49.99');
    expect(formatMinor({ amountMinor: 1500, currency: 'JPY' })).toBe('JPY 1,500');
    expect(formatMinor({ amountMinor: 1234, currency: 'BHD' })).toBe('BHD 1.234');
    expect(minorToDecimal({ amountMinor: 900719925474099, currency: 'USD' })).toBe('9007199254740.99');
    expect(decimalToMinor('1,250.5', 'USD')).toBe(125050);
    expect(decimalToMinor('0.07', 'USD')).toBe(7);
    expect(decimalToMinor('1.234', 'USD')).toBeNull();
    expect(decimalToMinor('abc', 'USD')).toBeNull();
    expect(decimalToMinor('12', 'JPY')).toBe(12);
  });
});

describe('money in minor units (OG-030 N2)', () => {
  it('amounts_in_minor_units_N2', () => {
    expect(decimalToMinor('1,250.50', 'USD')).toBe(125050);
    expect(decimalToMinor('0.1', 'USD')).toBe(10);
    expect(decimalToMinor('1.005', 'USD')).toBeNull();
    expect(formatMinor({ amountMinor: 12_610_016, currency: 'USD' })).toBe('US$126,100.16');
    expect(minorToDecimal({ amountMinor: 100000, currency: 'USD' })).toBe('1000.00');
  });
});

import type { Corridor } from '../api/types';
import {
  bicValid,
  ibanValid,
  recipientFormErrors,
  recipientRequest,
  schemeFor,
  sortCodeValid,
  type RecipientForm,
} from './bankDetails';

const amt = (amountMinor: number, currency: string) => ({ amountMinor, currency });
const corridor = (requiredFields: string[], country = 'DE', currency = 'EUR'): Corridor => ({
  id: `cor_${country}`,
  sourceCurrency: 'USD',
  destinationCurrency: currency,
  destinationCountry: country,
  rail: 'SEPA',
  minAmount: amt(100, currency),
  maxAmount: amt(5_000_000, currency),
  requiredFields,
});
const form = (f: Partial<RecipientForm>): RecipientForm => ({
  kind: 'BUSINESS',
  name: 'Muster GmbH',
  iban: '',
  bic: '',
  sortCode: '',
  routingNumber: '',
  accountNumber: '',
  localScheme: '',
  bankCode: '',
  line1: '',
  city: '',
  postalCode: '',
  ...f,
});

describe('OG-054 bank details abroad, checked as ongem-core checks them', () => {
  it('OG054_IBAN mod 97 and the length for its country', () => {
    expect(ibanValid('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(ibanValid('de89370400440532013000')).toBe(true);
    expect(ibanValid('DE88370400440532013000')).toBe(false);
    expect(ibanValid('DE8937040044053201300')).toBe(false);
    expect(ibanValid('GB82WEST12345698765432')).toBe(true);
    expect(ibanValid('KW81CBKU0000000000001234560101')).toBe(true);
    expect(ibanValid('KW81CBKU000000000000123456010')).toBe(false);
  });

  it('OG054_BIC 8 or 11, sort code 6 digits with dashes', () => {
    expect(bicValid('COBADEFF')).toBe(true);
    expect(bicValid('COBADEFFXXX')).toBe(true);
    expect(bicValid('COBADEF')).toBe(false);
    expect(bicValid('C0BADEFFXXX')).toBe(false);
    expect(sortCodeValid('60-83-71')).toBe(true);
    expect(sortCodeValid('60837')).toBe(false);
  });

  it('OG054_scheme from the corridor fields', () => {
    expect(schemeFor(['IBAN', 'BIC'])).toBe('IBAN');
    expect(schemeFor(['SORT_CODE', 'ACCOUNT_NUMBER'])).toBe('UK_SORT_CODE');
    expect(schemeFor(['ABA_ROUTING', 'ACCOUNT_NUMBER'])).toBe('US_ABA');
    expect(schemeFor(['LOCAL_BANK_CODE', 'ACCOUNT_NUMBER'])).toBe('LOCAL');
  });

  it('OG054_IBAN corridor: missing, foreign country and a required BIC', () => {
    const c = corridor(['IBAN', 'BIC']);
    expect(recipientFormErrors(form({}), c)).toEqual({
      iban: 'recipient_field_required',
      bic: 'recipient_field_required',
    });
    expect(recipientFormErrors(form({ iban: 'GB82WEST12345698765432', bic: 'COBADEFF' }), c)).toEqual({
      iban: 'iban_invalid',
    });
    expect(recipientFormErrors(form({ iban: 'DE89370400440532013000', bic: 'BAD' }), c)).toEqual({
      bic: 'bic_invalid',
    });
    expect(recipientFormErrors(form({ iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' }), c)).toEqual({});
  });

  it('OG054_UK, US ABA and local schemes', () => {
    const uk = corridor(['SORT_CODE', 'ACCOUNT_NUMBER'], 'GB', 'GBP');
    expect(recipientFormErrors(form({ sortCode: '60-83-71', accountNumber: '1234567' }), uk)).toEqual({
      accountNumber: 'account_number_invalid',
    });
    const us = corridor(['ABA_ROUTING', 'ACCOUNT_NUMBER'], 'US', 'USD');
    expect(recipientFormErrors(form({ routingNumber: '021000022', accountNumber: '1234' }), us)).toEqual({
      routingNumber: 'routing_number_invalid',
    });
    expect(recipientFormErrors(form({ routingNumber: '021000021', accountNumber: '1234' }), us)).toEqual({});
    const local = corridor(['LOCAL_BANK_CODE', 'ACCOUNT_NUMBER', 'ADDRESS'], 'IN', 'INR');
    expect(
      recipientFormErrors(
        form({ localScheme: 'I', bankCode: 'HDFC0001', accountNumber: '123', line1: 'x' }),
        local,
      ),
    ).toEqual({
      localScheme: 'validation_failed',
      accountNumber: 'account_number_invalid',
      address: 'recipient_field_required',
    });
    expect(
      recipientFormErrors(
        form({
          name: ' ',
          localScheme: 'IFSC',
          bankCode: 'HDFC0001',
          accountNumber: '50100012345',
          line1: 'MG Road 1',
          city: 'Pune',
          postalCode: '411001',
        }),
        local,
      ),
    ).toEqual({ name: 'validation_failed' });
  });

  it('OG054_the request carries only the scheme fields, normalised', () => {
    const r = recipientRequest(
      form({ iban: 'de89 3704 0044 0532 0130 00', bic: 'cobadeff', sortCode: '123456' }),
      corridor(['IBAN']),
    );
    expect(r).toEqual({
      corridorId: 'cor_DE',
      kind: 'BUSINESS',
      name: 'Muster GmbH',
      country: 'DE',
      currency: 'EUR',
      scheme: 'IBAN',
      bic: 'COBADEFF',
      iban: 'DE89370400440532013000',
      address: null,
    });
    const uk = recipientRequest(
      form({ sortCode: '60-83-71', accountNumber: '41927730' }),
      corridor(['SORT_CODE', 'ACCOUNT_NUMBER'], 'GB', 'GBP'),
    );
    expect(uk.sortCode).toBe('608371');
    expect(uk.iban).toBeUndefined();
  });
});

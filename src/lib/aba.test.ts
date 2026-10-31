import { abaValid } from './aba';

describe('ABA routing number check', () => {
  it('aba_checksum_AC_R3_1 accepts numbers whose weighted sum is a multiple of 10', () => {
    for (const n of ['021000021', '011000015', '121000358', '026009593']) expect(abaValid(n)).toBe(true);
  });
  it('refuses a mistyped digit, the wrong length and non-digits', () => {
    for (const n of ['021000022', '12345678', '0210000210', '02100002a', '', ' 21000021'])
      expect(abaValid(n)).toBe(false);
  });
});

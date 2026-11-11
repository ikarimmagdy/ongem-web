import { ApiError, errorText } from '../api/errors';
import { formatBankDate } from '../lib/format';

describe('bank dates and transfer errors (OG-024 R16, OG-023 R8)', () => {
  it('a bank date reads as its own calendar day in any time zone AC_R16_1', () => {
    expect(formatBankDate('2026-10-01')).toBe('1 Oct 2026');
    expect(formatBankDate('2026-10-31')).toBe('31 Oct 2026');
  });

  it('a 409 capability_unavailable names the accounts, a 422 keeps the scheduling text AC_R11_3', () => {
    expect(errorText(new ApiError(409, 'capability_unavailable'))).toMatch(
      /same bank and in the same region/,
    );
    expect(errorText(new ApiError(422, 'capability_unavailable'))).toMatch(/Schedule an ACH/);
  });
});

import {
  AE_DEV_ORIGIN,
  DEV_ORIGIN,
  PROD_ORIGIN,
  securityTxt,
  securityTxtOrigin,
} from '../../scripts/security-txt.mjs';

describe('OG-042 security.txt (RFC 9116)', () => {
  it('names the contact, expires one year after the build, prefers English and is canonical for its origin', () => {
    const txt = securityTxt(DEV_ORIGIN, new Date('2026-11-14T10:00:00.123Z'));
    expect(txt.split('\n')).toEqual([
      'Contact: mailto:security@ongem.com',
      'Expires: 2027-11-14T10:00:00Z',
      'Preferred-Languages: en',
      'Canonical: https://app-dev.platform.ongem.com/.well-known/security.txt',
      '',
    ]);
  });

  it('the origin is the build site, else production or the region dev site', () => {
    expect(securityTxtOrigin({})).toBe(DEV_ORIGIN);
    expect(securityTxtOrigin({ VITE_REGION: 'AE' })).toBe(AE_DEV_ORIGIN);
    expect(securityTxtOrigin({ VITE_ENVIRONMENT: 'production' })).toBe(PROD_ORIGIN);
    expect(PROD_ORIGIN).toBe('https://app.platform.ongem.com');
    expect(
      securityTxtOrigin({ VITE_ENVIRONMENT: 'production', VITE_SITE_URL: 'https://app.platform.ongem.com/' }),
    ).toBe('https://app.platform.ongem.com');
  });
});

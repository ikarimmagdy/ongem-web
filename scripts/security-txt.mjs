// OG-042: /.well-known/security.txt (RFC 9116), written into the build next to index.html. Volume 7 section 11.1 names
// security.txt as the channel for external reports. The build writes it so Expires is always one year from the build
// and Canonical names the origin the build is served from: VITE_SITE_URL when set (a production build must set it,
// PS-014), otherwise app.platform.ongem.com for a production build (VITE_ENVIRONMENT=production) and the region's dev
// site for any other build.

export const SECURITY_CONTACT = 'mailto:security@ongem.com';
export const DEV_ORIGIN = 'https://app-dev.platform.ongem.com';
export const AE_DEV_ORIGIN = 'https://ongemuaedevweb.z1.web.core.windows.net';
export const PROD_ORIGIN = 'https://app.platform.ongem.com';
export const SECURITY_TXT_PATH = '.well-known/security.txt';

/** The origin this build is served from, by its VITE_ variables. */
export function securityTxtOrigin(env) {
  const site = (env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (site) return site;
  if ((env.VITE_ENVIRONMENT ?? '').trim().toLowerCase() === 'production') return PROD_ORIGIN;
  return env.VITE_REGION === 'AE' ? AE_DEV_ORIGIN : DEV_ORIGIN;
}

export function securityTxt(origin, now = new Date()) {
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return [
    `Contact: ${SECURITY_CONTACT}`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    'Preferred-Languages: en',
    `Canonical: ${origin}/${SECURITY_TXT_PATH}`,
    '',
  ].join('\n');
}

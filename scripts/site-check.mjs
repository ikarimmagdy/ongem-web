// PS-014: a production build (VITE_ENVIRONMENT=production) must name its public sites. Canonical links, hreflang
// alternates, Open Graph URLs and the region chooser are built from VITE_SITE_URL and VITE_OTHER_SITE_URL; without them
// the site falls back to the dev hosts, which a production build refuses.

/** Hosts that belong to development or preview, never to the public site. */
const DEV_HOST =
  /(^|[.-])(dev|preview|staging|test)([.-]|$)|localhost|127\.0\.0\.1|\.web\.core\.windows\.net$|\.cloudfront\.net$/i;

/** The problems with [env] for a production build; empty when it is not one or when it is fine. */
export function siteConfigErrors(env) {
  if ((env.VITE_ENVIRONMENT ?? '').trim().toLowerCase() !== 'production') return [];
  const errors = [];
  for (const name of ['VITE_SITE_URL', 'VITE_OTHER_SITE_URL']) {
    const value = (env[name] ?? '').trim();
    if (!value) {
      errors.push(`${name} is not set`);
      continue;
    }
    let url;
    try {
      url = new URL(value);
    } catch {
      errors.push(`${name} is not a URL: ${value}`);
      continue;
    }
    if (url.protocol !== 'https:') errors.push(`${name} is not https: ${value}`);
    if (DEV_HOST.test(url.hostname)) errors.push(`${name} points at a development host: ${value}`);
  }
  return errors;
}

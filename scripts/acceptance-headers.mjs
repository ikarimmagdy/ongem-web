// OG-039: the founder web's CloudFront headers for a build with payment acceptance on (VITE_ACCEPTANCE_ENABLED=true).
// Reads security-headers.json and writes dist/security-headers.acceptance.json with the processor's element sources
// added (Whop elements CSP table, docs.whop.com/elements/beta/getting-started: frames and API; the ads pixel is skipped,
// so its host is not allowed) and, for OG-055, Stripe.js and the Payment Element (docs.stripe.com/security/guide, content
// security policy: js.stripe.com scripts and frames, hooks.stripe.com for 3D Secure, api.stripe.com). ongem-infra deploys it with -c founderWebHeaders=../ongem-web/dist/security-headers.acceptance.json.
// The policy is the distribution's, so it also covers the buyer's pay link page /pay/<token> (OG-058): Stripe.js and the
// Payment Element load there, its API calls stay same-origin (/api-dev), Referrer-Policy strict-origin keeps the token
// (in the path) out of every Referer, and frame-ancestors 'none' and X-Frame-Options DENY keep the page from being
// framed. The build's routes.json lists `pay`, so the edge answers the page instead of the not-found page.
// Usage: node scripts/acceptance-headers.mjs [sandbox|production]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const readBase = () => JSON.parse(readFileSync(new URL('../security-headers.json', import.meta.url), 'utf8'));

/** [base] (security-headers.json) with the card form's sources added, for [env] (sandbox or production). */
export function acceptanceHeaders(env = 'sandbox', base = readBase()) {
  const api = env === 'production' ? 'https://api.whop.com' : 'https://sandbox-api.whop.com';
  const add = {
    'script-src': ['https://cdn.whop.com', 'https://js.stripe.com', 'https://*.js.stripe.com'],
    'frame-src': [
      'https://cdn.whop.com',
      'https://cdn.plaid.com',
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://hooks.stripe.com',
    ],
    'connect-src': [
      api,
      env === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com',
      'https://api.stripe.com',
    ],
  };
  const headers = structuredClone(base);
  const csp = headers.SecurityHeadersConfig.ContentSecurityPolicy;
  csp.ContentSecurityPolicy = csp.ContentSecurityPolicy.split(';')
    .map((d) => d.trim())
    .map((d) => {
      const name = d.split(' ')[0];
      const extra = (add[name] ?? []).filter((s) => !d.split(' ').includes(s));
      return extra.length ? `${d} ${extra.join(' ')}` : d;
    })
    .join('; ');
  headers.Name = `${headers.Name}-acceptance`;
  headers.Comment = `${headers.Comment} OG-039: the payment processor's element frames and API (${env}); OG-058: the same policy covers the public pay link page /pay/<token>.`;
  return headers;
}

/** Writes dist/security-headers.acceptance.json; `npm run build` calls it for a build with Get paid on. */
export function writeAcceptanceHeaders(env = 'sandbox') {
  const headers = acceptanceHeaders(env);
  mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../dist/security-headers.acceptance.json', import.meta.url),
    `${JSON.stringify(headers, null, 2)}\n`,
  );
  console.log(`dist/security-headers.acceptance.json (${env})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  writeAcceptanceHeaders(process.argv[2] === 'production' ? 'production' : 'sandbox');

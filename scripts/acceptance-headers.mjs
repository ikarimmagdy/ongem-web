// OG-039: the founder web's CloudFront headers for a build with payment acceptance on (VITE_ACCEPTANCE_ENABLED=true).
// Reads security-headers.json and writes dist/security-headers.acceptance.json with the processor's element sources
// added (Whop elements CSP table, docs.whop.com/elements/beta/getting-started: frames and API; the ads pixel is skipped,
// so its host is not allowed). ongem-infra deploys it with -c founderWebHeaders=../ongem-web/dist/security-headers.acceptance.json.
// Usage: node scripts/acceptance-headers.mjs [sandbox|production]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const env = process.argv[2] === 'production' ? 'production' : 'sandbox';
const api = env === 'production' ? 'https://api.whop.com' : 'https://sandbox-api.whop.com';
const add = {
  'script-src': ['https://cdn.whop.com'],
  'frame-src': ['https://cdn.whop.com', 'https://cdn.plaid.com'],
  'connect-src': [api, env === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com'],
};
const headers = JSON.parse(readFileSync(new URL('../security-headers.json', import.meta.url), 'utf8'));
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
headers.Comment = `${headers.Comment} OG-039: the payment processor's element frames and API (${env}).`;
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../dist/security-headers.acceptance.json', import.meta.url),
  `${JSON.stringify(headers, null, 2)}\n`,
);
console.log(`dist/security-headers.acceptance.json (${env})`);

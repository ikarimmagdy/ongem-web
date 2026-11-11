// `npm run build`: the content snapshot, the client build, then the prerender of the first screen. `-- --outDir <dir>`
// builds into another folder, for example `VITE_REGION=AE npm run build -- --outDir dist-uae` (OG-022 R18).
//
// Content (OG-033): every text is pulled from the target environment's API (GET /v1/public/content/{channel} for
// every public channel, English and Arabic). ONGEM_CONTENT_API overrides the region's default API. If the API cannot
// be reached the build stops; `-- --content-snapshot <file>` (or ONGEM_CONTENT_SNAPSHOT) builds from a snapshot file
// instead, such as one made from the seed by `npm run content:snapshot` for CI and tests.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, loadEnv } from 'vite';
import { DEFAULT_API, fetchSnapshot, LOCALES, PUBLIC_CHANNELS, regionOf } from './content.mjs';
import { siteConfigErrors } from './site-check.mjs';

const arg = (name) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const outDir = arg('--outDir') ?? 'dist';
const region = regionOf();

// PS-014: a production build stops when its public site URLs are missing or point at development hosts.
const siteErrors = siteConfigErrors({ ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env });
if (siteErrors.length) {
  for (const e of siteErrors) console.error(`site: ${e}`);
  console.error(
    'site: a production build needs the public URLs of both regions (VITE_SITE_URL, VITE_OTHER_SITE_URL).',
  );
  process.exit(1);
}

let file = arg('--content-snapshot') ?? process.env.ONGEM_CONTENT_SNAPSHOT;
if (file) {
  file = resolve(file);
  const snap = JSON.parse(readFileSync(file, 'utf8'));
  if (snap.region !== region)
    throw new Error(`content: snapshot ${file} is for region ${snap.region}, this build is ${region}`);
  for (const l of LOCALES)
    for (const c of PUBLIC_CHANNELS)
      if (!snap.locales?.[l]?.[c]) throw new Error(`content: snapshot ${file} has no ${c} in ${l}`);
  console.log(`content: snapshot ${file} (${snap.source})`);
} else {
  const api = process.env.ONGEM_CONTENT_API || DEFAULT_API[region];
  let snap;
  try {
    snap = await fetchSnapshot(api, region);
  } catch (e) {
    console.error(`\ncontent: could not pull the content snapshot from ${api}: ${e.message}`);
    console.error(
      'content: the build stops rather than ship without text. Set ONGEM_CONTENT_API, or build from a',
    );
    console.error(
      'content: snapshot file: npm run content:snapshot && npm run build -- --content-snapshot <file>\n',
    );
    process.exit(1);
  }
  mkdirSync('node_modules/.tmp', { recursive: true });
  file = resolve(`node_modules/.tmp/content-snapshot-${region}.json`);
  writeFileSync(file, JSON.stringify(snap));
  console.log(`content: snapshot pulled from ${api}`);
}
process.env.ONGEM_CONTENT_SNAPSHOT = file;

await build({ build: { outDir } });
await import('./prerender.mjs');

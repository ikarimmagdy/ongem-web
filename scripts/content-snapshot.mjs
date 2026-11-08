// The seed files (content-seed/<region>/*.json) as a content snapshot, the form `npm run build` pulls from the API
// (OG-033). For CI and tests: `npm run content:snapshot` writes content-snapshot.<region>.json for VITE_REGION (or
// `-- --region ae --out <file>`), then `npm run build -- --content-snapshot content-snapshot.<region>.json`.
import { writeFileSync } from 'node:fs';
import { regionOf, seedSnapshot } from './content.mjs';

const arg = (name) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const region = arg('--region') ?? regionOf();
if (region !== 'us' && region !== 'ae') throw new Error(`content: unknown region ${region}`);
const out = arg('--out') ?? `content-snapshot.${region}.json`;
writeFileSync(out, JSON.stringify(seedSnapshot(process.cwd(), region)));
console.log(`content: seed snapshot for ${region} in ${out}`);

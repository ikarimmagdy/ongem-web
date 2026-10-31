// Writes src/api/openapi-paths.json (path template to verbs) from the API's OpenAPI document.
// Usage: npm run api:paths [-- <url or file>]; the default is the dev API.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2] ?? 'https://api-dev.ongem.com/v3/api-docs';
const doc = src.startsWith('http') ? await (await fetch(src)).json() : JSON.parse(readFileSync(src, 'utf8'));
const paths = Object.fromEntries(
  Object.keys(doc.paths)
    .sort()
    .map((p) => [p, Object.keys(doc.paths[p]).sort()]),
);
writeFileSync(
  new URL('../src/api/openapi-paths.json', import.meta.url),
  `${JSON.stringify(paths, null, 2)}\n`,
);
console.log(`${Object.keys(paths).length} paths from ${src}`);

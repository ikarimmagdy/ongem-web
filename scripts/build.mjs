// `npm run build`: the client build, then the prerender of the first screen. `-- --outDir <dir>` builds into another
// folder, for example `VITE_REGION=AE npm run build -- --outDir dist-uae` (OG-022 R18).
import { build } from 'vite';

const at = process.argv.indexOf('--outDir');
const outDir = at > 0 && process.argv[at + 1] ? process.argv[at + 1] : 'dist';
await build({ build: { outDir } });
await import('./prerender.mjs');

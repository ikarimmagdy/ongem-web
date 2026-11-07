// After `vite build`: puts the first screen (the public home, OG-032) into dist/index.html as static HTML with the default theme's variables, so
// the first screen paints before the script runs (OG-030-N3). Font preloads were tried and made LCP later on a throttled
// phone (the fonts took bandwidth from the stylesheet), so the text paints in the fallback font and swaps.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const out = 'node_modules/.tmp/prerender';
await build({
  logLevel: 'warn',
  build: {
    ssr: 'src/prerender.tsx',
    outDir: out,
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: 'prerender.mjs' } },
  },
});
const { prerender } = await import(pathToFileURL(`${out}/prerender.mjs`).href);
const shell = prerender();
rmSync(out, { recursive: true, force: true });

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const text = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let html = readFileSync('dist/index.html', 'utf8');
const before = html;
html = html
  .replace(
    '<html lang="en">',
    `<html lang="en" data-theme="${attr(shell.themeId)}" data-theme-mode="${attr(shell.themeMode)}" style="${attr(shell.style)}">`,
  )
  .replace(/<title>.*<\/title>/, `<title>${text(shell.title)}</title>`)
  .replace('<div id="root"></div>', `<div id="root">${shell.html}</div>`);
if (html === before || !html.includes('data-testid="public-home"'))
  throw new Error('prerender: index.html not updated');
writeFileSync('dist/index.html', html);
console.log('prerender: public home in dist/index.html');

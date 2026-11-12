// After `vite build`: puts the first screen (the public home, OG-032) into dist/index.html as static HTML with the default theme's variables, so
// the first screen paints before the script runs (OG-030-N3). Font preloads were tried and made LCP later on a throttled
// phone (the fonts took bandwidth from the stylesheet), so the text paints in the fallback font and swaps.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

// `npm run build -- --outDir dist-uae` builds into another folder (scripts/build.mjs passes the same argument here).
const at = process.argv.indexOf('--outDir');
const dist = at > 0 && process.argv[at + 1] ? process.argv[at + 1] : 'dist';
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
const template = readFileSync(`${dist}/index.html`, 'utf8');
const page = (title, description) =>
  template
    .replace(
      '<html lang="en">',
      `<html lang="en" dir="ltr" data-theme="${attr(shell.themeId)}" data-theme-mode="${attr(shell.themeMode)}" style="${attr(shell.style)}">`,
    )
    .replace(/<title>.*<\/title>/, `<title>${text(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      () => `<meta name="description" content="${attr(description)}" />`,
    );
const before = template;
// PS-013: the card drawings below the hero get their wordmark from the app's first render, so the static home spends
// a slow phone's bandwidth on the hero screens.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const firstPaint = (s) => s.replace(/(class="og-cardface__wordmark" src=")[^"]*"/g, `$1${BLANK}"`);
let html = page(shell.title, shell.description)
  .replace(
    '</head>',
    () =>
      shell.social
        .map((m) => `  <meta ${m.attr}="${attr(m.name)}" content="${attr(m.content)}" />\n`)
        .join('') +
      `  <script type="application/ld+json" id="${attr(shell.ld.id)}">${shell.ld.json.replace(/</g, '\\u003c')}</script>\n  </head>`,
  )
  .replace('<div id="root"></div>', () => `<div id="root">${firstPaint(shell.html)}</div>`);
if (html === before || !html.includes('data-testid="public-home"') || !html.includes('application/ld+json'))
  throw new Error('prerender: index.html not updated');
writeFileSync(`${dist}/index.html`, html);
console.log(`prerender: public home in ${dist}/index.html`);

// PS-008: the not-found page, out of search, and the build's routes, from which the edge answers 404 for other paths.
const notFound = page(shell.notFound.title, shell.notFound.description)
  .replace(/\s*<meta name="robots" content="[^"]*" \/>/, '')
  .replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>')
  .replace('<div id="root"></div>', () => `<div id="root">${shell.notFound.html}</div>`);
if (!notFound.includes('data-testid="public-not-found"')) throw new Error('prerender: 404.html not rendered');
writeFileSync(`${dist}/404.html`, notFound);
writeFileSync(`${dist}/routes.json`, JSON.stringify(shell.routes, null, 2) + '\n');
console.log(`prerender: ${dist}/404.html and ${shell.routes.pages.length} pages in ${dist}/routes.json`);

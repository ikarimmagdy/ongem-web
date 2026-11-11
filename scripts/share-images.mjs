// PS-015: the branded share images (Open Graph and Twitter cards), 1200 x 630, one per region and language, written to
// public/og/ongem-<region>-<locale>.png. Colours and faces come from the theme tokens, words from the content seed, the
// wordmark from src/assets. Run: `node scripts/share-images.mjs` after a change to any of them.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const theme = JSON.parse(readFileSync('src/themes/ongem-themes.json', 'utf8')).themes.find((t) => t.id === 'ongem');
const c = theme.color;
const font = (path) => `data:font/woff2;base64,${readFileSync(path).toString('base64')}`;
const display = font('node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2');
const arabic = font('node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2');
const body = font('node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2');
const wordmark = `data:image/png;base64,${readFileSync('src/assets/ongem-wordmark-light.png').toString('base64')}`;
const mark = `data:image/png;base64,${readFileSync('src/assets/ongem-favicon.png').toString('base64')}`;

const seed = (region) =>
  Object.fromEntries(
    JSON.parse(readFileSync(`content-seed/${region}/web_public.json`, 'utf8')).entries.map((e) => [e.key, e]),
  );
const text = (s, key, locale) => s[key]?.[locale] ?? s[key]?.en ?? '';

const page = (region, locale) => {
  const s = seed(region);
  const rtl = locale === 'ar';
  const eyebrow = text(s, 'web.hero.eyebrow', locale);
  const title = text(s, 'web.hero.title', locale);
  const badge = region === 'ae' ? text(s, 'web.soon.badge', locale) : '';
  const g = theme.gradient.brand;
  return `<!doctype html><html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
@font-face{font-family:D;src:url(${display})}@font-face{font-family:A;src:url(${arabic})}@font-face{font-family:B;src:url(${body})}
*{margin:0;box-sizing:border-box}
html{width:1200px;height:630px;overflow:hidden}
body{width:1200px;height:630px;align-items:flex-start;background:${c.brand.deep};color:${c.text.inverse};font-family:B,A,sans-serif;
padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.glow{position:absolute;inset-inline-end:-160px;top:-160px;width:640px;height:640px;border-radius:50%;
background:radial-gradient(circle,${g[2]} 0%,${g[1]} 40%,transparent 70%);opacity:.55}
.mark{position:absolute;inset-inline-end:96px;bottom:84px;width:120px;height:120px;border-radius:24px}
img.wm{height:64px;width:auto;position:relative}
.eyebrow{font-size:28px;color:${c.brand.accent};margin-bottom:20px;font-family:B,A,sans-serif}
h1{font-family:D,A,sans-serif;font-size:${rtl ? 64 : 76}px;line-height:${rtl ? 1.3 : 1.05};max-width:820px}
.badge{display:inline-block;margin-top:28px;padding:8px 18px;border-radius:999px;background:${c.surface.tintBlue};color:${c.brand.deep};font-size:24px}
</style></head><body><div class="glow"></div><img class="mark" src="${mark}" alt="">
<img class="wm" src="${wordmark}" alt="OnGem"><div style="position:relative"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>
${badge ? `<span class="badge">${badge}</span>` : ''}</div></body></html>`;
};

mkdirSync('public/og', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const region of ['us', 'ae'])
  for (const locale of ['en', 'ar']) {
    await p.setContent(page(region, locale), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `public/og/ongem-${region}-${locale}.png` });
  }
await browser.close();
console.log('share images in public/og');

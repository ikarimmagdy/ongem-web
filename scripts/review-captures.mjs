// UI and UX review captures (ongem-engineering skill ui-ux-review): every public page and every signed-in screen in
// demo mode (sample data only), at 1440 and 390 px, light and dark, full page. Run with the dev server up:
// `node scripts/review-captures.mjs <out-dir> [base]`; public pages go to <out-dir>/public, signed-in screens to
// <out-dir>/app.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:5190';
if (!out) {
  console.error('usage: node scripts/review-captures.mjs <out-dir> [base]');
  process.exit(2);
}
const PUBLIC = ['/', '/product', '/security', '/partners', '/sign-in', '/sign-in?mode=sign-up'];
const APP = [
  '/',
  '/accounts',
  '/payments',
  '/payments/new',
  '/payments/top-up',
  '/payments/schedules',
  '/recipients',
  '/cards',
  '/onboarding',
  '/support',
  '/support/new',
  '/notifications',
  '/settings',
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const THEMES = { light: 'ongem', dark: 'ongem-dark' };
const name = (p) => (p === '/' ? 'home' : p.slice(1).replace(/[/?=]/g, '-'));
const browser = await chromium.launch();
const errors = [];

async function context(vp, theme) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], reducedMotion: 'reduce' });
  await ctx.addInitScript((id) => localStorage.setItem('ongem-admin.theme.selected', id), THEMES[theme]);
  return ctx;
}

// Scroll through the page so lazy images load before a full-page capture.
async function settle(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
}

async function go(page, to) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
}

for (const vp of Object.keys(VIEWPORTS)) {
  for (const theme of Object.keys(THEMES)) {
    const dirPub = `${out}/public`;
    const dirApp = `${out}/app`;
    mkdirSync(dirPub, { recursive: true });
    mkdirSync(dirApp, { recursive: true });
    let ctx = await context(vp, theme);
    let page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${vp} ${theme}: ${e}`));
    for (const p of PUBLIC) {
      await page.goto(`${base}${p}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(700);
      await settle(page);
      await page.screenshot({ path: `${dirPub}/${name(p)}-${vp}-${theme}.png`, fullPage: true });
    }
    await ctx.close();
    ctx = await context(vp, theme);
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${vp} ${theme}: ${e}`));
    await page.goto(`${base}/sign-in`);
    await page.getByTestId('explore-demo').click();
    await page.getByTestId('home-total').waitFor();
    for (const p of APP) {
      await go(page, p);
      await page.screenshot({ path: `${dirApp}/${name(p)}-${vp}-${theme}.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`captures in ${out}`);

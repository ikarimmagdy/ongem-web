// UI and UX review captures (ongem-engineering skill ui-ux-review): every public page and every signed-in screen in
// demo mode (sample data only), at 1440 and 390 px, English and Arabic, light and dark, full page JPEG, plus the open
// states of menus, selects, date pickers and dialogs. Run with the dev or preview server up:
// `node scripts/review-captures.mjs <out-dir> [base]`; public pages go to <out-dir>/public, signed-in screens to
// <out-dir>/app, open states to <out-dir>/states. CHROME=<path> launches that browser instead of Playwright's own.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:5190';
if (!out) {
  console.error('usage: node scripts/review-captures.mjs <out-dir> [base]');
  process.exit(2);
}
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const PUBLIC = [
  '/',
  '/product',
  '/product/accounts',
  '/product/payments',
  '/product/approvals',
  '/product/cards',
  '/product/assistant',
  '/product/companies',
  '/for/new-companies',
  '/for/several-companies',
  '/pricing',
  '/security',
  '/partners',
  '/blog',
  '/blog/where-your-money-lives',
  '/guides',
  '/faq',
  '/status',
  '/contact',
  '/videos',
  '/legal/privacy',
  '/legal/terms',
  '/sign-in',
  '/sign-in?mode=sign-up',
  '/no-such-page',
];
const APP = [
  '/',
  '/accounts',
  '/accounts/acc_demo_ops',
  '/payments',
  '/payments/new',
  '/payments/top-up',
  '/payments/schedules',
  '/payments/recipients',
  '/payments/approvals',
  '/payments/pay_demo_1',
  '/payments/pay_demo_approval',
  '/cards',
  '/cards/crd_demo_dana',
  '/team',
  '/documents',
  '/more',
  '/onboarding',
  '/support',
  '/support/new',
  '/support/tkt_demo_1',
  '/settings',
  '/notifications',
];

// Open states: each opens something on a screen and captures the viewport.
const STATES = [
  {
    name: 'public-menu-product',
    at: '/',
    public: true,
    wide: true,
    open: (p) => p.getByTestId('menu-product').click(),
  },
  {
    name: 'public-region',
    at: '/',
    public: true,
    wide: true,
    open: (p) => p.getByTestId('region-chooser').click(),
  },
  {
    name: 'public-phone-menu',
    at: '/',
    public: true,
    narrow: true,
    open: (p) => p.getByTestId('phone-menu-button').click(),
  },
  { name: 'app-profile-menu', at: '/', wide: true, open: (p) => p.getByTestId('profile-menu').click() },
  {
    name: 'app-command-search',
    at: '/',
    wide: true,
    open: (p) => p.getByTestId('command-search-open').click(),
  },
  { name: 'app-send-from', at: '/payments/new', open: (p) => openField(p, 0) },
  { name: 'app-send-rail', at: '/payments/new', open: (p) => openField(p, 1) },
  { name: 'app-schedule-select', at: '/payments/schedules', open: (p) => openNew(p, 0) },
  { name: 'app-schedule-date', at: '/payments/schedules', open: (p) => openDate(p) },
  { name: 'app-export-format', at: '/documents', open: (p) => openField(p, 0) },
  { name: 'app-export-dates', at: '/accounts/acc_demo_ops', open: (p) => openRange(p) },
  { name: 'app-support-topic', at: '/support/new', open: (p) => openField(p, 0) },
  { name: 'app-topup-select', at: '/payments/top-up', open: (p) => openField(p, 0) },
  {
    name: 'app-statement',
    at: '/documents',
    open: (p) => p.locator('[data-testid^="documents-statement-"]').first().click(),
  },
  { name: 'app-stepup', at: '/cards/crd_demo_dana', open: (p) => p.getByTestId('card-freeze').click() },
];

async function openField(page, i) {
  const sel = page.locator('select.og-select, button[role="combobox"].og-select__button').nth(i);
  await sel.scrollIntoViewIfNeeded();
  if (await sel.evaluate((e) => e.tagName === 'SELECT')) await sel.focus();
  else await sel.click();
}
async function openNew(page, i) {
  const add = page.getByTestId('schedule-new');
  if (await add.count()) await add.click();
  await openField(page, i);
}
// Picks [value] in a select, native (before OG-050) or the design-system combobox (after).
async function pick(page, testid, value) {
  const el = page.getByTestId(testid);
  if (await el.evaluate((e) => e.tagName === 'SELECT')) return el.selectOption(value);
  await el.click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}
async function openRange(page) {
  await page.getByTestId('export-start').click();
  await pick(page, 'export-period', 'range');
  const d = page.getByTestId('export-from');
  await d.scrollIntoViewIfNeeded();
  await d.click();
}
async function openDate(page) {
  const add = page.getByTestId('schedule-new');
  if (await add.count()) await add.click();
  const d = page.getByTestId('schedule-start');
  await d.scrollIntoViewIfNeeded();
  await d.click();
}

const VIEWPORTS = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
if (process.env.VP) for (const k of Object.keys(VIEWPORTS)) if (k !== process.env.VP) delete VIEWPORTS[k];
const THEMES = { light: 'ongem', dark: 'ongem-dark' };
const LANGS = ['en', 'ar'];
const name = (p) => (p === '/' ? 'home' : p.slice(1).replace(/[/?=]/g, '-'));
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const errors = [];
const report = [];

async function context(vp, theme, lang) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], reducedMotion: 'reduce' });
  await ctx.addInitScript(
    ([id, l]) => {
      localStorage.setItem('ongem-admin.theme.selected', id);
      localStorage.setItem('ongem.locale', l);
    },
    [THEMES[theme], lang],
  );
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
  await page.waitForTimeout(600);
}

async function shot(page, file, full = true) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await page.screenshot({ path: file, fullPage: full, type: 'jpeg', quality: 70 });
  report.push({ file, overflow });
}

async function demo(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e}`));
  await page.goto(`${base}/sign-in`);
  await page.getByTestId('explore-demo').click();
  await page.getByTestId('home-total').waitFor();
  return page;
}

for (const vp of Object.keys(VIEWPORTS)) {
  for (const theme of Object.keys(THEMES)) {
    for (const lang of LANGS) {
      const tag = `${vp}-${lang}-${theme}`;
      for (const d of ['public', 'app', 'states']) mkdirSync(`${out}/${d}`, { recursive: true });
      let ctx = await context(vp, theme, lang);
      let page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${tag} ${page.url()}: ${e}`));
      for (const p of PUBLIC) {
        if (ONLY && !ONLY.test(`public${p}`)) continue;
        await page.goto(`${base}${p}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await settle(page);
        await shot(page, `${out}/public/${name(p)}-${tag}.jpg`);
      }
      for (const s of STATES.filter((x) => x.public)) {
        if ((s.wide && vp !== '1440') || (s.narrow && vp !== '390') || (ONLY && !ONLY.test(s.name))) continue;
        try {
          await page.goto(`${base}${s.at}`);
          await page.waitForLoadState('networkidle');
          await s.open(page);
          await page.waitForTimeout(400);
          await shot(page, `${out}/states/${s.name}-${tag}.jpg`, false);
        } catch (e) {
          errors.push(`${tag} state ${s.name}: ${String(e).split('\n')[0]}`);
        }
      }
      await ctx.close();
      ctx = await context(vp, theme, lang);
      page = await demo(ctx);
      for (const p of APP) {
        if (ONLY && !ONLY.test(`app${p}`)) continue;
        await go(page, p);
        await shot(page, `${out}/app/${name(p)}-${tag}.jpg`);
      }
      for (const s of STATES.filter((x) => !x.public)) {
        if ((s.wide && vp !== '1440') || (s.narrow && vp !== '390') || (ONLY && !ONLY.test(s.name))) continue;
        try {
          await go(page, s.at);
          await s.open(page);
          await page.waitForTimeout(400);
          await shot(page, `${out}/states/${s.name}-${tag}.jpg`, false);
          await page.keyboard.press('Escape');
          await page.keyboard.press('Escape');
        } catch (e) {
          errors.push(`${tag} state ${s.name}: ${String(e).split('\n')[0]}`);
        }
      }
      await ctx.close();
    }
  }
}
await browser.close();
writeFileSync(`${out}/_report.json`, JSON.stringify({ base, captures: report, errors }, null, 2));
if (errors.length) console.error(errors.join('\n'));
console.log(`${report.length} captures in ${out}`);

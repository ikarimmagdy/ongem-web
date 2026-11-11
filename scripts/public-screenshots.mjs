// OG-032 R7 and R10, PS-005, PS-013, PS-017: captures the public site's product screens from demo mode (sample data
// only) with headless Chromium. Desktop screens are cropped to the content column of a 1180 x 780 window (the side bar
// and top bar left out) so they read at the size the site shows them, at twice the pixel density and at 1x for
// `srcset`; phone screens are the whole 390 x 844 screen at twice the density. The demo bar is hidden in captures.
// Run with the dev server up (`npm run dev`), then `node scripts/public-screenshots.mjs [base]`
// (default http://localhost:5190).
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5190';
const out = 'src/assets/public';
/** The content column of the 1180 x 780 window: right of the side bar, under the top bar. */
const CLIP = { x: 240, y: 64, width: 940, height: 640 };
const DESKTOP = ['/', '/payments', '/payments/schedules', '/cards', '/notifications', '/support'];
const PHONE = ['/', '/payments', '/payments/schedules', '/cards', '/notifications', '/support'];
const name = (p) => (p === '/' ? 'home' : p.slice(1).replace('/', '-'));
const browser = await chromium.launch();
const errors = [];

async function open(viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/sign-in`);
  await page.getByTestId('explore-demo').click();
  await page.getByTestId('home-total').waitFor();
  await page.addStyleTag({ content: '.pub-demobar { display: none !important; }' });
  return { ctx, page };
}

async function go(page, to) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(900);
  await page.mouse.move(0, 0);
}

const file = (screen, scale) => `${out}/screen-${screen}${scale === 1 ? '-1x' : ''}.jpg`;

for (const scale of [2, 1]) {
  const { ctx, page } = await open({ width: 1180, height: 780 }, scale);
  for (const p of DESKTOP) {
    await go(page, p);
    await page.screenshot({ path: file(name(p), scale), type: 'jpeg', quality: 84, clip: CLIP });
  }
  // Several companies: the switcher open over Home (OG-034).
  await go(page, '/');
  await page.getByTestId('company-switcher').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: file('companies', scale), type: 'jpeg', quality: 84, clip: CLIP });
  await page.keyboard.press('Escape');
  // The assistant open with a question answered.
  await page.getByTestId('assistant-open').first().click();
  await page.getByTestId('assistant-input').fill('What did we pay Acme Supplies this month?');
  await page.getByTestId('assistant-send').click();
  await page.getByTestId('assistant-reply').first().waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: file('assistant', scale), type: 'jpeg', quality: 84, clip: CLIP });
  await ctx.close();
}

// Every product screen also as a phone screen: narrow pages show these instead of a shrunken desktop screen (UX-08).
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 2);
  for (const p of PHONE) {
    await go(page, p);
    await page.screenshot({ path: `${out}/screen-${name(p)}-phone.jpg`, type: 'jpeg', quality: 72 });
  }
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
console.log(`screens in ${out}`);

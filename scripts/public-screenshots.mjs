// OG-032 R7 and R10: captures the public site's product screens from demo mode (sample data only) with headless
// Chromium: desktop screens at 1440 x 900 and a phone screen at 390 x 844, both at twice the pixel density so they stay
// sharp on high-density displays. Run with the dev server up (`npm run dev`), then
// `node scripts/public-screenshots.mjs [base]` (default http://localhost:5190).
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5190';
const out = 'src/assets/public';
const DESKTOP = ['/', '/payments', '/payments/schedules', '/cards', '/notifications', '/support'];
const name = (p) => (p === '/' ? 'home' : p.slice(1).replace('/', '-'));
const browser = await chromium.launch();
const errors = [];

async function capture(viewport, paths, suffix) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/sign-in`);
  await page.getByTestId('explore-demo').click();
  await page.getByTestId('home-total').waitFor();
  for (const p of paths) {
    await page.evaluate((to) => {
      window.history.pushState({}, '', to);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, p);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
    await page.mouse.move(0, 0);
    // Feature screens are cropped to the content column so the screen reads large; home and phone stay whole.
    const clip = suffix || p === '/' ? undefined : { x: 0, y: 0, width: 1080, height: 720 };
    await page.screenshot({ path: `${out}/screen-${name(p)}${suffix}.jpg`, type: 'jpeg', quality: 84, clip });
  }
  await ctx.close();
}

await capture({ width: 1440, height: 900 }, DESKTOP, '');
// Every product screen also as a phone screen: narrow pages show these instead of a shrunken desktop screen (UX-08).
await capture({ width: 390, height: 844 }, DESKTOP, '-phone');
await browser.close();
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
console.log(`screens in ${out}`);

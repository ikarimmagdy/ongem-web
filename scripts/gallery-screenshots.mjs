// OG-032 R14, PS-005, PS-037: captures the product gallery's web screens from demo mode (sample data only) at twice the pixel density:
// onboarding, add money, OnGem approval for a one-person company and a card.
// Run with the dev server up (`npm run dev`), then `node scripts/gallery-screenshots.mjs [base]`
// (default http://localhost:5190). The app screens in src/assets/public/gallery/app-*.jpg are the ongem-app device
// captures of the OG-028 run (ongem-engineering specs/OG-028-founder-app-banking/outputs/test-runs/2026-10-29-screens).
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5190';
const out = 'src/assets/public/gallery';
const browser = await chromium.launch();
const errors = [];
const clip = { x: 248, y: 0, width: 1040, height: 760 };

async function start(query = '') {
  const ctx = await browser.newContext({
    viewport: { width: 1288, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/sign-in${query}`);
  await page.getByTestId('explore-demo').click();
  await page.getByTestId('home-total').waitFor();
  // The demo bar (PS-019) is not part of the product screen.
  await page.addStyleTag({ content: '.pub-demobar { display: none !important; }' });
  return { ctx, page };
}

async function go(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(700);
}

async function stepUp(page) {
  const code = page.getByTestId('reverify-code');
  if (await code.isVisible().catch(() => false)) {
    await code.fill('123456');
    await page.getByTestId('reverify-confirm').click();
    await page.waitForTimeout(600);
  }
}

async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/web-${name}.jpg`, type: 'jpeg', quality: 82, clip });
}

{
  const { ctx, page } = await start();
  await go(page, '/onboarding');
  await shot(page, 'onboarding');
  await go(page, '/payments/top-up');
  await page.getByTestId('topup-amount').fill('1500.00');
  await shot(page, 'add-money');
  await go(page, '/cards');
  await page.getByTestId('card-crd_demo_dana').click();
  await shot(page, 'card');
  await ctx.close();
}
{
  const { ctx, page } = await start('?demo=solo');
  await go(page, '/payments/top-up');
  await page.getByTestId('topup-amount').fill('800.00');
  await page.getByTestId('topup-review-button').click();
  await page.getByTestId('topup-send').click();
  await page.waitForTimeout(500);
  await stepUp(page);
  await page.getByTestId('payment-status-line').waitFor();
  await shot(page, 'ongem-approves');
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
console.log(`gallery screens in ${out}`);

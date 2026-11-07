// OG-032 R7: captures the public site's product screenshots from demo mode (sample data only) at 1440 x 900.
// Run with the dev server up: `npx vite --port 5191 --strictPort`, then `node scripts/public-screenshots.mjs [base]`.
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5191';
const out = 'src/assets/public';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/sign-in`);
await page.getByTestId('explore-demo').click();
await page.getByTestId('home-total').waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/screenshot-home.png` });
await page.getByTestId('nav-payments').first().click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/screenshot-payments.png` });
await browser.close();
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
console.log(`screenshots in ${out}`);

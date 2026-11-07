import { expect, test } from '@playwright/test';

/** OG-032 R17 to R25 in a real browser: the UI Skills review fixes on the public site. */
test('hero_proof_and_product_above_the_fold_at_1280x800_OG_032_AC_R18_2', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  for (const id of ['hero-get-started', 'hero-proof', 'hero-stage']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.y, id).toBeLessThan(800);
  }
  const h1 = await page.getByRole('heading', { level: 1 }).boundingBox();
  const lineHeight = await page
    .getByRole('heading', { level: 1 })
    .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(Math.round(h1!.height / lineHeight)).toBeLessThanOrEqual(2);
});

test('mobile_lede_is_two_lines_OG_032_AC_R20_2', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.goto('/');
  const lede = page.locator('.pub-lede--short');
  await expect(lede).toBeVisible();
  const lines = await lede.evaluate(
    (el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
  );
  expect(Math.round(lines)).toBeLessThanOrEqual(2);
  await expect(page.locator('.pub-lede--full')).toBeHidden();
});

test('feature_screens_never_blank_OG_032_AC_R17_2', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('[data-testid^="feature-row-"]').first().locator('img:visible').first();
  await first.scrollIntoViewIfNeeded();
  await expect
    .poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
});

test('security_band_shape_behind_the_cards_OG_032_AC_R24_1', async ({ page }) => {
  await page.goto('/security');
  const glow = page.locator('.pub-band__glow').first();
  const z = await glow.evaluate((el) => getComputedStyle(el).zIndex);
  expect(z).toBe('0');
  const cards = page.getByTestId('security-control');
  const cardZ = await cards.first().evaluate((el) => getComputedStyle(el.closest('.pub-wrap')!).zIndex);
  expect(Number(cardZ)).toBeGreaterThan(0);
});

test('dark_mode_wordmark_has_no_plate_OG_032_AC_R25_1', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-mode', 'dark'));
  const plate = await page
    .locator('.pub-header .og-logo--image')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(plate).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** OG-030 journeys in demo mode at desktop 1440x900 and mobile 390x844 (projects in playwright.config.ts). */
async function demo(page: Page) {
  await page.goto('/sign-in');
  await page.getByTestId('explore-demo').click();
  await expect(page.getByTestId('home-total')).toBeVisible();
}

async function nav(page: Page, label: string) {
  await page.locator(`[data-testid="nav-${label}"]:visible`).first().click();
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(
    r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
  ).toEqual([]);
}

async function stepUp(page: Page) {
  await page.getByTestId('reverify-code').fill('123456');
  await page.getByTestId('reverify-confirm').click();
}

test('journeys_desktop_and_mobile_AC_R1_2', async ({ page }, info) => {
  const started = Date.now();
  await demo(page);
  expect(Date.now() - started).toBeLessThan(10_000);
  const mobile = info.project.name === 'mobile';
  await expect(
    page
      .getByTestId(mobile ? 'bottom-nav' : 'shell')
      .locator('a', { hasText: 'Accounts' })
      .first(),
  ).toBeVisible();
  await expect(page.locator('.fw-side')).toBeVisible({ visible: !mobile });
  await noSideScroll(page);
  await axe(page);
  await page.screenshot({ path: `e2e-output/screens/${info.project.name}-home.png`, fullPage: true });

  await nav(page, 'accounts');
  await page.getByTestId('account-acc_demo_ops').click();
  await expect(page.getByTestId('account-detail')).toBeVisible();
  await page.getByTestId('statement-2026-09').click();
  await expect(page.getByTestId('statement-view')).toContainText('US$98,700.00');
  await page.keyboard.press('Escape');
  await noSideScroll(page);
  await page.screenshot({ path: `e2e-output/screens/${info.project.name}-account.png`, fullPage: true });

  await nav(page, 'payments');
  await page.getByTestId('new-payment').click();
  await page.getByTestId('payment-recipient').selectOption('rcp_demo_acme');
  await page.getByTestId('payment-amount').fill('250.00');
  await page.getByTestId('payment-review-button').click();
  await page.getByTestId('payment-send').click();
  await stepUp(page);
  await expect(page.getByTestId('payment-detail')).toContainText('Submitted');
  await axe(page);
  await page.screenshot({ path: `e2e-output/screens/${info.project.name}-payment-sent.png`, fullPage: true });

  await nav(page, 'cards');
  await page.getByTestId('card-crd_demo_dana').click();
  await page.getByTestId('card-freeze').click();
  await stepUp(page);
  await expect(page.getByTestId('card-state')).toHaveText('Frozen');

  await nav(page, 'support');
  await page.getByTestId('ticket-new').click();
  await page.getByTestId('ticket-subject').fill('Card for a contractor');
  await page.getByTestId('ticket-body').fill('Can we get a virtual card?');
  await page.getByTestId('ticket-send').click();
  await expect(page.getByTestId('ticket-thread')).toContainText('Can we get a virtual card?');
  await noSideScroll(page);
  await page.screenshot({ path: `e2e-output/screens/${info.project.name}-support.png`, fullPage: true });
});

test('storage_holds_no_secrets_AC_R10_2', async ({ page }) => {
  await demo(page);
  await nav(page, 'accounts');
  await page.getByTestId('account-acc_demo_ops').click();
  await nav(page, 'payments');
  await page.getByTestId('new-payment').click();
  await page.getByTestId('payment-recipient').selectOption('rcp_demo_acme');
  await page.getByTestId('payment-amount').fill('99.00');
  await page.getByTestId('payment-review-button').click();
  await page.getByTestId('payment-send').click();
  await stepUp(page);
  await expect(page.getByTestId('payment-detail')).toBeVisible();
  const stored = await page.evaluate(
    () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  );
  expect(stored).not.toMatch(/US\$|\d{4,}|token|Bearer|eyJ/i);
});

test('dev_url_and_api_health_AC_R11_1', async ({ page, request }) => {
  test.skip(!process.env.E2E_DEV, 'runs against the deployed dev URL only (E2E_BASE_URL with E2E_DEV=1)');
  const health = await request.get('/api-dev/actuator/health');
  expect((await health.json()).status).toBe('UP');
  await demo(page);
});

test('assistant_widget_AC_R4_4', async ({ page }, info) => {
  await demo(page);
  await expect(page.getByTestId('privacy-line')).toHaveCount(0);
  await page.getByTestId('assistant-open').click();
  await page.getByTestId('assistant-input').fill('What is my balance?');
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('assistant-reply').last()).toContainText('Operating •••• 4821');
  await page.getByTestId('assistant-input').fill('Transfer $100 to Tax reserve');
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('assistant-draft').last()).toContainText(
    'Move US$100.00 from Operating to Tax reserve',
  );
  await axe(page);
  await page.screenshot({ path: `e2e-output/screens/${info.project.name}-assistant-draft.png` });
  await page.getByTestId('assistant-review').last().click();
  await expect(page.getByTestId('payment-amount')).toHaveValue('100.00');
  await page.getByTestId('assistant-open').click();
  await page.getByTestId('payment-review-button').click();
  await page.getByTestId('payment-send').click();
  await stepUp(page);
  await expect(page.getByTestId('payment-detail')).toContainText('Settled');
  await page.getByTestId('assistant-open').click();
  await expect(page.getByTestId('assistant-draft-state').last()).toHaveText('Confirmed by you');
  await noSideScroll(page);
  await page.screenshot({ path: `e2e-output/screens/${info.project.name}-assistant-confirmed.png` });
});

test('WEB-SEC-05 security headers are served and the journey runs under the CSP', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  page.on('pageerror', (e) => violations.push(e.message));
  const res = await page.goto('/sign-in');
  const h = res!.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).toContain("object-src 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('strict-origin');
  expect(h['permissions-policy']).toContain('camera=()');
  await page.getByTestId('explore-demo').click();
  await expect(page.getByTestId('home-total')).toBeVisible();
  await expect(page.getByTestId('recording-session')).not.toBeAttached();
  await nav(page, 'accounts');
  await page.getByTestId('account-acc_demo_ops').click();
  await expect(page.getByTestId('account-detail')).toBeVisible();
  await page.getByTestId('assistant-open').click();
  await page.getByTestId('assistant-input').fill('What is my balance?');
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('assistant-reply').last()).toContainText('Operating');
  await nav(page, 'settings');
  await page.getByRole('combobox', { name: 'Theme' }).selectOption({ index: 1 });
  await page.waitForTimeout(500);
  expect(violations).toEqual([]);
});

test('PERF-WEB-04 the public home is in the HTML and paints before the script, without a shift (OG-032)', async ({
  page,
}) => {
  const res = await page.request.get('/');
  const html = await res.text();
  expect(html).toContain('data-testid="public-home"');
  expect(html).toContain('data-testid="hero-get-started"');
  // The static screen carries no founder data: nothing from the signed-in app is rendered.
  expect(html).not.toContain('data-testid="home-total"');
  await page.route(/\/assets\/index-.*\.js$/, async (r) => {
    await new Promise((s) => setTimeout(s, 800));
    await r.continue();
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>)
        if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByTestId('public-home')).toBeVisible({ timeout: 700 });
  // The static links do nothing until the app has rendered over them.
  await page.waitForFunction(() =>
    Object.keys(document.getElementById('root') ?? {}).some((k) => k.startsWith('__reactContainer')),
  );
  await axe(page);
  await page.getByTestId('hero-get-started').click();
  await expect(page.getByTestId('privacy-line')).toBeVisible();
  await page.getByTestId('explore-demo').click();
  await expect(page.getByTestId('home-total')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
});

test('public_pages_axe_and_no_sideways_scroll_OG_032_N1_N3', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of ['/', '/product', '/security', '/partners']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await axe(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    // The full-page capture shows every section settled: scroll so lazy screens load, then wait for each image.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      window.scrollTo(0, 0);
    });
    // Only the images on show: each product screen has a desktop and a phone version, one hidden per width (UX-08).
    await page.waitForFunction(() =>
      Array.from(document.images)
        .filter((i) => i.getClientRects().length > 0)
        .every((i) => i.complete && i.naturalWidth > 0),
    );
    await page.waitForTimeout(700);
    await page.screenshot({
      path: `e2e-output/public-${info.project.name}${path === '/' ? '-home' : path.replace('/', '-')}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test('public_pages_colour_contrast_light_and_dark_OG_032_N1_R13', async ({ page }) => {
  // Reduced motion: nothing is mid-fade when axe measures, and the reveal never hides content.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    for (const path of ['/', '/product', '/security', '/partners']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const dark = await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme === 'dark',
      );
      if ((theme === 'dark') !== dark) await page.getByTestId('theme-toggle').click();
      await expect(page.locator('.pub--motion')).toHaveCount(0);
      const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(
        r.violations.flatMap((v) => v.nodes.map((n) => `${theme} ${path} ${n.target.join(' ')}`)),
      ).toEqual([]);
    }
  }
});

/** Contrast ratio of two CSS colours (WCAG relative luminance); rgb() or rgba() strings from getComputedStyle. */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
    const ch = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r!) + 0.7152 * ch(g!) + 0.0722 * ch(bl!);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

test('UX_01 headings on dark brand bands read against the band, light and dark', async ({ page }) => {
  // axe cannot measure text over the band's glow image, so the band's own colour is the background here.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    for (const path of ['/', '/product', '/security', '/partners']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const dark = await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme === 'dark',
      );
      if ((theme === 'dark') !== dark) await page.getByTestId('theme-toggle').click();
      const pairs = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('.pub-band h2, .pub-band h3, .pub-band p')).map(
          (el) => ({
            text: (el.textContent ?? '').slice(0, 30),
            fg: getComputedStyle(el).color,
            bg: getComputedStyle(el.closest('.pub-band')!).backgroundColor,
          }),
        ),
      );
      for (const p of pairs)
        expect(contrast(p.fg, p.bg), `${theme} ${path} "${p.text}"`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('UX_02 a public page opens at its top with the header and the first heading in view', async ({
  page,
}) => {
  for (const path of ['/', '/product', '/security', '/partners', '/sign-in']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY), path).toBe(0);
    const header = await page.locator('.pub-header').boundingBox();
    const h1 = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(header!.y, path).toBe(0);
    expect(h1!.y, `${path} heading under the header`).toBeGreaterThanOrEqual(header!.height);
  }
});

test('UX_03 the hero phone never covers the web screen; a phone sees the phone screen', async ({
  page,
}, info) => {
  await page.goto('/');
  const phone = await page.locator('.pub-hero__phone').boundingBox();
  if (info.project.name === 'mobile') {
    await expect(page.locator('.pub-hero__desk')).toBeHidden();
    expect(phone!.width).toBeGreaterThan(200);
  } else {
    const desk = await page.locator('.pub-hero__desk').boundingBox();
    expect(phone!.x).toBeGreaterThanOrEqual(desk!.x + desk!.width - 1);
  }
});

test('UX_09 the assistant button never covers the last field or button of a form', async ({ page }) => {
  await demo(page);
  await nav(page, 'support');
  await page.getByTestId('ticket-new').click();
  const send = page.getByRole('button', { name: 'Send request' });
  await send.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const b = (await send.boundingBox())!;
  const fab = (await page.locator('.fw-assistant').boundingBox())!;
  const overlaps =
    b.x < fab.x + fab.width && fab.x < b.x + b.width && b.y < fab.y + fab.height && fab.y < b.y + b.height;
  expect(overlaps).toBe(false);
});

test('UX_12 the top bar is one row on a phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout');
  await demo(page);
  const bar = (await page.locator('.fw-topbar').boundingBox())!;
  expect(bar.height).toBeLessThanOrEqual(72);
  await expect(page.locator('.fw-topbar__logo')).toBeVisible();
});

test('UX_13 the notch of a phone frame sits in the bezel, above the screen', async ({ page }) => {
  await page.goto('/product');
  const frames = page.locator('.pub-phone:visible');
  const n = await frames.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const f = frames.nth(i);
    await f.scrollIntoViewIfNeeded();
    const notch = (await f.locator('.pub-phone__notch').boundingBox())!;
    const img = (await f.locator('img').boundingBox())!;
    expect(notch.y + notch.height).toBeLessThanOrEqual(img.y + 0.5);
  }
});

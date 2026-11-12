import { expect, test } from '@playwright/test';

/**
 * OG-037 AC-R9.1 in a real browser on the local preview (built with the dev collector): the exporter loads after first
 * paint, an uncaught error leaves as an OTLP log with the route template and no query string, and the page's CSP lets
 * the request go. The collector is stood in for here (it answers CORS only for the deployed origins); the same body is
 * posted to the real collector by `src/telemetry/live.test.ts`.
 */
test('OG-037 AC-R9.1 an uncaught error reaches the collector without query string or ids', async ({
  page,
}) => {
  const bodies: { path: string; body: string }[] = [];
  const csp: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) csp.push(m.text());
  });
  await page.route('https://otel-dev.platform.ongem.com/**', async (route) => {
    const req = route.request();
    const cors = {
      'access-control-allow-origin': new URL(page.url()).origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (req.method() === 'POST')
      bodies.push({ path: new URL(req.url()).pathname, body: req.postData() ?? '' });
    await route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: '{"partialSuccess":{}}',
    });
  });
  await page.goto('/payments/pay_8f2a91c0?company=cmp_bad078ed36794af3adcf&email=jane@example.com');
  await page.waitForLoadState('load');
  // The exporter chunk loads on idle after load.
  await page.waitForFunction(() =>
    performance.getEntriesByType('resource').some((e) => /\/assets\/start-[\w-]+\.js$/.test(e.name)),
  );
  await page.evaluate(() => {
    setTimeout(() => {
      throw new TypeError('no account 123456789 for jane@example.com');
    });
  });
  // Hiding the page flushes the queue at once.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => bodies.filter((b) => b.path === '/v1/logs').length).toBeGreaterThan(0);
  const logs = bodies
    .filter((b) => b.path === '/v1/logs')
    .map((b) => b.body)
    .join('\n');
  expect(logs).toContain('"service.name"');
  expect(logs).toContain('ongem-web');
  expect(logs).toContain('TypeError');
  expect(logs).not.toMatch(/123456789|jane@example\.com|cmp_bad078|company=|pay_8f2a91c0/);
  expect(csp).toEqual([]);
});

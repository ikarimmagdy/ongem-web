// Cold first load at phone width on a throttled connection (Lighthouse's devtools mobile profile: 562.5 ms request latency,
// 1,474.56 Kbps down, 675 Kbps up, 4x CPU), reading FCP, LCP and CLS from the page. Usage: node scripts/lcp-probe.mjs [url] [runs]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:5190/';
const runs = Number(process.argv[3] ?? 3);
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome' });
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 562.5,
    downloadThroughput: (1474.56 * 1024) / 8,
    uploadThroughput: (675 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const w = window;
    w.__m = { lcp: [], cls: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        w.__m.lcp.push([Math.round(e.startTime), e.element?.className ?? e.url]);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) w.__m.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const m = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    return { fcp: Math.round(fcp), ...window.__m, cls: Math.round(window.__m.cls * 1000) / 1000 };
  });
  const last = m.lcp[m.lcp.length - 1] ?? [0, ''];
  console.log(`run ${i + 1}: FCP ${m.fcp} ms, LCP ${last[0]} ms (${last[1]}), CLS ${m.cls}`);
  await ctx.close();
}
await browser.close();

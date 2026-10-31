import { defineConfig, devices } from '@playwright/test';

/** Founder web e2e: the local preview in demo mode by default (`npm run preview`), the dev URL with E2E_BASE_URL. */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5190';

export default defineConfig({
  testDir: './src/test',
  testMatch: '**/*.e2e.ts',
  outputDir: './e2e-output/results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'e2e-output/report.json' }]],
  use: {
    baseURL,
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['Pixel 7'].userAgent,
      },
    },
  ],
});

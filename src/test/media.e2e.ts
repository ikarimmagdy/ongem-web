import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** OG-032 R14 to R16 in a real browser, desktop and mobile, under the CSP the preview serves. */
const PAGES = ['/blog', '/blog/approvals-and-the-one-person-company', '/videos'];

test('media_pages_axe_and_no_sideways_scroll_OG_032_R14_2', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
    const r = await new AxeBuilder({ page }).analyze();
    expect(
      r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${path} ${v.id}`),
    ).toEqual([]);
  }
});

test('a_walkthrough_plays_with_captions_under_the_CSP_OG_032_AC_R16_5', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  await page.goto('/videos');
  const video = page.locator('[data-testid="video-send-a-payment"] video');
  await video.scrollIntoViewIfNeeded();
  const played = await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
    await new Promise((r) => setTimeout(r, 1500));
    const cues = v.textTracks[0]?.cues?.length ?? 0;
    return { time: v.currentTime, cues, mode: v.textTracks[0]?.mode };
  });
  expect(played.time).toBeGreaterThan(0.5);
  expect(played.cues).toBeGreaterThan(3);
  expect(played.mode).toBe('showing');
  expect(violations).toEqual([]);
});

test('blog_post_links_to_its_video_OG_032_AC_R15_2', async ({ page }) => {
  await page.goto('/blog');
  await page
    .getByRole('link', { name: /one-person company/ })
    .first()
    .click();
  await expect(page.getByTestId('public-post')).toBeVisible();
  await page.getByRole('link', { name: 'OnGem approving for a one-person company' }).click();
  await expect(page).toHaveURL(/\/videos#ongem-approves-one-person-company$/);
  await expect(page.getByTestId('video-ongem-approves-one-person-company')).toBeVisible();
});

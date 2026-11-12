// OG-032 R16: records the founder walkthrough videos from demo mode (sample data only) with headless Chromium. The
// journeys follow the OG-035 shell and the 12 Nov 2026 review (PS-005): Payments tabs with Send and Add money in the
// page header, a second step that names what it confirms, the confirmation after sending, branded card faces and the
// dispute form from a card charge.
// Each video is a scripted, paced journey with on-screen captions; the same captions are written as a WebVTT track
// and a poster frame is captured. Run with the dev server up (`npm run dev`), then
// `node scripts/record-videos.mjs [base]` (default http://localhost:5190). Writes public/videos/<id>.webm,
// <id>.vtt and <id>.jpg, and src/public/media/videos.json (durations and sizes). ffmpeg is not required: Chromium
// records WebM (VP8), which every current browser plays.
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5190';
const out = 'public/videos';
const tmp = 'e2e-output/video-tmp';
const PACE = 1700;
mkdirSync(out, { recursive: true });

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

/** Caption overlay injected into the page; brand navy with white text, bottom centre. */
async function caption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById('og-video-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'og-video-caption';
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'fixed',
        left: '50%',
        bottom: '28px',
        transform: 'translateX(-50%)',
        maxWidth: 'min(88vw, 760px)',
        padding: '12px 20px',
        borderRadius: '12px',
        background: 'rgba(11, 16, 53, 0.92)',
        color: '#ffffff',
        font: '600 18px/1.4 Inter, system-ui, sans-serif',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(11, 16, 53, 0.35)',
        zIndex: '2147483647',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

async function go(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(600);
}

/** The second step, held long enough to read what it confirms (the action, amount and payee), then answered. */
async function stepUp(page) {
  const code = page.getByTestId('reverify-code');
  await code.waitFor({ timeout: 4000 }).catch(() => {});
  if (await code.isVisible().catch(() => false)) {
    await page.waitForTimeout(1400);
    await code.pressSequentially('123456', { delay: 60 });
    await page.getByTestId('reverify-confirm').click();
  }
}

async function demo(page, query = '') {
  await page.goto(`${base}/sign-in${query}`);
  await page.getByTestId('explore-demo').click();
  await page.getByTestId('home-total').waitFor();
}

async function nav(page, label) {
  await page.locator(`[data-testid="nav-${label}"]:visible`).first().click();
  await page.waitForTimeout(500);
}

const type = (loc, text) => loc.pressSequentially(text, { delay: 55 });

/** Picks [preferred] when the list has it, else its first real choice, so new sample data does not stop a recording. */
async function choose(select, preferred) {
  const values = await select.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
  await select.selectOption(values.includes(preferred) ? preferred : values[0]);
}

/** Payments, then one of the page header actions: Send or Add money (FA-023). */
async function paymentsAction(page, action) {
  await nav(page, 'payments');
  await page.getByTestId('payments-tabs').waitFor();
  await page.waitForTimeout(700);
  await page.getByTestId(`payments-tab-${action}`).click();
}

/** Opens the first card in the list, or the one named, and waits for its face. */
async function openCard(page, id) {
  const named = page.getByTestId(`card-${id}`);
  const card = (await named.count()) ? named : page.locator('[data-testid^="card-crd_"]').first();
  await card.click();
  await page.getByTestId('card-face').first().waitFor();
}

/** The videos: id, title, summary, viewport, steps. Each step is [caption, action]. */
const VIDEOS = [
  {
    id: 'sign-up-and-onboarding',
    title: 'From sign-up to an application at the bank',
    summary:
      'Start on the OnGem site, open the demo, confirm your company and owners, accept the disclosures and submit.',
    viewport: DESKTOP,
    steps: [
      ['OnGem: business banking for founders', async (p) => p.goto(`${base}/`)],
      [
        'Get started opens sign-up. This walkthrough uses the demo.',
        async (p) => {
          await p.getByTestId('hero-get-started').click();
          await p.getByTestId('explore-demo').waitFor();
        },
      ],
      [
        'Explore the demo on sample data',
        async (p) => {
          await p.getByTestId('explore-demo').click();
          await p.getByTestId('home-total').waitFor();
        },
      ],
      ['Your application: company, owners and the bank’s disclosures', async (p) => go(p, '/onboarding')],
      [
        'Each owner adds their identity details',
        async (p) => {
          const ssn = p.locator('[data-testid^="owner-ssn-own_"]').first();
          if (await ssn.isVisible().catch(() => false)) {
            await ssn.click();
            await type(ssn, '123456789');
            await p.locator('[data-testid^="owner-ssn-save-"]').first().click();
            await stepUp(p);
          }
        },
      ],
      [
        'Confirm the company details',
        async (p) => {
          const b = p.getByTestId('application-confirm');
          if (await b.isVisible().catch(() => false)) await b.click();
          await stepUp(p);
        },
      ],
      [
        'Read and accept each of the bank’s disclosures',
        async (p) => {
          for (const id of ['dsv_demo_esign', 'dsv_demo_terms']) {
            await p.getByTestId(`disclosure-${id}`).click();
            await p.waitForTimeout(700);
            await p.getByTestId('disclosure-accept').click();
            await p.waitForTimeout(500);
            await stepUp(p);
          }
        },
      ],
      [
        'Submit: Piermont Bank verifies the business and its owners',
        async (p) => {
          const b = p.getByTestId('application-submit');
          if (await b.isVisible().catch(() => false)) await b.click();
          await stepUp(p);
        },
      ],
      [
        'You see where the bank is up to, and add an ID document if it asks',
        async (p) => p.waitForTimeout(400),
      ],
    ],
  },
  {
    id: 'send-a-payment',
    title: 'Send an ACH payment',
    summary:
      'Pick a recipient, enter the amount, review and confirm it is you; then follow it from sent to settled.',
    viewport: DESKTOP,
    steps: [
      [
        'Payments: all payments, scheduled, approvals and recipients',
        async (p) => {
          await demo(p);
          await nav(p, 'payments');
          await p.getByTestId('payments-tabs').waitFor();
        },
      ],
      [
        'Send is at the top of Payments',
        async (p) => {
          await p.getByTestId('payments-tab-send').click();
          await p.getByTestId('payment-form').waitFor();
        },
      ],
      [
        'Choose a recipient you have already added',
        async (p) => choose(p.getByTestId('payment-recipient'), 'rcp_demo_acme'),
      ],
      [
        'Enter the amount: your available balance shows under From',
        async (p) => type(p.getByTestId('payment-amount'), '250.00'),
      ],
      [
        'Review the payment before it goes',
        async (p) => {
          await p.getByTestId('payment-review-button').click();
          await p.getByTestId('payment-review').waitFor();
        },
      ],
      [
        'Send. The second step names the payment you are confirming',
        async (p) => {
          await p.getByTestId('payment-send').click();
          await stepUp(p);
        },
      ],
      ['Sent: how much, to whom, and when it arrives', async (p) => p.getByTestId('payment-sent').waitFor()],
      [
        'Follow it from sent to settled',
        async (p) =>
          p
            .getByTestId('payment-timeline')
            .scrollIntoViewIfNeeded()
            .catch(() => {}),
      ],
    ],
  },
  {
    id: 'add-money-and-approve',
    title: 'Add money from another bank, with a second approval',
    summary:
      'Pull money from your verified account at another bank by ACH; a second person in your company approves it.',
    viewport: DESKTOP,
    steps: [
      [
        'Add money: from your verified account at another bank',
        async (p) => {
          await demo(p);
          await paymentsAction(p, 'add_money');
          await p.getByTestId('topup-form').waitFor();
        },
      ],
      ['Enter how much to pull in', async (p) => type(p.getByTestId('topup-amount'), '1500.00')],
      ['Review it', async (p) => p.getByTestId('topup-review-button').click()],
      [
        'Confirm it is you: the second step names the top-up',
        async (p) => {
          await p.getByTestId('topup-send').click();
          await stepUp(p);
        },
      ],
      [
        'A second person in your company approves it before the bank pulls the money',
        async (p) => p.getByTestId('payment-detail').waitFor(),
      ],
      [
        'The approver approves, with their own second step',
        async (p) => {
          const b = p.getByTestId('payment-approve');
          if (await b.isVisible().catch(() => false)) {
            await b.click();
            await stepUp(p);
          }
        },
      ],
      ['Approved: the bank pulls the money by ACH', async (p) => p.waitForTimeout(400)],
    ],
  },
  {
    id: 'ongem-approves-one-person-company',
    title: 'One-person company: OnGem approves',
    summary: 'When no one else in your company can approve, OnGem approves your payment or top-up.',
    viewport: DESKTOP,
    steps: [
      [
        'A company with one person who can approve',
        async (p) => {
          await demo(p, '?demo=solo');
          await paymentsAction(p, 'add_money');
          await p.getByTestId('topup-form').waitFor();
        },
      ],
      [
        'Add money from your account at another bank',
        async (p) => type(p.getByTestId('topup-amount'), '800.00'),
      ],
      [
        'Review and confirm it is you',
        async (p) => {
          await p.getByTestId('topup-review-button').click();
          await p.waitForTimeout(500);
          await p.getByTestId('topup-send').click();
          await stepUp(p);
        },
      ],
      [
        'No second person needed: OnGem approves it for you',
        async (p) => p.getByTestId('payment-status-line').waitFor(),
      ],
      ['Nothing moves until it is approved', async (p) => p.waitForTimeout(400)],
    ],
  },
  {
    id: 'cards-freeze-and-details',
    title: 'Virtual cards: freeze, unfreeze and see the details',
    summary:
      'Freeze a card the moment something looks wrong, unfreeze it, and open its details in the bank’s secure window.',
    viewport: DESKTOP,
    steps: [
      [
        'Your virtual cards, each on the OnGem card face',
        async (p) => {
          await demo(p);
          await nav(p, 'cards');
        },
      ],
      ['Open a card', async (p) => openCard(p, 'crd_demo_dana')],
      [
        'Freeze it in one tap',
        async (p) => {
          await p.getByTestId('card-freeze').click();
          await p.waitForTimeout(600);
          await stepUp(p);
        },
      ],
      [
        'Unfreeze it when you are ready',
        async (p) => {
          await p.getByTestId('card-unfreeze').waitFor();
          await p.waitForTimeout(800);
          await p.getByTestId('card-unfreeze').click();
          await p.waitForTimeout(600);
          await stepUp(p);
        },
      ],
      [
        'Card details open in the bank’s secure window; OnGem never sees the number',
        async (p) => {
          const actions = p.getByTestId('card-widget-actions').getByRole('button').first();
          if (await actions.isVisible().catch(() => false)) {
            await actions.click();
            await p.waitForTimeout(600);
            await stepUp(p);
          }
        },
      ],
      ['The window closes by itself after a few minutes', async (p) => p.waitForTimeout(400)],
    ],
  },
  {
    id: 'notifications-and-settings',
    title: 'Notifications and your choices',
    summary: 'See what needs you in one inbox, and choose email or text for each kind of notice.',
    viewport: DESKTOP,
    steps: [
      ['The bell shows what needs you', async (p) => demo(p)],
      [
        'One inbox: approvals, payments, cards and your application',
        async (p) => p.getByTestId('notice-bell').click(),
      ],
      [
        'Mark everything read',
        async (p) => {
          const b = p.getByTestId('notices-read-all');
          if (await b.isEnabled().catch(() => false)) await b.click();
        },
      ],
      [
        'Settings: choose email or text for each kind of notice',
        async (p) => {
          await nav(p, 'settings');
          await p.getByTestId('notice-choices').scrollIntoViewIfNeeded();
        },
      ],
      ['The important ones stay on', async (p) => p.waitForTimeout(400)],
      [
        'Add a phone number for texts and verify it with a code',
        async (p) => {
          await p.getByTestId('sms-number').scrollIntoViewIfNeeded();
          await type(p.getByTestId('sms-number'), '+12025550143');
          await p.getByTestId('sms-number-save').click();
          await p.waitForTimeout(600);
          await stepUp(p);
          const code = p.getByTestId('sms-code');
          if (await code.isVisible().catch(() => false)) {
            await type(code, '246810');
            await p.getByTestId('sms-code-verify').click();
          }
        },
      ],
    ],
  },
  {
    id: 'support-and-disputes',
    title: 'Get help and dispute a card payment',
    summary:
      'Raise a support ticket or dispute a charge from the card, and follow the replies in one thread.',
    viewport: DESKTOP,
    steps: [
      [
        'Something wrong with a card payment?',
        async (p) => {
          await demo(p);
          await nav(p, 'cards');
          await openCard(p, 'crd_demo_dana');
        },
      ],
      [
        'Dispute a charge straight from the card',
        async (p) => {
          await p.getByTestId('card-dispute').click();
          await p.getByTestId('dispute-form').waitFor();
        },
      ],
      [
        'Pick the charge and say what went wrong',
        async (p) => {
          await p.locator('[data-testid^="dispute-charge-"]').first().check();
          await p.waitForTimeout(500);
          await p.getByTestId('dispute-reason').selectOption('not_mine');
          await type(p.getByTestId('dispute-details'), 'I did not make this purchase.');
        },
      ],
      [
        'Send it to OnGem support with every fact the bank needs',
        async (p) => p.getByTestId('dispute-send').click(),
      ],
      [
        'Follow the replies and the status in one thread',
        async (p) => p.getByTestId('ticket-thread').waitFor(),
      ],
    ],
  },
  {
    id: 'phone-send-a-payment',
    title: 'On your phone: send a payment',
    summary: 'The same payment, with the same second step, on a phone.',
    viewport: PHONE,
    phone: true,
    steps: [
      ['OnGem on your phone', async (p) => demo(p)],
      [
        'Pay, from the tab bar',
        async (p) => {
          await p.getByTestId('tab-pay').click();
          await p.getByTestId('payment-form').waitFor();
        },
      ],
      [
        'A recipient and the amount',
        async (p) => {
          await choose(p.getByTestId('payment-recipient'), 'rcp_demo_acme');
          await type(p.getByTestId('payment-amount'), '120.00');
        },
      ],
      [
        'Review it',
        async (p) => {
          await p.getByTestId('payment-review-button').click();
          await p.getByTestId('payment-review').waitFor();
        },
      ],
      [
        'Send and confirm it is you',
        async (p) => {
          await p.getByTestId('payment-send').click();
          await stepUp(p);
        },
      ],
      ['Sent: the confirmation says when it arrives', async (p) => p.getByTestId('payment-sent').waitFor()],
    ],
  },
];

const vtt = (ms) => {
  const d = new Date(ms);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
};

const only = process.argv[3]?.split(',');
const browser = await chromium.launch();
const results = [];
const errors = [];
for (const v of VIDEOS) {
  if (only && !only.includes(v.id)) continue;
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: v.viewport,
    deviceScaleFactor: 1,
    isMobile: Boolean(v.phone),
    hasTouch: Boolean(v.phone),
    recordVideo: { dir: tmp, size: v.viewport },
  });
  // The demo bar (PS-019) is not part of the product being shown, as in the screenshots.
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.pub-demobar { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${v.id}: ${e}`));
  const t0 = Date.now();
  const cues = [];
  let posterTaken = false;
  for (const [i, [text, act]] of v.steps.entries()) {
    // The caption leads: it says what is about to happen, then the action runs while it is on screen. A full page load
    // drops the overlay, so it is set again after the action.
    await caption(page, text).catch(() => {});
    const start = Date.now() - t0;
    await page.waitForTimeout(500);
    try {
      await act(page);
    } catch (e) {
      errors.push(`${v.id} step ${i + 1} "${text}": ${String(e).split('\n')[0]}`);
    }
    await caption(page, text).catch(() => {});
    await page.waitForTimeout(PACE);
    cues.push({ start, end: Date.now() - t0, text });
    if (!posterTaken && i === Math.floor(v.steps.length / 2)) {
      // A clean poster: the screen without the caption, whose title the site shows under the video (PS-020).
      await page.evaluate(() =>
        document.getElementById('og-video-caption')?.style.setProperty('display', 'none'),
      );
      await page.screenshot({ path: join(out, `${v.id}.jpg`), type: 'jpeg', quality: 80 });
      await page.evaluate(() => document.getElementById('og-video-caption')?.style.removeProperty('display'));
      posterTaken = true;
    }
  }
  await page.waitForTimeout(800);
  const ms = Date.now() - t0;
  await ctx.close();
  const file = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  renameSync(join(tmp, file), join(out, `${v.id}.webm`));
  writeFileSync(
    join(out, `${v.id}.vtt`),
    `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${vtt(c.start)} --> ${vtt(c.end)}\n${c.text}\n`).join('\n')}`,
  );
  results.push({
    // The title and summary shown on the site are content entries (web.videos.<id>.*, OG-033).
    id: v.id,
    seconds: Math.round(ms / 1000),
    bytes: statSync(join(out, `${v.id}.webm`)).size,
    width: v.viewport.width,
    height: v.viewport.height,
  });
  console.log(
    `${v.id}: ${Math.round(ms / 1000)} s, ${(statSync(join(out, `${v.id}.webm`)).size / 1e6).toFixed(1)} MB`,
  );
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
if (!only) writeFileSync('src/public/media/videos.json', `${JSON.stringify(results, null, 2)}\n`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

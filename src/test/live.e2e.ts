/// <reference types="node" />
import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The live founder journey against dev (api-dev.ongem.com on the Synctera sandbox) as a real Clerk test founder of the
 * OnGem Founder instance: sign-up or sign-in with TOTP, onboarding to a bank decision, then daily banking. Skipped unless
 * E2E_LIVE=1, so the normal suite stays offline. The founder's company must exist first (ops test application with the
 * founder's email). Credentials come from `.env.e2e` (gitignored): E2E_LIVE_EMAIL, E2E_LIVE_PASSWORD and
 * E2E_LIVE_TOTP_SECRET, which this spec writes itself when it sets up the authenticator on sign-up.
 *
 * Every API response is logged to e2e-output/live-api.json (method, path, status and the problem code); any 4xx or 5xx
 * that is not an expected refusal fails the run. Step outcomes go to e2e-output/live-steps.json.
 */
const LIVE = process.env.E2E_LIVE === '1';
const ENV_FILE = '.env.e2e';
const OUT = 'e2e-output';
const SSN = process.env.E2E_LIVE_SSN ?? '600002071';
const DECISION_MINUTES = Number(process.env.E2E_LIVE_DECISION_MINUTES ?? 20);
const RECIPIENT = process.env.E2E_LIVE_RECIPIENT ?? 'Live Test Supplier';
/** Minutes to wait after sign-in before the money and card steps, so the API's step-up window has passed (10 min). */
const STEP_UP_WAIT_MIN = Number(process.env.E2E_LIVE_STEPUP_WAIT_MIN ?? 0);

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

function saveEnv(key: string, value: string) {
  const env = { ...readEnv(), [key]: value };
  writeFileSync(
    ENV_FILE,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits), as in ongem-admin's e2e helpers. */
function totp(secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/[\s=]/g, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v < 0) throw new Error('TOTP secret is not base32');
    bits += v.toString(2).padStart(5, '0');
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, '0');
}

/** Clerk refuses a code twice: each 30 s window is claimed once per secret, across processes (same file as ongem-admin). */
const TOTP_STATE = `${tmpdir()}/ongem-e2e-totp-windows.json`;
function claimWindow(secret: string, window: number): boolean {
  const lock = `${TOTP_STATE}.lock`;
  for (let i = 0; i < 200; i++) {
    try {
      mkdirSync(lock);
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > 10_000) rmdirSync(lock);
      } catch {
        /* gone */
      }
      const until = Date.now() + 50;
      while (Date.now() < until) {
        /* spin */
      }
      continue;
    }
    try {
      const id = createHash('sha256').update(secret).digest('hex').slice(0, 16);
      let used: Record<string, number> = {};
      try {
        used = JSON.parse(readFileSync(TOTP_STATE, 'utf8')) as Record<string, number>;
      } catch {
        used = {};
      }
      if ((used[id] ?? -1) >= window) return false;
      used[id] = window;
      writeFileSync(TOTP_STATE, JSON.stringify(used));
      return true;
    } finally {
      rmdirSync(lock);
    }
  }
  throw new Error('TOTP window lock not acquired');
}

async function freshTotp(page: Page): Promise<string> {
  const secret = readEnv().E2E_LIVE_TOTP_SECRET ?? '';
  if (!secret) throw new Error('E2E_LIVE_TOTP_SECRET is not set');
  for (;;) {
    const w = Math.floor(Date.now() / 30_000);
    // A code with under 4 s left may expire on the way; wait for the next window.
    if (30_000 - (Date.now() % 30_000) > 4_000 && claimWindow(secret, w)) return totp(secret);
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Evidence: every API call and every step outcome.

interface ApiCall {
  at: string;
  method: string;
  path: string;
  status: number;
  code?: string;
  detail?: string;
}
interface StepOutcome {
  step: string;
  outcome: 'pass' | 'fail' | 'blocked';
  evidence: string;
}
const calls: ApiCall[] = [];
const steps: StepOutcome[] = [];

/** Refusals the app expects and handles: step-up, a request the API is still running, the device binding's first ask. */
const EXPECTED = new Set(['reverification_required', 'idempotency_in_progress']);

function writeEvidence() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/live-api.json`, JSON.stringify(calls, null, 2));
  writeFileSync(`${OUT}/live-steps.json`, JSON.stringify(steps, null, 2));
}

function record(step: string, outcome: StepOutcome['outcome'], evidence: string) {
  steps.push({ step, outcome, evidence });
  writeEvidence();
  console.log(`STEP ${outcome.toUpperCase()} ${step}: ${evidence}`);
}

function watchApi(page: Page) {
  page.on('response', async (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith('/api-dev/')) return;
    const call: ApiCall = {
      at: new Date().toISOString(),
      method: res.request().method(),
      path: url.pathname.replace(/^\/api-dev/, '') + url.search,
      status: res.status(),
    };
    if (res.status() >= 400) {
      try {
        const p = (await res.json()) as { code?: string; detail?: string };
        call.code = p.code;
        call.detail = p.detail?.slice(0, 300);
      } catch {
        /* no problem body */
      }
    }
    calls.push(call);
  });
}

/** API errors since [from] that are not expected refusals (and not in [allow], codes a step expects). */
function unexpected(from: number, allow: string[] = []) {
  return calls
    .slice(from)
    .filter((c) => c.status >= 400 && !EXPECTED.has(c.code ?? '') && !allow.includes(c.code ?? ''))
    .filter((c) => !knownInfra(c));
}

/**
 * Open infra issue, recorded in the results, not a web fault: the AWS WAF in front of api-dev answers 403 (HTML, no
 * problem code) to recording batches over 8 KB or carrying markup, which rrweb snapshots always are.
 */
function knownInfra(c: ApiCall) {
  return c.status === 403 && !c.code && /^\/v1\/recording\/sessions\/[^/]+\/events$/.test(c.path);
}

function describe(c: ApiCall) {
  return `${c.method} ${c.path} ${c.status} ${c.code ?? ''} ${c.detail ?? ''}`.trim();
}

/** Runs one journey step, records pass or fail with the API evidence, and fails on an unexpected API error. */
async function step(name: string, body: () => Promise<string>, allow: string[] = []) {
  const from = calls.length;
  await test.step(name, async () => {
    let evidence = '';
    try {
      evidence = await body();
    } catch (e) {
      const bad = unexpected(from, allow);
      record(
        name,
        'fail',
        `${(e as Error).message.split('\n')[0]}${bad.length ? ` | API: ${bad.map(describe).join('; ')}` : ''}`,
      );
      throw e;
    }
    const bad = unexpected(from, allow);
    if (bad.length) {
      record(name, 'fail', `unexpected API errors: ${bad.map(describe).join('; ')}`);
      throw new Error(`unexpected API errors in ${name}: ${bad.map(describe).join('; ')}`);
    }
    record(name, 'pass', evidence);
  });
}

class Blocked extends Error {}

// ---------------------------------------------------------------------------------------------------------------------
// Clerk: sign-up on the Account Portal, sign-in on the app, the authenticator set-up task and step-up.

async function typeCode(page: Page, input: Locator, code: string) {
  await input.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await input.pressSequentially(code, { delay: 40 });
  await expect(input)
    .toBeHidden({ timeout: 6_000 })
    .catch(async () => {
      const go = page.getByRole('button', { name: 'Continue', exact: true });
      if (await go.isVisible()) await go.click();
    });
}

/** Drives Clerk until the app shell shows: each round reads the screen Clerk is on and answers it. */
async function signInOrUp(page: Page): Promise<string> {
  const env = readEnv();
  const email = env.E2E_LIVE_EMAIL ?? '';
  const password = env.E2E_LIVE_PASSWORD ?? '';
  if (!email || !password) throw new Blocked('E2E_LIVE_EMAIL and E2E_LIVE_PASSWORD are not set in .env.e2e');
  const path: string[] = [];
  await page.goto('/');
  const shell = page.getByTestId('shell');
  const code = page.locator('input[autocomplete="one-time-code"]').first();
  const emailField = page.getByLabel('Email address');
  const passwordField = page.getByLabel('Password', { exact: true });
  const cantScan = page.getByRole('button', { name: "Can't scan QR code?" });
  for (let round = 0; round < 20; round++) {
    await expect(
      shell
        .or(code)
        .or(emailField)
        .or(passwordField)
        .or(cantScan)
        .or(page.getByText(/backup codes/i))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    if (await shell.isVisible()) return path.join(' > ');
    const text = await page.locator('body').innerText();
    if (process.env.E2E_LIVE_DEBUG)
      console.log(
        `AUTH round ${round} ${page.url()} | ${text
          .replace(/\b[A-Z2-7]{16,}\b/g, '<secret>')
          .replace(/\s+/g, ' ')
          .slice(0, 300)}`,
      );
    if (/backup codes/i.test(text) && !(await code.isVisible())) {
      path.push('backup-codes');
      const done = page.getByRole('button', { name: /^(Finish|Continue|Done)$/ }).first();
      await done.click();
      continue;
    }
    if (await cantScan.isVisible()) {
      path.push('authenticator-setup');
      await cantScan.click();
      await page.waitForTimeout(800);
      // Clerk shows the key in a read-only text box.
      const shown = (await page.getByRole('textbox').first().inputValue()).replace(/\s/g, '');
      if (!/^[A-Z2-7]{16,}=*$/i.test(shown)) throw new Error('Clerk did not show the authenticator secret');
      saveEnv('E2E_LIVE_TOTP_SECRET', shown.toUpperCase());
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(code).toBeVisible();
      await typeCode(page, code, await freshTotp(page));
      continue;
    }
    if (await code.isVisible()) {
      const totpStep = /authenticator/i.test(text);
      path.push(totpStep ? 'totp' : 'email-code');
      if (!totpStep) await expect(page.getByText(/Resend/)).toBeVisible({ timeout: 15_000 });
      await typeCode(page, code, totpStep ? await freshTotp(page) : '424242');
      continue;
    }
    if (/Create your account/.test(text) && (await emailField.isVisible())) {
      path.push('sign-up');
      if (await emailField.isEditable()) await emailField.fill(email);
      await passwordField.fill(password);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(code).toBeVisible({ timeout: 30_000 });
      continue;
    }
    if (/Couldn.t find your account/.test(text)) {
      path.push('no-account');
      await page.getByRole('link', { name: 'Sign up' }).click();
      continue;
    }
    if ((await passwordField.isVisible()) && (await passwordField.isEditable())) {
      if ((await emailField.isVisible()) && (await emailField.isEditable())) await emailField.fill(email);
      if (!(await passwordField.inputValue())) {
        path.push('password');
        await passwordField.fill(password);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        continue;
      }
    }
    if ((await emailField.isVisible()) && (await emailField.isEditable())) {
      path.push('email');
      await emailField.fill(email);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.waitForTimeout(1_500);
      continue;
    }
    // On the Account Portal with nothing left to answer: back to the app.
    if (!page.url().startsWith(test.info().project.use.baseURL ?? 'http://localhost:5190')) {
      path.push('back-to-app');
      await page.goto('/');
    }
  }
  throw new Error(`sign-in did not reach the app (path: ${path.join(' > ')})`);
}

/** Clerk's reverification modal (step-up) answered with a fresh TOTP code; returns false when none was asked. */
async function stepUp(page: Page, timeout = 20_000): Promise<boolean> {
  const modal = page.locator('.cl-userVerification-root, .cl-modalContent').first();
  const asked = await modal
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
  if (!asked) return false;
  const code = modal.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first();
  await expect(code).toBeVisible();
  await typeCode(page, code, await freshTotp(page));
  await expect(modal).toBeHidden({ timeout: 30_000 });
  return true;
}

async function nav(page: Page, label: string) {
  await page.locator(`[data-testid="nav-${label}"]:visible`).first().click();
}

async function shot(page: Page, name: string) {
  mkdirSync(`${OUT}/live`, { recursive: true });
  await page.screenshot({ path: `${OUT}/live/${name}.png`, fullPage: true });
}

function last(method: string, re: RegExp): ApiCall | undefined {
  return [...calls].reverse().find((c) => c.method === method && re.test(c.path));
}

// ---------------------------------------------------------------------------------------------------------------------

// A click on a button Clerk has swapped for a spinner must fail, not wait for the whole run. No trace: it would hold
// session tokens and the authenticator key.
test.use({ actionTimeout: 20_000, trace: 'off' });

test.describe('live founder journey on dev', () => {
  test.skip(
    !LIVE,
    'live run only: E2E_LIVE=1 with .env.e2e for a Clerk test founder whose company ops set up',
  );

  test('founder_live_journey_onboarding_to_daily_banking', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one live run, at desktop width');
    test.setTimeout((DECISION_MINUTES + 25) * 60_000);
    watchApi(page);
    page.on('pageerror', (e) => console.log(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log(`CONSOLE ${m.text().slice(0, 300)}`);
    });

    await step('sign-in with TOTP (sign-up and authenticator set-up the first time)', async () => {
      const path = await signInOrUp(page);
      await expect(page.getByTestId('env-badge')).toHaveText('Live');
      const me = last('GET', /^\/v1\/me$/);
      return `path ${path}; GET /v1/me ${me?.status ?? 'not seen'}`;
    });

    // ----- onboarding
    let open = false;
    await step('onboarding: application screen', async () => {
      await page.goto('/onboarding');
      await expect(page.getByTestId('application-state')).toBeVisible();
      const state = await page.getByTestId('application-state').innerText();
      await shot(page, '01-onboarding');
      return `state ${state}; ${describe(last('GET', /onboarding\/applications$/)!)}`;
    });

    const ssn = page.locator('[data-testid^="owner-ssn-"]:not([data-testid^="owner-ssn-save-"])');
    if (await ssn.count()) {
      await step('onboarding: owner SSN', async () => {
        const n = await ssn.count();
        for (let i = 0; i < n; i++) {
          const field = ssn.first();
          const id = (await field.getAttribute('data-testid'))!.replace('owner-ssn-', '');
          await field.fill(SSN);
          await page.getByTestId(`owner-ssn-save-${id}`).click();
          await expect(page.getByTestId(`owner-ssn-${id}`)).toBeHidden();
        }
        await expect(page.getByText(/ID ending \d{4}/).first()).toBeVisible();
        return `${n} owner(s); ${describe(last('PUT', /owners\/.*\/identity$/)!)}`;
      });
    }

    if (await page.getByTestId('application-confirm').isVisible()) {
      await step('onboarding: confirm details', async () => {
        await page.getByTestId('application-confirm').click();
        await expect(page.getByTestId('application-confirm')).toBeHidden();
        return `${describe(last('POST', /\/confirm$/)!)}; state ${await page.getByTestId('application-state').innerText()}`;
      });
    }

    const disclosure = page.locator('[data-testid^="disclosure-"]:not([data-testid="disclosure-accept"])');
    if (await page.getByTestId('application-submit').isVisible()) {
      await step('onboarding: read and accept every disclosure', async () => {
        let n = 0;
        // Each acceptance reloads the application, so the list is read again once it is back on screen.
        const settled = async () => {
          await expect(page.getByTestId('application-submit')).toBeVisible({ timeout: 30_000 });
          await expect(page.getByTestId('application-state')).toBeVisible();
          await page.waitForTimeout(1_500);
          return disclosure.count();
        };
        while (await settled()) {
          const next = disclosure.first();
          const id = await next.getAttribute('data-testid');
          await next.click();
          await expect(page.getByTestId('disclosure-accept')).toBeVisible();
          await page.getByTestId('disclosure-accept').click();
          await expect(page.getByTestId('disclosure-accept')).toBeHidden();
          await expect(page.getByTestId(id!)).toBeHidden({ timeout: 30_000 });
          n++;
          if (n > 20) throw new Error('disclosures never run out');
        }
        await expect(page.getByTestId('application-submit')).toBeEnabled();
        const events = calls.filter((c) => c.method === 'POST' && c.path === '/v1/disclosures/events');
        return `${n} accepted; disclosure events ${events.map((c) => c.status).join(',')}`;
      });
      await step('onboarding: submit to the bank', async () => {
        await page.getByTestId('application-submit').click();
        await expect(page.getByTestId('application-submit')).toBeHidden({ timeout: 30_000 });
        await shot(page, '02-submitted');
        return `${describe(last('POST', /\/submit$/)!)}; state ${await page.getByTestId('application-state').innerText()}`;
      });
    }

    await step('onboarding: bank decision (polling the onboarding screen)', async () => {
      const deadline = Date.now() + DECISION_MINUTES * 60_000;
      let state = '';
      const seen: string[] = [];
      for (;;) {
        state = await page.getByTestId('application-state').innerText();
        if (!seen.includes(state)) seen.push(state);
        if (/^(active|open|approved)/i.test(state)) break;
        if (/declined|rejected|cancel/i.test(state)) throw new Error(`the bank declined: ${state}`);
        if (Date.now() > deadline) break;
        await page.waitForTimeout(30_000);
        await page.reload();
        await expect(page.getByTestId('application-state')).toBeVisible({ timeout: 30_000 });
      }
      await shot(page, '03-decision');
      open = /^(active|open|approved)/i.test(state);
      if (!open)
        throw new Blocked(`no decision after ${DECISION_MINUTES} min; states seen: ${seen.join(' > ')}`);
      return `states seen: ${seen.join(' > ')}`;
    }).catch((e) => {
      if (!(e instanceof Blocked) && !/no decision after/.test((e as Error).message)) throw e;
      steps[steps.length - 1]!.outcome = 'blocked';
      writeEvidence();
    });
    if (!open) {
      test
        .info()
        .annotations.push({ type: 'blocked', description: 'account not open yet; daily banking not run' });
      throw new Error('blocked: no bank decision in time, daily banking steps not run (see live-steps.json)');
    }

    // ----- daily banking
    let accountId = '';
    await step('home and accounts', async () => {
      await nav(page, 'home');
      await expect(page.getByTestId('home-total')).toBeVisible();
      await nav(page, 'accounts');
      const first = page.locator('[data-testid^="account-acc"]').first();
      await expect(first).toBeVisible();
      accountId = (await first.getAttribute('data-testid'))!.replace('account-', '');
      await first.click();
      await expect(page.getByTestId('account-detail')).toBeVisible();
      await shot(page, '04-account');
      return `account ${accountId}; ${describe(last('GET', /^\/v1\/accounts$/)!)}; ${describe(last('GET', /transactions/)!)}`;
    });

    await step('statements', async () => {
      const st = page.locator('[data-testid^="statement-"]:not([data-testid="statement-view"])').first();
      const any = await st
        .waitFor({ timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      const list = last('GET', /statements$/);
      if (!any) return `no statement yet (new account); ${list ? describe(list) : 'list not called'}`;
      await st.click();
      await expect(page.getByTestId('statement-view')).toBeVisible();
      await page.keyboard.press('Escape');
      return `${list ? describe(list) : ''}; ${describe(last('GET', /statements\/.+/)!)}`;
    });

    if (STEP_UP_WAIT_MIN > 0) {
      // A fresh sign-in counts as a recent second factor: wait it out so each protected action asks for step-up.
      await page.waitForTimeout(STEP_UP_WAIT_MIN * 60_000);
      await page.reload();
      await expect(page.getByTestId('shell')).toBeVisible({ timeout: 30_000 });
    }

    let recipientId = '';
    await step('add a recipient (step-up when asked)', async () => {
      await page.getByRole('link', { name: 'Recipients' }).first().click();
      await expect(page.getByTestId('recipient-add')).toBeVisible();
      const existing = page.locator('[data-testid^="recipient-rcp"]', { hasText: RECIPIENT });
      if (await existing.count()) {
        recipientId = (await existing.first().getAttribute('data-testid'))!.replace('recipient-', '');
        return `already there: ${recipientId}`;
      }
      await page.getByTestId('recipient-add').click();
      await page.getByTestId('recipient-name').fill(RECIPIENT);
      await page.getByTestId('recipient-routing').fill('021000021');
      await page.getByTestId('recipient-account').fill('123456789012');
      await page.getByTestId('recipient-save').click();
      const stepped = await stepUp(page, 10_000);
      const row = page.locator('[data-testid^="recipient-rcp"]', { hasText: RECIPIENT }).first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      recipientId = (await row.getAttribute('data-testid'))!.replace('recipient-', '');
      await shot(page, '05-recipient');
      return `${recipientId}; step-up ${stepped ? 'asked and passed' : 'not asked'}; ${describe(last('POST', /^\/v1\/recipients$/)!)}`;
    });

    await step('ACH payment with step-up', async () => {
      await nav(page, 'payments');
      await page.getByTestId('new-payment').click();
      await page.getByTestId('payment-kind').selectOption('ach');
      const option = page.getByTestId('payment-recipient').locator(`option[value="${recipientId}"]`);
      if (!(await option.count()))
        throw new Blocked(`recipient ${recipientId} is not offered in the payment form`);
      await page.getByTestId('payment-recipient').selectOption(recipientId);
      await page.getByTestId('payment-amount').fill('25.00');
      await page.getByTestId('payment-reference').fill('Live e2e');
      await page.getByTestId('payment-review-button').click();
      await page.getByTestId('payment-send').click();
      const stepped = await stepUp(page);
      await expect(page.getByTestId('payment-detail')).toBeVisible({ timeout: 30_000 });
      await shot(page, '06-payment');
      const status = await page.getByTestId('payment-detail').innerText();
      return `step-up ${stepped ? 'asked and passed' : 'not asked'}; ${describe(last('POST', /^\/v1\/payments$/)!)}; ${describe(last('POST', /\/send$/)!)}; detail: ${status.replace(/\s+/g, ' ').slice(0, 160)}`;
    });

    await step('cards: list, freeze and unfreeze with step-up', async () => {
      await nav(page, 'cards');
      const card = page
        .locator(
          '[data-testid^="card-"]:not([data-testid^="card-detail"]):not([data-testid^="card-state"]):not([data-testid^="card-freeze"]):not([data-testid^="card-unfreeze"])',
        )
        .first();
      const has = await card
        .waitFor({ timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (!has) throw new Blocked(`no cards for this company; ${describe(last('GET', /^\/v1\/cards/)!)}`);
      await card.click();
      await expect(page.getByTestId('card-state')).toBeVisible();
      const before = await page.getByTestId('card-state').innerText();
      if (before !== 'Active') return `card state ${before}; freeze not offered`;
      await page.getByTestId('card-freeze').click();
      const s1 = await stepUp(page);
      await expect(page.getByTestId('card-state')).toHaveText('Frozen', { timeout: 30_000 });
      await page.getByTestId('card-unfreeze').click();
      const s2 = await stepUp(page);
      await expect(page.getByTestId('card-state')).toHaveText('Active', { timeout: 30_000 });
      return `freeze ${describe(last('POST', /\/freeze$/)!)} (step-up ${s1}); unfreeze ${describe(last('POST', /\/unfreeze$/)!)} (step-up ${s2})`;
    }).catch((e) => {
      if (!(e instanceof Blocked)) throw e;
      steps[steps.length - 1]!.outcome = 'blocked';
      writeEvidence();
    });

    await step('support ticket', async () => {
      await nav(page, 'support');
      await page.getByTestId('ticket-new').click();
      await page.getByTestId('ticket-subject').fill('Live e2e: card for a contractor');
      await page.getByTestId('ticket-body').fill('Can we get a virtual card for a contractor?');
      await page.getByTestId('ticket-send').click();
      await expect(page.getByTestId('ticket-thread')).toContainText('virtual card', { timeout: 30_000 });
      return describe(last('POST', /^\/v1\/support\/tickets$/)!);
    });

    await step('assistant: balance question and a payment draft opened with Review', async () => {
      await nav(page, 'home');
      await page.getByTestId('assistant-open').click();
      await page.getByTestId('assistant-input').fill('What is my balance?');
      await page.getByTestId('assistant-send').click();
      await expect(page.getByTestId('assistant-reply').last()).toBeVisible({ timeout: 30_000 });
      const reply = (await page.getByTestId('assistant-reply').last().innerText()).replace(
        /\$[\d,.]+/g,
        '$x',
      );
      await page.getByTestId('assistant-input').fill(`Send $25 to ${RECIPIENT}`);
      await page.getByTestId('assistant-send').click();
      await expect(page.getByTestId('assistant-draft').last()).toBeVisible({ timeout: 30_000 });
      const draft = await page.getByTestId('assistant-draft').last().innerText();
      await shot(page, '07-assistant');
      await page.getByTestId('assistant-review').last().click();
      await expect(page.getByTestId('payment-amount')).toHaveValue('25.00');
      return `balance reply "${reply.slice(0, 120)}"; draft "${draft.replace(/\s+/g, ' ').slice(0, 120)}"; Review opened the prefilled payment; ${describe(last('POST', /conversations\/.+\/messages$/)!)}`;
    });

    expect(steps.filter((s) => s.outcome === 'fail')).toEqual([]);
  });
});

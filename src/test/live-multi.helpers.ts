/// <reference types="node" />
import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for the T9 dev runs of OG-023 and OG-024 (og023-live.e2e.ts, og024-live.e2e.ts): two Clerk test founders of
 * the OnGem Founder instance and the ops console, each signed in its own browser context. They run only against a
 * deployed https E2E_BASE_URL. Credentials are read from the gitignored env files named in E2E_ENV_FILES (paths joined
 * with ':'), never from the repo: founder A is E2E_LIVE_EMAIL/_PASSWORD/_TOTP_SECRET, founder B is FOUNDER1_EMAIL/
 * _PASSWORD/_TOTP_SECRET, the console is CONSOLE_USER/CONSOLE_PASSWORD (basic auth) and E2E_EMAIL/E2E_PASSWORD/
 * E2E_TOTP_SECRET (ops sign-in). No value is ever logged.
 */
export const LIVE_URL = /^https:\/\//.test(process.env.E2E_BASE_URL ?? '');
export const CONSOLE_URL = process.env.E2E_CONSOLE_URL ?? 'https://console-dev.platform.ongem.com';

function readEnvFiles(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of (process.env.E2E_ENV_FILES ?? '').split(':').filter(Boolean)) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && env[m[1]!] === undefined) env[m[1]!] = m[2]!;
    }
  }
  return env;
}
const ENV = readEnvFiles();

export interface Who {
  label: string;
  email: string;
  password: string;
  totp: string;
}
export const founderA: Who = {
  label: 'founder A',
  email: ENV.E2E_LIVE_EMAIL ?? '',
  password: ENV.E2E_LIVE_PASSWORD ?? '',
  totp: ENV.E2E_LIVE_TOTP_SECRET ?? '',
};
export const founderB: Who = {
  label: 'founder B',
  email: ENV.FOUNDER1_EMAIL ?? '',
  password: ENV.FOUNDER1_PASSWORD ?? '',
  totp: ENV.FOUNDER1_TOTP_SECRET ?? '',
};
export const ops: Who = {
  label: 'ops',
  email: ENV.E2E_EMAIL ?? '',
  password: ENV.E2E_PASSWORD ?? '',
  totp: ENV.E2E_TOTP_SECRET ?? '',
};
export const consoleAuth = { username: ENV.CONSOLE_USER ?? '', password: ENV.CONSOLE_PASSWORD ?? '' };

/** The names of the credentials that are missing (names only). */
export function missing(): string[] {
  const need: [string, string][] = [
    ['E2E_LIVE_EMAIL', founderA.email],
    ['E2E_LIVE_PASSWORD', founderA.password],
    ['E2E_LIVE_TOTP_SECRET', founderA.totp],
    ['FOUNDER1_EMAIL', founderB.email],
    ['FOUNDER1_PASSWORD', founderB.password],
    ['FOUNDER1_TOTP_SECRET', founderB.totp],
    ['CONSOLE_USER', consoleAuth.username],
    ['CONSOLE_PASSWORD', consoleAuth.password],
    ['E2E_EMAIL', ops.email],
    ['E2E_PASSWORD', ops.password],
    ['E2E_TOTP_SECRET', ops.totp],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

// ---------------------------------------------------------------------------------------------------------------------
// TOTP (RFC 6238), each 30 s window claimed once per secret across processes (the same state file as live.e2e.ts).

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

export async function freshTotp(page: Page, secret: string): Promise<string> {
  for (;;) {
    const w = Math.floor(Date.now() / 30_000);
    if (30_000 - (Date.now() % 30_000) > 4_000 && claimWindow(secret, w)) return totp(secret);
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// API evidence per page: method, path, status and problem code of every call to the API.

export interface ApiCall {
  who: string;
  at: string;
  method: string;
  path: string;
  status: number;
  code?: string;
  detail?: string;
  body?: unknown;
}

export class Evidence {
  readonly calls: ApiCall[] = [];
  readonly steps: { step: string; outcome: 'pass' | 'fail' | 'blocked'; evidence: string }[] = [];
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  /** Records every /api-dev call of [page]; [keep] decides which JSON bodies are kept (for ids, never personal data). */
  watch(page: Page, who: string, keep: (path: string) => boolean = () => false) {
    page.on('response', async (res) => {
      const url = new URL(res.url());
      if (!url.pathname.startsWith('/api-dev/')) return;
      const path = url.pathname.replace(/^\/api-dev/, '') + url.search;
      const call: ApiCall = {
        who,
        at: new Date().toISOString(),
        method: res.request().method(),
        path,
        status: res.status(),
      };
      try {
        if (res.status() >= 400) {
          const p = (await res.json()) as { code?: string; detail?: string };
          call.code = p.code;
          call.detail = p.detail?.slice(0, 300);
        } else if (keep(path)) {
          call.body = await res.json();
        }
      } catch {
        /* no JSON body */
      }
      this.calls.push(call);
    });
  }

  last(who: string, method: string, re: RegExp): ApiCall | undefined {
    return [...this.calls].reverse().find((c) => c.who === who && c.method === method && re.test(c.path));
  }

  write() {
    const redacted = this.calls.map((c) => ({ ...c, body: undefined }));
    writeFileSync(`${this.dir}/api-calls.json`, JSON.stringify(redacted, null, 2));
    writeFileSync(`${this.dir}/steps.json`, JSON.stringify(this.steps, null, 2));
  }

  async step(name: string, body: () => Promise<string>) {
    await test.step(name, async () => {
      try {
        const evidence = await body();
        this.steps.push({ step: name, outcome: 'pass', evidence });
        console.log(`STEP PASS ${name}: ${evidence}`);
      } catch (e) {
        const msg = (e as Error).message.split('\n')[0] ?? '';
        const outcome = e instanceof Blocked ? 'blocked' : 'fail';
        this.steps.push({ step: name, outcome, evidence: msg });
        console.log(`STEP ${outcome.toUpperCase()} ${name}: ${msg}`);
        this.write();
        if (!(e instanceof Blocked)) throw e;
      }
      this.write();
    });
  }

  /** A full-page screenshot with personal data (emails, names, account digits, marked fields) blacked out. */
  async shot(page: Page, name: string) {
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${this.dir}/${name}.png`,
      fullPage: true,
      mask: [
        page.getByText(/@/),
        page.getByRole('heading', { name: /^Hello,/ }),
        page.locator('[data-mask], .cl-userButtonBox, .cl-identityPreview'),
        page.getByText(/(ending|•{2,}|\*{2,})\s*\d{4}/),
      ],
      maskColor: '#222',
    });
  }
}

export class Blocked extends Error {}

export function describe(c: ApiCall | undefined): string {
  if (!c) return 'not seen';
  return `${c.method} ${c.path} ${c.status}${c.code ? ` ${c.code}` : ''}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sign-in: founders on the founder web (Clerk customer instance), ops on the console (Clerk ops instance).

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

/** Signs [who] in on the founder web until the app shell shows; never signs up or sets up an authenticator. */
export async function signInFounder(page: Page, who: Who): Promise<string> {
  const path: string[] = [];
  await page.goto('/sign-in');
  const shell = page.getByTestId('shell');
  const code = page.locator('input[autocomplete="one-time-code"]').first();
  const emailField = page.getByLabel('Email address');
  const passwordField = page.getByLabel('Password', { exact: true });
  for (let round = 0; round < 15; round++) {
    await expect(shell.or(code).or(emailField).or(passwordField).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    if (await shell.isVisible()) return path.join(' > ');
    const text = await page.locator('body').innerText();
    if (/Create your account|Couldn.t find your account/.test(text))
      throw new Blocked(`${who.label} has no account on the Clerk instance`);
    if (await code.isVisible()) {
      await page.waitForTimeout(1_000);
      const now = await page.locator('body').innerText();
      // Clerk's second factor page is the authenticator unless it offers to resend an email code.
      const totpStep =
        /authenticator/i.test(now) || (page.url().includes('factor-two') && !/Resend|sent to/i.test(now));
      path.push(totpStep ? 'totp' : 'email-code');
      if (!totpStep) await expect(page.getByText(/Resend/)).toBeVisible({ timeout: 15_000 });
      await typeCode(page, code, totpStep ? await freshTotp(page, who.totp) : '424242');
      continue;
    }
    if ((await passwordField.isVisible()) && (await passwordField.isEditable())) {
      if ((await emailField.isVisible()) && (await emailField.isEditable())) await emailField.fill(who.email);
      if (!(await passwordField.inputValue())) {
        path.push('password');
        await passwordField.fill(who.password);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        continue;
      }
    }
    if ((await emailField.isVisible()) && (await emailField.isEditable())) {
      path.push('email');
      await emailField.fill(who.email);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.waitForTimeout(1_500);
      continue;
    }
    if (!page.url().startsWith(process.env.E2E_BASE_URL ?? '')) {
      path.push('back-to-app');
      await page.goto('/sign-in');
    }
  }
  throw new Error(`${who.label}: sign-in did not reach the app (path: ${path.join(' > ')})`);
}

/** Clerk's reverification modal (step-up) answered with a fresh TOTP code; false when none was asked. */
export async function stepUp(page: Page, who: Who, timeout = 20_000): Promise<boolean> {
  const modal = page.locator('.cl-userVerification-root, .cl-modalContent').first();
  const asked = await modal
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
  if (!asked) return false;
  const code = modal.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first();
  await expect(code).toBeVisible();
  await typeCode(page, code, await freshTotp(page, who.totp));
  await expect(modal).toBeHidden({ timeout: 30_000 });
  return true;
}

/** A browser context and page on the founder web for [who]. */
export async function founderPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return ctx.newPage();
}

/** The ops console signed in as the ops test account, behind the console's basic auth, in live mode. */
export async function consolePage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    baseURL: CONSOLE_URL,
    httpCredentials: consoleAuth,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('ongem-admin.api', JSON.stringify({ mode: 'live', baseUrl: '/api-dev' })),
  );
  await page.reload();
  const heading = page.getByRole('heading', { name: /Sign in to the .* Console/ });
  const badge = page.getByTestId('env-badge');
  await expect(heading.or(badge).first()).toBeVisible({ timeout: 30_000 });
  if (await heading.isVisible()) {
    await page.getByLabel('Email address').fill(ops.email);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toBeVisible();
    await password.fill(ops.password);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const code = page.locator('input[autocomplete="one-time-code"]').first();
    for (let i = 0; i < 6; i++) {
      await expect(badge.or(code).first()).toBeVisible({ timeout: 30_000 });
      if (await badge.isVisible()) break;
      await page.waitForTimeout(1_000);
      const totpStep = await page
        .getByText(/authenticator app/i)
        .first()
        .isVisible();
      if (!totpStep) await expect(page.getByText(/Resend/)).toBeVisible({ timeout: 15_000 });
      await typeCode(page, code, totpStep ? await freshTotp(page, ops.totp) : '424242');
    }
  }
  await expect(badge).toBeVisible({ timeout: 30_000 });
  return page;
}

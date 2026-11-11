/// <reference types="node" />
import { expect, test, type Page } from '@playwright/test';
import {
  Blocked,
  consolePage,
  describe as show,
  Evidence,
  founderA,
  founderB,
  founderPage,
  LIVE_URL,
  missing,
  signInFounder,
  stepUp,
} from './live-multi.helpers';
import type { InviteCreated, Me, Membership, Payment } from '../api/types';

/**
 * OG-023 T9 on dev US: founder A invites founder B to A's company, B accepts at /invite/<token>, B's switcher lists both
 * companies, a pick of a company B is not in is refused with the 403 copy, a transfer between B's companies when B holds
 * two ACTIVE companies with accounts, and the console's company page shows members and invites read-only. Adds data
 * only (an invite, a membership, one cent moved); deletes nothing. Run with E2E_BASE_URL (https) and E2E_ENV_FILES.
 */
const OUT = process.env.E2E_OUT_OG023 ?? 'e2e-output/og023-live';
const ROLE = process.env.E2E_INVITE_ROLE ?? 'MEMBER';
const NOT_A_COMPANY = 'cmp_00000000000000000000';

test.use({ actionTimeout: 20_000, trace: 'off' });

test.describe('@live OG-023 multi-company on dev', () => {
  test.skip(!LIVE_URL, 'live run only: E2E_BASE_URL must be the deployed https founder web');

  test('og023_invite_accept_switch_refuse_transfer_console @live', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'one live run, at desktop width');
    test.setTimeout(25 * 60_000);
    const gone = missing();
    if (gone.length) throw new Error(`credentials missing (names): ${gone.join(', ')}`);
    const ev = new Evidence(OUT);
    const keep = () => true;
    const a = await founderPage(browser);
    const b = await founderPage(browser);
    ev.watch(a, 'A', keep);
    ev.watch(b, 'B', keep);

    const me = async (who: 'A' | 'B'): Promise<Me> => {
      let found: Me | undefined;
      await expect
        .poll(() => (found = ev.last(who, 'GET', /^\/v1\/me$/)?.body as Me | undefined), { timeout: 30_000 })
        .toBeTruthy();
      return found!;
    };
    const summary = (m: Membership) => `${m.companyId} ${m.role} ${m.state}/${m.companyState ?? '?'}`;

    let companyA = '';
    let meB: Me | undefined;
    await ev.step('A signs in and is OWNER of an ACTIVE company', async () => {
      const path = await signInFounder(a, founderA);
      await expect(a.getByTestId('env-badge')).toHaveText('Live');
      const m = await me('A');
      const current = m.memberships.find((x) => x.companyId === m.companyId) ?? m.memberships[0];
      if (!current || current.role !== 'OWNER')
        throw new Blocked(`A is not an owner: ${m.memberships.map(summary).join('; ')}`);
      companyA = current.companyId;
      await ev.shot(a, 'og023-01-a-signed-in');
      return `path ${path}; A memberships: ${m.memberships.map(summary).join('; ')}`;
    });

    await ev.step('B signs in', async () => {
      const path = await signInFounder(b, founderB);
      meB = await me('B');
      await ev.shot(b, 'og023-02-b-signed-in');
      return `path ${path}; B memberships: ${meB.memberships.map(summary).join('; ')}`;
    });
    const bAlreadyIn = !!meB?.memberships.some((m) => m.companyId === companyA && m.state === 'ACTIVE');

    await ev.step('a pick of a company B is not in is refused with the 403 copy', async () => {
      // The switcher offers only B's companies, so the pick is forced: the next accounts call carries the other id.
      const target = bAlreadyIn ? NOT_A_COMPANY : companyA;
      await b.route('**/api-dev/v1/accounts', (route) =>
        route.continue({ headers: { ...route.request().headers(), 'x-company-id': target } }),
      );
      await b.locator('[data-testid="nav-accounts"]:visible').first().click();
      await expect(b.getByText('You are no longer a member of that company.')).toBeVisible({
        timeout: 30_000,
      });
      const call = ev.last('B', 'GET', /^\/v1\/accounts$/);
      await ev.shot(b, 'og023-03-b-refused-pick');
      await b.unroute('**/api-dev/v1/accounts');
      expect(call?.status).toBe(403);
      expect(call?.code).toBe('company_not_member');
      return `X-Company-Id ${target === companyA ? "A's company" : 'an unknown id'}: ${show(call)}; copy shown`;
    });

    let token = '';
    await ev.step(`A invites B as ${ROLE} in Settings`, async () => {
      if (bAlreadyIn)
        throw new Blocked("B is already an ACTIVE member of A's company (an earlier run); no new invite");
      await a.locator('[data-testid="nav-settings"]:visible').first().click();
      await expect(a.getByTestId('settings-team')).toBeVisible();
      await a.getByTestId('invite-email').fill(founderB.email);
      await a.getByTestId('invite-role').selectOption(ROLE);
      await a.getByTestId('invite-send').click();
      await expect(a.getByTestId('invite-sent').or(a.getByTestId('invite-form-error')).first()).toBeVisible({
        timeout: 30_000,
      });
      const post = ev.last('A', 'POST', /^\/v1\/companies\/[^/]+\/invites$/);
      if (await a.getByTestId('invite-form-error').isVisible())
        throw new Error(
          `invite refused: ${show(post)}: ${await a.getByTestId('invite-form-error').innerText()}`,
        );
      const made = post?.body as InviteCreated | undefined;
      token = made?.acceptUrl ? new URL(made.acceptUrl).pathname.split('/').pop()! : (made?.token ?? '');
      if (!token) throw new Error('no accept link in the answer');
      await expect(a.getByTestId('invite-list')).toBeVisible();
      await ev.shot(a, 'og023-04-a-invite-sent');
      return `${show(post)}; invite ${made?.invite.id} ${made?.invite.role} ${made?.invite.state}; link host ${new URL(made!.acceptUrl).host}`;
    });

    await ev.step('B accepts at /invite/<token>', async () => {
      if (!token) throw new Blocked('no invite token (see the invite step)');
      await b.goto(`/invite/${token}`);
      await expect(b.getByTestId('invite-accept')).toBeVisible({ timeout: 30_000 });
      await ev.shot(b, 'og023-05-b-invite');
      await b.getByTestId('invite-accept').click();
      await expect(b.getByTestId('invite-joined').or(b.getByTestId('invite-error')).first()).toBeVisible({
        timeout: 30_000,
      });
      const post = ev.last('B', 'POST', /^\/v1\/invites\/[^/]+\/accept$/);
      if (await b.getByTestId('invite-error').isVisible())
        throw new Error(
          `accept refused: ${post?.status} ${post?.code}: ${await b.getByTestId('invite-error').innerText()}`,
        );
      const joined = await b.getByTestId('invite-joined').innerText();
      await ev.shot(b, 'og023-06-b-joined');
      await b.getByTestId('invite-open').click();
      await expect(b.getByTestId('shell')).toBeVisible();
      return `POST /v1/invites/<token>/accept ${post?.status}; "${joined}"`;
    });

    await ev.step("B's switcher lists both companies", async () => {
      await b.reload();
      await expect(b.getByTestId('company-switcher')).toBeVisible({ timeout: 30_000 });
      await b.getByTestId('company-switcher').click();
      const options = b.locator('[data-testid^="company-option-"]');
      await expect(options.first()).toBeVisible();
      const ids = await options.evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-testid')!.replace('company-option-', '')),
      );
      await ev.shot(b, 'og023-07-b-switcher');
      await b.keyboard.press('Escape');
      expect(ids).toContain(companyA);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      return `${ids.length} companies listed: ${ids.join(', ')}`;
    });

    await ev.step('transfer between my companies (INTERNAL, smallest amount) seen in both', async () => {
      // B sends from B's own company (OWNER) to an account of A's company, where B is now a member.
      const m = (await me('B')).memberships.filter(
        (x) => x.state === 'ACTIVE' && (x.companyState ?? 'ACTIVE') === 'ACTIVE',
      );
      const own = m.find((x) => x.companyId !== companyA && x.role === 'OWNER');
      if (!own || !m.some((x) => x.companyId === companyA))
        throw new Blocked(
          `precondition missing: B does not hold two ACTIVE companies (${m.map(summary).join('; ')})`,
        );
      await b.getByTestId('company-switcher').click();
      const pick = b.getByTestId(`company-option-${own.companyId}`);
      if ((await pick.getAttribute('aria-current')) === 'true') await b.keyboard.press('Escape');
      else await pick.click();
      await expect(b.getByTestId('shell')).toBeVisible();
      await b.goto('/payments/new');
      await expect(
        b
          .getByTestId('payment-form')
          .or(b.getByText(/no accounts|could not/i))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      const kinds = await b
        .getByTestId('payment-kind')
        .locator('option')
        .evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
      if (!kinds.includes('company'))
        throw new Blocked(
          `precondition missing: no "Between my companies" option (kinds ${kinds.join(',')})`,
        );
      const from = await b.getByTestId('payment-from').locator('option').count();
      if (!from) throw new Blocked("precondition missing: B's own company has no ACTIVE account");
      await b.getByTestId('payment-kind').selectOption('company');
      const dest = b.getByTestId('payment-to-company-account');
      await expect(dest).toBeVisible({ timeout: 30_000 });
      const values = (
        await dest.locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value))
      ).filter(Boolean);
      if (!values.length)
        throw new Blocked("precondition missing: A's company has no ACTIVE account in the same currency");
      await dest.selectOption(values[0]!);
      await b.getByTestId('payment-amount').fill('0.01');
      await b.getByTestId('payment-reference').fill('OG-023 T9 e2e');
      await ev.shot(b, 'og023-08-b-transfer-form');
      await b.getByTestId('payment-review-button').click();
      await expect(b.getByTestId('payment-review')).toBeVisible();
      await b.getByTestId('payment-send').click();
      const stepped = await stepUp(b, founderB);
      await expect(
        b
          .getByTestId('payment-detail')
          .or(b.getByTestId('payment-review').locator('.og-notice, [role="alert"]'))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      const create = ev.last('B', 'POST', /^\/v1\/payments$/);
      const send = ev.last('B', 'POST', /^\/v1\/payments\/[^/]+\/send$/);
      if (!(await b.getByTestId('payment-detail').isVisible())) {
        await ev.shot(b, 'og023-09-b-transfer-refused');
        if (create?.status === 409 && create.code === 'capability_unavailable') {
          // AC-R11.3: the API refuses companies at different banks. The copy must say that, not the scheduled-transfer text.
          const copy = await b.getByTestId('payment-review').innerText();
          expect
            .soft(
              copy,
              'capability_unavailable on a transfer between companies shows the scheduled-transfer copy',
            )
            .not.toContain('Scheduled transfers between your own accounts');
          throw new Blocked(
            `precondition missing: B's two companies are not at the same bank (${show(create)}: ${create.detail}); nothing sent`,
          );
        }
        throw new Error(`transfer refused: ${show(create)}; ${show(send)}`);
      }
      await ev.shot(b, 'og023-09-b-transfer-sent');
      const paid = (send?.body ?? create?.body) as Payment | undefined;
      // A sees the credit on the destination account.
      const toAccount = values[0]!;
      let seen = false;
      for (let i = 0; i < 12 && !seen; i++) {
        await a.goto(`/accounts/${toAccount}`);
        await expect(a.getByTestId('account-detail')).toBeVisible({ timeout: 30_000 });
        await a.waitForTimeout(2_000);
        const txns = ev.last('A', 'GET', new RegExp(`^/v1/accounts/${toAccount}/transactions`));
        seen = JSON.stringify(txns?.body ?? '').includes('"amountMinor":1,');
        if (!seen) await a.waitForTimeout(10_000);
      }
      await ev.shot(a, 'og023-10-a-transfer-received');
      if (!seen) throw new Error(`A does not see the 0.01 credit on ${toAccount} after 2 minutes`);
      return `step-up ${stepped ? 'asked and passed' : 'not asked'}; ${show(create)}; ${show(send)}; payment ${paid?.id} ${paid?.rail} ${paid?.state} toCompany ${paid?.toCompanyId ?? '?'}; A sees the credit on ${toAccount}`;
    });

    await ev.step("console: A's company page shows members and invites read-only", async () => {
      const c = await consolePage(browser);
      await c.goto(`/companies/${companyA}`);
      const card = c
        .locator('section, div')
        .filter({ has: c.getByRole('heading', { name: 'Members and invites' }) })
        .last();
      await expect(c.getByRole('heading', { name: 'Members and invites' })).toBeVisible({ timeout: 30_000 });
      await expect(c.getByRole('list', { name: 'Members' })).toBeVisible({ timeout: 30_000 });
      const members = await c.getByRole('list', { name: 'Members' }).locator('li').count();
      const invites = await c
        .getByRole('list', { name: 'Invites' })
        .locator('li')
        .count()
        .catch(() => 0);
      const accepted = await c
        .getByRole('list', { name: 'Invites' })
        .getByText('Accepted')
        .count()
        .catch(() => 0);
      const buttons = await card.getByRole('button', { name: /invite|revoke|remove/i }).count();
      await c.getByRole('heading', { name: 'Members and invites' }).scrollIntoViewIfNeeded();
      // The bank persona's name in People is personal-looking data: blurred for the record.
      await c.evaluate(() => {
        for (const h of document.querySelectorAll('h2, h3')) {
          if (h.textContent?.trim() === 'People') (h.parentElement as HTMLElement).style.filter = 'blur(8px)';
        }
      });
      await ev.shot(c, 'og023-11-console-members');
      await c.context().close();
      expect(members).toBeGreaterThanOrEqual(2);
      expect(buttons).toBe(0);
      return `${members} members, ${invites} invites (${accepted} accepted), no invite or revoke action`;
    });

    ev.write();
    await (a as Page).context().close();
    await b.context().close();
  });
});

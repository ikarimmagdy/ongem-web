/// <reference types="node" />
import { expect, test } from '@playwright/test';
import {
  Blocked,
  consolePage,
  describe as show,
  Evidence,
  founderA,
  founderPage,
  LIVE_URL,
  missing,
  signInFounder,
} from './live-multi.helpers';
import type { ExportRun } from '../api/types';

/**
 * OG-024 T9 (US part) on dev US: founder A (an owner) exports last month of an account of A's company as CSV, the run is
 * read until DONE (or REFUSED with statement_mismatch, also a valid outcome), the file is downloaded through the link,
 * its header block and lines header are checked, the link carries a 15 minute expiry, and the console's account page
 * shows the run. Adds one export run; deletes nothing. Run with E2E_BASE_URL (https) and E2E_ENV_FILES.
 */
const OUT = process.env.E2E_OUT_OG024 ?? 'e2e-output/og024-live';
const HEADER_FIELDS = [
  'company',
  'account_last4',
  'currency',
  'period_from',
  'period_to',
  'opening_balance',
  'closing_balance',
  'line_count',
  'run_id',
  'generated_at',
  'cutoff_at',
  'last_drift_check',
  'statement_match',
  'reexport_of',
];
const LINES_HEADER =
  'section,posted_on,effective_date,direction,amount,currency,rail,subtype,origin,counterparty,reference,trace_number,return_code,transaction_id,provider_reference,linked_transaction_id,belongs_to_period';

/** A bank date as the app writes it (1 Oct 2026), without any time zone. */
function dayText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'][
    m! - 1
  ];
  return `${d} ${month} ${y}`;
}

test.use({ actionTimeout: 20_000, trace: 'off' });

test.describe('@live OG-024 accounting exports on dev', () => {
  test.skip(!LIVE_URL, 'live run only: E2E_BASE_URL must be the deployed https founder web');

  test('og024_export_last_month_download_link_console @live', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'one live run, at desktop width');
    test.setTimeout(20 * 60_000);
    const gone = missing();
    if (gone.length) throw new Error(`credentials missing (names): ${gone.join(', ')}`);
    const ev = new Evidence(OUT);
    const a = await founderPage(browser);
    ev.watch(a, 'A', () => true);

    let accountId = '';
    await ev.step('A signs in and opens an account of the company', async () => {
      const path = await signInFounder(a, founderA);
      await a.locator('[data-testid="nav-accounts"]:visible').first().click();
      const first = a.locator('[data-testid^="account-acc"]').first();
      await expect(first).toBeVisible({ timeout: 30_000 });
      accountId = (await first.getAttribute('data-testid'))!.replace('account-', '');
      await first.click();
      await expect(a.getByTestId('account-detail')).toBeVisible();
      await expect(a.getByTestId('export-activity')).toBeVisible({ timeout: 30_000 });
      await ev.shot(a, 'og024-01-account');
      return `path ${path}; account ${accountId}; ${show(ev.last('A', 'GET', /\/exports$/))}`;
    });

    let run: ExportRun | undefined;
    await ev.step('request a CSV export of last month', async () => {
      await a.getByTestId('export-start').click();
      await expect(a.getByTestId('export-form')).toBeVisible();
      await expect(a.getByTestId('export-period')).toHaveValue('month');
      await expect(a.getByTestId('export-format')).toHaveValue('CSV');
      await ev.shot(a, 'og024-02-export-form');
      await a.getByTestId('export-confirm').click();
      await expect(a.getByTestId('export-state')).toBeVisible({ timeout: 30_000 });
      const post = ev.last('A', 'POST', /\/v1\/accounts\/[^/]+\/exports$/);
      if (!post || post.status !== 202)
        throw new Error(`export not accepted: ${show(post)} ${post?.detail ?? ''}`);
      run = post.body as ExportRun;
      await ev.shot(a, 'og024-03-preparing');
      return `${show(post)}; run ${run.id} ${run.state} ${run.from} to ${run.to} ${run.format}`;
    });

    await ev.step('the run ends DONE (or REFUSED statement_mismatch)', async () => {
      if (!run) throw new Blocked('no run');
      const done = a.getByTestId('export-run-done');
      const refused = a.getByTestId('export-run-refused');
      const failed = a.getByTestId('export-run-failed');
      await expect(done.or(refused).or(failed).first()).toBeVisible({ timeout: 10 * 60_000 });
      const read = ev.last('A', 'GET', new RegExp(`/exports/${run.id}$`));
      run = (read?.body as ExportRun | undefined) ?? run;
      await ev.shot(a, `og024-04-${run.state.toLowerCase()}`);
      if (run.state === 'REFUSED' && run.reason === 'statement_mismatch')
        return `REFUSED statement_mismatch (a valid outcome); ${show(read)}`;
      expect(run.state).toBe('DONE');
      // The period is bank dates: 2026-10-01 must read 1 Oct 2026 in any time zone, never the day before.
      const ready = await a.getByTestId('export-run-done').innerText();
      expect
        .soft(ready, 'the ready text shows the period shifted by a day')
        .toContain(`${dayText(run.from)} to ${dayText(run.to)}`);
      return `DONE: ${run.lineCount} lines, file ${run.fileName}, sha256 ${run.sha256?.slice(0, 12)}..., cutoff ${run.cutoffAt}`;
    });

    await ev.step('download through the link: CSV header and the link expiry', async () => {
      if (!run || run.state !== 'DONE')
        throw new Blocked(`run is ${run?.state} ${run?.reason ?? ''}: no file`);
      const link = run.link;
      if (!link) throw new Error('a DONE run came back without a link');
      await expect(a.getByTestId('export-download')).toBeVisible();
      const href = await a.getByTestId('export-download').getAttribute('href');
      expect(href).toBe(link.url);
      const url = new URL(link.url);
      const ttl = (Date.parse(link.expiresAt) - Date.now()) / 60_000;
      const amzExpires = Number(url.searchParams.get('X-Amz-Expires') ?? NaN);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(15.5);
      const res = await a.context().request.get(link.url);
      expect(res.status()).toBe(200);
      const text = await res.text();
      const disposition = res.headers()['content-disposition'] ?? '';
      const lines = text.split('\r\n');
      const blank = lines.indexOf('');
      const header = lines.slice(0, blank);
      expect(header[0]).toBe('field,value');
      const fields = header.slice(1).map((l) => l.slice(0, l.indexOf(',')));
      expect(fields).toEqual(HEADER_FIELDS);
      expect(lines[blank + 1]).toBe(LINES_HEADER);
      expect(text.charCodeAt(0)).not.toBe(0xfeff);
      const value = (f: string) => header.find((l) => l.startsWith(`${f},`))?.slice(f.length + 1);
      expect(value('run_id')).toBe(run.id);
      await expect(a.getByText(/The link works until/)).toBeVisible();
      await ev.shot(a, 'og024-05-download-link');
      return `GET <link host ${url.host}> ${res.status()} ${res.headers()['content-type']}; ${disposition.includes(run.fileName ?? '#') ? 'attachment names the file' : `disposition "${disposition}"`}; header fields in order (${fields.length}); lines header ok; currency ${value('currency')}, period ${value('period_from')} to ${value('period_to')}, line_count ${value('line_count')}, statement_match ${value('statement_match')}, last_drift_check ${value('last_drift_check')}; link expiresAt in ${ttl.toFixed(1)} min, X-Amz-Expires ${amzExpires} s, signed ${url.searchParams.has('X-Amz-Signature') ? 'yes' : 'no'}`;
    });

    await ev.step('console: the account page shows the export run', async () => {
      if (!run) throw new Blocked('no run');
      const c = await consolePage(browser);
      ev.watch(c, 'console', () => true);
      await c.goto(`/accounts/${accountId}`);
      const table = c.getByRole('table', { name: 'Export runs' });
      await expect(table).toBeVisible({ timeout: 30_000 });
      const row = table
        .getByRole('row')
        .filter({ hasText: `${run.from} to ${run.to}` })
        .first();
      await expect(row).toBeVisible();
      await row.scrollIntoViewIfNeeded();
      await ev.shot(c, 'og024-06-console-exports');
      const list = ev.last('console', 'GET', /\/v1\/ops\/accounts\/[^/]+\/exports$/);
      const ops = (list?.body as { id: string; state: string }[] | undefined)?.find((r) => r.id === run!.id);
      await c.context().close();
      expect(ops?.state).toBe(run.state);
      expect(JSON.stringify(list?.body ?? '')).not.toContain('"link"');
      return `${show(list)}; run ${run.id} listed ${ops?.state}; row for ${run.from} to ${run.to} shown; no link in the ops answer`;
    });

    ev.write();
    await a.context().close();
  });
});

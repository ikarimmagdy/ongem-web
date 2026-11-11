import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { ApiError, errorText } from '../api/errors';
import { paymentStatusLine } from '../screens/Payments';
import { formatDay, frequencyText, nthRun } from '../lib/schedule';
import { renderApp } from './render';

describe('payments (OG-030 R4)', () => {
  it('ach_review_send_with_step_up_AC_R4_1', async () => {
    renderApp('/payments');
    await userEvent.click(await screen.findByTestId('payments-tab-send'));
    await userEvent.selectOptions(await screen.findByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '1,250.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    expect(await screen.findByTestId('payment-review')).toHaveTextContent('US$1,250.00');
    await userEvent.click(screen.getByTestId('payment-send'));
    await userEvent.type(await screen.findByTestId('reverify-code'), '123456');
    await userEvent.click(screen.getByTestId('reverify-confirm'));
    const detail = await screen.findByTestId('payment-detail');
    expect(within(detail).getAllByText('Sent').length).toBeGreaterThan(0);
    // SL1-15: where the payment is, in words, announced as a status.
    expect(within(detail).getByRole('status')).toHaveTextContent(/^Sent\./);
  });

  it('SL1_15 status lines and the low balance message', () => {
    expect(paymentStatusLine('PRECHECKED')).toBe(
      'Sending. Our banking partner did not answer yet. We will not send it twice.',
    );
    // FA-035: no raw bank reference in front of a founder.
    expect(paymentStatusLine('SUBMITTED', 'ach_5c2e')).toBe('Sent. The bank has it and it is on its way.');
    expect(paymentStatusLine('SETTLED')).toBe('Settled.');
    expect(paymentStatusLine('PENDING_APPROVAL', null, 'COMPANY')).toBe(
      'Waiting for a second person in your company to approve it. Nothing has moved yet.',
    );
    expect(paymentStatusLine('PENDING_APPROVAL', null, 'ONGEM')).toBe(
      'Waiting for OnGem to approve it, because no one else in your company can approve payments. Nothing has moved yet.',
    );
    expect(errorText(new ApiError(409, 'insufficient_funds', 'x'))).toBe(
      'Your available balance is lower than this payment.',
    );
  });

  it('internal_transfer_moves_both_balances_AC_R4_1', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/payments/new?kind=internal&to=acc_demo_tax&amount=100000', { api });
    expect(await screen.findByTestId('payment-amount')).toHaveValue('1000.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    await screen.findByTestId('payment-detail');
    const accounts = await api.accounts();
    expect(accounts.find((a) => a.id === 'acc_demo_ops')!.balance!.available.amountMinor).toBe(12_510_016);
    expect(accounts.find((a) => a.id === 'acc_demo_tax')!.balance!.available.amountMinor).toBe(2_600_000);
    expect((await api.payments()).items[0]!.rail).toBe('BOOK');
  });

  it('returned_shows_code_AC_R4_2', async () => {
    renderApp('/payments/pay_demo_3');
    expect(await screen.findByTestId('return-code')).toHaveTextContent(
      'R03 No account, or unable to locate account',
    );
  });
});

describe('payments to a new recipient (live check 2026-11-02)', () => {
  it('a PENDING recipient can be paid, the bank checks it with the first payment; a BLOCKED one is not offered', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    const all = api.recipients;
    api.recipients = async () => [
      ...(await all()),
      {
        id: 'rcp_blocked',
        kind: 'BUSINESS',
        name: 'Blocked Payee',
        accountLast4: '0001',
        routingNumber: '021000021',
        accountType: 'CHECKING',
        screening: 'BLOCKED',
        status: 'ACTIVE',
      },
    ];
    const pending = (await api.recipients()).find((r) => r.screening === 'PENDING')!;
    renderApp('/payments/new', { api });
    const select = await screen.findByTestId('payment-recipient');
    expect(within(select).queryByText('Blocked Payee')).toBeNull();
    await userEvent.selectOptions(select, pending.id);
    expect(screen.getByText('Checked by the bank with the first payment.')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('payment-amount'), '25.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    expect(await screen.findByTestId('payment-detail')).toBeInTheDocument();
    expect(api.calls).toContain('createPayment');
  });
});

describe('add money from another bank (G-40)', () => {
  it('links a typed-in account, unverified until the bank verifies it G_40_1', async () => {
    const api = new DemoOnGemApi();
    renderApp('/payments/top-up', { api });
    await screen.findByTestId('funding-fsrc_demo_main');
    await userEvent.type(screen.getByTestId('funding-link-owner'), 'Northwind Labs LLC');
    await userEvent.type(screen.getByTestId('funding-link-routing'), '021000021');
    await userEvent.type(screen.getByTestId('funding-link-number'), '000123456789');
    await userEvent.type(screen.getByTestId('funding-link-nickname'), 'Savings bank');
    await userEvent.click(screen.getByTestId('funding-link-save'));
    const state = await screen.findByText('Waiting for the bank to verify it');
    expect(document.body.textContent).not.toContain('000123456789');
    expect(screen.getByTestId('funding-link-number')).toHaveValue('');
    expect(api.stepUps).toContain('funding_source');
    const id = (await api.fundingSources())[0]!.id;
    expect(state).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`funding-check-${id}`));
    expect(await screen.findByTestId(`funding-${id}-state`)).toHaveTextContent('Verified');
    await userEvent.click(screen.getByTestId(`funding-remove-${id}`));
    await screen.findByTestId('funding-fsrc_demo_main');
    await expect(api.fundingSources()).resolves.toHaveLength(1);
  });

  it('a one-person company is told OnGem approves its top-up, with no approve button Q_091_COPY_1', async () => {
    const api = new DemoOnGemApi();
    api.approvalBy = 'ONGEM';
    renderApp('/payments', { api });
    await userEvent.click(await screen.findByTestId('payments-tab-add_money'));
    await userEvent.type(await screen.findByTestId('topup-amount'), '5,000.00');
    await userEvent.click(screen.getByTestId('topup-review-button'));
    expect(await screen.findByTestId('topup-review')).toHaveTextContent(
      'If no one else in your company can approve, OnGem approves it.',
    );
    await userEvent.click(screen.getByTestId('topup-send'));
    const detail = await screen.findByTestId('payment-detail');
    expect(within(detail).getByRole('status')).toHaveTextContent('Waiting for OnGem to approve it');
    expect(within(detail).queryByRole('button', { name: /approve/i })).toBeNull();
  });

  it('tops up from a verified account and waits for approval, then the approver approves G_40_2', async () => {
    const api = new DemoOnGemApi();
    renderApp('/payments', { api });
    await userEvent.click(await screen.findByTestId('payments-tab-add_money'));
    await userEvent.type(await screen.findByTestId('topup-amount'), '5,000.00');
    await userEvent.click(screen.getByTestId('topup-review-button'));
    const review = await screen.findByTestId('topup-review');
    expect(review).toHaveTextContent('US$5,000.00');
    expect(review).toHaveTextContent('Main bank');
    await userEvent.click(screen.getByTestId('topup-send'));
    const detail = await screen.findByTestId('payment-detail');
    expect(within(detail).getByRole('status')).toHaveTextContent('Waiting for a second person');
    expect(detail).toHaveTextContent('ACH debit from your account at another bank');
    const [p] = (await api.payments(null)).items;
    expect(p).toMatchObject({
      state: 'PENDING_APPROVAL',
      fundingSourceId: 'fsrc_demo_main',
      fromAccountId: 'acc_demo_ops',
    });
    await userEvent.click(within(detail).getByTestId('payment-approve'));
    expect(await screen.findByText(/^Sent\. The bank has it/)).toBeInTheDocument();
    expect(api.stepUps.filter((s) => s === 'payment')).toHaveLength(2);
  });

  it('a declined top-up moves nothing G_40_3', async () => {
    const api = new DemoOnGemApi();
    const p = await api.createTopUp({
      fundingSourceId: 'fsrc_demo_main',
      toAccountId: 'acc_demo_ops',
      amountMinor: 10_000,
      currency: 'USD',
    });
    renderApp(`/payments/${p.id}`, { api });
    await userEvent.click(await screen.findByTestId('payment-reject'));
    await userEvent.click(await screen.findByTestId('payment-reject-confirm')); // FA-037: Decline asks first
    expect(await screen.findByText('Declined by the approver. Nothing was moved.')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-approve')).not.toBeInTheDocument();
  });

  it('refuses an unverified account, over the limit, and says why G_40_4', async () => {
    const api = new DemoOnGemApi();
    const f = await api.linkFundingSource({
      accountId: 'acc_demo_ops',
      method: 'MANUAL',
      accountNumber: '4444',
      routingNumber: '021000021',
      accountType: 'SAVINGS',
      ownerName: 'Northwind Labs LLC',
    });
    const top = (id: string, amountMinor: number) =>
      api.createTopUp({ fundingSourceId: id, toAccountId: 'acc_demo_ops', amountMinor, currency: 'USD' });
    const unverified = await top(f.id, 100).catch((e: unknown) => e);
    expect(errorText(unverified)).toMatch(/not verified this account yet/);
    const over = await top('fsrc_demo_main', 2_500_001).catch((e: unknown) => e);
    expect(errorText(over)).toBe('This top-up is over the limit of US$25,000.00 for one top-up.');
    expect(errorText(new ApiError(403, 'self_approval_forbidden'))).toBe(
      'A second person approves this, not the person who made it.',
    );
  });

  it('roles: a viewer sees the accounts only, an approver can approve G_40_5', async () => {
    const as = (role: string) =>
      new DemoOnGemApi({ me: { ...demoMe, memberships: [{ ...demoMe.memberships[0]!, role }] } });
    const owner = new DemoOnGemApi();
    const pending = await owner.createTopUp({
      fundingSourceId: 'fsrc_demo_main',
      toAccountId: 'acc_demo_ops',
      amountMinor: 10_000,
      currency: 'USD',
    });
    const viewer = as('VIEWER');
    const { unmount } = renderApp('/payments/top-up', { api: viewer });
    await screen.findByTestId('funding-fsrc_demo_main');
    expect(screen.queryByTestId('topup-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('funding-link-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('funding-remove-fsrc_demo_main')).not.toBeInTheDocument();
    unmount();
    const approver = as('APPROVER');
    Object.assign(approver, { paymentsState: [pending] });
    renderApp(`/payments/${pending.id}`, { api: approver });
    expect(await screen.findByTestId('payment-approve')).toBeInTheDocument();
  });
});

describe('scheduled payments (G-120)', () => {
  it('creates a monthly ACH schedule and shows the next payment date G_120_1', async () => {
    const api = new DemoOnGemApi();
    renderApp('/payments', { api });
    await userEvent.click(await screen.findByTestId('payments-tab-scheduled'));
    await userEvent.selectOptions(await screen.findByTestId('schedule-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('schedule-amount'), '2,000.00');
    const start = screen.getByTestId('schedule-start');
    await userEvent.clear(start);
    await userEvent.type(start, '2026-12-01');
    await userEvent.selectOptions(screen.getByTestId('schedule-ends'), 'count');
    await userEvent.clear(screen.getByTestId('schedule-count'));
    await userEvent.type(screen.getByTestId('schedule-count'), '3');
    expect(screen.getByTestId('schedule-summary')).toHaveTextContent(
      'US$2,000.00 every month, first on 1 Dec 2026',
    );
    await userEvent.click(screen.getByTestId('schedule-save'));
    const [s] = await api.schedules();
    expect(s).toMatchObject({
      frequency: 'MONTHLY',
      interval: 1,
      count: 3,
      startDate: '2026-12-01',
      rail: 'ACH',
    });
    expect(await screen.findByTestId(`schedule-next-${s!.id}`)).toHaveTextContent(
      'Next payment on 1 Dec 2026',
    );
    expect(screen.getByTestId(`schedule-${s!.id}`)).toHaveTextContent('Every month');
    expect(screen.getByTestId(`schedule-state-${s!.id}`)).toHaveTextContent('Active');
    expect(api.stepUps).toContain('payment');
    await userEvent.click(screen.getByTestId(`schedule-runs-toggle-${s!.id}`));
    expect(await screen.findByTestId(`schedule-runs-${s!.id}`)).toHaveTextContent('No payment has been made');
  });

  it('pauses, resumes and cancels G_120_2', async () => {
    const api = new DemoOnGemApi();
    const s = await api.createSchedule({
      fromAccountId: 'acc_demo_ops',
      recipientId: 'rcp_demo_acme',
      rail: 'ACH',
      amountMinor: 50_000,
      currency: 'USD',
      frequency: 'WEEKLY',
      interval: 2,
      startDate: '2026-11-02',
    });
    renderApp('/payments/schedules', { api });
    await userEvent.click(await screen.findByTestId(`schedule-pause-${s.id}`));
    expect(await screen.findByText('Paused. No payment is made until you resume it.')).toBeInTheDocument();
    expect(screen.getByTestId(`schedule-${s.id}`)).toHaveTextContent('Every 2 weeks');
    await userEvent.click(screen.getByTestId(`schedule-resume-${s.id}`));
    expect(await screen.findByText('Next payment on 2 Nov 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`schedule-cancel-${s.id}`));
    expect(await screen.findByText('No more payments.')).toBeInTheDocument();
    expect(screen.getByTestId(`schedule-state-${s.id}`)).toHaveTextContent('Cancelled');
    expect(screen.queryByTestId(`schedule-resume-${s.id}`)).not.toBeInTheDocument();
    const again = await api.resumeSchedule(s.id).catch((e: unknown) => e);
    expect(errorText(again)).toMatch(/cannot do that now/);
  });

  it('a resume skips the dates that passed while paused, and month ends hold G_120_3', async () => {
    let now = '2026-10-29T15:00:00Z';
    const api = new DemoOnGemApi({ now: () => now });
    const s = await api.createSchedule({
      fromAccountId: 'acc_demo_ops',
      recipientId: 'rcp_demo_acme',
      rail: 'ACH',
      amountMinor: 1_000,
      currency: 'USD',
      frequency: 'DAILY',
      interval: 1,
      startDate: '2026-10-30',
      endDate: '2026-11-05',
    });
    await api.pauseSchedule(s.id);
    now = '2026-11-03T09:00:00Z';
    expect((await api.resumeSchedule(s.id)).nextRunOn).toBe('2026-11-03');
    await api.pauseSchedule(s.id);
    now = '2026-11-06T09:00:00Z';
    expect(await api.resumeSchedule(s.id)).toMatchObject({ state: 'COMPLETED', nextRunOn: null });
    expect(nthRun('2026-01-31', 'MONTHLY', 1, 1)).toBe('2026-02-28');
    expect(nthRun('2026-01-31', 'MONTHLY', 1, 2)).toBe('2026-03-31');
    expect(nthRun('2026-12-28', 'WEEKLY', 1, 1)).toBe('2027-01-04');
    expect(formatDay('2026-12-01')).toBe('1 Dec 2026');
    expect(frequencyText('DAILY', 3)).toBe('Every 3 days');
    const internal = await api
      .createSchedule({
        ...{
          fromAccountId: 'acc_demo_ops',
          recipientId: 'rcp_demo_acme',
          amountMinor: 1,
          currency: 'USD',
          frequency: 'DAILY',
          interval: 1,
          startDate: '2026-12-01',
        },
        rail: 'BOOK' as 'ACH',
      })
      .catch((e: unknown) => e);
    expect(errorText(internal)).toMatch(/not available yet/);
  });

  it('a viewer sees the schedules only G_120_4', async () => {
    const owner = new DemoOnGemApi();
    const s = await owner.createSchedule({
      fromAccountId: 'acc_demo_ops',
      recipientId: 'rcp_demo_acme',
      rail: 'ACH',
      amountMinor: 1_000,
      currency: 'USD',
      frequency: 'MONTHLY',
      interval: 1,
      startDate: '2026-12-01',
    });
    const viewer = new DemoOnGemApi({
      me: { ...demoMe, memberships: [{ ...demoMe.memberships[0]!, role: 'VIEWER' }] },
    });
    Object.assign(viewer, { schedulesState: [s] });
    renderApp('/payments/schedules', { api: viewer });
    expect(await screen.findByTestId(`schedule-${s.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`schedule-pause-${s.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('schedule-form')).not.toBeInTheDocument();
  });
});

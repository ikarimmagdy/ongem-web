/// <reference types="node" />
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError } from '../api/errors';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { getLocale, setLocale } from '../i18n';
import { noticeRoute } from '../screens/Notifications';
import { spendOf } from '../spend/api';
import { SPEND_ERROR_CODES, spendErrorText } from '../spend/common';
import { demoEmployeeMe } from '../spend/demo';
import { expensePaging } from '../spend/Expenses';
import { spendPeriodValid } from '../spend/Exports';
import { chooseDate, chooseOption, renderApp } from './render';

const root = join(__dirname, '..', '..');

const finance = (opts: ConstructorParameters<typeof DemoOnGemApi>[0] = {}) => new DemoOnGemApi(opts);
const asRole = (role: string) =>
  finance({ me: { ...demoMe, memberships: [{ ...demoMe.memberships[0]!, role }] } });
const employee = () => new DemoOnGemApi({ me: demoEmployeeMe });
/** Lea as an owner: finance and an employee at once, for the four-eyes rule on her own expense. */
const leaOwner = () =>
  new DemoOnGemApi({
    me: { ...demoEmployeeMe, memberships: [{ ...demoEmployeeMe.memberships[0]!, role: 'OWNER' }] },
  });

afterEach(async () => {
  expensePaging.size = 25;
  if (getLocale() !== 'en') await act(() => setLocale('en'));
});

describe('OG-087 spend section behind the programme', () => {
  it('OG087_hidden_when_the_programme_is_off_and_shown_when_active', async () => {
    const off = finance({
      me: {
        ...demoMe,
        companyId: 'cmp_other',
        memberships: [{ ...demoMe.memberships[0]!, companyId: 'cmp_other' }],
      },
    });
    const first = renderApp('/spend', { api: off });
    expect(await screen.findByTestId('spend-off')).toHaveTextContent(
      'Company cards and expenses are not turned on',
    );
    expect(screen.queryByTestId('nav-spend')).toBeNull();
    expect(off.calls).toContain('spendProgram');
    expect(off.calls).not.toContain('spendTeams');
    first.unmount();

    const on = finance();
    renderApp('/spend', { api: on });
    expect(await screen.findByTestId('nav-spend')).toHaveTextContent('Spend');
    const overview = await screen.findByTestId('spend-overview');
    expect(within(overview).getByTestId('spend-count-open')).toHaveTextContent('7');
    expect(within(overview).getByTestId('spend-count-pending')).toHaveTextContent('0');
    expect(within(overview).getByTestId('spend-count-receipts')).toHaveTextContent('0');
    expect(overview).toHaveTextContent('Version 1');
    expect(screen.getByText('Nothing is waiting for a decision.')).toBeInTheDocument();
  });

  it('OG087_a_member_without_spend_permissions_sees_no_spend', async () => {
    const api = asRole('MEMBER');
    renderApp('/', { api });
    await screen.findByTestId('nav-home');
    expect(screen.queryByTestId('nav-spend')).toBeNull();
    expect(api.calls).not.toContain('spendProgram');
  });

  it('OG087_overview_shows_what_waits_in_review_state', async () => {
    renderApp('/spend', { api: finance({ scenario: 'spend_review' }) });
    const overview = await screen.findByTestId('spend-overview');
    expect(within(overview).getByTestId('spend-count-pending')).toHaveTextContent('1');
    expect(within(overview).getByTestId('spend-count-receipts')).toHaveTextContent('1');
    expect(screen.getByTestId('spend-overview-proposal')).toHaveTextContent(
      'Policy version 2 is waiting for a decision',
    );
    expect(within(screen.getByTestId('spend-waiting')).getByText('Corner Bistro')).toBeInTheDocument();
  });
});

describe('OG-087 teams (R3)', () => {
  it('OG087_AC_R3_teams_list_add_duplicate_rename_archive', async () => {
    const api = finance();
    renderApp('/spend/teams', { api });
    const list = await screen.findByTestId('team-list');
    expect(within(list).getByTestId('team-spt_demo_eng')).toHaveTextContent('Engineering2 active employees');
    expect(within(list).getByTestId('team-spt_demo_sales')).toHaveTextContent('Sales1 active employee');
    await userEvent.type(screen.getByTestId('team-name'), 'Engineering');
    await userEvent.click(screen.getByTestId('team-add'));
    expect(await screen.findByTestId('team-error')).toHaveTextContent(
      'A team with this name already exists.',
    );
    await userEvent.clear(screen.getByTestId('team-name'));
    await userEvent.type(screen.getByTestId('team-name'), 'Operations');
    await userEvent.click(screen.getByTestId('team-add'));
    expect(await within(await screen.findByTestId('team-list')).findByText('Operations')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('team-rename-spt_demo_sales'));
    const input = screen.getByTestId('team-rename-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'Revenue');
    await userEvent.click(screen.getByTestId('team-rename-save'));
    expect(await screen.findByText('Revenue')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('team-archive-spt_demo_eng'));
    await waitFor(() => expect(screen.getByTestId('team-spt_demo_eng')).toHaveTextContent('Archived'));
    expect(screen.queryByTestId('team-archive-spt_demo_eng')).toBeNull();
  });

  it('OG087_teams_error_and_viewer_states', async () => {
    const api = finance();
    api.spend.teams = () => Promise.reject(new ApiError(503, 'provider_unavailable'));
    renderApp('/spend/teams', { api });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('OG087_a_viewer_reads_teams_without_changing_them', async () => {
    renderApp('/spend/teams', { api: asRole('VIEWER') });
    await screen.findByTestId('team-list');
    expect(screen.queryByTestId('team-form')).toBeNull();
    expect(screen.queryByTestId('team-rename-spt_demo_eng')).toBeNull();
  });
});

describe('OG-087 employees (R3, R4)', () => {
  it('OG087_AC_R3_1_the_seeded_employees_and_inviting_one', async () => {
    const api = finance();
    renderApp('/spend/employees', { api });
    const list = await screen.findByTestId('employee-list');
    const names = within(list)
      .getAllByRole('link')
      .map((a) => a.querySelector('strong')?.textContent);
    expect(names).toEqual(['Sam Iverson', 'Tom Bergstrom', 'Lea Fontaine']);
    expect(within(list).getByTestId('employee-emp_demo_lea')).toHaveTextContent(
      'Engineering · l***@northwind.example',
    );
    expect(within(list).getByTestId('employee-emp_demo_lea')).toHaveTextContent('•••• 4417');
    await userEvent.click(screen.getByTestId('employee-invite'));
    expect(screen.getAllByText('This is needed.')).toHaveLength(2);
    await userEvent.type(screen.getByTestId('employee-first'), 'Nina');
    await userEvent.type(screen.getByTestId('employee-last'), 'Okafor');
    await userEvent.type(screen.getByTestId('employee-email'), 'nina@northwind.example');
    await chooseOption(screen.getByTestId('employee-team'), 'spt_demo_sales');
    await userEvent.click(screen.getByTestId('employee-invite'));
    const row = await screen.findByText('Nina Okafor');
    expect(row.closest('a')).toHaveTextContent('Sales · n***@northwind.example');
    expect(row.closest('a')).toHaveTextContent('Invited');
    expect(row.closest('a')).toHaveTextContent('No card');
  });

  it('OG087_AC_R3_3_suspend_reactivate_offboard_freeze_the_card', async () => {
    const api = finance();
    renderApp('/spend/employees/emp_demo_tom', { api });
    expect(await screen.findByTestId('employee-state')).toHaveTextContent('Invited');
    await userEvent.click(screen.getByTestId('employee-suspend'));
    await waitFor(() => expect(screen.getByTestId('employee-state')).toHaveTextContent('Suspended'));
    expect(screen.getByTestId('employee-card-state')).toHaveTextContent('Frozen');
    await userEvent.click(screen.getByTestId('employee-reactivate'));
    await waitFor(() => expect(screen.getByTestId('employee-state')).toHaveTextContent('Invited'));
    await userEvent.click(screen.getByTestId('employee-card-unfreeze'));
    await waitFor(() => expect(screen.getByTestId('employee-card-state')).toHaveTextContent('Active'));
    expect(api.stepUps).toContain('card');
    await userEvent.click(screen.getByTestId('employee-offboard'));
    expect(await screen.findByText(/This cannot be undone/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('employee-offboard-confirm'));
    await waitFor(() => expect(screen.getByTestId('employee-state')).toHaveTextContent('Offboarded'));
    expect(screen.getByTestId('employee-card-state')).toHaveTextContent('Frozen');
    expect(screen.queryByTestId('employee-suspend')).toBeNull();
    expect(screen.queryByTestId('employee-card-unfreeze')).toBeNull();
  });

  it('OG087_AC_R4_1_issue_a_card_with_step_up_then_card_exists', async () => {
    const api = finance();
    const created = await spendOf(api).createEmployee({
      firstName: 'Nina',
      lastName: 'Okafor',
      email: 'nina@northwind.example',
    });
    renderApp(`/spend/employees/${created.id}`, { api });
    expect(await screen.findByTestId('employee-no-card')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('employee-card-issue'));
    await userEvent.click(screen.getByTestId('card-issue-confirm'));
    expect(screen.getAllByText('This is needed.').length).toBe(5);
    await userEvent.type(screen.getByTestId('card-dob'), '1990-04-02');
    await userEvent.type(screen.getByTestId('card-line1'), '1 Demo Street');
    await userEvent.type(screen.getByTestId('card-city'), 'Austin');
    await userEvent.type(screen.getByTestId('card-region'), 'TX');
    await userEvent.type(screen.getByTestId('card-postal'), '78701');
    await userEvent.click(screen.getByTestId('card-issue-confirm'));
    await waitFor(() => expect(screen.getByTestId('employee-card-state')).toHaveTextContent('Active'));
    expect(api.stepUps).toContain('spend_card');
    await expect(
      spendOf(api).issueCard(created.id, {
        dateOfBirth: '1990-04-02',
        address: { line1: 'x', city: 'y', region: 'TX', postalCode: '1', country: 'US' },
      }),
    ).rejects.toMatchObject({ code: 'card_exists' });
    expect(spendErrorText(new ApiError(409, 'card_exists'))).toBe('This employee already has a card.');
  });

  it('OG087_card_issue_bank_unavailable_keeps_the_key_for_try_again', async () => {
    const api = finance();
    const created = await spendOf(api).createEmployee({
      firstName: 'Nina',
      lastName: 'Okafor',
      email: 'nina@northwind.example',
    });
    const keys: (string | undefined)[] = [];
    const real = api.spend.issueCard;
    api.spend.issueCard = (id, body, key) => {
      keys.push(key);
      return keys.length === 1 ? Promise.reject(new ApiError(503, 'bank_unavailable')) : real(id, body, key);
    };
    renderApp(`/spend/employees/${created.id}`, { api });
    await userEvent.click(await screen.findByTestId('employee-card-issue'));
    for (const [id, v] of [
      ['card-dob', '1990-04-02'],
      ['card-line1', '1 Demo Street'],
      ['card-city', 'Austin'],
      ['card-region', 'TX'],
      ['card-postal', '78701'],
    ])
      await userEvent.type(screen.getByTestId(id!), v!);
    await userEvent.click(screen.getByTestId('card-issue-confirm'));
    expect(await screen.findByTestId('card-issue-error')).toHaveTextContent(
      'The bank did not answer. Try again',
    );
    expect(screen.getByTestId('card-issue-confirm')).toHaveTextContent('Try again');
    await userEvent.click(screen.getByTestId('card-issue-confirm'));
    await waitFor(() => expect(screen.getByTestId('employee-card-state')).toHaveTextContent('Active'));
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});

describe('OG-087 expenses (R6, R9, R11)', () => {
  it('OG087_AC_R6_1_the_seven_purchases_filters_and_keyset_paging', async () => {
    expensePaging.size = 3;
    const api = finance();
    renderApp('/spend/expenses', { api });
    expect(await screen.findByTestId('expense-row-exp_demo_7')).toHaveTextContent('Uber');
    expect(screen.getByTestId('expense-row-exp_demo_6')).toHaveTextContent('Hilton Hotels');
    expect(screen.getByTestId('expense-row-exp_demo_5')).toHaveTextContent('Apple Store');
    expect(screen.queryByTestId('expense-row-exp_demo_4')).toBeNull();
    await userEvent.click(screen.getByTestId('expense-next'));
    expect(await screen.findByTestId('expense-row-exp_demo_4')).toHaveTextContent('Staples');
    await userEvent.click(screen.getByTestId('expense-next'));
    expect(await screen.findByTestId('expense-row-exp_demo_1')).toHaveTextContent('Figma');
    expect(screen.queryByTestId('expense-next')).toBeNull();
    await userEvent.click(screen.getByTestId('expense-previous'));
    expect(await screen.findByTestId('expense-row-exp_demo_4')).toBeInTheDocument();
    expensePaging.size = 25;
    await chooseOption(screen.getByTestId('expense-employee'), 'emp_demo_lea');
    await waitFor(() => expect(screen.queryByTestId('expense-row-exp_demo_7')).toBeNull());
    expect(screen.getByTestId('expense-row-exp_demo_2')).toHaveTextContent('Delta Air Lines');
    await userEvent.click(screen.getByTestId('expense-filter-APPROVED'));
    expect(await screen.findByText('No expenses match.')).toBeInTheDocument();
  }, 30_000);

  it('OG087_AC_R9_2_finance_recodes_an_expense', async () => {
    const api = finance();
    renderApp('/spend/expenses/exp_demo_2', { api });
    expect(await screen.findByTestId('expense-receipt')).toHaveTextContent('Missing');
    await chooseOption(screen.getByTestId('recode-category'), 'travel');
    await chooseOption(screen.getByTestId('recode-tax'), 'SALES_TAX');
    await userEvent.type(screen.getByTestId('recode-vat'), '500');
    await userEvent.click(screen.getByTestId('recode-save'));
    expect(await screen.findByText('Enter an amount no larger than the expense.')).toBeInTheDocument();
    await userEvent.clear(screen.getByTestId('recode-vat'));
    await userEvent.type(screen.getByTestId('recode-vat'), '9.10');
    await userEvent.click(screen.getByTestId('recode-save'));
    await waitFor(() => expect(screen.getByTestId('expense-detail')).toHaveTextContent('Travel'));
    expect(screen.getByTestId('expense-detail')).toHaveTextContent('Sales tax');
    expect(screen.getByTestId('expense-detail')).toHaveTextContent('US$9.10');
    expect(api.calls).toContain('spendRecode');
  });

  it('OG087_AC_R11_1_approve_and_reject_with_a_reason', async () => {
    const api = finance({ scenario: 'spend_review' });
    const first = renderApp('/spend/expenses/exp_demo_8', { api });
    expect(await screen.findByTestId('expense-reasons')).toHaveTextContent(
      'Needs a person: an out of pocket claim',
    );
    await userEvent.click(screen.getByTestId('expense-reject'));
    await userEvent.click(screen.getByTestId('expense-reject-confirm'));
    expect(await screen.findByText('Write why you reject it, so the employee knows.')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('expense-reject-note'), 'Not a client lunch');
    await userEvent.click(screen.getByTestId('expense-reject-confirm'));
    await waitFor(() => expect(screen.getByTestId('expense-state')).toHaveTextContent('Rejected'));
    expect(screen.getByTestId('expense-detail')).toHaveTextContent('Not a client lunch');
    expect(screen.queryByTestId('expense-decide')).toBeNull();
    first.unmount();

    const again = finance({ scenario: 'spend_review' });
    renderApp('/spend/expenses/exp_demo_8', { api: again });
    await userEvent.click(await screen.findByTestId('expense-approve'));
    await waitFor(() => expect(screen.getByTestId('expense-state')).toHaveTextContent('Approved'));
    await expect(spendOf(again).decideExpense('exp_demo_8', true)).rejects.toMatchObject({
      code: 'invalid_transition',
    });
  });

  it('OG087_AC_R11_1_four_eyes_on_your_own_expense', async () => {
    const api = leaOwner();
    const spend = spendOf(api);
    await spend.codeMyExpense('exp_demo_1', { category: 'travel' });
    const claim = await spend.claim({
      amountMinor: 1800,
      currency: 'USD',
      merchant: 'Corner Bistro',
      spentOn: '2026-10-29',
      category: 'meals',
    });
    expect((await spend.submitMyExpense(claim.id)).state).toBe('PENDING_APPROVAL');
    renderApp(`/spend/expenses/${claim.id}`, { api });
    expect(await screen.findByTestId('expense-four-eyes')).toHaveTextContent('This is your own expense');
    expect(screen.queryByTestId('expense-approve')).toBeNull();
    await expect(spend.decideExpense(claim.id, true)).rejects.toMatchObject({
      code: 'self_approval_forbidden',
    });
  });

  it('OG087_receipt_download_on_an_expense', async () => {
    const api = finance();
    const created = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoke });
    renderApp('/spend/expenses/exp_demo_3', { api });
    await userEvent.click(await screen.findByTestId('expense-receipt-download'));
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(api.calls).toContain('spendReceiptFile');
  });
});

describe('OG-087 unmatched receipts (R8)', () => {
  it('OG087_AC_R8_2_finance_matches_a_receipt_by_hand', async () => {
    const api = finance({ scenario: 'spend_review' });
    renderApp('/spend/receipts', { api });
    const row = await screen.findByTestId('receipt-rct_demo_3');
    expect(row).toHaveTextContent('hilton-folio.pdf');
    expect(row).toHaveTextContent('Told: US$180.00, 29 Oct 2026, Hilton Hotels');
    expect(row).toHaveTextContent('Likely expenses');
    expect(screen.getByTestId('receipt-pick-rct_demo_3')).toHaveTextContent(
      'Hilton Hotels, US$184.00, 29 Oct 2026, Sam Iverson',
    );
    await userEvent.click(screen.getByTestId('receipt-match-rct_demo_3'));
    expect(await screen.findByTestId('receipts-empty')).toBeInTheDocument();
    expect((await spendOf(api).expense('exp_demo_6')).receipt).toBe('ATTACHED');
  });

  it('OG087_receipts_empty_state', async () => {
    renderApp('/spend/receipts', { api: finance() });
    expect(await screen.findByText('Every receipt is matched')).toBeInTheDocument();
  });
});

describe('OG-087 policy with four eyes (R5)', () => {
  it('OG087_AC_R5_2_a_limit_above_the_ceiling_is_refused_before_it_is_sent', async () => {
    const api = finance();
    renderApp('/spend/policy', { api });
    const active = await screen.findByTestId('policy-active');
    expect(active).toHaveTextContent('Policy in force: version 1');
    expect(active).toHaveTextContent('US$1,000.00');
    expect(active).toHaveTextContent('Travel (6100)');
    await userEvent.click(screen.getByTestId('policy-propose'));
    const per = screen.getByTestId('policy-per');
    await userEvent.clear(per);
    await userEvent.type(per, '20000');
    await userEvent.click(screen.getByTestId('policy-submit'));
    expect(await screen.findByText('The programme allows up to US$10,000.00.')).toBeInTheDocument();
    expect(api.calls).not.toContain('spendProposePolicy');
    await expect(
      spendOf(api).proposePolicy({
        ...(await spendOf(api).policy()).active!.policy,
        perTransactionLimitMinor: 2_000_000,
      }),
    ).rejects.toMatchObject({ code: 'policy_invalid' });
  });

  it('OG087_AC_R5_1_the_proposer_cannot_approve_and_may_withdraw', async () => {
    const api = finance();
    renderApp('/spend/policy', { api });
    await userEvent.click(await screen.findByTestId('policy-propose'));
    const per = screen.getByTestId('policy-per');
    await userEvent.clear(per);
    await userEvent.type(per, '1500');
    await userEvent.type(screen.getByTestId('policy-reason-input'), 'Travel costs went up');
    await userEvent.click(screen.getByTestId('policy-submit'));
    const proposed = await screen.findByTestId('policy-proposed');
    expect(proposed).toHaveTextContent('Proposed: version 2');
    expect(proposed).toHaveTextContent('Proposed by you');
    expect(screen.getByTestId('policy-four-eyes')).toHaveTextContent('You proposed this, so another person');
    expect(screen.queryByTestId('policy-approve')).toBeNull();
    expect(screen.queryByTestId('policy-propose')).toBeNull();
    await expect(spendOf(api).decidePolicy(2, true)).rejects.toMatchObject({
      code: 'self_approval_forbidden',
    });
    await userEvent.click(screen.getByTestId('policy-withdraw'));
    await waitFor(() => expect(screen.queryByTestId('policy-proposed')).toBeNull());
    expect(within(screen.getByTestId('policy-versions')).getByText('Withdrawn')).toBeInTheDocument();
  });

  it('OG087_AC_R5_1_another_person_approves_with_step_up_and_the_old_version_is_superseded', async () => {
    const api = finance({ scenario: 'spend_review' });
    renderApp('/spend/policy', { api });
    const proposed = await screen.findByTestId('policy-proposed');
    expect(proposed).toHaveTextContent('Proposed by Priya Shah');
    expect(screen.getByTestId('policy-reason')).toHaveTextContent('Why: Travel costs went up');
    expect(screen.getByTestId('policy-four-eyes')).toHaveTextContent('Four eyes');
    await userEvent.click(screen.getByTestId('policy-approve'));
    await waitFor(() =>
      expect(screen.getByTestId('policy-active')).toHaveTextContent('Policy in force: version 2'),
    );
    expect(api.stepUps).toContain('spend_policy');
    expect(within(screen.getByTestId('policy-versions')).getByText('Superseded')).toBeInTheDocument();
  });

  it('OG087_reject_a_proposal_and_an_admin_without_approval_rights', async () => {
    const api = finance({ scenario: 'spend_review' });
    const first = renderApp('/spend/policy', { api });
    await userEvent.click(await screen.findByTestId('policy-reject'));
    await userEvent.type(screen.getByTestId('policy-reject-note'), 'Too high');
    await userEvent.click(screen.getByTestId('policy-reject-confirm'));
    await waitFor(() => expect(screen.queryByTestId('policy-proposed')).toBeNull());
    expect(within(screen.getByTestId('policy-versions')).getByText('Rejected')).toBeInTheDocument();
    first.unmount();

    const admin = new DemoOnGemApi({
      scenario: 'spend_review',
      me: { ...demoMe, memberships: [{ ...demoMe.memberships[0]!, role: 'ADMIN' }] },
    });
    renderApp('/spend/policy', { api: admin });
    expect(await screen.findByTestId('policy-no-approve')).toBeInTheDocument();
    expect(screen.queryByTestId('policy-approve')).toBeNull();
  });
});

describe('OG-087 exports (R13)', () => {
  it('OG087_AC_R13_1_approved_lines_and_what_was_left_out', async () => {
    const api = finance({ scenario: 'spend_review' });
    renderApp('/spend/exports', { api });
    expect(await screen.findByText('No exports yet.')).toBeInTheDocument();
    await chooseDate(screen.getByTestId('spend-export-from'), '2026-10-01');
    await chooseDate(screen.getByTestId('spend-export-to'), '2026-10-31');
    await chooseOption(screen.getByTestId('spend-export-format'), 'XERO');
    await userEvent.click(screen.getByTestId('spend-export-create'));
    const result = await screen.findByTestId('spend-export-result');
    expect(result).toHaveTextContent('1 expenses from 1 Oct 2026 to 31 Oct 2026');
    expect(result).toHaveTextContent('Xero');
    expect(result).toHaveTextContent('US$78.00');
    const left = within(result).getByTestId('spend-export-excluded');
    expect(left).toHaveTextContent('Left out: 6 expenses, US$1,059.99, not submitted yet');
    expect(left).toHaveTextContent('Left out: 1 expenses, US$18.00, still waiting for approval');
    expect(within(result).getByTestId('spend-export-download')).toHaveAttribute(
      'download',
      'spend-2026-10-01-2026-10-31.xero.csv',
    );
    expect(await screen.findByTestId('spend-export-list')).toBeInTheDocument();
    // AC-R13.2: the same period again has no line, the expense was exported once.
    await userEvent.click(screen.getByTestId('spend-export-create'));
    expect(await screen.findByTestId('spend-export-empty')).toBeInTheDocument();
  }, 30_000);

  it('OG087_period_rule_is_the_contracts', () => {
    expect(spendPeriodValid('2026-10-01', '2026-10-31')).toBe(true);
    expect(spendPeriodValid('2026-10-31', '2026-10-01')).toBe(false);
    expect(spendPeriodValid('2025-01-01', '2026-01-02')).toBe(false);
  });

  it('OG087_exports_hidden_without_spend_export', async () => {
    renderApp('/spend', { api: asRole('APPROVER') });
    await screen.findByTestId('spend-tabs');
    expect(screen.queryByTestId('spend-tab-exports')).toBeNull();
    expect(screen.getByTestId('spend-tab-policy')).toBeInTheDocument();
  });
});

describe('OG-087 employee view', () => {
  it('OG087_an_employee_sees_only_their_spend', async () => {
    const api = employee();
    renderApp('/', { api });
    const card = await screen.findByTestId('my-card');
    expect(card).toHaveTextContent('•••• 4417');
    expect(screen.getByTestId('my-card-state')).toHaveTextContent('Active');
    const side = document.querySelector('.fw-side nav') as HTMLElement;
    expect(
      within(side)
        .getAllByRole('link')
        .map((a) => a.querySelector('.fw-nav__label')?.textContent),
    ).toEqual(['Spend', 'Settings']);
    expect(screen.getByTestId('spend-needs')).toHaveTextContent('1 expense needs a receipt.');
    expect(screen.getByTestId('my-receipt-threshold')).toHaveTextContent('US$50.00');
    expect(api.calls).not.toContain('accounts');
    expect(api.calls).not.toContain('spendTeams');
    await userEvent.click(screen.getByTestId('my-card-freeze'));
    await waitFor(() => expect(screen.getByTestId('my-card-state')).toHaveTextContent('Frozen'));
    await userEvent.click(screen.getByTestId('my-card-unfreeze'));
    await waitFor(() => expect(screen.getByTestId('my-card-state')).toHaveTextContent('Active'));
    await userEvent.click(screen.getByTestId('my-card-reveal'));
    expect(api.calls).toContain('spendMyCardWidget');
    expect(api.stepUps.filter((s) => s === 'card')).toHaveLength(2);
  });

  it('OG087_AC_R10_1_submit_needs_a_category_and_the_receipt_then_the_policy_approves', async () => {
    const api = employee();
    renderApp('/spend/me/expenses/exp_demo_2', { api });
    await userEvent.click(await screen.findByTestId('my-expense-submit'));
    expect(await screen.findByTestId('my-expense-error')).toHaveTextContent(
      'Pick a category before you submit.',
    );
    await chooseOption(screen.getByTestId('coding-category'), 'travel');
    await userEvent.click(screen.getByTestId('coding-save'));
    await waitFor(() => expect(screen.getByTestId('my-expense-detail')).toHaveTextContent('Travel'));
    await userEvent.click(screen.getByTestId('my-expense-submit'));
    expect(await screen.findByTestId('my-expense-error')).toHaveTextContent(
      'Add the receipt before you submit',
    );
    expect(screen.getByTestId('my-receipt-required')).toHaveTextContent('above US$50.00');
    expect(screen.getByTestId('receipt-amount')).toHaveValue('129.99');
    const file = new File(['%PDF delta'], 'delta.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByTestId('receipt-file'), file);
    await userEvent.click(screen.getByTestId('receipt-upload-submit'));
    await waitFor(() => expect(screen.getByTestId('expense-receipt')).toHaveTextContent('Attached'));
    await userEvent.click(screen.getByTestId('my-expense-submit'));
    await waitFor(() => expect(screen.getByTestId('expense-state')).toHaveTextContent('Approved'));
    expect(screen.getByTestId('my-expense-detail')).toHaveTextContent('By policy version 1');
    expect(screen.queryByTestId('my-expense-submit')).toBeNull();
  });

  it('OG087_AC_R8_1_a_receipt_with_amount_and_date_matches_its_purchase', async () => {
    const api = employee();
    renderApp('/spend/me/receipts', { api });
    expect(await screen.findByTestId('my-receipt-list')).toHaveTextContent('blue-bottle-coffee.pdf');
    await userEvent.upload(
      screen.getByTestId('receipt-file'),
      new File(['%PDF figma'], 'figma.pdf', { type: 'application/pdf' }),
    );
    await userEvent.type(screen.getByTestId('receipt-amount'), '42.50');
    await chooseDate(screen.getByTestId('receipt-date'), '2026-10-27');
    await userEvent.click(screen.getByTestId('receipt-upload-submit'));
    expect(await screen.findByTestId('receipt-result-matched')).toHaveTextContent(
      'Receipt uploaded and matched by amount and date.',
    );
    expect((await spendOf(api).myExpense('exp_demo_1')).receipt).toBe('ATTACHED');
  });

  it('OG087_AC_R8_2_an_unmatched_receipt_is_matched_by_hand_and_upload_errors', async () => {
    const api = employee();
    renderApp('/spend/me/receipts', { api });
    await screen.findByTestId('my-receipt-list');
    await userEvent.upload(
      screen.getByTestId('receipt-file'),
      new File(['%PDF hotel'], 'hotel.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByTestId('receipt-upload-submit'));
    const result = await screen.findByTestId('receipt-result-unmatched');
    expect(result).toHaveTextContent('We could not tell which purchase it is for');
    const pick = within(result).getByRole('combobox');
    await chooseOption(pick, /Delta Air Lines/);
    await userEvent.click(within(result).getByRole('button', { name: 'Match' }));
    expect(await screen.findByTestId('receipt-result-matched')).toHaveTextContent('matched by hand');
    expect((await spendOf(api).myExpense('exp_demo_2')).receipt).toBe('ATTACHED');

    await userEvent.upload(
      screen.getByTestId('receipt-file'),
      new File(['%PDF hotel'], 'hotel.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByTestId('receipt-upload-submit'));
    expect(await screen.findByTestId('receipt-upload-error')).toHaveTextContent(
      'This receipt was uploaded before.',
    );
    await userEvent.upload(
      screen.getByTestId('receipt-file'),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      {
        applyAccept: false,
      },
    );
    await userEvent.click(screen.getByTestId('receipt-upload-submit'));
    expect(await screen.findByTestId('receipt-upload-error')).toHaveTextContent(
      'This file type is not accepted.',
    );
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 20 * 1_048_576 });
    await userEvent.upload(screen.getByTestId('receipt-file'), big);
    await userEvent.click(screen.getByTestId('receipt-upload-submit'));
    expect(await screen.findByTestId('receipt-upload-error')).toHaveTextContent('This file is too large.');
  });

  it('OG087_AC_R12_1_a_claim_follows_the_submit_rules', async () => {
    const api = employee();
    renderApp('/spend/me/claim', { api });
    await userEvent.click(await screen.findByTestId('claim-submit'));
    expect(await screen.findByText('Enter an amount above zero, such as 18.00.')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('claim-amount'), '18.00');
    await userEvent.type(screen.getByTestId('claim-merchant'), 'Corner Bistro');
    await chooseOption(screen.getByTestId('claim-category'), 'meals');
    await userEvent.click(screen.getByTestId('claim-submit'));
    const detail = await screen.findByTestId('my-expense-detail');
    expect(detail).toHaveTextContent('Out of pocket claim');
    expect(detail).toHaveTextContent('US$18.00');
    expect(screen.getByTestId('expense-state')).toHaveTextContent('Open');
    await userEvent.click(screen.getByTestId('my-expense-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('expense-state')).toHaveTextContent('Waiting for approval'),
    );
    expect(screen.getByTestId('expense-reasons')).toHaveTextContent('an out of pocket claim');
  });

  it('OG087_AC_R15_2_an_employee_cannot_read_company_expenses_and_my_expenses_lists_own', async () => {
    const api = employee();
    await expect(spendOf(api).expenses({})).rejects.toMatchObject({ status: 403 });
    expect((await spendOf(api).myExpenses()).items.map((x) => x.merchant)).toEqual([
      'Blue Bottle Coffee',
      'Delta Air Lines',
      'Figma',
    ]);
    await expect(spendOf(api).myExpense('exp_demo_6')).rejects.toMatchObject({ code: 'expense_not_found' });
    renderApp('/spend/me/expenses', { api });
    const list = await screen.findByTestId('my-expense-list');
    expect(within(list).getAllByRole('button')).toHaveLength(3);
    await userEvent.click(screen.getByTestId('my-expense-filter-APPROVED'));
    expect(await screen.findByText('No expenses here')).toBeInTheDocument();
  });

  it('OG087_a_finance_member_who_is_not_an_employee_has_no_employee_view', async () => {
    const api = finance();
    await expect(spendOf(api).me()).rejects.toMatchObject({ code: 'employee_not_found' });
    renderApp('/spend', { api });
    await screen.findByTestId('spend-tabs');
    expect(screen.queryByTestId('spend-tab-my_spend')).toBeNull();
  });
});

describe('OG-087 notice links', () => {
  it('OG087_spend_notice_links_open_the_screens', () => {
    expect(noticeRoute('spend/expenses/exp_1')).toBe('/spend/expenses/exp_1');
    expect(noticeRoute('spend/me/expenses/exp_1')).toBe('/spend/me/expenses/exp_1');
    expect(noticeRoute('spend/policy')).toBe('/spend/policy');
    expect(noticeRoute('spend/unknown/thing')).toBe('/spend');
  });
});

describe('OG-087 copy', () => {
  it('OG087_every_contract_error_code_has_its_sentence_in_english_and_arabic', () => {
    for (const region of ['us', 'ae']) {
      const seed = JSON.parse(readFileSync(join(root, 'content-seed', region, 'web_app.json'), 'utf8')) as {
        entries: { key: string; en: string; ar?: string }[];
      };
      const byKey = new Map(seed.entries.map((e) => [e.key, e]));
      const keys = [
        ...SPEND_ERROR_CODES.map((c) => `app.spend.error.${c}`),
        ...[
          'off',
          'active',
          'suspended',
          'archived',
          'invited',
          'offboarded',
          'pending',
          'frozen',
          'cancelled',
          'rejected',
          'proposed',
          'superseded',
          'withdrawn',
          'open',
          'pending_approval',
          'approved',
          'exported',
          'unmatched',
          'matched',
        ].map((s) => `app.spend.state.${s}`),
        ...['over_transaction_limit', 'over_monthly_limit', 'category_not_allowed', 'claim'].map(
          (r) => `app.spend.reason.${r}`,
        ),
        ...['travel', 'software', 'meals', 'office', 'other'].map((c) => `app.spend.category.${c}`),
        ...['none', 'sales_tax', 'vat_5', 'vat_0', 'exempt', 'out_of_scope'].map((c) => `app.spend.tax.${c}`),
        ...['not_required', 'missing', 'attached'].map((c) => `app.spend.receipt.${c}`),
        ...['attached', 'amount_date', 'manual'].map((c) => `app.spend.match.${c}`),
        ...['not_submitted', 'pending_approval'].map((c) => `app.spend.export.excluded.${c}`),
      ];
      for (const k of keys) {
        const e = byKey.get(k);
        expect(e, `${region} ${k}`).toBeDefined();
        expect(e!.ar, `${region} ${k}`).toMatch(/[؀-ۿ]/);
      }
    }
  });

  it('OG087_spend_reads_in_arabic_right_to_left', async () => {
    renderApp('/spend', { api: finance() });
    await screen.findByTestId('spend-overview');
    await act(() => setLocale('ar'));
    expect(await screen.findByText('لمحة سريعة')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(spendErrorText(new ApiError(403, 'self_approval_forbidden'))).toBe(
      'يجب أن يقرر شخص آخر: لا أحد يوافق على مصروفه أو على سياسة اقترحها.',
    );
  });

  it('OG087_unknown_category_shows_its_key', async () => {
    const { categoryLabel } = await import('../spend/common');
    expect(categoryLabel('travel')).toBe('Travel');
    expect(categoryLabel('team_offsite')).toBe('team_offsite');
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { describeTransaction } from '../screens/Accounts';
import { renderApp } from './render';

describe('accounts and statements (OG-030 R2)', () => {
  it('balances_stale_marker_and_more_AC_R2_1', async () => {
    const api = new DemoOnGemApi();
    renderApp('/accounts', { api });
    const list = await screen.findByTestId('accounts-list');
    expect(within(list).getByText('US$126,100.16')).toBeInTheDocument();
    expect(screen.getByTestId('stale-acc_demo_payroll')).toHaveTextContent(/did not answer/);
    await userEvent.click(screen.getByTestId('account-acc_demo_ops'));
    const detail = await screen.findByTestId('account-detail');
    expect(within(detail).getAllByRole('row')).toHaveLength(21);
    await userEvent.click(screen.getByTestId('show-more'));
    expect(await within(detail).findAllByRole('row')).toHaveLength(37);
  });

  it('statement_view_AC_R2_2', async () => {
    renderApp('/accounts/acc_demo_ops');
    await userEvent.click(await screen.findByTestId('statement-2026-09'));
    const view = await screen.findByTestId('statement-view');
    expect(within(view).getByText('US$98,700.00')).toBeInTheDocument();
    expect(within(view).getByText('US$119,854.00')).toBeInTheDocument();
    expect(within(view).getAllByRole('row')).toHaveLength(5);
  });
});

describe('transactions and accounts as the API sends them (live check 2026-11-02)', () => {
  it('a transaction reads as its rail and direction, never its origin', async () => {
    expect(describeTransaction({ rail: 'ACH', direction: 'DEBIT' })).toBe('ACH out');
    expect(describeTransaction({ rail: 'BOOK', direction: 'CREDIT' })).toBe('Transfer in');
    expect(describeTransaction({ rail: null, direction: 'CREDIT' })).toBe('Transaction in');
    renderApp('/accounts/acc_demo_ops');
    const detail = await screen.findByTestId('account-detail');
    expect(within(detail).queryByText(/PROVIDER|ONGEM/)).toBeNull();
    expect(within(detail).getAllByText(/^(ACH|Card) (in|out)$/).length).toBeGreaterThan(0);
  });

  it('the payment form offers only ACTIVE accounts', async () => {
    const api = new DemoOnGemApi();
    const all = api.accounts;
    api.accounts = async () =>
      (await all()).map((a) => (a.id === 'acc_demo_tax' ? { ...a, status: 'FROZEN' } : a));
    renderApp('/payments/new', { api });
    const from = await screen.findByTestId('payment-from');
    expect(within(from).queryByText(/Tax reserve/)).toBeNull();
    expect(within(from).getByText(/Operating/)).toBeInTheDocument();
  });
});

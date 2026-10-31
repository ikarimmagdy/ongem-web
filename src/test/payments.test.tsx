import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { renderApp } from './render';

describe('payments (OG-030 R4)', () => {
  it('ach_review_send_with_step_up_AC_R4_1', async () => {
    renderApp('/payments');
    await userEvent.click(await screen.findByTestId('new-payment'));
    await userEvent.selectOptions(await screen.findByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '1,250.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    expect(await screen.findByTestId('payment-review')).toHaveTextContent('US$1,250.00');
    await userEvent.click(screen.getByTestId('payment-send'));
    await userEvent.type(await screen.findByTestId('reverify-code'), '123456');
    await userEvent.click(screen.getByTestId('reverify-confirm'));
    const detail = await screen.findByTestId('payment-detail');
    expect(within(detail).getAllByText('Submitted').length).toBeGreaterThan(0);
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
    expect(await screen.findByTestId('return-code')).toHaveTextContent('R03 No account, or unable to locate account');
  });
});

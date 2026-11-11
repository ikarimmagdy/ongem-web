import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './render';

/** M-3-R35: every M3 money and card flow opens from the founder web. */
describe('M3 flows reachable (M-3-R35)', () => {
  it.each([
    ['/payments', 'payments-tab-send'],
    ['/payments/top-up', 'topup-form'],
    ['/payments/schedules', 'schedules'],
    ['/recipients', 'recipients-list'],
    ['/cards', 'cards-list'],
    ['/support/new?category=DISPUTE', 'dispute-send'], // FA-039: its own form
    ['/notifications', 'notices-list'],
  ])('AC_R35_1 %s renders', async (route, testId) => {
    renderApp(route);
    expect(await screen.findByTestId(testId)).toBeInTheDocument();
  });

  it('AC_R35_1 a card offers Dispute a charge, which opens a DISPUTE request', async () => {
    renderApp('/cards/crd_demo_ops');
    await userEvent.click(await screen.findByTestId('card-dispute'));
    // FA-039: the dispute form for this card, starting from its charges.
    expect(await screen.findByTestId('dispute-form')).toBeInTheDocument();
    expect(screen.getByTestId('dispute-card')).toHaveValue('crd_demo_ops');
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './render';

/** M-3-R35: every M3 money and card flow opens from the founder web. */
describe('M3 flows reachable (M-3-R35)', () => {
  it.each([
    ['/payments', 'new-payment'],
    ['/payments/top-up', 'topup-form'],
    ['/payments/schedules', 'schedules'],
    ['/recipients', 'recipients-list'],
    ['/cards', 'cards-list'],
    ['/support/new?category=DISPUTE', 'ticket-send'],
    ['/notifications', 'notices-list'],
  ])('AC_R35_1 %s renders', async (route, testId) => {
    renderApp(route);
    expect(await screen.findByTestId(testId)).toBeInTheDocument();
  });

  it('AC_R35_1 a card offers Dispute a charge, which opens a DISPUTE request', async () => {
    renderApp('/cards/crd_demo_ops');
    await userEvent.click(await screen.findByTestId('card-dispute'));
    expect(await screen.findByDisplayValue('Dispute')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Dispute a charge on card ending/)).toBeInTheDocument();
  });
});

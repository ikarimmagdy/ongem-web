import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './render';

describe('shell and sign-in (OG-030 R1)', () => {
  it('sign_in_not_configured_and_demo_AC_R1_1', async () => {
    renderApp('/', { mode: 'none' });
    expect(screen.getByText(/Sign-in is not configured for this build/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('explore-demo'));
    expect(await screen.findByTestId('home-total')).toBeInTheDocument();
    expect(screen.getByTestId('env-badge')).toHaveTextContent('Demo');
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    for (const label of ['Home', 'Accounts', 'Payments', 'Cards', 'Support', 'Settings']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('leaving demo returns to sign-in', async () => {
    renderApp('/settings');
    await userEvent.click(await screen.findByTestId('sign-out'));
    expect(await screen.findByTestId('explore-demo')).toBeInTheDocument();
  });
});

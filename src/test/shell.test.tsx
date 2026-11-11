import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { RECORDING_ENABLED } from '../recording/Recorder';
import { renderApp } from './render';

describe('shell and sign-in (OG-030 R1)', () => {
  it('sign_in_not_configured_and_demo_AC_R1_1', async () => {
    renderApp('/sign-in', { mode: 'none' });
    expect(screen.getByText(/Sign-in is not configured for this build/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('explore-demo'));
    expect(await screen.findByTestId('home-total')).toBeInTheDocument();
    expect(screen.getByTestId('env-badge')).toHaveTextContent('Demo');
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    for (const label of [
      'Home',
      'Accounts',
      'Payments',
      'Cards',
      'Team',
      'Documents',
      'Support',
      'Settings',
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('screen recording is off: no session starts and no event is sent', async () => {
    expect(RECORDING_ENABLED).toBe(false);
    const api = new DemoOnGemApi();
    renderApp('/', { api });
    await screen.findByTestId('home-total');
    await userEvent.click(screen.getAllByTestId('nav-accounts')[0]!);
    await screen.findByTestId('accounts-list');
    await userEvent.click(screen.getAllByTestId('nav-settings')[0]!);
    await screen.findByTestId('sign-out');
    expect(screen.queryByTestId('recording-session')).not.toBeInTheDocument();
    expect(api.calls).not.toContain('startRecording');
    expect(api.calls).not.toContain('recordEvents');
    expect(api.recorded).toEqual([]);
  });

  it('leaving demo returns to sign-in', async () => {
    renderApp('/settings');
    await userEvent.click(await screen.findByTestId('sign-out'));
    expect(await screen.findByTestId('explore-demo')).toBeInTheDocument();
  });
});

describe('home (G-157)', () => {
  it('greets the founder by name and shows the company name and the bank identity state G_157', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Hello, Dana' })).toBeInTheDocument();
    // OG-035 R1: the company name is the switcher's; the identity state moved to Settings.
    const company = await screen.findByTestId('side-company');
    expect(company).toHaveTextContent('Northwind Labs LLC');
    expect(company).not.toHaveTextContent(/cmp_/);
    await userEvent.click(screen.getAllByTestId('nav-settings')[0]!);
    expect(await screen.findByTestId('home-verification')).toHaveTextContent('Accepted');
  });
});

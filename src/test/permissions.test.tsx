import { screen } from '@testing-library/react';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { renderApp } from './render';

const viewer = () =>
  new DemoOnGemApi({ me: { ...demoMe, memberships: [{ ...demoMe.memberships[0]!, role: 'VIEWER' }] } });

describe('permissions (OG-030 R9)', () => {
  it('viewer_sees_no_write_actions_AC_R9_1', async () => {
    renderApp('/payments', { api: viewer() });
    await screen.findByTestId('payments-list');
    expect(screen.queryByTestId('new-payment')).not.toBeInTheDocument();
  });

  it('a forced 403 says why AC_R9_1', async () => {
    renderApp('/cards', { api: viewer() });
    expect(
      await screen.findByText('Your role does not allow this. An owner of the company can do it.'),
    ).toBeInTheDocument();
  });

  it('recipients hide add and archive AC_R9_1', async () => {
    renderApp('/recipients', { api: viewer() });
    await screen.findByTestId('recipients-list');
    expect(screen.queryByTestId('recipient-add')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Archive/ })).not.toBeInTheDocument();
  });
});

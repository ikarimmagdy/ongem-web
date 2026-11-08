import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { snapshot } from 'rrweb-snapshot';
import { DemoOnGemApi } from '../api/demo';
import { maskAll } from '../recording/mask';
import { EventQueue, privacyLine, RRWEB_OPTIONS } from '../recording/Recorder';
import { renderApp } from './render';

// The shell's recording switch is off (RECORDING_ENABLED); these tests cover the recorder itself, so they turn it on.
vi.mock('../recording/Recorder', async (actual) => ({
  ...(await actual<typeof import('../recording/Recorder')>()),
  RECORDING_ENABLED: true,
}));

describe('recording (OG-031 R5, R6, R8)', () => {
  it('screen_and_action_events_AC_R5_2', async () => {
    const api = new DemoOnGemApi();
    renderApp('/', { api });
    await screen.findByTestId('home-total');
    await userEvent.click(screen.getAllByTestId('nav-accounts')[0]!);
    await screen.findByTestId('accounts-list');
    await userEvent.click(screen.getByTestId('account-acc_demo_ops'));
    await screen.findByTestId('account-detail');
    await userEvent.click(screen.getAllByTestId('nav-settings')[0]!);
    await screen.findByTestId('sign-out');
    await userEvent.click(screen.getByTestId('sign-out'));
    await waitFor(() => expect(api.recorded.length).toBeGreaterThan(4));
    const screens = api.recorded.filter((e) => e.type === 'SCREEN').map((e) => e.name);
    expect(screens).toEqual(
      expect.arrayContaining(['/', '/accounts', '/accounts/acc_demo_ops', '/settings']),
    );
    const actions = api.recorded.filter((e) => e.type === 'ACTION').map((e) => e.name);
    expect(actions).toEqual(expect.arrayContaining(['nav-accounts', 'account-acc_demo_ops', 'sign-out']));
    expect(api.calls).toContain('startRecording');
  });

  it('masks props and names when the event is created AC_R6_1', async () => {
    const sent: unknown[] = [];
    const q = new EventQueue(
      { recordEvents: (_id, e) => (sent.push(...e), Promise.resolve({ stored: e.length })) },
      () => 'rss_1',
    );
    q.action('Pay US$1,250.00 to 123456789', {
      accountNumber: '000123456789',
      label: 'Balance $40.00',
      screen: '/payments',
    });
    q.screen('/accounts/acc_demo_ops');
    expect(q.pending[0]).toMatchObject({
      name: 'Pay [amount] to [digits]',
      props: { accountNumber: '[masked]', label: 'Balance [amount]', screen: '/payments' },
    });
    await q.flush();
    expect(JSON.stringify(sent)).not.toMatch(/1,250|123456789|40\.00/);
    expect(sent).toHaveLength(2);
  });

  it('rrweb_snapshot_masked_at_capture_AC_R6_1', async () => {
    renderApp('/accounts/acc_demo_ops', { api: new DemoOnGemApi() });
    await screen.findByTestId('account-detail');
    expect(document.body.textContent).toContain('US$126,100.16');
    const node = snapshot(document, {
      maskAllInputs: RRWEB_OPTIONS.maskAllInputs,
      maskTextSelector: RRWEB_OPTIONS.maskTextSelector,
      maskTextFn: RRWEB_OPTIONS.maskTextFn,
      maskInputFn: RRWEB_OPTIONS.maskInputFn,
    });
    const text = JSON.stringify(node);
    for (const secret of ['126,100.16', '128,450.16', '4821', '9034', 'US$'])
      expect(text).not.toContain(secret);
    expect(text).toContain('Operating');
    expect(maskAll('US$1.00')).toBe('*******');
  });

  it('privacy_line_on_sign_in_and_settings_AC_R8_1', async () => {
    const { unmount } = renderApp('/sign-in', { mode: 'none' });
    expect(screen.getByTestId('privacy-line')).toHaveTextContent(privacyLine());
    unmount();
    renderApp('/settings');
    expect(await screen.findByTestId('privacy-line')).toHaveTextContent(privacyLine());
  });
});

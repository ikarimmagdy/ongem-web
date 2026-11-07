import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { noticeRoute } from '../screens/Notifications';
import { renderApp } from './render';

describe('notifications (M-3-R31 to R34, R36; OG-014 client)', () => {
  it('AC_R31_1 inbox newest first, read on open, opens the linked screen, mark all read', async () => {
    const api = new DemoOnGemApi();
    renderApp('/notifications', { api });
    const list = await screen.findByTestId('notices-list');
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('A payment needs your approval');
    expect(rows[2]).toHaveTextContent('Payment completed');
    expect(screen.getByText('2 unread')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('notice-ntc_demo_2'));
    expect(await screen.findByTestId('ticket-detail')).toBeInTheDocument();
    expect((await api.notifications()).unread).toBe(1);
    await await api.readAllNotifications();
    expect((await api.notifications()).unread).toBe(0);
  });

  it('AC_R31_1 mark all read from the screen', async () => {
    renderApp('/notifications');
    await userEvent.click(await screen.findByTestId('notices-read-all'));
    expect(await screen.findByText('All read')).toBeInTheDocument();
  });

  it('AC_R32_1 the bell shows the unread count and clears after mark all read', async () => {
    renderApp('/notifications');
    expect(await screen.findByTestId('notice-bell-count')).toHaveTextContent('2');
    expect(screen.getByTestId('notice-bell')).toHaveAccessibleName('Notifications, 2 unread');
    await userEvent.click(await screen.findByTestId('notices-read-all'));
    await waitFor(() => expect(screen.queryByTestId('notice-bell-count')).toBeNull());
  });

  it('AC_R33_1 choices per kind: mandatory email locked, a change is saved', async () => {
    const api = new DemoOnGemApi();
    renderApp('/settings', { api });
    const mandatory = await screen.findByTestId('pref-email-PAYMENT_RETURNED');
    expect(mandatory).toBeChecked();
    expect(mandatory).toBeDisabled();
    const sent = screen.getByTestId('pref-email-PAYMENT_SENT');
    expect(sent).not.toBeChecked();
    await userEvent.click(sent);
    await waitFor(() => expect(screen.getByTestId('pref-email-PAYMENT_SENT')).toBeChecked());
    const saved = await api.notificationPreferences();
    expect(saved.kinds.find((k) => k.kind === 'PAYMENT_SENT')!.email).toBe(true);
    expect(api.calls).toContain('setNotificationPreferences');
    expect(screen.getByTestId('pref-sms-PAYMENT_SENT')).toBeDisabled();
  });

  it('AC_R34_1 SMS number verified with the code; a wrong code is explained', async () => {
    renderApp('/settings');
    await userEvent.type(await screen.findByTestId('sms-number'), '+15551234567');
    await userEvent.click(screen.getByTestId('sms-number-save'));
    expect(await screen.findByTestId('sms-state')).toHaveTextContent('ending 4567, not verified yet');
    await userEvent.type(screen.getByTestId('sms-code'), '000000');
    await userEvent.click(screen.getByTestId('sms-code-verify'));
    expect(await screen.findByText(/That code is not right/)).toBeInTheDocument();
    await userEvent.clear(screen.getByTestId('sms-code'));
    await userEvent.type(screen.getByTestId('sms-code'), '123456');
    await userEvent.click(screen.getByTestId('sms-code-verify'));
    expect(await screen.findByText(/ending 4567, verified/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('pref-sms-PAYMENT_SENT')).toBeEnabled());
  });

  it('AC_R34_1 an invalid number shows the reason', async () => {
    renderApp('/settings');
    await userEvent.type(await screen.findByTestId('sms-number'), '5551234');
    await userEvent.click(screen.getByTestId('sms-number-save'));
    expect(await screen.findByText(/international form/)).toBeInTheDocument();
  });

  it('AC_R36_1 demo carries sample notices and choices', async () => {
    const api = new DemoOnGemApi();
    expect((await api.notifications()).items).toHaveLength(3);
    expect((await api.notificationPreferences()).kinds).toHaveLength(16);
    await expect(
      api.setNotificationPreferences([{ kind: 'PAYMENT_RETURNED', email: false }]),
    ).rejects.toMatchObject({
      code: 'mandatory_kind',
    });
  });

  it('notice links map to this app', () => {
    expect(noticeRoute('payments/pay_1/approve')).toBe('/payments/pay_1');
    expect(noticeRoute('payments/limits')).toBe('/payments');
    expect(noticeRoute('payment-schedules/s1')).toBe('/payments/schedules');
    expect(noticeRoute('cards/c1')).toBe('/cards/c1');
    expect(noticeRoute('support/t1')).toBe('/support/t1');
    expect(noticeRoute('settings/devices')).toBe('/settings');
    expect(noticeRoute('onboarding/review')).toBe('/onboarding');
    expect(noticeRoute('platform')).toBeNull();
    expect(noticeRoute(null)).toBeNull();
  });
});

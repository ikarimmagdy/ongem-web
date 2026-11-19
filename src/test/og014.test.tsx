import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { LiveOnGemApi } from '../api/live';
import { noticeRoute } from '../screens/Notifications';
import { renderApp } from './render';

function fake() {
  const sent: string[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sent.push(`${init.method ?? 'GET'} ${url}`);
    const body = url.endsWith('unread-count')
      ? { unread: 3 }
      : { kinds: [], smsNumberLast4: null, smsVerified: false };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  const api = new LiveOnGemApi({
    baseUrl: '',
    fetchImpl,
    getToken: () => Promise.resolve('t'),
    reverify: () => Promise.resolve(false),
  });
  return { sent, api };
}

describe('OG-014 notifications (contract 2026-11-20)', () => {
  it('OG014_bell_reads_unread_count_and_inbox_marks_one_read_in_place', async () => {
    const api = new DemoOnGemApi();
    renderApp('/notifications', { api });
    expect(await screen.findByTestId('notice-bell-count')).toHaveTextContent('2');
    expect(api.calls).toContain('unreadCount');
    await userEvent.click(await screen.findByTestId('notice-read-ntc_demo_3'));
    await waitFor(() => expect(screen.getByTestId('notice-bell-count')).toHaveTextContent('1'));
    expect(screen.queryByTestId('notice-read-ntc_demo_3')).toBeNull();
    expect(screen.getByTestId('notices-list')).toBeInTheDocument();
  });

  it('OG014_inbox_filters_by_category', async () => {
    renderApp('/notifications', { api: new DemoOnGemApi() });
    const filter = await screen.findByTestId('notice-filter');
    await userEvent.click(within(filter).getByTestId('notice-filter-SUPPORT'));
    const list = screen.getByTestId('notices-list');
    expect(within(list).getAllByTestId(/^notice-ntc_/)).toHaveLength(1);
    expect(list).toHaveTextContent('Support');
  });

  it('OG014_choices_per_channel_grouped_with_mandatory_locked', async () => {
    const api = new DemoOnGemApi();
    renderApp('/settings', { api });
    expect(await screen.findByTestId('pref-group-MONEY')).toHaveTextContent('Money');
    const inApp = screen.getByTestId('pref-inapp-PAYMENT_FAILED');
    expect(inApp).toBeChecked();
    expect(inApp).toBeDisabled();
    const push = screen.getByTestId('pref-push-MONEY_OUT');
    expect(push).toBeChecked();
    await userEvent.click(push);
    await waitFor(() => expect(screen.getByTestId('pref-push-MONEY_OUT')).not.toBeChecked());
    expect((await api.notificationPreferences()).kinds.find((k) => k.kind === 'MONEY_OUT')!.push).toBe(false);
  });

  it('OG014_company_override_shows_its_source_and_resets', async () => {
    const api = new DemoOnGemApi();
    renderApp('/settings', { api });
    await userEvent.click(await screen.findByTestId('pref-scope-company'));
    expect(await screen.findByTestId('pref-source-MONEY_IN')).toHaveTextContent('Default');
    await userEvent.click(screen.getByTestId('pref-email-MONEY_IN'));
    await waitFor(() =>
      expect(screen.getByTestId('pref-source-MONEY_IN')).toHaveTextContent('Set for this company'),
    );
    expect(api.calls).toContain('setCompanyNotificationPreferences');
    // The person's own choice is untouched.
    expect((await api.notificationPreferences()).kinds.find((k) => k.kind === 'MONEY_IN')!.email).toBe(true);
    await userEvent.click(screen.getByTestId('pref-reset-company'));
    await waitFor(() => expect(screen.getByTestId('pref-source-MONEY_IN')).toHaveTextContent('Default'));
    expect(screen.queryByTestId('sms-number')).toBeNull();
  });

  it('OG014_live_paths_follow_the_contract', async () => {
    const { sent, api } = fake();
    expect(await api.unreadCount()).toBe(3);
    await api.companyNotificationPreferences();
    await api.setCompanyNotificationPreferences([{ kind: 'MONEY_OUT', inApp: true, push: false }]);
    await api.resetCompanyNotificationPreferences('MONEY_OUT');
    await api.resetCompanyNotificationPreferences();
    expect(sent).toEqual([
      'GET /v1/notifications/unread-count',
      'GET /v1/notifications/preferences/company',
      'PUT /v1/notifications/preferences/company',
      'DELETE /v1/notifications/preferences/company?kind=MONEY_OUT',
      'DELETE /v1/notifications/preferences/company',
    ]);
  });

  it('OG014_new_links_map_to_screens', () => {
    expect(noticeRoute('accounts/acc_1/transactions/txn_1')).toBe('/accounts/acc_1');
    expect(noticeRoute('movements/mov_1')).toBe('/payments/movements/mov_1');
    expect(noticeRoute('get-paid')).toBe('/get-paid');
    expect(noticeRoute('team')).toBe('/team');
    expect(noticeRoute('nowhere/1')).toBeNull();
  });
});

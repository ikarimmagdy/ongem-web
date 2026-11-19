import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { LiveOnGemApi } from '../api/live';
import { lastCompany, rememberCompany } from '../lib/company';
import { renderApp } from './render';

function fake(...answers: Array<[number, unknown]>) {
  const sent: { url: string; method: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sent.push({ url, method: init.method ?? 'GET', headers: init.headers as Record<string, string> });
    const [status, body] = answers.shift() ?? [200, {}];
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

describe('OG-023 several companies with one login (contract 2026-11-20)', () => {
  it('OG023_permissions_come_from_the_membership_for_the_current_company', async () => {
    // An OWNER whose money actions are suspended: GET /v1/me lists only the reading permissions for this company.
    const me = {
      ...demoMe,
      memberships: [{ ...demoMe.memberships[0]!, permissions: ['account:view', 'payment:view'] }],
    };
    renderApp('/accounts/acc_demo_ops', { api: new DemoOnGemApi({ me }) });
    expect(await screen.findByTestId('export-no-permission')).toBeInTheDocument();
  });

  it('OG023_waiting_invite_shows_in_the_switcher_and_accepting_opens_the_new_company', async () => {
    const api = new DemoOnGemApi({ scenario: 'invites' });
    renderApp('/', { api });
    const switcher = await screen.findByTestId('company-switcher');
    expect(within(switcher).getByTestId('switcher-invites')).toHaveTextContent('1');
    await userEvent.click(switcher);
    const row = await screen.findByTestId('company-invite-inv_demo_waiting');
    expect(row).toHaveTextContent('Harbor Studio LLC');
    expect(row).toHaveTextContent('Priya Shah invited you as Viewer');
    await userEvent.click(within(row).getByTestId('accept-invite-inv_demo_waiting'));
    await waitFor(() =>
      expect(screen.getByTestId('company-switcher')).toHaveTextContent('Harbor Studio LLC'),
    );
    expect(api.calls).toContain('acceptMyInvite');
    expect(screen.queryByTestId('switcher-invites')).toBeNull();
  });

  it('OG023_me_invites_paths_and_company_not_member_falls_back', async () => {
    const { sent, fetchImpl } = fake(
      [200, { items: [{ id: 'inv_1', companyId: 'cmp_k', companyName: 'Kumar', role: 'VIEWER' }] }],
      [200, { membershipId: 'mbr_2', companyId: 'cmp_k', role: 'VIEWER' }],
      [403, { code: 'company_not_member' }],
    );
    const dropped = vi.fn();
    const api = new LiveOnGemApi({
      baseUrl: '/api-dev',
      fetchImpl,
      newKey: () => 'k',
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(false),
      onCompanyNotMember: dropped,
    });
    expect(await api.myInvites()).toHaveLength(1);
    await api.acceptMyInvite('inv_1');
    await expect(api.forCompany('cmp_gone').accounts()).rejects.toMatchObject({ code: 'company_not_member' });
    expect(sent.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /api-dev/v1/me/invites',
      'POST /api-dev/v1/me/invites/inv_1/accept',
      'GET /api-dev/v1/accounts',
    ]);
    expect(sent[1]!.headers['Idempotency-Key']).toBe('k');
    expect(sent[2]!.headers['X-Company-Id']).toBe('cmp_gone');
    expect(dropped).toHaveBeenCalledTimes(1);
  });

  it('OG023_last_pick_is_remembered_per_person_only', () => {
    rememberCompany('prn_1', { companyId: 'cmp_k', region: 'US' });
    expect(lastCompany('prn_1')).toEqual({ companyId: 'cmp_k', region: 'US' });
    expect(lastCompany('prn_2')).toBeNull();
    rememberCompany('prn_1', null);
    expect(lastCompany('prn_1')).toBeNull();
  });
});

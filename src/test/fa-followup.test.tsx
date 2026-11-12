import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { samplePdf } from '../api/samplePdf';
import { LiveOnGemApi } from '../api/live';
import { paths } from '../api/paths';
import { signInDevice, signInPlace } from '../lib/signins';
import { renderApp } from './render';

/** Follow-up of the UI and UX review of 2026-11-12: findings that needed ongem-core first (FA-xxx). */
describe('founder web review 2026-11-12 follow-up', () => {
  it('FA_037 an approval names who asked for it, and Decline sends the optional reason the requester sees', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/payments/approvals', { api });
    expect(await screen.findByTestId('approval-requested-by-pay_demo_approval')).toHaveTextContent(
      'Requested by Dana Lee',
    );
    await userEvent.click(screen.getAllByTestId('payment-reject')[0]!);
    const reason = await screen.findByTestId('payment-reject-reason');
    await userEvent.type(reason, 'x'.repeat(281));
    expect(screen.getByTestId('payment-reject-confirm')).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('280 characters or fewer');
    await userEvent.clear(reason);
    await userEvent.type(reason, 'Paid by card last week');
    await userEvent.click(screen.getByTestId('payment-reject-confirm'));
    await waitFor(() => expect(api.calls).toContain('rejectPayment'));
    const p = await api.payment('pay_demo_approval');
    expect(p.state).toBe('REJECTED');
    expect(p.declineReason).toBe('Paid by card last week');
  });

  it('FA_037 a declined payment shows who declined it and why; the detail names the requester', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    await api.rejectPayment('pay_demo_approval', 'Wrong account');
    renderApp('/payments/pay_demo_approval', { api });
    expect(await screen.findByTestId('payment-requested-by')).toHaveTextContent('Dana Lee');
    expect(screen.getByTestId('payment-decline-reason')).toHaveTextContent('Wrong account');
    expect(screen.getByTestId('payment-declined-by')).toHaveTextContent('Declined by Dana Rivera');
  });

  it('FA_037 the live client sends the reason only when there is one', async () => {
    const bodies: (string | null)[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push((init?.body as string | undefined) ?? null);
      return new Response(JSON.stringify({ id: 'p', state: 'REJECTED' }), { status: 200 });
    }) as unknown as typeof fetch;
    const live = new LiveOnGemApi({
      baseUrl: 'https://api.example.test',
      getToken: async () => 'tok',
      reverify: async () => true,
      fetchImpl,
    } as never);
    await live.rejectPayment('p1', '  Not this month  ');
    await live.rejectPayment('p1');
    expect(bodies[bodies.length - 2]).toBe(JSON.stringify({ reason: 'Not this month' }));
    expect(bodies[bodies.length - 1]).toBeNull();
  });

  it('FA_011 a transaction names the other party first and the method under it', async () => {
    renderApp('/accounts/acc_demo_ops');
    const who = await screen.findByTestId('txn-counterparty-txn_demo_1');
    expect(who).toHaveTextContent('Harbor Property Management');
    expect(who).toHaveTextContent(/ out$/);
    // A line the bank gives no name for keeps the method alone.
    expect(screen.queryByTestId('txn-counterparty-txn_demo_7')).not.toBeInTheDocument();
  });

  it('FA_029 Settings shows the authenticator, recent sign-ins with device and place, and what to do', async () => {
    renderApp('/settings');
    expect(await screen.findByTestId('security-authenticator')).toHaveTextContent('On.');
    expect(await screen.findByTestId('sign-in-0')).toHaveTextContent('Chrome on macOS');
    expect(screen.getByTestId('sign-in-0')).toHaveTextContent('This session');
    expect(screen.getByTestId('sign-in-0')).toHaveTextContent('Austin, United States');
    expect(screen.getByTestId('sign-in-2')).toHaveTextContent('Place not known');
    expect(screen.getByTestId('security-not-you')).toBeInTheDocument();
    expect(signInDevice({ at: '', kind: 'android', secondFactor: true, current: false })).toBe(
      'OnGem app on Android',
    );
    expect(
      signInPlace({ at: '', kind: 'web', place: { country: 'AE' }, secondFactor: true, current: false }),
    ).toBe('United Arab Emirates');
  });

  it('FA_029 a summary that cannot load says so and the devices still show', async () => {
    const api = new DemoOnGemApi();
    api.securitySummary = () => Promise.reject(new Error('down'));
    renderApp('/settings', { api });
    expect(await screen.findByTestId('security-error')).toHaveTextContent('could not be loaded');
    expect(await screen.findByTestId('device-dev_demo_web')).toBeInTheDocument();
  });

  it('FA_055 the last sign-in sits beside the bank disclosure in the side bar and in Settings', async () => {
    renderApp('/settings');
    expect(await screen.findByTestId('side-last-sign-in')).toHaveTextContent(/^Last sign-in 28 Oct 2026/);
    expect(await screen.findByTestId('settings-last-sign-in')).toHaveTextContent(/^Last sign-in/);
  });

  it('FA_034 a sent payment downloads its PDF receipt; a draft has none', async () => {
    const created: Blob[] = [];
    const urlApi = URL as unknown as {
      createObjectURL?: (b: Blob) => string;
      revokeObjectURL?: (u: string) => void;
    };
    const saved = { create: urlApi.createObjectURL, revoke: urlApi.revokeObjectURL };
    urlApi.createObjectURL = (b: Blob) => {
      created.push(b);
      return 'blob:receipt';
    };
    urlApi.revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      const api = new DemoOnGemApi();
      renderApp('/payments/pay_demo_1', { api });
      await userEvent.click(await screen.findByTestId('payment-receipt'));
      await waitFor(() =>
        expect(screen.getByTestId('payment-receipt-status')).toHaveTextContent('Receipt ready'),
      );
      expect(created[0]!.type).toBe('application/pdf');
      expect(click).toHaveBeenCalled();
      await expect(api.paymentReceipt('pay_demo_approval')).rejects.toMatchObject({
        code: 'receipt_unavailable',
      });
    } finally {
      click.mockRestore();
      urlApi.createObjectURL = saved.create;
      urlApi.revokeObjectURL = saved.revoke;
    }
    expect(samplePdf('US$1.00 (x)')).toMatch(/^%PDF-1\.4[\s\S]*\(US\$1\.00 \\\(x\\\)\) Tj[\s\S]*%%EOF\n$/);
    expect(paths.paymentReceipt('pay 1')).toBe('/v1/payments/pay%201/receipt');
  });

  it('FA_052 the web and the app use one term for a transfer between own accounts', async () => {
    const { t } = await import('../i18n');
    expect(t('app.payments.detail.internal_transfer')).toBe('Transfer between your accounts');
    expect(t('app.payments.form.internal')).toBe('Transfer between your accounts');
  });
});

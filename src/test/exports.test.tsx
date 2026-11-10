import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { getLocale, setLocale } from '../i18n';
import { exportTiming, lastFullMonth, periodValid } from '../screens/ExportActivity';
import { renderApp } from './render';

const account = '/accounts/acc_demo_ops';

beforeEach(() => {
  exportTiming.pollMs = 5;
});

afterEach(async () => {
  if (getLocale() !== 'en') await act(() => setLocale('en'));
});

describe('accounting exports (OG-024 R16)', () => {
  it('export_last_month_shows_preparing_then_ready_AC_R16_1', async () => {
    const api = new DemoOnGemApi();
    renderApp(account, { api });
    const card = await screen.findByTestId('export-activity');
    await userEvent.click(within(card).getByTestId('export-start'));
    const period = within(card).getByTestId('export-period');
    expect(period).toHaveDisplayValue(`Last full month (${lastFullMonth()})`);
    await userEvent.click(within(card).getByTestId('export-confirm'));
    expect(await within(card).findByText('Preparing your file')).toBeInTheDocument();
    expect(within(card).getByTestId('export-state')).toHaveAttribute('aria-live', 'polite');
    await within(card).findByTestId('export-run-done');
    expect(within(card).getByText('Your file is ready')).toBeInTheDocument();
    const download = within(card).getByTestId('export-download');
    const month = lastFullMonth();
    expect(download).toHaveTextContent(`Download ongem-activity-${month}-01-`);
    expect(download).toHaveAttribute('download', expect.stringContaining(`${month}-01`));
    expect(api.calls).toEqual(expect.arrayContaining(['requestExport', 'exportRun']));
    await userEvent.click(within(card).getByTestId('export-link-again'));
    await waitFor(() => expect(api.calls).toContain('exportLink'));
    expect(within(await within(card).findByTestId('export-recent')).getByText('Ready')).toBeInTheDocument();
  });

  it('refused_and_no_permission_states_AC_R16_2', async () => {
    const api = new DemoOnGemApi();
    api.refuseExportOf = lastFullMonth();
    const first = renderApp(account, { api });
    const card = await screen.findByTestId('export-activity');
    await userEvent.click(within(card).getByTestId('export-start'));
    await userEvent.click(within(card).getByTestId('export-confirm'));
    await within(card).findByTestId('export-run-refused');
    expect(within(card).getByText(/does not agree with the bank's statement/)).toBeInTheDocument();
    expect(within(card).queryByTestId('export-download')).toBeNull();
    first.unmount();

    const viewer = new DemoOnGemApi({
      me: { ...demoMe, memberships: [{ ...demoMe.memberships[0]!, role: 'ADMIN' }] },
    });
    renderApp(account, { api: viewer });
    expect(await screen.findByTestId('export-no-permission')).toHaveTextContent(
      'Only an owner of the company can export account activity.',
    );
    expect(screen.queryByTestId('export-start')).toBeNull();
  });

  it('a date error is shown and nothing is requested AC_R16_2', async () => {
    const api = new DemoOnGemApi();
    renderApp(account, { api });
    const card = await screen.findByTestId('export-activity');
    await userEvent.click(within(card).getByTestId('export-start'));
    await userEvent.selectOptions(within(card).getByTestId('export-period'), 'range');
    const from = within(card).getByTestId('export-from');
    await userEvent.clear(from);
    await userEvent.type(from, '2026-10-20');
    const to = within(card).getByTestId('export-to');
    await userEvent.clear(to);
    await userEvent.type(to, '2026-10-01');
    await userEvent.click(within(card).getByTestId('export-confirm'));
    expect(
      await within(card).findByText(/Choose an end date that is not before the start date/),
    ).toBeInTheDocument();
    expect(within(card).getByTestId('export-from')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls).not.toContain('requestExport');
    expect(periodValid('2026-10-01', '2026-10-31', new Date('2026-11-10T00:00:00Z'))).toBe(true);
    expect(periodValid('2025-11-09', '2026-11-10', new Date('2026-11-10T00:00:00Z'))).toBe(false);
    expect(periodValid('2026-11-01', '2026-11-11', new Date('2026-11-10T00:00:00Z'))).toBe(false);
  });

  it('arabic_export_screens_from_content_keys_rtl_AC_R16_4', async () => {
    await act(() => setLocale('ar'));
    renderApp(account, { api: new DemoOnGemApi() });
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    const card = await screen.findByTestId('export-activity');
    expect(within(card).getByText('ملف بالحركات المرحّلة في هذا الحساب لمحاسبك.')).toBeInTheDocument();
    await userEvent.click(within(card).getByTestId('export-start'));
    expect(within(card).getByTestId('export-period')).toHaveDisplayValue(`آخر شهر كامل (${lastFullMonth()})`);
    await userEvent.click(within(card).getByTestId('export-confirm'));
    await within(card).findByTestId('export-run-done');
    expect(within(card).getByText('ملفك جاهز')).toBeInTheDocument();
    expect(within(card).getByTestId('export-download').textContent).toMatch(
      /^تنزيل ongem-activity-\d{4}-\d{2}-01-/,
    );
  });
});

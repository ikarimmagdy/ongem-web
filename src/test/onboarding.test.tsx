import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { demoApplication } from '../api/demoData';
import { captureStatus, safeCaptureUrl } from '../screens/Onboarding';
import { renderApp } from './render';

describe('onboarding (OG-030 R6)', () => {
  it('steps_to_submitted_AC_R6_1', async () => {
    const api = new DemoOnGemApi();
    renderApp('/onboarding', { api });
    await userEvent.type(await screen.findByTestId('owner-ssn-own_demo_dana'), '123456789');
    await userEvent.click(screen.getByTestId('owner-ssn-save-own_demo_dana'));
    expect(await screen.findAllByText('ID ending 6789', { selector: 'span' })).toHaveLength(2);
    expect(document.body.textContent).not.toContain('123456789');
    await userEvent.click(await screen.findByTestId('application-confirm'));
    for (const id of ['dsv_demo_esign', 'dsv_demo_terms']) {
      await userEvent.click(await screen.findByTestId(`disclosure-${id}`));
      await userEvent.click(await screen.findByTestId('disclosure-accept'));
    }
    await userEvent.click(await screen.findByTestId('application-submit'));
    expect(await screen.findByTestId('application-state')).not.toHaveTextContent('Ready for disclosures');
    const [app] = await api.applications();
    expect(['SUBMITTED', 'VERIFYING', 'MORE_INFO', 'IN_REVIEW']).toContain(app!.state);
  });
});

describe('ID document capture (G-111)', () => {
  const submitted = () => ({ ...demoApplication(), state: 'SUBMITTED' });

  it('captures in this browser through the bank page and follows the status to verified G_111_1', async () => {
    const api = new DemoOnGemApi({ application: submitted() });
    const start = api.startIdCapture;
    let sent: unknown[] = [];
    api.startIdCapture = async (...args) => {
      sent = args;
      return { ...(await start(...args)), captureUrl: 'https://capture.bank.example/s/abc' };
    };
    renderApp('/onboarding', { api });
    await userEvent.selectOptions(await screen.findByTestId('id-capture-document'), 'PASSPORT');
    await userEvent.click(screen.getByTestId('id-capture-browser'));
    const link = await screen.findByTestId('id-capture-open');
    expect(link).toHaveAttribute('href', 'https://capture.bank.example/s/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(sent).toEqual(['app_demo_northwind', 'PASSPORT', false]);
    expect(screen.getByTestId('id-capture-status')).toHaveTextContent('Waiting for your photos');
    await userEvent.click(screen.getByTestId('id-capture-check'));
    expect(await screen.findByText('Photos received. The bank is checking them.')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('id-capture-check'));
    expect(await screen.findByText('Your ID is verified')).toBeInTheDocument();
    expect(screen.queryByTestId('id-capture-browser')).not.toBeInTheDocument();
  });

  it('asks the bank to text the link G_111_2', async () => {
    const api = new DemoOnGemApi({ application: submitted() });
    renderApp('/onboarding', { api });
    await userEvent.click(await screen.findByTestId('id-capture-sms'));
    expect(await screen.findByTestId('id-capture-sms-sent')).toHaveTextContent('texting the link');
    expect(screen.queryByTestId('id-capture-open')).not.toBeInTheDocument();
    const [c] = await api.idCaptures('app_demo_northwind');
    expect(c).toMatchObject({ smsRequested: true, stage: 'WAITING', ownerId: 'own_demo_dana' });
  });

  it('never opens a capture address that is not https G_111_3', async () => {
    const api = new DemoOnGemApi({ application: submitted() });
    const start = api.startIdCapture;
    api.startIdCapture = async (...args) => ({
      ...(await start(...args)),
      captureUrl: 'javascript:alert(1)',
    });
    renderApp('/onboarding', { api });
    await userEvent.click(await screen.findByTestId('id-capture-browser'));
    expect(await screen.findByText(/capture address we cannot open/)).toBeInTheDocument();
    expect(screen.queryByTestId('id-capture-open')).not.toBeInTheDocument();
    expect(safeCaptureUrl('http://capture.bank.example')).toBeNull();
    expect(safeCaptureUrl('https://capture.bank.example/x')).toBe('https://capture.bank.example/x');
  });

  it('shows the latest session again and is not offered before the application is submitted G_111_4', async () => {
    const api = new DemoOnGemApi({ application: submitted() });
    await api.startIdCapture('app_demo_northwind', 'DRIVERS_LICENSE', true);
    renderApp('/onboarding', { api });
    expect(await screen.findByTestId('id-capture-status')).toHaveTextContent('Waiting for your photos');
    const rejected = captureStatus({
      id: 'c',
      ownerId: 'o',
      document: 'PASSPORT',
      stage: 'VERIFIED',
      kycStatus: 'REJECTED',
      smsRequested: false,
      createdAt: '',
      updatedAt: '',
      captureUrl: null,
    });
    expect(rejected).toEqual({ status: 'failure', text: 'The bank could not verify this ID' });
  });

  it('is not offered while the founder is still filling in the application G_111_5', async () => {
    const api = new DemoOnGemApi();
    renderApp('/onboarding', { api });
    await screen.findByTestId('owner-ssn-own_demo_dana');
    expect(screen.queryByTestId('id-capture-browser')).not.toBeInTheDocument();
    await expect(api.startIdCapture('app_demo_northwind', 'PASSPORT', false)).rejects.toMatchObject({
      code: 'invalid_state',
    });
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
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

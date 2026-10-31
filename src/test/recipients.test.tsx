import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { renderApp } from './render';

async function fill(routing: string) {
  await userEvent.click(await screen.findByTestId('recipient-add'));
  await userEvent.type(screen.getByTestId('recipient-name'), 'Globex LLC');
  await userEvent.type(screen.getByTestId('recipient-routing'), routing);
  await userEvent.type(screen.getByTestId('recipient-account'), '000123456789');
  await userEvent.click(screen.getByTestId('recipient-save'));
}

describe('recipients (OG-030 R3)', () => {
  it('bad_routing_refused_before_any_call_AC_R3_1', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/recipients', { api });
    await fill('123456789');
    expect(await screen.findByText('Enter a valid 9-digit routing number.')).toBeInTheDocument();
    expect(api.calls).not.toContain('createRecipient');
  });

  it('add_shows_screening_and_last4_AC_R3_2', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/recipients', { api });
    await fill('021000021');
    const row = (await screen.findByText('Globex LLC', { selector: 'strong' })).closest('li')!;
    expect(within(row).getByText('Globex LLC')).toBeInTheDocument();
    expect(within(row).getByText('•••• 6789')).toBeInTheDocument();
    expect(within(row).getByText('Pending')).toBeInTheDocument();
    expect(row.textContent).not.toContain('000123456789');
    expect(api.stepUps).toEqual(['recipient']);
  });
});

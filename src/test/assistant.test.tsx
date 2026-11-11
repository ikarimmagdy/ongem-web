import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { readLabel } from '../assistant/readLabel';
import { asPhone, renderApp } from './render';

async function ask(text: string) {
  if (!screen.queryByTestId('assistant-panel'))
    await userEvent.click(await screen.findByTestId('assistant-open'));
  await userEvent.type(screen.getByTestId('assistant-input'), text);
  await userEvent.click(screen.getByTestId('assistant-send'));
  const turns = await screen.findAllByTestId('assistant-turn');
  return turns[turns.length - 1]!;
}

describe('assistant widget on the web (OG-031 R4)', () => {
  // OG-035 R9: the floating assistant button is the phone's way in; these tests open it there.
  let undoPhone: () => void = () => undefined;
  beforeEach(() => {
    undoPhone = asPhone();
  });
  afterEach(() => undoPhone());

  it('draft_review_prefills_and_confirms_AC_R4_3', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/', { api });
    const balance = await ask('What is my balance?');
    expect(within(balance).getByTestId('assistant-reply')).toHaveTextContent(
      'Operating •••• 4821: US$126,100.16 available',
    );
    const before = await api.payments();
    const turn = await ask('Send $25 to Acme Supplies');
    expect(within(turn).getByTestId('assistant-draft')).toHaveTextContent(
      'Send US$25.00 by ACH from Operating to Acme Supplies LLC',
    );
    expect((await api.payments()).items).toHaveLength(before.items.length);
    expect(api.calls).not.toContain('createPayment');
    await userEvent.click(within(turn).getByTestId('assistant-review'));
    expect(await screen.findByTestId('payment-amount')).toHaveValue('25.00');
    expect(screen.getByTestId('payment-recipient')).toHaveValue('rcp_demo_acme');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    await screen.findByTestId('payment-detail');
    expect(await screen.findByTestId('assistant-draft-state')).toHaveTextContent('Confirmed by you');
    const draft = [...api.assistant.drafts.values()][0]!;
    expect(draft.state).toBe('CONFIRMED');
    expect(draft.resultRef).toBe((await api.payments()).items[0]!.id);
    expect(api.stepUps).toEqual(['payment']);
  });

  it('the tool line reads as words, never a raw tool name G_157_TOOLS', async () => {
    renderApp('/');
    const turn = await ask('What is my balance?');
    const line = within(turn).getByTestId('assistant-read');
    expect(line).toHaveTextContent(/^Checked /);
    expect(line.textContent).not.toMatch(/_|\blist\b|\bget\b/);
    expect(readLabel(['list_accounts', 'get_account', 'list_transactions'])).toBe(
      'Checked your accounts and transactions',
    );
    expect(readLabel(['list_payments', 'list_recipients', 'get_me'])).toBe(
      'Checked payments, recipients and your profile',
    );
    expect(readLabel(['some_new_tool'])).toBeNull();
  });

  it('a dismissed draft runs nothing AC_R4_3', async () => {
    const api = new DemoOnGemApi();
    renderApp('/', { api });
    const turn = await ask('Freeze my card');
    await userEvent.click(within(turn).getByRole('button', { name: 'Dismiss' }));
    expect(await within(turn).findByTestId('assistant-draft-state')).toHaveTextContent('Dismissed');
    expect((await api.cards()).items.find((c) => c.id === 'crd_demo_dana')!.state).toBe('ACTIVE');
    await userEvent.click(within(turn).getByRole('button', { name: 'Helpful' }));
    expect(api.calls).toContain('rateAssistantTurn');
  });
});

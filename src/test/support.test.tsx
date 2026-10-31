import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './render';

describe('support (OG-030 R7)', () => {
  it('open_reply_attach_AC_R7_1', async () => {
    renderApp('/support');
    await userEvent.click(await screen.findByTestId('ticket-new'));
    await userEvent.type(await screen.findByTestId('ticket-subject'), 'ACH not received');
    await userEvent.type(screen.getByTestId('ticket-body'), 'Acme says the payment has not arrived.');
    await userEvent.click(screen.getByTestId('ticket-send'));
    const thread = await screen.findByTestId('ticket-thread');
    expect(within(thread).getByText('Acme says the payment has not arrived.')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('ticket-reply'), 'It was invoice 1042.');
    await userEvent.click(screen.getByTestId('ticket-reply-send'));
    expect(
      await within(await screen.findByTestId('ticket-thread')).findByText('It was invoice 1042.'),
    ).toBeInTheDocument();
    await userEvent.upload(
      screen.getByTestId('ticket-file'),
      new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByTestId('ticket-attachment')).toHaveTextContent('invoice.pdf');
  });
});

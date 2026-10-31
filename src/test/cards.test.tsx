import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './render';

describe('cards (OG-030 R5)', () => {
  it('freeze_and_unfreeze_with_step_up_AC_R5_1', async () => {
    renderApp('/cards');
    await userEvent.click(await screen.findByTestId('card-crd_demo_dana'));
    await userEvent.click(await screen.findByTestId('card-freeze'));
    await userEvent.type(await screen.findByTestId('reverify-code'), '654321');
    await userEvent.click(screen.getByTestId('reverify-confirm'));
    expect(await screen.findByTestId('card-unfreeze')).toBeInTheDocument();
    expect(screen.getByTestId('card-state')).toHaveTextContent('Frozen');
    await userEvent.click(screen.getByTestId('card-unfreeze'));
    await userEvent.type(await screen.findByTestId('reverify-code'), '654321');
    await userEvent.click(screen.getByTestId('reverify-confirm'));
    expect(await screen.findByTestId('card-freeze')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d{12,}/);
  });
});

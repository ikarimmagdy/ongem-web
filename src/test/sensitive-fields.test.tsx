import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './render';

/** A browser offers to save a password field: SSN, bank numbers and step-up codes must never be one (WEB-SEC, 2026-11-02). */
function notStorable(el: HTMLElement, autocomplete: string) {
  expect(el).toHaveAttribute('inputmode', 'numeric');
  expect(el.getAttribute('type') ?? 'text').not.toBe('password');
  expect(el).toHaveAttribute('autocomplete', autocomplete);
}

describe('sensitive fields are never password fields', () => {
  it('owner SSN', async () => {
    renderApp('/onboarding');
    notStorable(await screen.findByTestId('owner-ssn-own_demo_dana'), 'off');
  });

  it('recipient routing and account numbers', async () => {
    renderApp('/recipients');
    await userEvent.click(await screen.findByTestId('recipient-add'));
    notStorable(screen.getByTestId('recipient-routing'), 'off');
    notStorable(screen.getByTestId('recipient-account'), 'off');
  });

  it('the step-up code', async () => {
    renderApp('/cards');
    await userEvent.click(await screen.findByTestId('card-crd_demo_dana'));
    await userEvent.click(await screen.findByTestId('card-freeze'));
    notStorable(await screen.findByTestId('reverify-code'), 'one-time-code');
  });
});

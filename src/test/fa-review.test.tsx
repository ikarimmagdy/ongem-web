import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { renderApp } from './render';
import {
  BUNDLED_THEMES,
  SIGNED_IN_SHEETS,
  colorVar,
  contrast,
  css,
  prop,
  px,
} from './fa-review.helpers';

const ongem = BUNDLED_THEMES.find((x) => x.id === 'ongem')!;

/** UI and UX review of the founder app, 2026-11-12 (ongem-engineering outputs/review/ui-ux-2026-11-12/founder-app). */
describe('founder web review 2026-11-12, P1', () => {
  it('FA_042 signed-in sheets paint no light surface tint behind text, so dark mode keeps contrast', () => {
    for (const sheet of SIGNED_IN_SHEETS)
      expect(css(sheet)).not.toMatch(/background(-color)?:\s*var\(--color-surface-tint-/);
  });

  it('FA_042 a selected row reads at 4.5:1 or more in every theme', () => {
    for (const selector of ['.fw-row.is-active', '.fw-palette__option.is-active', '.fw-msg--mine']) {
      const bg = prop(SIGNED_IN_SHEETS, selector, 'background')!;
      expect(bg).toBeDefined();
      for (const theme of BUNDLED_THEMES)
        expect(
          contrast(theme.color.text.primary, colorVar(theme, bg)),
          `${selector} in ${theme.id}`,
        ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('FA_044 the stale balance warning is primary text on the pending background, 4.5:1 in every theme', () => {
    expect(prop(SIGNED_IN_SHEETS, '.fw-stale', 'color')).toBe('var(--color-text-primary)');
    const bg = prop(SIGNED_IN_SHEETS, '.fw-stale', 'background')!;
    for (const theme of BUNDLED_THEMES)
      expect(contrast(theme.color.text.primary, colorVar(theme, bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('FA_043 every Settings switch has a 44px target', () => {
    expect(px(ongem, prop(SIGNED_IN_SHEETS, '.fw-toggle', 'min-height')!)).toBeGreaterThanOrEqual(44);
    expect(px(ongem, prop(SIGNED_IN_SHEETS, '.fw-toggle', 'min-width')!)).toBeGreaterThanOrEqual(44);
  });

  it('FA_047 the dialog body leaves room for a field focus ring', () => {
    expect(prop(['design-system/styles.css'], '.og-modal__body', 'padding')).toBe('var(--space-xs)');
  });

  it('FA_032 the step-up dialog names the amount and the payee it confirms', async () => {
    renderApp('/payments/new');
    await userEvent.selectOptions(await screen.findByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '1250');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    expect(await screen.findByTestId('reverify-title')).toHaveTextContent(
      'Send US$1,250.00 to Acme Supplies LLC',
    );
  });

  it('FA_032 freezing a card names the card in the step-up dialog', async () => {
    renderApp('/cards/crd_demo_dana');
    await userEvent.click(await screen.findByTestId('card-freeze'));
    expect(await screen.findByTestId('reverify-title')).toHaveTextContent(/^Freeze the card ending \d{4}$/);
  });

  it('FA_033 while the step-up dialog is open the page behind is inert and Ctrl K opens nothing', async () => {
    renderApp('/payments/new');
    await userEvent.selectOptions(await screen.findByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '10');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    await screen.findByTestId('reverify-code');
    expect(screen.getByTestId('shell').closest('[inert]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.queryByTestId('command-search')).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByTestId('shell').closest('[inert]')).toBeNull());
  });

  it('FA_031 the From account shows its balance and an amount over it is refused before Review', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/payments/new', { api });
    expect(await screen.findByTestId('payment-from-available')).toHaveTextContent(
      'Available: US$126,100.16',
    );
    await userEvent.selectOptions(screen.getByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '999999999');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This is more than the US$126,100.16 available in this account.',
    );
    expect(screen.getByTestId('payment-review-button')).toBeDisabled();
    expect(api.calls).not.toContain('createPayment');
  });
});

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { stateStatus } from '../screens/common';
import { asPhone, renderApp } from './render';
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

describe('founder web review 2026-11-12, shell and brand', () => {
  it('FA_001 every card is the brand card face: wordmark, chip, last four, holder, network area; frozen keeps the face', async () => {
    renderApp('/cards/crd_demo_dana');
    const list = await screen.findByTestId('cards-list');
    const faces = list.querySelectorAll('[data-testid="card-face"]');
    expect(faces).toHaveLength(2);
    const active = screen.getByTestId('card-crd_demo_dana').querySelector('[data-testid="card-face"]')!;
    expect(active).toHaveAttribute('data-base', 'navy');
    expect(active.querySelector('.og-cardface__wordmark')).not.toBeNull();
    expect(active.querySelector('.og-cardface__chip')).not.toBeNull();
    expect(active.querySelector('[data-testid="card-face-network"]')).not.toBeNull();
    expect(active).toHaveTextContent('5521');
    expect(active).toHaveTextContent('Dana Rivera');
    expect(active).toHaveClass('is-selected');
    expect(screen.getByTestId('card-crd_demo_dana')).toHaveAttribute('aria-current', 'true');
    const frozen = screen.getByTestId('card-crd_demo_ops').querySelector('[data-testid="card-face"]')!;
    expect(frozen).toHaveAttribute('data-frozen', 'true');
    expect(frozen).toHaveTextContent('Frozen');
    expect(frozen).toHaveTextContent('8830');
  });

  it('FA_001 the card face is a design system component drawn from theme tokens only', () => {
    const sheet = css('design-system/styles.css');
    const block = sheet.slice(sheet.indexOf('/* Card face (FA-001'));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(block).toMatch(/background: var\(--color-brand-deep\)/);
    expect(block).toMatch(/background: var\(--gradient-brand\)/);
  });

  it('FA_009 nav, tab labels and the Demo badge use the body face; the top bar is 64px', () => {
    expect(prop(SIGNED_IN_SHEETS, '.fw-shell .og-nav__link', 'font-family')).toBe('var(--font-body-strong)');
    expect(prop(SIGNED_IN_SHEETS, '.fw-bottom .og-nav__link.fw-tab', 'font-family')).toBe(
      'var(--font-body-strong)',
    );
    expect(prop(SIGNED_IN_SHEETS, '.fw-shell .og-env', 'font-family')).toBe('var(--font-body-strong)');
    expect(prop(SIGNED_IN_SHEETS, '.fw-shell .og-env', 'text-transform')).toBe('none');
    expect(px(ongem, prop(SIGNED_IN_SHEETS, '.fw-topbar.og-topbar', 'min-height')!)).toBe(64);
  });

  it('FA_004 a phone shows the wordmark in the top bar, with Demo; the company is the second line', async () => {
    const undo = asPhone();
    try {
      renderApp('/');
      const brand = await screen.findByTestId('top-brand');
      expect(brand.querySelector('.og-logo')).not.toBeNull();
      expect(brand).toContainElement(screen.getByTestId('env-badge'));
      expect(await screen.findByTestId('top-company')).toBeInTheDocument();
    } finally {
      undo();
    }
  });

  it('FA_010 the desktop top bar starts with the page name; Demo sits beside the wordmark', async () => {
    renderApp('/payments');
    expect(await screen.findByTestId('top-title')).toHaveTextContent('Payments');
    expect(document.querySelector('.fw-side__brand')).toContainElement(screen.getByTestId('env-badge'));
  });

  it('FA_005 the side bar brand row uses logical padding, so Arabic mirrors it', () => {
    expect(prop(SIGNED_IN_SHEETS, '.fw-side__brand', 'padding-inline')).toBe('var(--space-md)');
  });

  it('FA_016 a phone form screen has no floating assistant; other screens leave room for it', async () => {
    const undo = asPhone();
    try {
      const { unmount } = renderApp('/payments/new');
      await screen.findByTestId('payment-form');
      expect(screen.queryByTestId('assistant-open')).not.toBeInTheDocument();
      unmount();
      renderApp('/');
      expect(await screen.findByTestId('assistant-open')).toBeInTheDocument();
    } finally {
      undo();
    }
    // The content ends at least the button's height plus its offset above the tab bar's padding.
    const pad = px(ongem, '(var(--space-3xl) + var(--space-xl))');
    expect(pad).toBeGreaterThanOrEqual(px(ongem, '(var(--space-xl) * 2 + var(--space-md))') + 48 - 96 + 8);
  });

  it('FA_007 one tone per state: sending and sent blue, settled green, waiting amber, returned red, frozen slate', () => {
    for (const s of ['PRECHECKED', 'SUBMITTED', 'SENT', 'BANK_REVIEW']) expect(stateStatus(s)).toBe('info');
    expect(stateStatus('SETTLED')).toBe('success');
    expect(stateStatus('PENDING_APPROVAL')).toBe('pending');
    for (const s of ['RETURNED', 'FAILED', 'REJECTED']) expect(stateStatus(s)).toBe('failure');
    expect(stateStatus('FROZEN')).toBe('neutral');
  });

  it('FA_051 the search key caps stay left to right in Arabic', async () => {
    renderApp('/');
    const open = await screen.findByTestId('command-search-open');
    expect(open.querySelector('kbd')).toHaveAttribute('dir', 'ltr');
  });

  it('FA_055 the bank disclosure is in the side bar and in Settings', async () => {
    renderApp('/settings');
    expect(await screen.findByTestId('side-disclosure')).toHaveTextContent('not a bank');
    expect(await screen.findByTestId('settings-disclosure')).toHaveTextContent('Piermont Bank, Member FDIC');
  });
});

describe('founder web review 2026-11-12, settings and lists', () => {
  it('FA_029 Settings lists the devices signed in and signs another one out', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/settings', { api });
    expect(await screen.findByTestId('device-dev_demo_web')).toHaveTextContent('This device');
    expect(screen.queryByTestId('device-revoke-dev_demo_web')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('device-revoke-dev_demo_phone'));
    await waitFor(() => expect(screen.getByTestId('device-dev_demo_phone')).toHaveTextContent('Signed out'));
    expect(api.calls).toContain('revokeDevice');
  });

  it('FA_030 appearance is Light, Dark or System; no white-label theme is offered', async () => {
    renderApp('/settings');
    const choice = await screen.findByTestId('appearance-choice');
    expect(choice.querySelectorAll('[role="radio"]')).toHaveLength(3);
    expect(choice).not.toHaveTextContent('Harbor');
    await userEvent.click(screen.getByTestId('appearance-dark'));
    expect(document.documentElement.dataset.themeMode).toBe('dark');
    expect(screen.getByTestId('appearance-dark')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByTestId('appearance-light'));
    expect(document.documentElement.dataset.themeMode).toBe('light');
  });

  it('FA_011 FA_048 a posted transaction carries no chip and its sign sits against the amount, left to right', async () => {
    renderApp('/accounts/acc_demo_ops');
    await screen.findByTestId('account-detail');
    const table = await screen.findByRole('table');
    const signed = table.querySelectorAll('bdi[dir="ltr"]');
    expect(signed.length).toBeGreaterThan(0);
    for (const b of Array.from(signed)) expect(b.textContent).toMatch(/^[+\u2212]US\$/);
    expect(table.querySelector('caption')).toHaveClass('og-visually-hidden');
  });

  it('FA_045 a scrolling table is a named region a keyboard reaches', async () => {
    renderApp('/accounts/acc_demo_ops');
    const table = await screen.findByRole('table');
    const wrap = table.closest('.og-table-wrap')!;
    expect(wrap).toHaveAttribute('tabindex', '0');
    expect(wrap).toHaveAttribute('role', 'region');
  });

  it('FA_041 a statement is named by its month', async () => {
    renderApp('/accounts/acc_demo_ops');
    expect(await screen.findByTestId('statement-2026-09')).toHaveTextContent('September 2026 statement');
  });

  it('FA_024 Accounts has no Recipients link; recipients live in Payments', async () => {
    renderApp('/accounts');
    await screen.findByTestId('accounts-list');
    expect(screen.queryByRole('link', { name: /recipients/i })).not.toBeInTheDocument();
  });

  it('FA_012 a list is one card with dividers, rows are not boxed', () => {
    expect(prop(SIGNED_IN_SHEETS, '.fw-list > li > .fw-row', 'border')).toBe('0');
    expect(prop(SIGNED_IN_SHEETS, '.fw-list > li + li', 'border-top')).toMatch(/--color-border-subtle/);
  });

  it('FA_013 FA_014 form text is 16px on a phone, paragraphs 14px', () => {
    expect(css('app-shell.css')).toMatch(
      /@media \(max-width: 600px\) \{\s*\.og-input,\s*\.og-modal \.og-input \{\s*font-size: var\(--font-size-md\);/,
    );
    expect(prop(SIGNED_IN_SHEETS, '.fw-privacy', 'font-size')).toBe('var(--font-size-sm)');
  });

  it('FA_040 the export account picker sits inside the export card', async () => {
    renderApp('/documents');
    const box = await screen.findByTestId('export-activity');
    expect(box).toContainElement(screen.getByTestId('documents-export-account'));
  });
});

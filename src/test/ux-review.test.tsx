import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PAYMENTS_PAGE } from '../screens/Payments';
import type { AuthSession } from '../auth';
import { NO_AUTH } from '../auth';
import { LABELS } from '../public/content';
import { PRIVACY_LINE, PRIVACY_LINE_OFF, RECORDING_ENABLED } from '../recording/privacy';
import { renderApp } from './render';

/** UI and UX review of 2026-11-07 (ongem-engineering specs OG-030 and OG-032, outputs/review/ui-ux.md). */
describe('UX review 2026-11-07', () => {
  const clerk = (): AuthSession => ({
    ...NO_AUTH,
    available: true,
    loaded: true,
    SignIn: () => <p>sign-in form</p>,
    SignUp: () => <p>sign-up form</p>,
  });

  it('UX_04 sign-in sits in the site frame: header, footer and one form, no card around the form', () => {
    renderApp('/sign-in', { mode: 'none', auth: clerk() });
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to OnGem' })).toBeInTheDocument();
    expect(screen.getByTestId('pub-get-started')).toBeInTheDocument();
    expect(screen.getByTestId('pub-disclosures')).toBeInTheDocument();
    expect(screen.getByTestId('auth-sign-in')).toHaveTextContent('sign-in form');
    expect(document.querySelector('.fw-signin__panel')).toBeNull();
  });

  it('UX_06 Get started shows the sign-up form, not the sign-in form', () => {
    renderApp('/sign-in?mode=sign-up', { mode: 'none', auth: clerk() });
    expect(screen.getByRole('heading', { level: 1, name: 'Create your OnGem account' })).toBeInTheDocument();
    expect(screen.getByTestId('auth-sign-up')).toHaveTextContent('sign-up form');
    expect(screen.queryByText('sign-in form')).not.toBeInTheDocument();
  });

  it('UX_05 the privacy line matches the recording switch: recording is off, so no screen says it records', async () => {
    expect(RECORDING_ENABLED).toBe(false);
    expect(PRIVACY_LINE).toBe(PRIVACY_LINE_OFF);
    const { unmount } = renderApp('/sign-in', { mode: 'none' });
    expect(screen.getByTestId('privacy-line')).toHaveTextContent('OnGem does not record your screen.');
    expect(screen.getByTestId('privacy-line')).not.toHaveTextContent(/record the screens/i);
    unmount();
    renderApp('/settings');
    expect(await screen.findByTestId('privacy-line')).not.toHaveTextContent(/record the screens/i);
  });

  it('UX_07 the product page lede does not repeat its title', () => {
    renderApp('/product', { mode: 'none' });
    const head = screen.getByRole('heading', { level: 1, name: LABELS.productTitle }).parentElement!;
    const lede = head.querySelector('.pub-lede')!;
    expect(lede.textContent).not.toMatch(new RegExp(`^${LABELS.productTitle}`));
  });

  it('UX_08 product screens come as a desktop screen and a phone screen, one shown per width', () => {
    renderApp('/product', { mode: 'none' });
    for (const name of ['payments', 'schedules', 'cards', 'notifications', 'support']) {
      const narrow = document.querySelector(`[data-testid="shot-narrow-${name}"]`);
      if (!narrow) continue;
      expect(document.querySelector(`[data-testid="shot-wide-${name}"]`)).not.toBeNull();
      expect(
        within(narrow as HTMLElement)
          .getByRole('img')
          .getAttribute('width'),
      ).toBe('390');
    }
    expect(document.querySelectorAll('[data-testid^="shot-narrow-"]').length).toBeGreaterThan(2);
  });

  it('UX_10 Recipients in the payments header looks like the other actions', async () => {
    renderApp('/payments');
    const link = await screen.findByTestId('payments-recipients');
    expect(link).toHaveClass('og-btn', 'og-btn--secondary');
  });

  it('UX_11 an owner and the identity form stack instead of sharing a narrow row', async () => {
    renderApp('/onboarding');
    const rows = await screen.findAllByTestId(/^owner-row-/);
    for (const r of rows) expect(r).toHaveClass('fw-row--stack');
  });

  it('UX_12 the top bar carries the logo for narrow screens, where the side bar is hidden', async () => {
    renderApp('/');
    await screen.findByTestId('home-total');
    expect(document.querySelector('.fw-topbar .fw-topbar__logo')).not.toBeNull();
  });
  it('UX_16 payments come in pages of ten with Newer and Older, not one long list', async () => {
    renderApp('/payments');
    const list = await screen.findByTestId('payments-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(PAYMENTS_PAGE);
    expect(screen.getByTestId('payments-newer')).toBeDisabled();
    await userEvent.click(screen.getByTestId('payments-older'));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    expect(screen.getByTestId('payments-newer')).toBeEnabled();
    await userEvent.click(screen.getByTestId('payments-newer'));
    expect(await screen.findByText('Page 1')).toBeInTheDocument();
  });

  it('UX_17 a list screen explains its detail column before anything is picked, and Home uses both columns', async () => {
    for (const path of ['/payments', '/accounts', '/cards', '/support']) {
      const { unmount } = renderApp(path);
      expect(await screen.findByTestId('split-hint')).toBeInTheDocument();
      unmount();
    }
    renderApp('/');
    const grid = await screen.findByTestId('home-grid');
    expect(within(grid).getByTestId('home-recent')).toBeInTheDocument();
    expect(await within(grid).findByTestId('home-company')).toBeInTheDocument();
  });
});

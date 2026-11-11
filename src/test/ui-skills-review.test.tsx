import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Logo, ThemeProvider } from '../design-system';
import { pageTitle } from '../nav';
import { applicationLabel, applicationSentence, paymentLabel } from '../lib/states';
import { paymentKind } from '../screens/Payments';
import { asPhone, renderApp } from './render';

/** UI Skills review of 2026-11-07 (ongem-engineering outputs/review/ui-skills-2026-11-07, spec OG-030 R12 to R21). */
describe('UI Skills review 2026-11-07 (OG-030 R-UX)', () => {
  it('AC_R12_1 the assistant never floats over a desktop page: the top bar search opens it (superseded by OG-035 R9)', async () => {
    renderApp('/');
    const search = await screen.findByTestId('command-search-open');
    expect(search.closest('header')).not.toBeNull();
    expect(screen.queryByTestId('assistant-open')).not.toBeInTheDocument();
  });

  it('AC_R13_1 every founder route names its page in the browser tab', async () => {
    renderApp('/payments');
    await screen.findByTestId('payments-list');
    expect(document.title).toBe('Payments | OnGem');
    expect(pageTitle('/payments/top-up')).toBe('Add money');
    expect(pageTitle('/cards/abc')).toBe('Cards');
    expect(pageTitle('/settings')).toBe('Settings');
    expect(pageTitle('/')).toBe('Home');
  });

  it('AC_R14_1 founders never see internal state names', () => {
    const app = [
      'PREFILLING',
      'COLLECTING',
      'READY_FOR_DISCLOSURES',
      'SUBMITTED',
      'VERIFYING',
      'MORE_INFO',
      'IN_REVIEW',
      'EDD',
      'PENDING_BANK',
      'APPROVED',
      'REJECTED',
      'PROVISIONING',
      'ACTIVE',
    ];
    for (const s of app) {
      expect(applicationLabel(s)).not.toMatch(/_|Collecting|Prefilling|Edd|Pending bank/);
      expect(applicationSentence(s)).toMatch(/\.$/);
    }
    expect(applicationSentence('COLLECTING')).toBe(
      'We need a few details from you to finish your application.',
    );
    expect(paymentLabel('PENDING_APPROVAL')).toBe('Waiting for approval');
    expect(paymentLabel('BANK_REVIEW')).toBe('With the bank');
    expect(paymentLabel('PRECHECKED')).toBe('Sending');
  });

  it('AC_R15_1 a top-up is titled Top-up and a transfer Transfer', () => {
    expect(paymentKind({ fundingSourceId: 'fs_1' })).toBe('Top-up');
    expect(paymentKind({ toAccountId: 'acc_2' })).toBe('Transfer');
    expect(paymentKind({})).toBe('Payment');
  });

  it('AC_R16_1 timeline dates are plain text, not status pills', async () => {
    renderApp('/payments/pay_demo_1');
    const timeline = await screen.findByTestId('payment-timeline');
    expect(timeline.querySelector('.og-chip, [class*="status-chip"]')).toBeNull();
    expect(timeline.querySelectorAll('.fw-timeline__date').length).toBeGreaterThan(0);
  });

  it('AC_R17_1 Home leads with the total, its breakdown and quick actions as buttons', async () => {
    renderApp('/');
    const balance = await screen.findByTestId('home-balance');
    expect(await within(balance).findByTestId('home-total')).toBeInTheDocument();
    expect(await within(balance).findByTestId('home-breakdown')).toBeInTheDocument();
    const actions = within(balance).getByTestId('home-actions');
    for (const a of within(actions).getAllByRole('link')) expect(a.className).toMatch(/og-btn/);
    const recent = screen.getByTestId('home-recent');
    expect(balance.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('AC_R18_1 notification choices are switches in a 44px target', async () => {
    renderApp('/settings');
    const email = await screen.findByTestId('pref-email-PAYMENT_SENT');
    expect(email).toHaveAttribute('role', 'switch');
    expect(email.closest('label')).toHaveClass('fw-toggle');
  });

  it('AC_R19_1 cards are tiles, and the first opens on a wide screen', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('min-width'),
      media: q,
    })) as typeof window.matchMedia;
    try {
      renderApp('/cards');
      expect(await screen.findByTestId('cards-list')).toHaveClass('fw-card-tiles');
      expect(await screen.findByTestId('card-detail')).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('AC_R20_1 a phone has five tabs and Settings under More (OG-035 R8)', async () => {
    const undo = asPhone();
    try {
      renderApp('/');
      const bottom = await screen.findByTestId('bottom-nav');
      expect(within(bottom).getAllByRole('link')).toHaveLength(5);
      expect(within(bottom).queryByTestId('tab-settings')).toBeNull();
      await userEvent.click(within(bottom).getByTestId('tab-more'));
      expect(await screen.findByTestId('more-settings')).toHaveAttribute('href', '/settings');
    } finally {
      undo();
    }
  });

  it('AC_R21_1 a dark theme shows the light-ink wordmark without a plate', () => {
    render(
      <ThemeProvider initialThemeId="ongem-dark">
        <Logo />
      </ThemeProvider>,
    );
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toMatch(/light/);
    expect(img.parentElement).toHaveClass('og-logo--ink');
  });
});

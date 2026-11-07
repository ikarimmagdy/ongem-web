import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { CAPABILITIES, DISCLOSURES, PAGE_META } from '../public/content';
import { renderApp } from './render';

/** OG-032: the signed-out public site and the way into sign-up. */
describe('public site (OG-032)', () => {
  it('public_home_AC_R1_1', () => {
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('public-home')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('hero-get-started')).toHaveAttribute('href', '/sign-in?mode=sign-up');
    expect(screen.getByTestId('pub-sign-in')).toHaveAttribute('href', '/sign-in');
    for (const id of ['accounts', 'payments', 'cards', 'approvals']) {
      expect(screen.getByTestId(`home-card-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('pub-bank-statement')).toHaveTextContent('not a bank');
    expect(screen.getByTestId('pub-bank-statement')).toHaveTextContent('Piermont Bank');
    expect(screen.getByRole('heading', { name: /Security that stays out of your way/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Formed your company with GenZone/ })).toBeInTheDocument();
    expect(screen.getByTestId('pub-disclosures')).toBeInTheDocument();
  });

  it('signed_in_home_AC_R1_2', async () => {
    renderApp('/');
    expect(await screen.findByTestId('home-total')).toBeInTheDocument();
    expect(screen.queryByTestId('public-home')).not.toBeInTheDocument();
  });

  it('product_sections_AC_R2_1', () => {
    renderApp('/product', { mode: 'none' });
    for (const c of CAPABILITIES) {
      expect(
        within(screen.getByTestId(`cap-${c.id}`)).getByRole('heading', { name: c.title }),
      ).toBeInTheDocument();
    }
    const payments = screen.getByTestId('cap-payments');
    expect(within(payments).getByText('Domestic wires')).toBeInTheDocument();
    expect(within(payments).getByText('International payments')).toBeInTheDocument();
    expect(within(payments).getAllByText('Coming soon')).toHaveLength(2);
  });

  it('security_controls_AC_R3_1', () => {
    renderApp('/security', { mode: 'none' });
    expect(screen.getAllByTestId('security-control')).toHaveLength(6);
    const main = screen.getByRole('main');
    expect(main).not.toHaveTextContent(/SOC ?2|PCI|FDIC/);
  });

  it('partners_AC_R4_1', () => {
    renderApp('/partners', { mode: 'none' });
    expect(screen.getByTestId('public-partners')).toHaveTextContent('GenZone');
    expect(screen.getByText(/Partner API/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Get started' }).length).toBeGreaterThan(0);
  });

  it('get_started_AC_R5_1', async () => {
    renderApp('/', { mode: 'none' });
    await userEvent.click(screen.getByTestId('hero-get-started'));
    expect(await screen.findByRole('heading', { name: 'Create your OnGem account' })).toBeInTheDocument();
    expect(screen.getByTestId('explore-demo')).toBeInTheDocument();
  });

  it('deep_link_sign_in_AC_R5_2', () => {
    renderApp('/payments', { mode: 'none' });
    expect(screen.getByTestId('explore-demo')).toBeInTheDocument();
    expect(screen.queryByTestId('public-home')).not.toBeInTheDocument();
  });

  it('disclosures_AC_R6_1', () => {
    for (const path of ['/', '/product', '/security', '/partners']) {
      const { unmount } = renderApp(path, { mode: 'none' });
      const footer = screen.getByTestId('pub-disclosures');
      expect(within(footer).getByTestId('pub-draft-note')).toHaveTextContent('Draft for legal review');
      expect(within(footer).getAllByRole('listitem')).toHaveLength(DISCLOSURES.length);
      unmount();
    }
  });

  it('title_meta_AC_R8_1', () => {
    for (const path of ['/', '/product', '/security', '/partners'] as const) {
      const { unmount } = renderApp(path, { mode: 'none' });
      expect(document.title).toBe(PAGE_META[path].title);
      expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        PAGE_META[path].description,
      );
      unmount();
    }
  });

  it('mobile menu button controls the site navigation', async () => {
    renderApp('/', { mode: 'none' });
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('accessibility_N1: no axe violations on public pages', async () => {
    for (const path of ['/', '/product', '/security', '/partners']) {
      const { container, unmount } = renderApp(path, { mode: 'none' });
      // jsdom computes no layout or colours, so contrast is checked in the browser e2e; every other rule runs here.
      const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(result.violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
      unmount();
    }
  });
});

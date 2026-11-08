import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { t, tList } from '../i18n';
import {
  capabilities,
  facts as factList,
  faq as faqList,
  feature,
  FEATURE_ROWS,
  pageMeta,
  securityFacts,
  trustParties,
} from '../public/content';
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
    for (const c of capabilities()) {
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
      expect(within(footer).getAllByRole('listitem')).toHaveLength(tList('web.disclosures').length);
      unmount();
    }
  });

  it('title_meta_AC_R8_1', () => {
    for (const path of ['/', '/product', '/security', '/partners'] as const) {
      const { unmount } = renderApp(path, { mode: 'none' });
      expect(document.title).toBe(pageMeta(path).title);
      expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        pageMeta(path).description,
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

  it('hero_stage_and_feature_rows_with_real_screens_AC_R10_1', () => {
    renderApp('/', { mode: 'none' });
    const hero = screen.getByTestId('public-home');
    expect(within(hero).getByAltText(/home screen on the web/)).toBeInTheDocument();
    expect(within(hero).getByAltText(/app home screen on a phone/)).toBeInTheDocument();
    for (const f of FEATURE_ROWS) {
      const row = screen.getByTestId(`feature-row-${f.id}`);
      expect(within(row).getByRole('heading', { level: 2, name: feature(f.id).title })).toBeInTheDocument();
      // The desktop screen and its phone version (UX-08); CSS shows one per width.
      expect(within(row).getAllByRole('img', { name: /sample data/ }).length).toBeGreaterThan(0);
    }
  });

  it('trust_strip_names_the_parties_and_the_bank_statement_AC_R9_1', () => {
    renderApp('/', { mode: 'none' });
    for (const p of trustParties()) expect(screen.getByText(p.name)).toBeInTheDocument();
    expect(screen.getByTestId('pub-bank-statement')).toHaveTextContent('not a bank');
  });

  it('facts_carry_a_source_each_AC_R11_1', () => {
    renderApp('/', { mode: 'none' });
    const facts = screen.getByTestId('pub-facts');
    for (const f of factList()) {
      const value = within(facts).getByText(f.value);
      expect(value.closest('[data-source]')?.getAttribute('data-source')).toBeTruthy();
    }
  });

  it('faq_answers_open_and_close_AC_R12_1', async () => {
    renderApp('/', { mode: 'none' });
    const faq = screen.getByTestId('pub-faq');
    expect(within(faq).getAllByRole('group')).toHaveLength(faqList().length);
    const first = within(faq).getByText(faqList()[0]!.q);
    await userEvent.click(first);
    expect(first.closest('details')).toHaveAttribute('open');
    expect(within(faq).getByText(/Piermont Bank, which provides the accounts/)).toBeVisible();
  });

  it('motion_off_with_reduced_motion_and_nothing_hidden_AC_R13_1', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      renderApp('/', { mode: 'none' });
      expect(document.querySelector('.pub')).not.toHaveClass('pub--motion');
    } finally {
      window.matchMedia = original;
    }
  });

  it('no_blank_frames_first_screens_load_at_once_AC_R17_1', () => {
    renderApp('/', { mode: 'none' });
    const hero = screen.getByTestId('public-home');
    for (const img of within(hero).getAllByRole('img')) {
      expect(img.getAttribute('loading')).not.toBe('lazy');
    }
    const first = screen.getByTestId(`feature-row-${FEATURE_ROWS[0]!.id}`);
    for (const img of within(first).getAllByRole('img', { name: /sample data/ })) {
      expect(img).toHaveAttribute('loading', 'eager');
    }
    const later = screen.getByTestId(`feature-row-${FEATURE_ROWS[1]!.id}`);
    expect(within(later).getAllByRole('img', { name: /sample data/ })[0]).toHaveAttribute('loading', 'lazy');
  });

  it('hero_copy_beside_the_product_with_proof_AC_R18_1_AC_R19_1', () => {
    renderApp('/', { mode: 'none' });
    const proof = screen.getByTestId('hero-proof');
    for (const p of tList('web.hero.proof')) expect(within(proof).getByText(p)).toBeInTheDocument();
    // Copy and stage are the two columns of one grid.
    const grid = screen.getByTestId('hero-stage').parentElement!;
    expect(grid).toHaveClass('pub-hero__grid');
    expect(screen.getByText(t('web.hero.lede_short'))).toHaveClass('pub-lede--short');
  });

  it('facts_lead_with_founder_value_and_tests_only_on_security_AC_R19_2', () => {
    renderApp('/', { mode: 'none' });
    const facts = screen.getByTestId('pub-facts');
    expect(within(facts).queryByText(/Automated tests/)).not.toBeInTheDocument();
    expect(within(facts).getAllByRole('term')[0]).toHaveTextContent(factList()[0]!.label);
  });

  it('security_facts_keep_the_tests_fact_AC_R19_3', () => {
    renderApp('/security', { mode: 'none' });
    const facts = screen.getByTestId('pub-facts');
    expect(within(facts).getByText(securityFacts().at(-1)!.label)).toBeInTheDocument();
  });

  it('faq_ends_with_a_next_step_and_pricing_has_no_numbers_AC_R21_1_AC_R22_1', () => {
    renderApp('/', { mode: 'none' });
    const next = screen.getByTestId('faq-next');
    expect(within(next).getByRole('heading', { name: t('web.faq_next.title') })).toBeInTheDocument();
    expect(within(next).getByRole('link', { name: t('web.hero.primary') })).toHaveAttribute(
      'href',
      '/sign-in?mode=sign-up',
    );
    expect(within(next).getByRole('link', { name: t('web.faq_next.security') })).toHaveAttribute(
      'href',
      '/security',
    );
    const pricing = screen.getByTestId('pub-pricing');
    expect(pricing).toHaveTextContent(t('web.pricing.label'));
    expect(pricing.textContent).not.toMatch(/\$|US\$|[0-9]/);
  });
});

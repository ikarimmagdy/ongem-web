import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { DemoAssistant } from '../assistant/demoAssistant';
import { uaeIbanValid } from '../lib/iban';
import { formatDate, formatMinor } from '../lib/format';
import { t, tList } from '../i18n';
import { posts } from '../public/media/blog';
import { IS_AE, REGION } from '../region';
import { renderApp } from './render';

// The AE build (VITE_REGION=AE) for this file only; the region is read when region.ts loads, so it is set before imports.
vi.hoisted(() => {
  vi.stubEnv('VITE_REGION', 'AE');
});

/** US bank, BaaS provider and partner names, US identity numbers, US rails and US dollars (OG-022 R18). */
const FORBIDDEN =
  /Piermont|Synctera|GenZone|FDIC|\bSSN\b|Social Security|\bITIN\b|\bEIN\b|\bACH\b|Fedwire|\bwires?\b|US\$|\$\d|US business|routing|ruya/i;

const text = () => document.body.textContent ?? '';

async function settled() {
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
}

describe('AE build shows UAE content only (OG-022 R18)', () => {
  it('builds for AE in this file', () => {
    expect(IS_AE).toBe(true);
    expect(REGION).toBe('AE');
  });

  it('public_pages_have_no_us_names_AC_R18_1', () => {
    for (const path of [
      '/',
      '/product',
      '/security',
      '/partners',
      '/blog',
      '/sign-in',
      '/sign-in?mode=sign-up',
    ]) {
      const { unmount } = renderApp(path, { mode: 'none' });
      expect(text(), path).not.toMatch(FORBIDDEN);
      unmount();
    }
    renderApp('/', { mode: 'none' });
    expect(text()).toMatch(/AED \d/);
    expect(screen.getByTestId('pub-bank-statement')).toHaveTextContent('a licensed UAE bank');
  });

  it('blog_posts_shown_have_no_us_names_AC_R18_1', () => {
    const slugs = posts().map((p) => p.slug);
    expect(slugs).not.toContain('from-genzone-to-ongem');
    expect(slugs).not.toContain('where-your-money-lives');
    expect(slugs).not.toContain('adding-money-from-another-bank');
    expect(slugs.length).toBeGreaterThan(0);
    for (const p of posts()) {
      const { unmount } = renderApp(`/blog/${p.slug}`, { mode: 'none' });
      expect(screen.getByTestId('public-post')).toBeInTheDocument();
      expect(text(), p.slug).not.toMatch(FORBIDDEN);
      unmount();
    }
  });

  it('videos_and_screenshots_left_out_AC_R18_1', () => {
    renderApp('/product', { mode: 'none' });
    expect(screen.queryByTestId('video-strip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gallery')).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="screen-"]')).toBeNull();
  });

  it('disclosures_name_a_licensed_uae_bank_AC_R18_1', () => {
    expect(t('web.bank_statement')).toContain('Banking services are provided by a licensed UAE bank.');
    // PS-033: the bank statement is said once; the disclosures no longer repeat it.
    expect(tList('web.disclosures')).not.toContain(t('web.bank_statement'));
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('pub-draft-note')).toHaveTextContent(t('web.disclosures.note'));
    expect(t('web.disclosures.note')).toContain('Draft for legal review');
  });

  it('demo_screens_have_no_us_names_and_read_aed_AC_R18_1', async () => {
    const routes = [
      '/',
      '/accounts',
      '/payments',
      '/payments/pay_demo_3',
      '/payments/new',
      '/payments/top-up',
      '/payments/schedules',
      '/recipients',
      '/cards',
      '/onboarding',
      '/support',
      '/notifications',
      '/settings',
    ];
    for (const route of routes) {
      const { unmount } = renderApp(route);
      await screen.findByTestId('shell');
      await settled();
      expect(text(), route).not.toMatch(FORBIDDEN);
      unmount();
    }
    renderApp('/');
    expect(await screen.findByTestId('home-total')).toHaveTextContent(/^AED \d/);
    expect(text()).toContain('Dune Trading LLC');
    expect(text()).toMatch(/AE•• •••• \d{4}/);
  }, 30_000);

  it('payments_offer_aani_and_uaefts_in_aed_AC_R18_1', async () => {
    renderApp('/payments/new');
    const kind = await screen.findByTestId('payment-kind');
    const options = within(kind)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'Aani to a recipient, instant',
      'UAEFTS to a recipient',
      'Transfer between your accounts',
    ]);
    expect(screen.getByText('Amount in AED')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '1250');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    const review = screen.getByTestId('payment-review');
    expect(review).toHaveTextContent('AED 1,250.00');
    expect(review).toHaveTextContent('Aani, arrives in seconds');
    expect(review).not.toHaveTextContent(FORBIDDEN);
  });

  it('owners_are_identified_by_emirates_id_or_passport_AC_R18_1', async () => {
    renderApp('/onboarding');
    await screen.findByTestId('shell');
    await settled();
    const type = screen.getByTestId('owner-id-type-own_demo_dana');
    expect(
      within(type)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Emirates ID number', 'Passport number']);
  });

  it('recipients_are_added_by_uae_iban_AC_R18_1', async () => {
    renderApp('/recipients?add=1');
    const iban = await screen.findByTestId('recipient-iban');
    expect(screen.queryByTestId('recipient-routing')).not.toBeInTheDocument();
    await userEvent.type(screen.getByTestId('recipient-name'), 'Oasis Catering LLC');
    await userEvent.type(iban, 'AE080331234567890123456');
    await userEvent.click(screen.getByTestId('recipient-save'));
    expect(await screen.findByText('Enter a valid UAE IBAN: AE and 21 digits.')).toBeInTheDocument();
    expect(uaeIbanValid('AE63 0330 0000 1012 3456 789')).toBe(true);
    expect(uaeIbanValid('AE080331234567890123456')).toBe(false);
  }, 30_000);

  it('demo_assistant_answers_in_aed_without_us_names_AC_R18_1', async () => {
    const api = new DemoOnGemApi();
    const assistant = new DemoAssistant(api);
    for (const q of [
      'What is my balance?',
      'Show my payments',
      'Show my recipients',
      'Show my cards',
      'Pay 500 to Saffron Packaging LLC',
      'Add a recipient named Oasis Catering',
      'hello',
    ]) {
      const turn = await assistant.answer(q);
      expect(`${turn.reply} ${turn.draft?.summary ?? ''}`, q).not.toMatch(FORBIDDEN);
    }
    const pay = await assistant.answer('Pay 500 to Saffron Packaging LLC');
    expect(pay.draft?.summary).toBe('Send AED 500.00 by Aani from Operating to Saffron Packaging LLC.');
    expect((await assistant.answer('What is my balance?')).reply).toMatch(/AED \d/);
  });

  it('money_and_times_read_aed_and_dubai_AC_R18_1', () => {
    expect(formatMinor({ amountMinor: 125_000, currency: 'AED' })).toBe('AED 1,250.00');
    expect(formatDate('2026-10-20T06:42:00Z', { time: true })).toBe('20 Oct 2026 10:42 GST');
  });
});

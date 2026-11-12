import { screen, within } from '@testing-library/react';
import { DemoOnGemApi } from '../api/demo';
import { errorText } from '../api/errors';
import { ApiError } from '../api/errors';
import { DemoAssistant } from '../assistant/demoAssistant';
import { formatDate, formatMinor } from '../lib/format';
import { t, tList } from '../i18n';
import { navGroups, navLinks } from '../public/content';
import { posts } from '../public/media/blog';
import { IS_AE, REGION } from '../region';
import { renderApp } from './render';

/** With no VITE_REGION (as the test run has), the build is the US one and its copy is as before OG-022 R18. */
describe('US build unchanged (OG-022 R18)', () => {
  it('no_region_is_us_AC_R18_2', () => {
    expect(IS_AE).toBe(false);
    expect(REGION).toBe('US');
  });

  it('public_copy_as_before_AC_R18_2', () => {
    expect(t('web.bank_statement')).toBe(
      'OnGem is a financial technology company, not a bank. Banking services are provided by Piermont Bank through Synctera.¹',
    );
    expect(t('web.hero.intro')).toBe(
      'A US business account held at Piermont Bank, ACH and scheduled payments, virtual cards and approvals that keep two sets of eyes on every payment. On the web and on your phone.',
    );
    expect(tList('web.disclosures')).toEqual([
      'OnGem is a financial technology company, not a bank. Banking services are provided by Piermont Bank, Member FDIC, through Synctera.',
      'OnGem cards are issued by Piermont Bank.',
      'Deposit insurance covers the failure of an insured bank, up to the applicable limits, once funds are on deposit at Piermont Bank. Conditions apply.',
      'Features marked Coming soon are in development and not yet available.',
    ]);
    expect(navGroups().map((g) => g.label)).toEqual(['Product', 'Who it’s for', 'Resources']);
    expect(navLinks().map((l) => l.label)).toEqual(['Pricing', 'Security']);
    expect(navGroups()[2]!.links.map((l) => l.label)).toEqual(['Guides', 'Blog', 'Videos', 'FAQ']);
    expect(posts().map((p) => p.slug)).toEqual(
      expect.arrayContaining([
        'from-genzone-to-ongem',
        'where-your-money-lives',
        'adding-money-from-another-bank',
      ]),
    );
    expect(posts()).toHaveLength(6);
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('hero-stage').querySelector('img')).not.toBeNull();
    expect(screen.getByTestId('video-strip')).toBeInTheDocument();
    renderApp('/partners', { mode: 'none' });
    expect(screen.getByRole('heading', { name: /Formed your company with GenZone/ })).toBeInTheDocument();
  });

  it('money_rails_and_ids_as_before_AC_R18_2', async () => {
    expect(formatMinor({ amountMinor: 125_000, currency: 'USD' })).toBe('US$1,250.00');
    expect(formatDate('2026-10-20T14:42:00Z', { time: true })).toBe('20 Oct 2026 10:42 ET');
    expect(errorText(new ApiError(409, 'limit_exceeded'))).toBe(
      'This top-up is over the limit of US$25,000.00 for one top-up.',
    );
    expect(errorText(new ApiError(422, 'capability_unavailable'))).toBe(
      'Scheduled transfers between your own accounts are not available yet. Schedule an ACH instead.',
    );
    const assistant = new DemoAssistant(new DemoOnGemApi());
    expect((await assistant.answer('Pay 500 to Acme Supplies LLC')).draft?.summary).toBe(
      'Send US$500.00 by ACH from Operating to Acme Supplies LLC.',
    );
    renderApp('/payments/new');
    const kind = await screen.findByTestId('payment-kind');
    expect(
      within(kind)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['ACH to a recipient', 'Transfer between your accounts']);
    expect(screen.getByText('Amount in US$')).toBeInTheDocument();
  });

  it('owner_id_is_ssn_AC_R18_2', async () => {
    renderApp('/onboarding');
    expect(await screen.findByTestId('owner-ssn-own_demo_dana')).toBeInTheDocument();
    expect(screen.getByText('Social Security number')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-id-type-own_demo_dana')).not.toBeInTheDocument();
  });
});

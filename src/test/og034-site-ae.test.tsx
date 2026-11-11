import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../i18n';
import { capIds, capPath, isPublicPath, navGroups, pagePaths } from '../public/content';
import { posts } from '../public/media/blog';
import { SITE } from '../public/site';
import { renderApp } from './render';

// The AE build for this file only; the region is read when region.ts loads, so it is set before imports.
vi.hoisted(() => {
  vi.stubEnv('VITE_REGION', 'AE');
});

const US_NAMES =
  /Piermont|Synctera|GenZone|FDIC|\bSSN\b|Social Security|\bITIN\b|\bEIN\b|\bACH\b|Fedwire|\bwires?\b|US\$|\$\d|US business|routing|revolut/i;
const CARDS = /\bcards?\b/i;
const text = () => document.body.textContent ?? '';
const root = join(__dirname, '..', '..');
const pages = () => [
  ...pagePaths().filter((p) => p !== '/demo'),
  '/blog',
  ...posts().map((p) => `/blog/${p.slug}`),
];

describe('OG-034 public site, UAE build: coming soon, no cards (R7)', () => {
  it('ae_hero_coming_soon_no_live_claim_AC_R7_1', () => {
    expect(SITE.live).toBe(false);
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('hero-soon')).toHaveTextContent('Coming soon to the UAE');
    expect(screen.getByText(t('web.hero.intro'))).toHaveTextContent('Accounts are not open yet.');
    // PS-010: no public address yet, so no Talk to us leading to a page without one; the demo is the main action.
    expect(SITE.contactEmail).toBe('');
    expect(screen.queryByTestId('hero-get-started')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-demo')).toHaveAttribute('href', '/demo');
    expect(screen.getByTestId('hero-demo')).toHaveClass('og-btn--primary');
    expect(screen.queryByTestId('final-get-started')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Talk to us/);
    for (const path of pages()) {
      const { unmount } = renderApp(path, { mode: 'none' });
      expect(text(), path).not.toMatch(/Open your business account|accounts are open/i);
      unmount();
    }
    for (const id of capIds()) {
      const { unmount } = renderApp(capPath(id), { mode: 'none' });
      expect(screen.getByTestId('soon-note'), id).toHaveTextContent('not open in the UAE yet');
      unmount();
    }
  });

  it('ae_no_cards_and_no_us_names_AC_R7_2', async () => {
    expect(SITE.cards).toBe(false);
    expect(capIds()).not.toContain('cards');
    expect(isPublicPath('/product/cards')).toBe(false);
    expect(posts().some((p) => p.tags.includes('cards'))).toBe(false);
    expect(navGroups().flatMap((g) => g.links.map((l) => l.label))).not.toContain('Cards');
    for (const path of pages()) {
      const { unmount } = renderApp(path, { mode: 'none' });
      expect(text(), path).not.toMatch(US_NAMES);
      expect(text(), path).not.toMatch(CARDS);
      unmount();
    }
    renderApp('/', { mode: 'none' });
    await userEvent.click(screen.getByTestId('phone-menu-button'));
    expect(within(screen.getByTestId('pub-phone-nav')).queryByRole('link', { name: /card/i })).toBeNull();
  });

  it('ae_seed_names_no_us_bank_partner_or_rail_AC_R7_3', () => {
    for (const channel of ['web_public', 'faq', 'blog']) {
      const seed = JSON.parse(readFileSync(join(root, 'content-seed', 'ae', `${channel}.json`), 'utf8'));
      for (const e of seed.entries as Array<{ key: string; en: string; ar: string }>)
        expect(`${e.en} ${e.ar}`, e.key).not.toMatch(
          /Piermont|Synctera|GenZone|\bACH\b|Fedwire|US\$|revolut/i,
        );
    }
  });

  it('region_chooser_ae_AC_R6_1', async () => {
    renderApp('/', { mode: 'none' });
    const button = screen.getByTestId('region-chooser');
    expect(button).toHaveTextContent('UAE');
    await userEvent.click(button);
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(within(panel).getByText('United Arab Emirates')).toHaveAttribute('aria-current', 'true');
    expect(within(panel).getByRole('link', { name: 'United States' })).toHaveAttribute(
      'href',
      'https://app-dev.platform.ongem.com/?lang=en',
    );
  });
});

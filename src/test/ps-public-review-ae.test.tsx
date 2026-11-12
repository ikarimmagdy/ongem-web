import { screen, within } from '@testing-library/react';
import { t, tList } from '../i18n';
import { capIds, isPublicPath, siteRoutes } from '../public/content';
import { SITE } from '../public/site';
import { renderApp } from './render';

// Public site UI and UX review of 12 Nov 2026, UAE build. The region is read when region.ts loads.
vi.hoisted(() => {
  vi.stubEnv('VITE_REGION', 'AE');
});

const US_NAMES = /Piermont|Synctera|FDIC|US\$|revolut/i;

describe('public site review fixes (AE)', () => {
  it('PS_001_legal_pages_exist_in_the_uae_build_too', () => {
    for (const slug of ['terms', 'privacy', 'cookies', 'disclosures']) {
      const { unmount } = renderApp(`/legal/${slug}`, { mode: 'none' });
      expect(screen.getByTestId('legal-holding')).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(US_NAMES);
      expect(document.body.textContent).not.toMatch(/\bcards?\b/i);
      unmount();
    }
  });

  it('PS_008_old_card_and_video_paths_go_to_their_pages', () => {
    expect(isPublicPath('/product/cards')).toBe(false);
    const cards = renderApp('/product/cards', { mode: 'none' });
    expect(screen.getByTestId('public-product')).toBeInTheDocument();
    expect(screen.queryByTestId('explore-demo')).not.toBeInTheDocument();
    cards.unmount();
    renderApp('/videos', { mode: 'none' });
    expect(screen.getByTestId('public-blog')).toBeInTheDocument();
  });

  it('PS_008_edge_routes_of_the_uae_build_keep_the_old_paths_that_move', () => {
    const { pages } = siteRoutes();
    expect(pages).toEqual(expect.arrayContaining(['/', '/product', '/product/cards', '/videos', '/blog']));
    expect(pages.filter((p) => p.startsWith('/blog/')).every((p) => isPublicPath(p))).toBe(true);
  });

  it('PS_010_no_talk_to_us_without_an_address_and_the_demo_leads', () => {
    expect(SITE.contactEmail).toBe('');
    renderApp('/product/payments', { mode: 'none' });
    expect(screen.queryByTestId('cap-get-started')).not.toBeInTheDocument();
    expect(screen.getByTestId('cap-get-started-demo')).toHaveClass('og-btn--primary');
    expect(screen.getByTestId('pub-demo')).toHaveClass('pub-header__main');
  });

  it('PS_011_uae_product_heading_says_what_onGem_will_do', () => {
    renderApp('/product', { mode: 'none' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What OnGem will do in the UAE');
    expect(t('web.nav.overview')).toBe('Everything OnGem will do');
  });

  it('PS_023_one_eyebrow_line_in_the_uae_hero', () => {
    renderApp('/', { mode: 'none' });
    const badge = screen.getByTestId('hero-soon');
    expect(badge.closest('p')).toHaveClass('pub-eyebrow');
    expect(badge.closest('p')).toHaveTextContent(t('web.hero.eyebrow'));
  });

  it('PS_031_a_demo_tile_closes_the_grid_of_five', () => {
    expect(capIds()).toHaveLength(5);
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('demo-tile')).toHaveAttribute('href', '/demo');
  });

  it('PS_032_trust_band_reads_as_sentences', () => {
    for (const i of [1, 2, 3]) expect(t(`web.trust.${i}.role`)).toMatch(/^[A-Z].*\.$/);
  });

  it('PS_033_the_bank_statement_is_said_once', () => {
    expect(tList('web.disclosures')).not.toContain(t('web.bank_statement'));
    renderApp('/', { mode: 'none' });
    const footer = screen.getByTestId('pub-disclosures');
    expect(footer.textContent!.split('Banking services are provided by').length).toBe(2);
  });

  it('PS_039_coming_soon_is_said_once_on_a_capability_page', () => {
    renderApp('/product/payments', { mode: 'none' });
    const note = screen.getByTestId('soon-note');
    expect(note).toHaveAttribute('role', 'note');
    expect(within(note).queryByText(t('web.soon.badge'))).not.toBeInTheDocument();
  });
});

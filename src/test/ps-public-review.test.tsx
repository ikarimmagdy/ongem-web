import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetContent, setChannel, t } from '../i18n';
import { isAppPath, isPublicPath, LEGAL_PAGES, legalSlugs, navGroups } from '../public/content';
import { SITE } from '../public/site';
import { siteConfigErrors } from '../../scripts/site-check.mjs';
import { renderApp } from './render';

// Public site UI and UX review of 12 Nov 2026 (ongem-engineering/outputs/review/ui-ux-2026-11-12/public-site), US build.

const root = join(__dirname, '..', '..');
const css = readFileSync(join(root, 'src/public/public.css'), 'utf8');
const media = readFileSync(join(root, 'src/public/media/media.css'), 'utf8');
const meta = (sel: string) => document.head.querySelector<HTMLMetaElement>(sel)?.content;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('public site review fixes (US)', () => {
  it('PS_001_terms_privacy_cookies_pages_exist_with_a_holding_line', async () => {
    expect(LEGAL_PAGES).toEqual(['terms', 'privacy', 'cookies', 'disclosures']);
    expect(legalSlugs()).toEqual(expect.arrayContaining(['terms', 'privacy', 'cookies']));
    const home = renderApp('/', { mode: 'none' });
    const legal = screen.getByTestId('pub-legal-links');
    const hrefs = within(legal)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/legal/terms', '/legal/privacy', '/legal/cookies', '/legal/disclosures']);
    expect(hrefs.some((h) => h?.startsWith('#'))).toBe(false);
    home.unmount();
    for (const slug of ['terms', 'privacy', 'cookies']) {
      const { unmount } = renderApp(`/legal/${slug}`, { mode: 'none' });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t(`web.legal.page.${slug}`));
      expect(screen.getByTestId('legal-holding')).toHaveTextContent(t('web.legal.holding'));
      expect(screen.getByTestId('legal-contact')).toHaveAttribute('href', '/contact');
      expect(screen.queryByTestId('legal-body')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('PS_001_published_legal_text_replaces_the_holding_line', () => {
    try {
      act(() =>
        setChannel('en', 'legal', {
          channel: 'legal',
          locale: 'en',
          version: 'sha256:legal',
          entries: { 'legal.terms.title': 'Terms from legal', 'legal.terms.body': 'The published terms.' },
          meta: {},
          fallback: [],
        }),
      );
      renderApp('/legal/terms', { mode: 'none' });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms from legal');
      expect(screen.getByTestId('legal-body')).toHaveTextContent('The published terms.');
      expect(screen.queryByTestId('legal-holding')).not.toBeInTheDocument();
    } finally {
      resetContent();
    }
  });

  it('PS_002_draft_disclosures_shown_on_dev_and_hidden_on_production', () => {
    const dev = renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('pub-draft-note')).toHaveTextContent('Draft for legal review');
    expect(screen.getByTestId('pub-draft-disclosures')).toBeInTheDocument();
    dev.unmount();
    vi.stubEnv('VITE_ENVIRONMENT', 'production');
    renderApp('/', { mode: 'none' });
    expect(screen.queryByTestId('pub-draft-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pub-draft-disclosures')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Draft for legal review/);
    expect(screen.getByTestId('pub-disclosures')).toHaveTextContent(t('web.bank_statement'));
  });

  it('PS_003_card_drawings_are_branded_virtual_cards_with_distinct_numbers', () => {
    renderApp('/product', { mode: 'none' });
    const tile = screen.getByTestId('cap-card-cards');
    const faces = within(tile).getAllByTestId('card-face');
    expect(faces).toHaveLength(2);
    for (const f of faces) {
      expect(f).toHaveAttribute('data-base', 'navy');
      expect(within(f).getByRole('img', { name: 'OnGem' })).toBeInTheDocument();
      expect(f).toHaveTextContent(t('web.art.card_business'));
    }
    const numbers = faces.map((f) => f.querySelector('.og-cardface__number')!.textContent);
    expect(new Set(numbers).size).toBe(2);
    expect(readFileSync(join(root, 'src/public/art.tsx'), 'utf8')).not.toMatch(/2412/);
  });

  it('PS_006_menu_items_are_40px_tall_with_8px_gaps_and_16px_type', () => {
    const nav = css.match(/\.pub-nav \{[^}]*\}/g) ?? [];
    expect(nav.join('\n')).not.toMatch(/gap: var\(--space-xs\)/);
    expect(nav.join('\n')).toMatch(/gap: var\(--space-sm\)/);
    const link = css.match(/\.pub-nav__link \{[^}]*\}/)![0];
    expect(link).toMatch(/min-height: 40px/);
    expect(link).toMatch(/font-size: var\(--font-size-md\)/);
    expect(link).toMatch(/font-family: var\(--font-label\)/);
  });

  it('PS_007_a_link_to_the_current_page_scrolls_to_top_and_is_marked', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    renderApp('/product/payments', { mode: 'none' });
    const footerLink = within(screen.getByTestId('footer-product')).getByRole('link', { name: 'Payments' });
    expect(footerLink).toHaveAttribute('aria-current', 'page');
    scrollTo.mockClear();
    await userEvent.click(footerLink);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    const overview = within(screen.getByTestId('footer-product'))
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/product')!;
    expect(overview.getAttribute('aria-current')).toBeNull();
  });

  it('PS_008_unknown_path_is_a_not_found_page_kept_out_of_search', () => {
    for (const path of ['/about', '/careers', '/prodcut']) {
      expect(isPublicPath(path)).toBe(false);
      expect(isAppPath(path)).toBe(false);
      const { unmount } = renderApp(path, { mode: 'none' });
      expect(screen.getByTestId('public-not-found')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('web.not_found.title'));
      expect(screen.getByTestId('not-found-home')).toHaveAttribute('href', '/');
      expect(screen.queryByTestId('explore-demo')).not.toBeInTheDocument();
      expect(document.title).toBe(t('web.page.not_found.title'));
      expect(document.title).not.toMatch(/Console/);
      expect(meta('meta[name="robots"]')).toBe('noindex');
      unmount();
    }
  });

  it('PS_008_app_paths_still_show_sign_in_when_signed_out', () => {
    for (const path of ['/payments', '/cards', '/invite/abc', '/sign-in', '/sign-in/factor-one']) {
      expect(isAppPath(path), path).toBe(true);
      const { unmount } = renderApp(path, { mode: 'none' });
      expect(screen.getByTestId('explore-demo'), path).toBeInTheDocument();
      unmount();
    }
  });

  it('PS_009_sign_in_without_a_key_speaks_plainly', () => {
    renderApp('/sign-in', { mode: 'none' });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/not configured|build|sign-in key/i);
    expect(text).toContain(t('web.auth.not_configured'));
  });

  it('PS_010_contact_gives_ways_in_without_an_invented_address', () => {
    expect(SITE.contactEmail).toBe('');
    renderApp('/contact', { mode: 'none' });
    const ways = screen.getByTestId('contact-ways');
    expect(within(ways).getAllByRole('heading', { level: 2 })).toHaveLength(4);
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(within(ways).getByRole('link', { name: t('web.faq.all') })).toHaveAttribute('href', '/faq');
  });

  it('PS_012_blog_tags_and_quotes_sit_on_surfaces_that_follow_the_theme', () => {
    expect(css).toMatch(/\.pub \.pub-tags li \{[^}]*--color-status-info-bg/);
    expect(css).toMatch(/\.pub \.pub-prose blockquote \{[^}]*--color-status-neutral-bg/);
  });

  it('PS_013_each_width_downloads_only_its_own_screen', () => {
    renderApp('/', { mode: 'none' });
    const hero = screen.getByTestId('hero-stage');
    const desk = hero.querySelector('.pub-hero__desk picture')!;
    expect(desk.querySelector('source')).toHaveAttribute('media', '(max-width: 640px)');
    expect(desk.querySelector('source')!.getAttribute('srcset')).toMatch(/^data:image\/gif/);
    expect(desk.querySelector('img')!.getAttribute('srcset')).toMatch(/ 940w, .* 1880w$/);
    expect(desk.querySelector('img')).toHaveAttribute('fetchpriority', 'high');
    const row = screen.getByTestId('feature-row-payments');
    const narrow = within(row).getByTestId('shot-narrow-payments').querySelector('source')!;
    expect(narrow).toHaveAttribute('media', '(min-width: 641px)');
    const wide = within(row).getByTestId('shot-wide-payments').querySelector('source')!;
    expect(wide).toHaveAttribute('media', '(max-width: 640px)');
  });

  it('PS_014_production_build_refuses_missing_or_dev_site_urls', () => {
    expect(siteConfigErrors({})).toEqual([]);
    expect(siteConfigErrors({ VITE_ENVIRONMENT: 'production' })).toHaveLength(2);
    expect(
      siteConfigErrors({
        VITE_ENVIRONMENT: 'production',
        VITE_SITE_URL: 'https://app-dev.platform.ongem.com',
        VITE_OTHER_SITE_URL: 'https://ongemuaedevweb.z1.web.core.windows.net',
      }),
    ).toHaveLength(2);
    expect(
      siteConfigErrors({
        VITE_ENVIRONMENT: 'production',
        VITE_SITE_URL: 'https://ongem.com',
        VITE_OTHER_SITE_URL: 'https://ae.ongem.com',
      }),
    ).toEqual([]);
  });

  it('PS_015_open_graph_and_twitter_tags_match_the_canonical', () => {
    renderApp('/product/payments', { mode: 'none' });
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href;
    expect(meta('meta[property="og:url"]')).toBe(canonical);
    expect(meta('meta[property="og:title"]')).toBe(document.title);
    expect(meta('meta[property="og:image"]')).toBe(`${SITE.url}/og/ongem-us-en.png`);
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(meta('meta[property="og:locale"]')).toBe('en_US');
  });

  it('PS_016_the_gem_is_the_logo_file_not_a_drawing', () => {
    const art = readFileSync(join(root, 'src/public/art.tsx'), 'utf8');
    expect(art).toMatch(/import brandMark from '\.\.\/assets\/ongem-favicon\.png'/);
    expect(art).not.toMatch(/points="0,14 14,0 34,0 48,14 24,44"/);
    expect(art).not.toMatch(/points="0,140 140,0/);
  });

  it('PS_018_the_primary_action_stays_in_the_header_at_every_width', () => {
    const narrow = css.slice(css.indexOf('@media (max-width: 1120px)'));
    const hidden = narrow.slice(0, narrow.indexOf('{', narrow.indexOf('{') + 1));
    expect(hidden).not.toMatch(/pub-header__start/);
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('pub-get-started')).toHaveClass('pub-header__main');
  });

  it('PS_019_the_demo_has_a_way_back_to_the_site_and_to_sign_up', async () => {
    renderApp('/demo', { mode: 'none' });
    const bar = await screen.findByTestId('demo-bar');
    expect(bar).toHaveTextContent(t('web.demo.bar_text'));
    expect(within(bar).getByTestId('demo-get-started')).toHaveTextContent('Get started');
    await userEvent.click(within(bar).getByTestId('demo-back-to-site'));
    expect(await screen.findByTestId('public-home')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-bar')).not.toBeInTheDocument();
  });

  it('PS_019_get_started_leaves_the_demo_for_sign_up', async () => {
    renderApp('/demo', { mode: 'none' });
    await userEvent.click(await screen.findByTestId('demo-get-started'));
    expect(await screen.findByText(t('web.auth.sign_up_title'))).toBeInTheDocument();
  });

  it('PS_020_video_posters_carry_no_title_over_the_frame', () => {
    renderApp('/', { mode: 'none' });
    const play = screen.getByTestId('play-send-a-payment');
    expect(play.textContent?.trim()).toBe('');
    expect(media).not.toMatch(/pub-video__play-title/);
  });

  it('PS_021_facts_put_the_value_first_from_the_top', () => {
    expect(css).toMatch(/\.pub-fact \{\s*flex-direction: column;\s*justify-content: flex-start;/);
  });

  it('PS_025_footer_is_the_navy_band_with_the_light_wordmark', () => {
    expect(css).toMatch(/\.pub-footer \{\s*background: var\(--color-brand-deep\)/);
    renderApp('/', { mode: 'none' });
    const img = document.querySelector('.pub-footer__logo img')!;
    expect(img.getAttribute('src')).toMatch(/ongem-wordmark-light/);
  });

  it('PS_026_a_menu_closes_when_focus_leaves_it', async () => {
    renderApp('/', { mode: 'none' });
    await userEvent.click(screen.getByTestId('menu-product'));
    expect(screen.getByTestId('menu-product')).toHaveAttribute('aria-expanded', 'true');
    const pricing = within(screen.getByTestId('pub-nav')).getByRole('link', { name: 'Pricing' });
    fireEvent.blur(screen.getByTestId('menu-product'), { relatedTarget: pricing });
    expect(screen.getByTestId('menu-product')).toHaveAttribute('aria-expanded', 'false');
  });

  it('PS_027_phone_panel_closes_on_escape_and_the_page_behind_is_inert', async () => {
    renderApp('/', { mode: 'none' });
    const button = screen.getByTestId('phone-menu-button');
    await userEvent.click(button);
    expect(document.querySelector('.pub > main')).toHaveAttribute('inert');
    expect(document.querySelector('.pub > .pub-footer')).toHaveAttribute('inert');
    await userEvent.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    expect(document.querySelector('.pub > main')).not.toHaveAttribute('inert');
    expect(css).toMatch(/\.pub-phone-nav \{\s*display: block;\s*position: absolute;/);
  });

  it('PS_028_region_link_keeps_the_page_and_the_language', () => {
    renderApp('/security', { mode: 'none' });
    const footer = screen.getByTestId('footer-regions');
    expect(within(footer).getByRole('link', { name: 'United Arab Emirates' })).toHaveAttribute(
      'href',
      `${SITE.otherUrl}/security?lang=en`,
    );
    const card = renderApp('/product/cards', { mode: 'none' });
    expect(
      within(card.getAllByTestId('footer-regions')[1]!).getByRole('link', { name: 'United Arab Emirates' }),
    ).toHaveAttribute('href', `${SITE.otherUrl}/?lang=en`);
  });

  it('PS_029_status_is_out_of_the_menus', () => {
    expect(navGroups().flatMap((g) => g.links.map((l) => l.to))).not.toContain('/status');
  });

  it('PS_030_read_more_names_its_target', () => {
    renderApp('/', { mode: 'none' });
    expect(screen.queryByRole('link', { name: 'Read more' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read more about Payments' })).toHaveAttribute(
      'href',
      '/product/payments',
    );
    expect(css).toMatch(/\.pub-link-light \{\s*display: inline-flex;\s*align-items: center;\s*min-height: 24px;/);
  });

  it('PS_034_faq_heading_column_has_a_line_and_the_next_step', () => {
    const home = renderApp('/', { mode: 'none' });
    const faq = screen.getByTestId('pub-faq');
    expect(within(faq).getByText(t('web.faq.side_text'))).toBeInTheDocument();
    expect(within(faq).getByTestId('faq-all')).toHaveAttribute('href', '/faq');
    home.unmount();
    renderApp('/faq', { mode: 'none' });
    expect(screen.queryByTestId('faq-all')).not.toBeInTheDocument();
  });

  it('PS_035_sign_in_and_sign_up_have_their_own_meta_and_noindex', () => {
    const signIn = renderApp('/sign-in', { mode: 'none' });
    expect(document.title).toBe(t('web.page.sign_in.title'));
    expect(meta('meta[name="description"]')).toBe(t('web.page.sign_in.description'));
    expect(meta('meta[name="robots"]')).toBe('noindex');
    signIn.unmount();
    renderApp('/sign-in?mode=sign-up', { mode: 'none' });
    expect(document.title).toBe(t('web.page.sign_up.title'));
  });

  it('PS_041_current_section_has_a_bar_not_only_colour', () => {
    expect(css).toMatch(/\.pub-menu__button\.is-current \{\s*box-shadow: inset 0 -2px 0 currentColor;/);
  });

  it('PS_042_theme_and_menu_icons_are_drawn', () => {
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('theme-toggle').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('theme-toggle').textContent).toBe('');
    expect(screen.getByTestId('phone-menu-button').querySelector('svg')).not.toBeNull();
  });

  it('PS_044_reveal_motion_is_short_and_eases_out', () => {
    expect(css).toMatch(/animation: pub-rise-in 0\.25s ease-out both/);
    expect(css).toMatch(/animation: pub-rise 0\.3s ease-out both/);
  });

  it('PS_045_theme_toggle_carries_its_words_in_the_panel', async () => {
    renderApp('/', { mode: 'none' });
    await userEvent.click(screen.getByTestId('phone-menu-button'));
    expect(screen.getByTestId('theme-toggle-labelled')).toHaveTextContent(t('web.labels.dark_theme'));
  });

  it('PS_047_skip_link_takes_its_own_row_on_focus', () => {
    expect(css).toMatch(/\.pub-skip:focus \{\s*position: static;/);
  });

  it('PS_049_chips_are_40px', () => {
    expect(css).toMatch(/\.pub-chips a \{\s*display: inline-flex;\s*align-items: center;\s*min-height: 40px;/);
  });
});

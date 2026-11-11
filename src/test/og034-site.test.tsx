import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLocale, resetContent, setChannel, setLocale, t } from '../i18n';
import {
  capability,
  capIds,
  capPath,
  facts,
  faq,
  faqFor,
  pageMeta,
  pagePaths,
  productLink,
  who,
  WHO_IDS,
  whoPath,
} from '../public/content';
import { posts } from '../public/media/blog';
import { SITE } from '../public/site';
import { prerender } from '../prerender';
import { renderApp } from './render';

const root = join(__dirname, '..', '..');
const css = readFileSync(join(root, 'src/public/public.css'), 'utf8');
const ld = (id: string) => JSON.parse(document.getElementById(id)?.textContent ?? 'null');

/** A stand-in IntersectionObserver that records what is observed (jsdom has none). */
function stubObserver() {
  const observed: Element[] = [];
  class IO {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      observed.push(el);
      this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as never);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IO);
  return observed;
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OG-034 public site structure (US build)', () => {
  it('content_visible_without_motion_AC_R1_1', () => {
    // The reveal never hides: no rule makes a reveal element transparent, and the old hiding class is gone.
    const revealRules = css.match(/[^{}]*data-reveal[^{}]*\{[^}]*\}/g) ?? [];
    expect(revealRules.length).toBeGreaterThan(0);
    for (const rule of revealRules) expect(rule).not.toMatch(/opacity|visibility|display:\s*none/);
    expect(css).not.toMatch(/pub--motion/);
    const observed = stubObserver();
    stubReducedMotion(false);
    renderApp('/', { mode: 'none' });
    expect(observed.length).toBeGreaterThan(0);
    expect(document.querySelector('.pub')!.className).toBe('pub');
    for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      expect(el.style.opacity).toBe('');
      expect(el.hidden).toBe(false);
    }
  });

  it('reduced_motion_no_observer_and_print_off_AC_R1_2', () => {
    const observed = stubObserver();
    stubReducedMotion(true);
    renderApp('/', { mode: 'none' });
    expect(observed).toHaveLength(0);
    expect(document.querySelector('.is-rising')).toBeNull();
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toMatch(/animation:\s*none/);
    const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce).toMatch(/\[data-reveal\]\.is-rising/);
  });

  it('screens_and_gallery_load_eagerly_AC_R1_3', () => {
    for (const path of ['/product', ...capIds().map(capPath)]) {
      const { unmount } = renderApp(path, { mode: 'none' });
      const imgs = Array.from(document.querySelectorAll('main img'));
      expect(imgs.length, path).toBeGreaterThan(0);
      for (const img of imgs)
        expect(img.getAttribute('loading'), `${path} ${img.getAttribute('alt')}`).not.toBe('lazy');
      unmount();
    }
  });

  it('overview_links_every_capability_page_AC_R2_1', () => {
    renderApp('/product', { mode: 'none' });
    const page = screen.getByTestId('public-product');
    for (const id of capIds())
      expect(within(screen.getByTestId(`cap-card-${id}`)).getByText(capability(id).nav)).toBeInTheDocument();
    for (const id of capIds())
      expect(screen.getByTestId(`cap-card-${id}`)).toHaveAttribute('href', capPath(id));
    expect(within(page).queryByRole('heading', { name: t('web.labels.what_it_does') })).toBeNull();
    expect(capIds()).toEqual(['accounts', 'payments', 'cards', 'approvals', 'companies', 'assistant']);
  });

  it('capability_page_anatomy_AC_R2_2', () => {
    for (const id of capIds()) {
      const { unmount } = renderApp(capPath(id), { mode: 'none' });
      const page = screen.getByTestId(`public-cap-${id}`);
      const c = capability(id);
      expect(within(page).getAllByRole('heading', { level: 1 }), id).toHaveLength(1);
      expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent(c.title);
      expect(within(page).getByText(c.lede)).toBeInTheDocument();
      expect(within(screen.getByTestId('cap-screen')).getAllByRole('img')[0]).toHaveAccessibleName(
        /sample data/,
      );
      expect(screen.getByTestId('cap-get-started')).toHaveAttribute('href', '/sign-in?mode=sign-up');
      expect(screen.getByTestId('cap-get-started-demo')).toHaveAttribute('href', '/demo');
      expect(within(screen.getByTestId('pub-faq')).getAllByRole('group')).toHaveLength(faq(id).length);
      expect(faq(id).length, id).toBeGreaterThan(0);
      unmount();
    }
  });

  it('old_product_anchors_go_to_capability_pages_AC_R2_3', () => {
    expect(productLink('/product#topup')).toBe('/product/payments');
    expect(productLink('/product#cards')).toBe('/product/cards');
    expect(productLink('/product#approvals')).toBe('/product/approvals');
    expect(productLink('/partners')).toBe('/partners');
    renderApp('/blog/adding-money-from-another-bank', { mode: 'none' });
    expect(screen.getByRole('link', { name: t('web.media.see_product') })).toHaveAttribute(
      'href',
      '/product/payments',
    );
  });

  it('header_top_level_items_AC_R3_1', () => {
    renderApp('/', { mode: 'none' });
    const nav = screen.getByTestId('pub-nav');
    const top = Array.from(nav.children).map((c) => (c.querySelector('button') ?? c).textContent);
    expect(top).toEqual(['Product', 'Who it’s for', 'Pricing', 'Security', 'Resources']);
    expect(top).not.toContain('Videos');
    expect(screen.getByTestId('pub-sign-in')).toHaveAttribute('href', '/sign-in');
    expect(screen.getByTestId('pub-demo')).toHaveTextContent('Try the demo');
    expect(screen.getByTestId('pub-get-started')).toHaveAttribute('href', '/sign-in?mode=sign-up');
    expect(screen.getByTestId('region-chooser')).toBeInTheDocument();
    expect(screen.getByTestId('language-switch')).toBeInTheDocument();
  });

  it('product_menu_opens_lists_and_closes_on_escape_AC_R3_2', async () => {
    renderApp('/', { mode: 'none' });
    const button = screen.getByTestId('menu-product');
    const list = screen.getByTestId('menu-list-product');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toBeVisible();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', list.id);
    expect(
      within(list)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/product', ...capIds().map(capPath)]);
    await userEvent.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    await userEvent.click(screen.getByTestId('menu-who'));
    await userEvent.click(document.body);
    expect(screen.getByTestId('menu-who')).toHaveAttribute('aria-expanded', 'false');
  });

  it('current_page_marked_AC_R3_3', async () => {
    renderApp('/product/approvals', { mode: 'none' });
    const button = screen.getByTestId('menu-product');
    expect(button).toHaveAttribute('data-current', 'true');
    expect(screen.getByTestId('menu-who')).not.toHaveAttribute('data-current');
    await userEvent.click(button);
    expect(
      within(screen.getByTestId('menu-list-product')).getByRole('link', { name: 'Approvals and team' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('phone_menu_shows_the_groups_AC_R3_4', async () => {
    renderApp('/', { mode: 'none' });
    const panel = screen.getByTestId('pub-phone-nav');
    expect(panel).not.toBeVisible();
    await userEvent.click(screen.getByTestId('phone-menu-button'));
    expect(screen.getByTestId('phone-menu-button')).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    for (const name of ['Product', 'Who it’s for', 'Resources'])
      expect(within(panel).getByRole('region', { name })).toBeInTheDocument();
    const hrefs = within(panel)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/product',
        '/product/cards',
        '/for/new-companies',
        '/partners',
        '/pricing',
        '/security',
        '/guides',
        '/faq',
        '/demo',
      ]),
    );
  });

  it('try_the_demo_links_AC_R4_1', () => {
    renderApp('/', { mode: 'none' });
    expect(screen.getByTestId('hero-demo')).toHaveAttribute('href', '/demo');
    expect(screen.getByTestId('hero-demo')).toHaveTextContent('Try the demo');
    expect(screen.getByTestId('pub-demo')).toHaveAttribute('href', '/demo');
    renderApp('/product/accounts', { mode: 'none' });
    expect(screen.getByTestId('cap-get-started-demo')).toHaveAttribute('href', '/demo');
  });

  it('demo_route_starts_the_demo_AC_R4_2', async () => {
    renderApp('/demo', { mode: 'none' });
    expect(await screen.findByTestId('home-total')).toBeInTheDocument();
    expect(screen.queryByTestId('public-home')).not.toBeInTheDocument();
  });

  it('footer_columns_disclosures_and_chooser_AC_R5_1', () => {
    renderApp('/', { mode: 'none' });
    for (const col of ['product', 'who', 'company', 'resources'])
      expect(screen.getByTestId(`footer-${col}`)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('footer-company')).getByRole('link', { name: 'Contact' }),
    ).toHaveAttribute('href', '/contact');
    // PS-029: Status stays out of the menus until it has a real page.
    expect(
      within(screen.getByTestId('footer-resources')).queryByRole('link', { name: 'Status' }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('pub-legal-links')).getByRole('link', { name: 'Disclosures' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('pub-draft-note')).toHaveTextContent('Draft for legal review');
    const chooser = screen.getByTestId('footer-chooser');
    expect(within(chooser).getByTestId('footer-regions')).toBeInTheDocument();
    expect(within(chooser).getByTestId('language-choice')).toBeInTheDocument();
  });

  it('status_placeholder_AC_R5_2', () => {
    renderApp('/status', { mode: 'none' });
    expect(screen.getByRole('heading', { level: 1, name: t('web.status.title') })).toBeInTheDocument();
    expect(screen.getByText(t('web.status.lede'))).toHaveTextContent(/monitoring/);
    expect(screen.getByTestId('status-placeholder')).toHaveTextContent(t('web.status.text'));
  });

  it('region_chooser_us_AC_R6_1', async () => {
    renderApp('/', { mode: 'none' });
    const button = screen.getByTestId('region-chooser');
    expect(button).toHaveTextContent('US');
    expect(button).toHaveAccessibleName('Region: United States. Choose a region');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(within(panel).getByText('United States')).toHaveAttribute('aria-current', 'true');
    expect(within(panel).getByRole('link', { name: 'United Arab Emirates' })).toHaveAttribute(
      'href',
      `${SITE.otherUrl}/?lang=en`,
    );
    expect(SITE.otherUrl).toBe('https://ongemuaedevweb.z1.web.core.windows.net');
  });

  it('numbers_band_true_facts_with_sources_AC_R8_1', () => {
    expect(facts()).toHaveLength(4);
    for (const f of facts()) {
      expect(f.source, f.label).toBeTruthy();
      expect(f.value).not.toBe('16');
    }
    renderApp('/', { mode: 'none' });
    const band = screen.getByTestId('pub-facts');
    expect(band).not.toHaveTextContent(/notices/i);
    expect(within(band).getAllByRole('term')).toHaveLength(4);
    expect(within(band).getByText('Sign-in for every company you run')).toBeInTheDocument();
  });

  it('faqpage_json_ld_AC_R9_1', () => {
    renderApp('/product/payments', { mode: 'none' });
    const data = ld('ld-faq');
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(faq('payments').length);
    expect(data.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: faq('payments')[0]!.q,
      acceptedAnswer: { '@type': 'Answer', text: faq('payments')[0]!.a },
    });
    renderApp('/status', { mode: 'none' });
    expect(document.getElementById('ld-faq')).toBeNull();
  });

  it('organization_json_ld_AC_R9_2', () => {
    renderApp('/pricing', { mode: 'none' });
    expect(ld('ld-organization')).toMatchObject({
      '@type': 'Organization',
      name: 'OnGem',
      url: `${SITE.url}/`,
    });
    const shell = prerender();
    expect(shell.ld.id).toBe('ld-organization');
    expect(JSON.parse(shell.ld.json)).toMatchObject({ '@type': 'Organization', name: 'OnGem' });
    expect(shell.description).toBe(pageMeta('/').description);
  });

  it('hreflang_and_lang_query_AC_R9_3', async () => {
    renderApp('/security', { mode: 'none' });
    const href = (lang: string) =>
      document.head.querySelector(`link[rel="alternate"][hreflang="${lang}"]`)?.getAttribute('href');
    expect(href('en-US')).toBe(`${SITE.url}/security`);
    expect(href('en-AE')).toBe(`${SITE.otherUrl}/security`);
    expect(href('ar-AE')).toBe(`${SITE.otherUrl}/security?lang=ar`);
    expect(href('x-default')).toBe(`${SITE.url}/security`);
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${SITE.url}/security`,
    );
    renderApp('/product/cards', { mode: 'none' });
    expect(href('en-AE')).toBeUndefined();
    try {
      renderApp('/security?lang=ar', { mode: 'none' });
      await waitFor(() => expect(getLocale()).toBe('ar'));
      expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    } finally {
      await act(() => setLocale('en'));
    }
  });

  it('unique_titles_and_descriptions_AC_R9_4', () => {
    const paths = pagePaths();
    expect(paths).toEqual(
      expect.arrayContaining(['/', '/product', '/pricing', '/guides', '/faq', '/status', '/contact']),
    );
    const titles = paths.map((p) => pageMeta(p).title);
    const descriptions = paths.map((p) => pageMeta(p).description);
    expect(new Set(titles).size).toBe(paths.length);
    expect(new Set(descriptions).size).toBe(paths.length);
    for (const p of paths.filter((x) => x !== '/demo')) {
      const { unmount } = renderApp(p, { mode: 'none' });
      expect(document.title, p).toBe(pageMeta(p).title);
      unmount();
    }
  });

  it('no_revolut_pricing_placeholder_draft_disclosures_AC_R10_1', () => {
    for (const p of [...pagePaths().filter((x) => x !== '/demo'), '/blog', '/videos']) {
      const { unmount } = renderApp(p, { mode: 'none' });
      expect(document.body.textContent, p).not.toMatch(/revolut/i);
      expect(screen.getByTestId('pub-draft-note'), p).toHaveTextContent('Draft for legal review');
      unmount();
    }
    renderApp('/pricing', { mode: 'none' });
    expect(screen.getByTestId('pub-pricing').textContent).not.toMatch(/\$|[0-9]/);
  });

  it('who_pages_AC_R11_1', () => {
    for (const id of WHO_IDS) {
      const { unmount } = renderApp(whoPath(id), { mode: 'none' });
      const w = who(id);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(w.title);
      for (const p of w.points) expect(screen.getByText(p)).toBeInTheDocument();
      expect(screen.getByTestId('who-get-started')).toHaveAttribute('href', '/sign-in?mode=sign-up');
      expect(screen.getByTestId('who-get-started-demo')).toHaveAttribute('href', '/demo');
      unmount();
    }
    expect(whoPath('new_companies')).toBe('/for/new-companies');
    const steps = renderApp('/for/new-companies', { mode: 'none' });
    expect(within(screen.getByTestId('who-steps')).getAllByRole('listitem')).toHaveLength(4);
    steps.unmount();
    renderApp('/partners', { mode: 'none' });
    expect(screen.getByTestId('public-partners')).toHaveTextContent('GenZone');
    expect(screen.getByText(/Partner API/)).toBeInTheDocument();
  });

  it('resources_pages_AC_R12_1', () => {
    const { unmount } = renderApp('/guides', { mode: 'none' });
    for (const p of posts().filter((x) => x.product))
      expect(screen.getByTestId(`guide-${p.slug}`)).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    unmount();
    const faqPage = renderApp('/faq', { mode: 'none' });
    expect(screen.getAllByRole('group')).toHaveLength(faqFor('/faq').length);
    faqPage.unmount();
    renderApp('/contact', { mode: 'none' });
    expect(screen.getByRole('heading', { level: 1, name: t('web.contact.title') })).toBeInTheDocument();
    expect(screen.getByText(t('web.contact.customers_text'))).toBeInTheDocument();
    expect(SITE.contactEmail).toBe('');
    expect(screen.queryByTestId('contact-email')).not.toBeInTheDocument();
  });

  it('seeds_have_en_ar_and_match_core_AC_R13_1', () => {
    const core = join(root, '..', 'ongem-core', 'src/main/resources/content/seed');
    for (const region of ['us', 'ae'])
      for (const channel of ['web_public', 'faq', 'blog']) {
        const web = readFileSync(join(root, 'content-seed', region, `${channel}.json`), 'utf8');
        // Names and patterns (a bank's name, "{title} | OnGem", "English") fall back to English by design (OG-033 R7).
        const sameInArabic = /^(© \{year\} OnGem|\{title\}.*|English|Piermont Bank|Synctera|GenZone|OnGem)$/;
        for (const e of JSON.parse(web).entries as Array<{ key: string; en: string; ar: string }>) {
          expect(e.en, e.key).toBeTruthy();
          if (!sameInArabic.test(e.en)) expect(e.ar, e.key).toBeTruthy();
        }
        // The core's copy is the same file (OG-033), where the sibling checkout is present.
        const coreFile = join(core, region, `${channel}.json`);
        if (existsSync(coreFile)) expect(readFileSync(coreFile, 'utf8'), `${region}/${channel}`).toBe(web);
      }
  });

  it('api_channel_without_a_new_key_keeps_the_built_text_AC_R13_1', () => {
    // A web release ahead of the core's seed: the API's older channel lacks the new keys; they keep the built text.
    try {
      setChannel('en', 'web_public', {
        channel: 'web_public',
        locale: 'en',
        version: 'sha256:older',
        entries: { 'web.hero.title': 'A newer hero from the API' },
        meta: {},
        fallback: [],
      });
      expect(t('web.hero.title')).toBe('A newer hero from the API');
      expect(t('web.nav.demo')).toBe('Try the demo');
    } finally {
      resetContent();
    }
  });

  it('accessibility_N1: no axe violations on the new pages', async () => {
    for (const path of [
      '/product',
      '/product/payments',
      '/for/new-companies',
      '/pricing',
      '/guides',
      '/faq',
      '/status',
      '/contact',
    ]) {
      const { container, unmount } = renderApp(path, { mode: 'none' });
      const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(result.violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
      unmount();
    }
  });
});

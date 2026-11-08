/// <reference types="node" />
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DemoOnGemApi } from '../api/demo';
import { LiveOnGemApi } from '../api/live';
import {
  channelContent,
  getLocale,
  refreshChannel,
  setChannel,
  setLocale,
  t,
  tn,
  type Channel,
} from '../i18n';
import { regionApiBase } from '../session';
import { renderApp } from './render';

const root = join(__dirname, '..', '..');

interface SeedEntry {
  key: string;
  format: string;
  description: string;
  placeholders: string[];
  meta: Record<string, string>;
  en: string;
  ar?: string;
}

const seed = (region: string) =>
  readdirSync(join(root, 'content-seed', region)).map((f) => ({
    file: f,
    text: readFileSync(join(root, 'content-seed', region, f), 'utf8'),
    seed: JSON.parse(readFileSync(join(root, 'content-seed', region, f), 'utf8')) as {
      channel: string;
      entries: SeedEntry[];
    },
  }));

const channel = (name: Channel, locale: 'en' | 'ar', entries: Record<string, string>, extra = {}) => ({
  channel: name,
  locale,
  version: `sha256:${locale}-${Object.keys(entries).length}`,
  entries,
  meta: {},
  fallback: [],
  ...extra,
});

/** OG-033: every text from the content API, in English and Arabic. */
describe('content (OG-033)', () => {
  it('ar_falls_back_to_en_and_lists_the_fallback_AC_R7_1', async () => {
    const keys = Array.from({ length: 12 }, (_, i) => `web.fixture.k${i + 1}`);
    const en = Object.fromEntries(keys.map((k) => [k, `English ${k}`]));
    const ar = Object.fromEntries(keys.map((k, i) => [k, i < 10 ? `عربي ${k}` : `English ${k}`]));
    const seen: Array<{ url: string; headers: HeadersInit | undefined }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers });
      return new Response(
        JSON.stringify({
          channel: 'web_public',
          locale: 'ar',
          version: 'sha256:v2',
          entries: ar,
          meta: {},
          fallback: keys.slice(10),
        }),
        { status: 200, headers: { ETag: '"sha256:v2"' } },
      );
    }) as unknown as typeof fetch;
    setChannel('en', 'web_public', channel('web_public', 'en', en));
    await setLocale('ar');
    const got = await refreshChannel('web_public', { base: 'https://api.test', fetchImpl });
    expect(seen[0]!.url).toBe('https://api.test/v1/public/content/web_public?locale=ar');
    expect(Object.keys(got!.entries).filter((k) => k.startsWith('web.fixture.'))).toHaveLength(12);
    expect(got!.fallback).toEqual(['web.fixture.k11', 'web.fixture.k12']);
    expect(t('web.fixture.k1')).toBe('عربي web.fixture.k1');
    expect(t('web.fixture.k12')).toBe('English web.fixture.k12');
    // Kept by version in localStorage, and asked again with its ETag: 304 keeps it.
    expect(JSON.parse(localStorage.getItem('ongem.content.us.ar.web_public')!).version).toBe('sha256:v2');
    const notModified = (async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>)['If-None-Match']).toBe('"sha256:v2"');
      return new Response(null, { status: 304 });
    }) as unknown as typeof fetch;
    await refreshChannel('web_public', { base: 'https://api.test', fetchImpl: notModified });
    expect(channelContent('web_public')!.version).toBe('sha256:v2');
    // An API that fails keeps the texts the page has.
    const down = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await refreshChannel('web_public', { base: 'https://api.test', fetchImpl: down });
    expect(t('web.fixture.k2')).toBe('عربي web.fixture.k2');
  });

  it('a_key_with_no_arabic_reads_english_AC_R7_1', async () => {
    setChannel(
      'en',
      'web_app',
      channel('web_app', 'en', { 'app.fixture.only_en': 'Only in English {name}' }),
    );
    await setLocale('ar');
    expect(t('app.fixture.only_en', { name: 'Dana' })).toBe('Only in English Dana');
    expect(t('app.fixture.missing')).toBe('app.fixture.missing');
  });

  it('arabic_plurals_pick_the_form_for_the_count', async () => {
    setChannel(
      'ar',
      'web_app',
      channel('web_app', 'ar', {
        'app.fixture.days.one': 'يوم واحد',
        'app.fixture.days.two': 'يومان',
        'app.fixture.days.few': '{count} أيام',
        'app.fixture.days.other': '{count} يومًا',
      }),
    );
    await setLocale('ar');
    expect(tn('app.fixture.days', 1)).toBe('يوم واحد');
    expect(tn('app.fixture.days', 2)).toBe('يومان');
    expect(tn('app.fixture.days', 3)).toBe('3 أيام');
    expect(tn('app.fixture.days', 11)).toBe('11 يومًا');
  });

  it('arabic_lays_the_page_out_right_to_left_and_back_AC_R10_1', async () => {
    renderApp('/', { mode: 'none' });
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    await userEvent.click(screen.getByTestId('language-switch'));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'ar'));
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/[؀-ۿ]/);
    expect(screen.getByTestId('language-switch')).toHaveTextContent('English');
    expect(localStorage.getItem('ongem.locale')).toBe('ar');
    await userEvent.click(screen.getByTestId('language-switch'));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'ltr'));
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/[؀-ۿ]/);
  });

  it('money_keeps_latin_digits_in_arabic_AC_R10_1', async () => {
    await act(() => setLocale('ar'));
    renderApp('/');
    const total = await screen.findByTestId('home-total');
    expect(total.textContent).toMatch(/^US\$[\d,]+\.\d{2}$/);
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
  });

  it('settings_language_choice_saves_the_notice_language_AC_R10_1', async () => {
    const api = new DemoOnGemApi();
    const saved = vi.spyOn(api, 'setLocale');
    renderApp('/settings', { api });
    const choice = await screen.findByTestId('language-choice');
    await userEvent.click(within(choice).getByTestId('language-ar'));
    await waitFor(() => expect(saved).toHaveBeenCalledWith('ar'));
    expect(getLocale()).toBe('ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('live_client_saves_the_locale_and_reads_whereami', async () => {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({
        method: init.method ?? 'GET',
        url,
        body: init.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        url.endsWith('/v1/whereami')
          ? '{"companyId":"cmp_1","region":"AE","apiBaseUrl":"https://api-dev.ae.platform.ongem.com"}'
          : '{}',
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const api = new LiveOnGemApi({
      baseUrl: 'https://api.test',
      fetchImpl,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(true),
    });
    await api.setLocale('ar');
    expect(calls[0]).toEqual({
      method: 'PUT',
      url: 'https://api.test/v1/me/preferences',
      body: { locale: 'ar' },
    });
    expect((await api.whereami()).apiBaseUrl).toBe('https://api-dev.ae.platform.ongem.com');
  });

  it('banking_calls_move_to_the_region_of_whereami_OG_022_AC_R11', () => {
    expect(
      regionApiBase({ region: 'AE', apiBaseUrl: 'https://api-dev.ae.platform.ongem.com/' }, '/api-dev'),
    ).toBe('https://api-dev.ae.platform.ongem.com');
    // The build's own region, a failed answer or a host that is not OnGem's keep the build's base.
    expect(regionApiBase({ region: 'US', apiBaseUrl: 'https://api-dev.ongem.com' }, '/api-dev')).toBe(
      '/api-dev',
    );
    expect(regionApiBase(null, '/api-dev')).toBe('/api-dev');
    expect(regionApiBase({ region: 'AE', apiBaseUrl: 'http://api.ae.ongem.com' }, '/api-dev')).toBe(
      '/api-dev',
    );
    expect(regionApiBase({ region: 'AE', apiBaseUrl: 'https://ongem.com.evil.test' }, '/api-dev')).toBe(
      '/api-dev',
    );
  });

  it('legal_page_shows_the_published_text_with_version_and_date_AC_R14_1', async () => {
    const meta = { 'legal.terms.title': { version: '3', effective: '2026-11-15' } };
    setChannel(
      'en',
      'legal',
      channel(
        'legal',
        'en',
        { 'legal.terms.title': 'Terms of use', 'legal.terms.body': '## Who we are\n\nOnGem is not a bank.' },
        { meta },
      ),
    );
    setChannel(
      'ar',
      'legal',
      channel(
        'legal',
        'ar',
        { 'legal.terms.title': 'شروط الاستخدام', 'legal.terms.body': '## من نحن\n\nOnGem ليست بنكًا.' },
        { meta },
      ),
    );
    await setLocale('ar');
    renderApp('/legal/terms', { mode: 'none' });
    const page = screen.getByTestId('public-legal');
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent('شروط الاستخدام');
    expect(within(page).getByRole('heading', { level: 2 })).toHaveTextContent('من نحن');
    expect(screen.getByTestId('legal-version')).toHaveTextContent('3');
    expect(screen.getByTestId('legal-effective')).toHaveTextContent(/15 نوفمبر 2026/);
    expect(document.title).toContain('شروط الاستخدام');
    expect(
      within(screen.getByTestId('pub-legal-links')).getByRole('link', { name: 'شروط الاستخدام' }),
    ).toHaveAttribute('href', '/legal/terms');
  });

  it('a_legal_slug_with_no_text_is_not_a_page_AC_R14_1', () => {
    renderApp('/legal/unknown', { mode: 'none' });
    expect(screen.queryByTestId('public-legal')).not.toBeInTheDocument();
  });
});

describe('seed files (OG-033 R12)', () => {
  it('ae_seed_names_no_us_bank_partner_or_rail_AC_R12_2', () => {
    const files = seed('ae');
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files)
      expect(f.text, f.file).not.toMatch(/Piermont|Synctera|GenZone|\bACH\b|Fedwire|US\$/);
  });

  for (const region of ['us', 'ae'])
    it(`${region}_seed_entries_are_complete_and_bilingual`, () => {
      for (const { file, seed: s } of seed(region)) {
        expect(`${s.channel}.json`).toBe(file);
        for (const e of s.entries) {
          expect(e.key, file).toMatch(/^[a-z0-9_.-]{1,120}$/);
          expect(e.key.split('.')[0], e.key).toBe(
            { web_public: 'web', web_app: 'app', blog: 'blog', faq: 'faq', legal: 'legal' }[s.channel],
          );
          expect(['text', 'markdown'], e.key).toContain(e.format);
          expect(e.description, e.key).toBeTruthy();
          // Arabic text, or the English kept as it is (a name, a figure, a format such as {title} | OnGem).
          if (e.ar !== e.en) expect(e.ar, e.key).toMatch(/[\u0600-\u06FF]/);
          const used = (s: string) => [...new Set(s.match(/\{[a-zA-Z0-9_]+\}/g) ?? [])].sort();
          expect(used(e.en), e.key).toEqual(e.placeholders.map((p) => `{${p}}`).sort());
          expect(used(e.ar!), e.key).toEqual(used(e.en));
          expect(`${e.en} ${e.ar}`, e.key).not.toMatch(/[–—]/);
        }
      }
    });

  it('every_key_the_code_reads_is_in_a_seed_AC_R1_1', () => {
    const keys = new Set(
      ['us', 'ae'].flatMap((r) => seed(r).flatMap((f) => f.seed.entries.map((e) => e.key))),
    );
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
      );
    const missing: string[] = [];
    for (const f of files(join(root, 'src')).filter((f) => !/[/\\]test[/\\]|\.test\.tsx?$/.test(f))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\b(t|tr|has)\(\s*'((?:web|app|faq|blog)\.[a-z0-9_.-]+)'/g))
        if (!keys.has(m[2]!)) missing.push(`${f.slice(root.length)}: ${m[2]}`);
      for (const m of src.matchAll(/\bk="((?:web|app)\.[a-z0-9_.-]+)"/g))
        if (!keys.has(m[1]!)) missing.push(`${f.slice(root.length)}: ${m[1]}`);
      for (const m of src.matchAll(/\btn\(\s*'((?:web|app)\.[a-z0-9_.-]+)'/g))
        if (!keys.has(`${m[1]}.other`)) missing.push(`${f.slice(root.length)}: ${m[1]}.other`);
      for (const m of src.matchAll(/\btList\(\s*'((?:web|app)\.[a-z0-9_.-]+)'/g))
        if (!keys.has(`${m[1]}.1`)) missing.push(`${f.slice(root.length)}: ${m[1]}.1`);
    }
    expect(missing).toEqual([]);
  });
});

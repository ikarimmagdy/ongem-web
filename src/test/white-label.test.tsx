/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { DemoOnGemApi } from '../api/demo';
import { AuthProvider, NO_AUTH } from '../auth/session';
import { t } from '../i18n';
import { brand, brandOverride, bundledBrand, loadBrand, parseBrand, setBrand } from '../lib/brand';
import { organizationLd } from '../public/seo';

/**
 * OG-082 (ADR-0058): the founder web is white label. No customer-visible file names the default brand; names, domains
 * and support come from the brand ongem-core serves, the bundled one until it answers.
 */
const root = join(__dirname, '..');
const repo = join(root, '..');
// Screens, components, the public site, acceptance surfaces, the assistant, recording and the demo data a visitor sees.
const scanned = [
  'App.tsx',
  'SignedIn.tsx',
  'CommandSearch.tsx',
  'CompanySwitcher.tsx',
  'nav.ts',
  'screens',
  'design-system/components',
  'public',
  'acceptance',
  'spend',
  'assistant',
  'recording',
  'auth',
  'api/demo.ts',
  'api/demoData.ts',
  'api/demoData.ae.ts',
  'api/demoFx.ts',
  'api/errors.ts',
  'api/live.ts',
];

function files(path: string): string[] {
  const full = join(root, path);
  const st = statSync(full);
  if (st.isFile()) return [full];
  return readdirSync(full).flatMap((f) => files(join(path, f)));
}

const sources = scanned.flatMap(files).filter((f) => /\.(tsx?|json)$/.test(f) && !/\.test\.tsx?$/.test(f));
const BRAND = /\bongem\b/i;
// Not copy: package and virtual module names in imports, storage keys and internal ids (`ongem.demo`,
// `ongem-demo-stub`), the API's approver value `ONGEM`, and asset and video file names.
const IMPORT = /^\s*(import|export)\b.*from\s+'[^']*';?\s*$|^\s*import\s+'[^']*';?\s*$/;
const INTERNAL = /(['"`])ongem[.-][\w.:/-]*\1/gi;
const API_VALUE = /'ONGEM'/g;
const ASSET = /['"/#][\w./-]*ongem[\w-]*(\.(png|svg|jpe?g|webp|webm|vtt))?['"]/gi;
// The operator's share image files (`/og/ongem-us-en.png`) and development hosts are not the brand's copy.
const OPERATOR = /\/og\/ongem-|'https:\/\/[\w-]+-dev\.[\w.-]*ongem\.com'/g;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function hitsIn(file: string, text: string): string[] {
  return text
    .split('\n')
    .map((line, i) => ({
      line: IMPORT.test(line)
        ? ''
        : line.replace(INTERNAL, "''").replace(API_VALUE, "''").replace(ASSET, "''").replace(OPERATOR, "''"),
      i,
    }))
    .filter(({ line }) => BRAND.test(line))
    .map(({ line, i }) => `${relative(repo, file)}:${i + 1}: ${line.trim()}`);
}

function renderWhole(route: string, mode: 'demo' | 'none' = 'demo') {
  return render(
    <AuthProvider value={NO_AUTH}>
      <MemoryRouter initialEntries={[route]}>
        <App initialMode={mode} />
      </MemoryRouter>
    </AuthProvider>,
  );
}

const served = {
  id: 'acme',
  version: 3,
  names: { product: 'Acme Pay', short: 'Acme', legal: 'Acme Payments LLC', assistant: 'Acme Assistant' },
  logo: null,
  theme: { light: 'demo-harbor', dark: null, tokens: null },
  domains: { web: 'app.acme.example', marketing: 'acme.example', api: 'api.acme.example' },
  support: { email: 'help@acme.example', phone: null, url: null },
  legal: { entity: 'Acme Payments LLC', address: '', bankDisclosureKey: null },
  messaging: { emailFrom: 'n@acme.example', emailFromName: 'Acme', smsPrefix: 'Acme', pushTitle: 'Acme' },
  apps: { iosBundleId: null, androidApplicationId: null, appStoreUrl: null, playStoreUrl: null },
  auth: { clerkPublishableKey: null },
};

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

afterEach(() => {
  act(() => setBrand(bundledBrand()));
  sessionStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('white label (OG-082)', () => {
  it('OG082_no_brand_literal_in_screens_components_or_public_pages', () => {
    expect(sources.length).toBeGreaterThan(80);
    const hits = sources.flatMap((f) =>
      hitsIn(f, f.endsWith('.json') ? readFileSync(f, 'utf8') : stripComments(readFileSync(f, 'utf8'))),
    );
    expect(hits).toEqual([]);
  });

  it('OG082_no_brand_literal_in_the_page_shell_or_the_texts', () => {
    const html = readFileSync(join(repo, 'index.html'), 'utf8');
    expect(hitsIn(join(repo, 'index.html'), html)).toEqual([]);
    expect(html).toContain('<title>%BRAND_PRODUCT%</title>');
    // The manifest is generated from the brand, so no static one names the default brand.
    expect(() => statSync(join(repo, 'public/site.webmanifest'))).toThrow();
    // Bundled texts use `{brand}`; the one id left is a video's file name.
    for (const region of ['us', 'ae'])
      for (const f of readdirSync(join(repo, 'content-seed', region))) {
        const seed = JSON.parse(readFileSync(join(repo, 'content-seed', region, f), 'utf8')) as {
          entries: Array<{ key: string; en: string; ar?: string }>;
        };
        for (const e of seed.entries)
          expect(
            `${e.en} ${e.ar ?? ''}`.replace(/#ongem-approves-one-person-company/g, ''),
            e.key,
          ).not.toMatch(BRAND);
      }
  });

  it('OG082_texts_take_the_brand_name', () => {
    expect(t('app.nav.document_title', { page: 'Home' })).toBe('Home | OnGem');
    act(() => setBrand(bundledBrand('harbor')));
    expect(t('app.nav.document_title', { page: 'Home' })).toBe('Home | Harbor');
    expect(t('app.errors.network')).toContain('Harbor');
    expect(organizationLd()).toMatchObject({ name: 'Harbor', legalName: 'Harbor Financial Inc.' });
  });

  it('OG082_brand_fetched_from_core_and_applied', async () => {
    const fetcher = answer(served);
    await act(async () => {
      await loadBrand('https://api.example', fetcher, null);
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/v1/public/brand',
      expect.objectContaining({ credentials: 'omit' }),
    );
    expect(brand().names.product).toBe('Acme Pay');
    renderWhole('/', 'none');
    expect(await screen.findByTestId('public-home')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('demo-harbor'));
    expect(document.body.textContent).toContain('Acme Pay');
    expect(document.body.textContent).not.toMatch(BRAND);
    expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Acme Pay');
  });

  it('OG082_null_fields_keep_the_bundled_values', () => {
    const b = parseBrand({
      ...bundledBrand('harbor'),
      names: { ...bundledBrand('harbor').names, legal: null },
      support: null,
    });
    expect(b?.names.legal).toBe('Harbor Financial Inc.');
    expect(b?.support.email).toBe('support@harbor.example');
    expect(parseBrand({ id: 'x' })).toBeNull();
    expect(parseBrand({ id: 'Bad Id', names: { product: 'X' } })).toBeNull();
  });

  it('OG082_bundled_brand_when_core_cannot_answer', async () => {
    for (const fetcher of [
      answer({ error: 'down' }, 503),
      answer({ not: 'a brand' }),
      vi.fn(async () => {
        throw new TypeError('offline');
      }) as unknown as typeof fetch,
    ]) {
      await act(async () => {
        await loadBrand('https://api.example', fetcher, null);
      });
      expect(brand()).toBe(bundledBrand());
      expect(brand().names.product).toBe('OnGem');
    }
  });

  it('OG082_override_passed_through_and_bundled_when_core_keeps_its_own', async () => {
    const own = answer(bundledBrand('ongem'));
    await act(async () => {
      await loadBrand('https://api.example', own, 'harbor');
    });
    expect(own).toHaveBeenCalledWith('https://api.example/v1/public/brand?brand=harbor', expect.anything());
    // A server that does not allow the override answers its own brand; the asked-for bundled brand stays.
    expect(brand().id).toBe('harbor');
  });

  it('OG082_brand_override_only_in_dev_or_demo', () => {
    const loc = { search: '?brand=harbor', pathname: '/' };
    expect(brandOverride(loc, {})).toBe('harbor');
    // Kept for the tab, so moving between pages keeps it.
    expect(brandOverride({ search: '', pathname: '/payments' }, {})).toBe('harbor');
    sessionStorage.clear();
    expect(brandOverride(loc, { VITE_ENVIRONMENT: 'production' })).toBeNull();
    sessionStorage.setItem('ongem.demo', '1');
    expect(brandOverride(loc, { VITE_ENVIRONMENT: 'production' })).toBe('harbor');
    expect(brandOverride({ search: '?brand=', pathname: '/' }, {})).toBeNull();
  });

  it('OG082_demo_api_serves_the_harbor_brand', async () => {
    const demo = new DemoOnGemApi();
    expect((await demo.brand('harbor')).names.product).toBe('Harbor');
    expect((await demo.brand('nobody')).id).toBe('ongem');
  });

  it('OG082_harbor_in_demo_mode_changes_title_theme_and_product_name', async () => {
    window.history.pushState({}, '', '/?brand=harbor');
    sessionStorage.setItem('ongem.demo', '1');
    const { container } = renderWhole('/');
    await waitFor(() => expect(brand().id).toBe('harbor'));
    await waitFor(() => expect(document.title).toMatch(/\| Harbor$/));
    expect(document.documentElement.dataset.theme).toBe('demo-harbor');
    await waitFor(() => expect(container.textContent).toContain('Harbor'));
    expect(container.textContent).not.toMatch(BRAND);
    expect(document.title).not.toMatch(BRAND);
  });
});

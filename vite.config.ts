/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { seedSnapshot, type Snapshot } from './scripts/content.mjs';
import { SECURITY_TXT_PATH, securityTxt, securityTxtOrigin } from './scripts/security-txt.mjs';

/**
 * The CloudFront response headers policy (security-headers.json, WEB-SEC-05) as plain headers, so the local preview and
 * the e2e run serve what CloudFront will. Over plain http the preview leaves out HSTS and upgrade-insecure-requests.
 */
function securityHeaders(): Record<string, string> {
  const p = JSON.parse(readFileSync(new URL('./security-headers.json', import.meta.url), 'utf8'));
  const s = p.SecurityHeadersConfig;
  const headers: Record<string, string> = {
    'Content-Security-Policy': s.ContentSecurityPolicy.ContentSecurityPolicy.replace(
      /;\s*upgrade-insecure-requests/,
      '',
    ),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': s.FrameOptions.FrameOption,
    'Referrer-Policy': s.ReferrerPolicy.ReferrerPolicy,
    'X-XSS-Protection': '0',
  };
  for (const h of p.CustomHeadersConfig.Items) headers[h.Header] = h.Value;
  return headers;
}

/**
 * The walkthrough videos in public/videos/ and the screenshots were recorded on the US demo, so an AE build
 * (VITE_REGION=AE, OG-022 R18) leaves them out of its output: the videos folder, and every image no chunk refers to.
 */
function regionPublic(): Plugin {
  let drop: string | null = null;
  return {
    name: 'ongem-region-public',
    apply: 'build',
    configResolved(config) {
      drop = config.env.VITE_REGION === 'AE' ? resolve(config.root, config.build.outDir, 'videos') : null;
    },
    generateBundle(_, bundle) {
      if (!drop) return;
      const files = Object.values(bundle);
      const code = files.map((f) => (f.type === 'chunk' ? f.code : String(f.source))).join('\n');
      for (const f of files)
        if (f.type === 'asset' && /\.(jpe?g|png|webp)$/.test(f.fileName) && !code.includes(f.fileName))
          delete bundle[f.fileName];
    },
    closeBundle() {
      if (drop) rmSync(drop, { recursive: true, force: true });
    },
  };
}

/** OG-042: /.well-known/security.txt for the origin this build is served from (scripts/security-txt.mjs). */
function securityTxtFile(): Plugin {
  let origin = '';
  return {
    name: 'ongem-security-txt',
    apply: 'build',
    configResolved(config) {
      origin = securityTxtOrigin(config.env);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: SECURITY_TXT_PATH, source: securityTxt(origin) });
    },
  };
}

/**
 * The content texts (OG-033 R1) as two virtual modules: `virtual:ongem-content` (English, in the main bundle) and
 * `virtual:ongem-content-ar` (Arabic, its own chunk). A build reads the snapshot `scripts/build.mjs` pulled from the
 * API (ONGEM_CONTENT_SNAPSHOT) and carries only its own region; the dev server and the tests read the seed files of
 * both regions, so a test can switch region (VITE_REGION) at run time.
 */
function contentSnapshot(): Plugin {
  const ID = 'virtual:ongem-content';
  const AR = 'virtual:ongem-content-ar';
  let snapshots: () => Snapshot[];
  let root = '';
  return {
    name: 'ongem-content',
    configResolved(config) {
      root = config.root;
      const file = process.env.ONGEM_CONTENT_SNAPSHOT;
      if (config.command === 'build' && !config.build.ssr && !file && config.mode !== 'test')
        throw new Error('content: no snapshot. Build with `npm run build`, which pulls one from the API.');
      if (config.build.ssr && !file && config.mode !== 'test')
        throw new Error('content: no snapshot for the prerender. Build with `npm run build`.');
      snapshots = file
        ? () => [JSON.parse(readFileSync(file, 'utf8')) as Snapshot]
        : () => [seedSnapshot(root, 'us'), seedSnapshot(root, 'ae')];
    },
    resolveId(id) {
      return id === ID || id === AR ? `\0${id}` : null;
    },
    load(id) {
      if (id !== `\0${ID}` && id !== `\0${AR}`) return null;
      if (!process.env.ONGEM_CONTENT_SNAPSHOT)
        for (const region of ['us', 'ae']) {
          const dir = join(root, 'content-seed', region);
          try {
            for (const f of readdirSync(dir)) this.addWatchFile(join(dir, f));
          } catch {
            /* no seed for this region */
          }
        }
      const locale = id === `\0${AR}` ? 'ar' : 'en';
      const out = Object.fromEntries(snapshots().map((s) => [s.region, s.locales[locale]]));
      return `export default ${JSON.stringify(out)};`;
    },
  };
}

/** OG-037: service.version for telemetry: the package version and the commit the build was made from. */
function appVersion(): string {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  try {
    return `${version}+${execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()}`;
  } catch {
    return version;
  }
}

/**
 * OG-082 (ADR-0058): the environment's brand (`VITE_BRAND`, default the bundle's) names the page before the script runs
 * and the web manifest, which is generated, so no build carries another brand's name in a static file. At run time
 * the page follows the brand ongem-core serves.
 */
export function brandManifest(env: Record<string, string | undefined>) {
  const bundle = JSON.parse(readFileSync(new URL('./src/lib/brands.json', import.meta.url), 'utf8'));
  const id = env.VITE_BRAND?.trim();
  const brand = bundle.brands[id && bundle.brands[id] ? id : bundle.default];
  // The icons, share images and videos in public/ carry the default brand; another brand gets its own icon only.
  const own = brand.id === bundle.default;
  const themes = JSON.parse(readFileSync(new URL('./src/themes/ongem-themes.json', import.meta.url), 'utf8'));
  const theme = themes.themes.find((t: { id: string }) => t.id === brand.theme.light) ?? themes.themes[0];
  const canvas: string = theme.color.surface.canvas;
  const manifest = {
    name: brand.names.product,
    short_name: brand.names.short,
    start_url: '/',
    display: 'standalone',
    background_color: canvas,
    theme_color: canvas,
    icons: own
      ? [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      : [{ src: `/${BRAND_ICON}`, sizes: 'any', type: 'image/svg+xml' }],
  };
  return {
    brand,
    own,
    icon: own ? null : brandIcon(brand, theme),
    json: JSON.stringify(manifest, null, 2) + '\n',
  };
}

/** Another brand's browser and home screen icon (OG-079): its favicon file in src/assets, else a letter mark. */
const BRAND_ICON = 'brand-icon.svg';
function brandIcon(
  brand: { id: string; names: { product: string } },
  theme: { color: { brand: { primary: string }; action: { primaryText: string } } },
): string {
  const file = new URL(`./src/assets/${brand.id}-favicon.svg`, import.meta.url);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const letter = brand.names.product.charAt(0).toUpperCase().replace(/[<&]/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" ` +
    `fill="${theme.color.brand.primary}"/><text x="32" y="44" text-anchor="middle" font-family="sans-serif" ` +
    `font-weight="700" font-size="38" fill="${theme.color.action.primaryText}">${letter}</text></svg>`
  );
}

/** The files in public/ that show the default brand: left out of another brand's build (OG-079). */
const DEFAULT_BRAND_PUBLIC = [
  'favicon.ico',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'og',
  'videos',
];

function brandFiles(): Plugin {
  let made: ReturnType<typeof brandManifest>;
  let outDir = '';
  let ssr = false;
  const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return {
    name: 'ongem-brand',
    configResolved(config) {
      made = brandManifest({ ...config.env, ...process.env });
      outDir = resolve(config.root, config.build.outDir);
      ssr = Boolean(config.build.ssr);
    },
    transformIndexHtml(html) {
      const named = html.replace(/%BRAND_PRODUCT%/g, escape(made.brand.names.product));
      if (made.own) return named;
      return named
        .replace(/\s*<link rel="(icon|apple-touch-icon)"[^>]*\/>/g, '')
        .replace(
          '<link rel="manifest"',
          `<link rel="icon" type="image/svg+xml" href="/${BRAND_ICON}" />\n    <link rel="manifest"`,
        );
    },
    configureServer(server) {
      server.middlewares.use('/site.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(made.json);
      });
      if (made.icon)
        server.middlewares.use(`/${BRAND_ICON}`, (_req, res) => {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.end(made.icon);
        });
    },
    generateBundle() {
      if (this.environment?.config.build.ssr) return;
      this.emitFile({ type: 'asset', fileName: 'site.webmanifest', source: made.json });
      if (made.icon) this.emitFile({ type: 'asset', fileName: BRAND_ICON, source: made.icon });
    },
    closeBundle() {
      if (made.own || ssr || this.environment?.config.build.ssr) return;
      for (const f of DEFAULT_BRAND_PUBLIC) rmSync(join(outDir, f), { recursive: true, force: true });
    },
  };
}

const devApi = {
  '/api-dev': {
    target: 'https://api-dev.ongem.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api-dev/, ''),
  },
};

/**
 * OG-055: the shared first-load chunk split in three, so a release that changes only the app or its texts leaves React
 * cached: React and its scheduler, the English texts, and the design system (components, theme, themes file).
 */
const CHUNK_GROUPS = [
  { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
  { name: 'content', test: /ongem-content(?!-ar)/, priority: 2 },
  { name: 'design-system', test: /src[\\/](design-system|themes)[\\/].*\.(tsx?|json)$/, priority: 1 },
];

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), regionPublic(), contentSnapshot(), securityTxtFile(), brandFiles()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: isSsrBuild
    ? undefined
    : {
        rolldownOptions: {
          output: { codeSplitting: { includeDependenciesRecursively: false, groups: CHUNK_GROUPS } },
        },
      },
  server: { port: 5190, strictPort: true, proxy: devApi },
  preview: { port: 5190, strictPort: true, proxy: devApi, headers: securityHeaders() },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: [...configDefaults.exclude, '**/*.e2e.ts', 'e2e-output/**'],
  },
}));

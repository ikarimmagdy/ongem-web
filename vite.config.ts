/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
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

const devApi = {
  '/api-dev': {
    target: 'https://api-dev.ongem.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api-dev/, ''),
  },
};

export default defineConfig({
  plugins: [react(), regionPublic(), contentSnapshot(), securityTxtFile()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  server: { port: 5190, strictPort: true, proxy: devApi },
  preview: { port: 5190, strictPort: true, proxy: devApi, headers: securityHeaders() },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: [...configDefaults.exclude, '**/*.e2e.ts', 'e2e-output/**'],
  },
});

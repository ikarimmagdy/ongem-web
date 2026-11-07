/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

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

const devApi = {
  '/api-dev': {
    target: 'https://api-dev.ongem.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api-dev/, ''),
  },
};

export default defineConfig({
  plugins: [react(), regionPublic()],
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

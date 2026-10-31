/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

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

const devApi = {
  '/api-dev': {
    target: 'https://api-dev.ongem.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api-dev/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
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

/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  preview: { port: 5190, strictPort: true, proxy: devApi },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: [...configDefaults.exclude, '**/*.e2e.ts', 'e2e-output/**'],
  },
});

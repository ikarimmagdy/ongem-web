/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Builds the web app's client from the US content snapshot, as `npm run build` does, and reads every emitted script. */
function build(env: Record<string, string>) {
  const out = mkdtempSync(join(tmpdir(), 'ongem-web-build-'));
  const environment: Record<string, string | undefined> = {
    ...process.env,
    ...env,
    NODE_ENV: 'production',
    ONGEM_CONTENT_SNAPSHOT: resolve('content-snapshot.us.json'),
  };
  delete environment.VITEST;
  if (!('VITE_LOCAL_IDENTITY' in env)) delete environment.VITE_LOCAL_IDENTITY;
  execFileSync('node_modules/.bin/vite', ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], {
    env: environment,
    stdio: 'pipe',
  });
  const js = readdirSync(join(out, 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(out, 'assets', f), 'utf8'))
    .join('\n');
  rmSync(out, { recursive: true, force: true });
  return js;
}

describe('OG-100 local identity build', () => {
  it('AC-R4_1 a build without the local flag carries no local sign-in; a local build does', () => {
    const live = build({});
    expect(live).not.toContain('/local-identity');
    expect(live).not.toContain('Local sign-in');
    const local = build({ VITE_LOCAL_IDENTITY: 'true' });
    expect(local).toContain('/local-identity');
    expect(local).toContain('Local sign-in');
  }, 300_000);

  it('AC-R4_1 the build script refuses the local flag in a production build', () => {
    expect(() =>
      execFileSync('node', ['scripts/build.mjs'], {
        env: { ...process.env, VITE_LOCAL_IDENTITY: 'true', VITE_ENVIRONMENT: 'production' },
        stdio: 'pipe',
      }),
    ).toThrow(/production build refuses it/);
  }, 60_000);
});

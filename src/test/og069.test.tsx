import { screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DemoOnGemApi } from '../api/demo';
import { LiveOnGemApi } from '../api/live';
import { renderApp } from './render';

describe('OG-069 beneficial owner threshold from the API (web)', { timeout: 20000 }, () => {
  it('OG069_owners_card_reads_the_threshold_in_force', async () => {
    const api = new DemoOnGemApi();
    renderApp('/onboarding', { api });
    expect(await screen.findByTestId('owners-threshold')).toHaveTextContent(
      'Everyone who owns 10% or more of the company is listed here and verifies their identity.',
    );
  });

  it('OG069_a_changed_threshold_shows_without_a_web_release', async () => {
    const api = new DemoOnGemApi();
    api.ownerThreshold = async () => ({
      percent: 25,
      enhancedPercent: 15,
      collectAtOrAbove: 15,
      version: 3,
      effectiveFrom: '2026-12-01T00:00:00Z',
    });
    renderApp('/onboarding', { api });
    expect(await screen.findByTestId('owners-threshold')).toHaveTextContent('owns 15% or more');
  });

  it('OG069_no_threshold_text_when_the_api_does_not_answer', async () => {
    const api = new DemoOnGemApi();
    api.ownerThreshold = async () => {
      throw new Error('down');
    };
    renderApp('/onboarding', { api });
    expect(await screen.findByTestId('application-state')).toBeInTheDocument();
    expect(screen.queryByTestId('owners-threshold')).toBeNull();
  });

  it('OG069_live_call_is_the_contract_path', async () => {
    const urls: string[] = [];
    const api = new LiveOnGemApi({
      baseUrl: '',
      fetchImpl: (async (url: string) => {
        urls.push(url);
        return new Response(
          '{"percent":10,"enhancedPercent":10,"collectAtOrAbove":10,"version":null,"effectiveFrom":null}',
        );
      }) as unknown as typeof fetch,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(true),
    });
    expect((await api.ownerThreshold()).collectAtOrAbove).toBe(10);
    expect(urls).toEqual(['/v1/onboarding/owner-threshold']);
  });

  it('OG069_no_owner_percentage_is_written_in_the_web', () => {
    const root = join(process.cwd(), 'src');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : [p];
      });
    const offenders = files(root)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/demoData/.test(f))
      .filter((f) =>
        /(beneficial|ownership|owner)[^\n]{0,60}\b(10|25)\b|\b(10|25)\b[^\n]{0,20}%[^\n]{0,20}own/i.test(
          readFileSync(f, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
    for (const seed of ['us', 'ae']) {
      const text = readFileSync(join(process.cwd(), `content-seed/${seed}/web_app.json`), 'utf8');
      expect(text).not.toMatch(/(own|owner|ownership)[^"\n]{0,40}\b(10|25) ?%/i);
    }
  });
});

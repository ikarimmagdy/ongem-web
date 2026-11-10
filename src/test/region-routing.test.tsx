import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveOnGemApi, type Whereami } from '../api/live';
import type { AuthSession } from '../auth';
import { findRegionBase } from '../session';
import { renderApp } from './render';

const AE = 'https://api-dev.ae.platform.ongem.com';
const none: Whereami = { companyId: null, region: null, apiBaseUrl: null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('OG-022 R24, R25: the region that holds the person (ADR-0052)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks_the_other_region_when_the_build_region_knows_no_company_OG_022_AC_R25_2', async () => {
    const asked: string[] = [];
    const ask = (base: string) => {
      asked.push(base);
      return Promise.resolve(
        base === AE ? { companyId: 'cmp_ae1', region: 'AE', apiBaseUrl: `${AE}/` } : none,
      );
    };
    expect(await findRegionBase(ask, '/api-dev', AE)).toEqual({ url: AE, region: 'AE' });
    expect(asked).toEqual(['/api-dev', AE]);
  });

  it('a_company_in_the_build_region_or_wrong_region_settles_it_without_a_second_ask_OG_022_AC_R24_1', async () => {
    const asked: string[] = [];
    const here = (w: Whereami) => (base: string) => {
      asked.push(base);
      return Promise.resolve(w);
    };
    expect(
      await findRegionBase(
        here({ companyId: 'cmp_1', region: 'US', apiBaseUrl: 'https://api-dev.ongem.com' }),
        '/api-dev',
        AE,
      ),
    ).toEqual({ url: '/api-dev', region: 'US' });
    expect(asked).toEqual(['/api-dev']);
    // The live client reads 409 wrong_region as the answer it carries.
    const fetchImpl = (() =>
      Promise.resolve(
        json(
          {
            code: 'wrong_region',
            homeRegion: 'AE',
            apiBaseUrl: AE,
            detail: 'This company is served in region AE.',
          },
          409,
        ),
      )) as unknown as typeof fetch;
    const live = new LiveOnGemApi({
      baseUrl: '/api-dev',
      fetchImpl,
      companyId: 'cmp_ae1',
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(false),
    });
    expect(await live.whereami()).toEqual({ companyId: 'cmp_ae1', region: 'AE', apiBaseUrl: AE });
    expect(await findRegionBase(() => live.whereami(), '/api-dev', AE)).toEqual({ url: AE, region: 'AE' });
  });

  it('neither_region_knowing_the_person_or_a_failure_keeps_the_build_base_OG_022_AC_R25_2', async () => {
    expect(await findRegionBase(() => Promise.resolve(none), '/api-dev', AE)).toEqual({
      url: '/api-dev',
      region: 'US',
    });
    expect(await findRegionBase(() => Promise.reject(new Error('offline')), '/api-dev', AE)).toEqual({
      url: '/api-dev',
      region: 'US',
    });
    // An other-region base that is not https on an OnGem host is never asked.
    const asked: string[] = [];
    await findRegionBase(
      (b) => {
        asked.push(b);
        return Promise.resolve(none);
      },
      '/api-dev',
      'http://evil.example',
    );
    expect(asked).toEqual(['/api-dev']);
  });

  it('whereami_binds_no_device_OG_022_AC_R25_1', async () => {
    const urls: string[] = [];
    const fetchImpl = ((url: string) => {
      urls.push(url);
      return Promise.resolve(json(none));
    }) as unknown as typeof fetch;
    const keys = { get: vi.fn(), forget: vi.fn() };
    const live = new LiveOnGemApi({
      baseUrl: '/api-dev',
      fetchImpl,
      personId: 'user_1',
      deviceKeys: keys as never,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(false),
    });
    await live.whereami();
    expect(urls).toEqual(['/api-dev/v1/whereami']);
    expect(keys.get).not.toHaveBeenCalled();
  });

  it('an_AE_founder_on_the_US_build_makes_every_call_to_the_AE_API_and_none_here_OG_022_AC_R25_2', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        urls.push(url);
        if (url === '/api-dev/v1/whereami') return Promise.resolve(json(none));
        if (url === `${AE}/v1/whereami`)
          return Promise.resolve(json({ companyId: 'cmp_ae1', region: 'AE', apiBaseUrl: AE }));
        if (url.endsWith('/v1/me'))
          return Promise.resolve(
            json({ personId: 'prn_ae', tenantId: 'tn_uae_dev', companyId: 'cmp_ae1', memberships: [] }),
          );
        // Every banking screen gets an error answer: this test is about where the calls go.
        return Promise.resolve(json({ code: 'service_unavailable' }, 503));
      }),
    );
    const auth: AuthSession = {
      available: true,
      loaded: true,
      signedIn: true,
      user: { id: 'user_ae', name: 'Mariam' },
      getToken: () => Promise.resolve('t'),
      signOut: () => Promise.resolve(),
    };
    renderApp('/', { mode: 'none', auth });
    await waitFor(() => expect(urls.some((u) => u.startsWith(AE) && !u.endsWith('/v1/whereami'))).toBe(true));
    expect(urls.slice(0, 2)).toEqual(['/api-dev/v1/whereami', `${AE}/v1/whereami`]);
    expect(urls.filter((u) => !u.startsWith(AE))).toEqual(['/api-dev/v1/whereami']);
  });
});

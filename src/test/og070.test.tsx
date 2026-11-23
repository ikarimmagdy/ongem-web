import { cleanup, screen, within } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DemoOnGemApi } from '../api/demo';
import { demoApplication } from '../api/demoData';
import { LiveOnGemApi } from '../api/live';
import { renderApp } from './render';

/** OG-070: onboarding rules as configuration (outputs/review/og070-2026-11-23/onboarding-rules-api.md). */
describe('OG-070 onboarding rules from the API (web)', { timeout: 20000 }, () => {
  it('OG070_live_call_is_the_contract_path', async () => {
    const urls: string[] = [];
    const api = new LiveOnGemApi({
      baseUrl: '',
      fetchImpl: (async (url: string) => {
        urls.push(url);
        return new Response('{"identifiers":{"ownerIdTypes":["SSN"]}}');
      }) as unknown as typeof fetch,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(true),
    });
    expect((await api.onboardingRules()).identifiers.ownerIdTypes).toEqual(['SSN']);
    expect(urls).toEqual(['/v1/onboarding/rules']);
  });

  it('OG070_the_id_types_offered_are_the_configured_ones', async () => {
    const api = new DemoOnGemApi();
    renderApp('/onboarding', { api });
    expect(await screen.findByTestId('owner-ssn-own_demo_dana')).toBeInTheDocument();
    cleanup();

    const none = new DemoOnGemApi();
    none.rules.identifiers.ownerIdTypes = ['EMIRATES_ID'];
    renderApp('/onboarding', { api: none });
    expect(await screen.findByTestId('owner-id-types-unavailable')).toHaveTextContent(
      'ID numbers cannot be sent right now.',
    );
    expect(screen.queryByTestId('owner-ssn-own_demo_dana')).toBeNull();
  });

  it('OG070_no_id_field_when_the_rules_cannot_be_read', async () => {
    const api = new DemoOnGemApi();
    api.onboardingRules = async () => {
      throw new Error('down');
    };
    renderApp('/onboarding', { api });
    expect(await screen.findByTestId('owner-id-types-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-ssn-own_demo_dana')).toBeNull();
  });

  it('OG070_the_configured_owner_limit_holds_confirm', async () => {
    const app = demoApplication();
    const api = new DemoOnGemApi({ application: { ...app, requirements: [] } });
    api.rules.ownerLimits.maxOwners = 1;
    renderApp('/onboarding', { api });
    expect(await screen.findByTestId('owner-limit')).toHaveTextContent(
      `The bank takes up to 1 owners and this application lists ${app.owners.length}.`,
    );
    expect(screen.getByTestId('application-confirm')).toBeDisabled();
    await expect(api.confirmApplication(app.id)).rejects.toMatchObject({ code: 'owner_limit_exceeded' });
    cleanup();

    const free = new DemoOnGemApi({ application: { ...app, requirements: [] } });
    renderApp('/onboarding', { api: free });
    expect(await screen.findAllByTestId('application-confirm')).not.toHaveLength(0);
    expect(screen.queryByTestId('owner-limit')).toBeNull();
  });

  it('OG070_an_owner_the_rule_does_not_ask_reads_no_id_needed', async () => {
    const app = demoApplication();
    const dana = app.owners.find((o) => o.id === 'own_demo_dana')!;
    const api = new DemoOnGemApi({ application: { ...app, requirements: [] } });
    api.rules.ownerIdRequired.owners = 'AT_OR_ABOVE_THRESHOLD';
    renderApp('/onboarding', { api });
    const row = await screen.findByTestId(`owner-row-${dana.id}`);
    expect(within(row).getByText(/No ID needed/)).toBeInTheDocument();
    expect(screen.queryByTestId('owner-ssn-own_demo_dana')).toBeNull();
  });

  it('OG070_the_demo_refuses_an_id_type_the_programme_does_not_take', async () => {
    const api = new DemoOnGemApi();
    api.rules.identifiers.ownerIdTypes = ['EMIRATES_ID'];
    const app = demoApplication();
    await expect(
      api.putOwnerIdentity(app.id, 'own_demo_dana', { idType: 'SSN', number: '123456789', country: 'US' }),
    ).rejects.toMatchObject({ code: 'owner_id_type_not_accepted' });
  });

  /**
   * Fails when an onboarding rule is written in the web again: owner limits, control person counts, ownership bounds,
   * trade licence lengths or a list of accepted ID types. The ID formats (SSN 9 digits, Emirates ID 784 and 15 digits)
   * are legal facts and stay in src/region.ts; demo data answers ongem-core's seed and is left out.
   */
  it('OG070_no_onboarding_rule_is_hard_coded_in_the_web', () => {
    const root = join(process.cwd(), 'src');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : [p];
      });
    const code = files(root).filter(
      (f) =>
        /\.tsx?$/.test(f) &&
        !/\.(test|e2e)\.tsx?$/.test(f) &&
        !/demoData/.test(f) &&
        !/[/\\]test[/\\]/.test(f),
    );
    const rules: Array<[string, RegExp]> = [
      ['owner count', /(owners|controlPersons?)\??\.length\s*[<>]=?\s*\d/],
      ['owner limit', /(maxOwners|acceptancePrefillMaxOwners|providerMaxOwners)\s*[:=?]+\s*\d/],
      ['control persons', /(controlPersons?\w*|\bmin|\bmax)\s*[:=]\s*\d[^\n]{0,30}control/i],
      ['ownership bounds', /(min|max)(Total)?Percent\w*\s*[:=]\s*\d/],
      ['ownership total', /ownershipPercent[^\n]{0,80}(===?|[<>]=?)\s*100\b/],
      ['trade licence length', /tradeLicen[cs]e[^\n]{0,60}\b\d+\b/i],
      ['ID type list', /\[\s*['"](SSN|EMIRATES_ID|PASSPORT)['"]\s*,/],
      ['beneficial owner threshold', /(beneficial|ownership|owner)[^\n]{0,60}\b(10|25)\s*%/i],
    ];
    const offenders = code.flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return rules.filter(([, re]) => re.test(text)).map(([what]) => `${f.slice(root.length + 1)}: ${what}`);
    });
    expect(offenders).toEqual([]);

    // The only place an owner ID type is named is the region's list of documents and their formats.
    const named = code.filter((f) => /['"](SSN|EMIRATES_ID)['"]/.test(readFileSync(f, 'utf8')));
    expect(named.map((f) => f.slice(root.length + 1))).toEqual(['region.ts']);

    for (const seed of ['us', 'ae']) {
      const entries = JSON.parse(
        readFileSync(join(process.cwd(), `content-seed/${seed}/web_app.json`), 'utf8'),
      ).entries as Array<{ key: string; en: string }>;
      const said = entries
        .filter((e) => e.key.startsWith('app.'))
        .filter((e) =>
          /up to (\d+|one|two|three|four|five) owners|(\d+|one|two) control persons?|(\d+|one|two) directors?|total[^.]{0,30}100 ?%/i.test(
            e.en,
          ),
        )
        .map((e) => e.key);
      expect(said, seed).toEqual([]);
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { OnGemApi } from '../api/client';
import { ACCEPTANCE_ENABLED, AcceptanceApi, minorFromMajor } from '../acceptance/api';
import { elementsAppearance, hueOf, nearestAccent } from '../acceptance/appearance';
import { MORE, NAV, pageTitle } from '../nav';
import themes from '../themes/ongem-themes.json';
import type { Theme } from '../design-system/theme';

/** OG-039 payment acceptance in the founder web (ADR-0055 proposed): off by default, styled from the theme, core-driven. */
describe('OG-039 Get paid', () => {
  it('OG039_off_by_default_no_screen_in_nav', () => {
    expect(ACCEPTANCE_ENABLED).toBe(false);
    expect(NAV.some((n) => n.id === 'get_paid')).toBe(false);
    expect(MORE.some((n) => n.id === 'get_paid')).toBe(false);
    expect(pageTitle('/get-paid')).not.toBe('OnGem');
  });

  it('OG039_demo_mode_reads_acceptance_as_off_and_calls_nothing', async () => {
    const api = { kind: 'demo' } as unknown as OnGemApi;
    await expect(new AcceptanceApi(api).status()).resolves.toEqual({
      enabled: false,
      environment: null,
      merchant: null,
    });
    await expect(new AcceptanceApi(api).open()).rejects.toMatchObject({ code: 'acceptance_disabled' });
  });

  it('OG039_calls_the_core_never_the_processor', async () => {
    const call = vi.fn().mockResolvedValue({});
    const acceptance = new AcceptanceApi({ kind: 'live', call } as unknown as OnGemApi);
    await acceptance.createCheckout(1250, 'Consulting');
    await acceptance.payout(5000, 'potk_1', 'STANDARD');
    await acceptance.token('WITHDRAW');
    expect(call.mock.calls.map((c) => `${c[0]} ${c[1]}`)).toEqual([
      'POST /v1/acceptance/checkouts',
      'POST /v1/acceptance/payouts',
      'POST /v1/acceptance/element-tokens',
    ]);
    expect(call.mock.calls[1]![2]).toEqual({
      json: { amountMinor: 5000, currency: 'USD', destinationId: 'potk_1', speed: 'STANDARD' },
    });
  });

  it('OG039_withdraw_amount_to_minor_units_without_float_drift', () => {
    expect(minorFromMajor(19.99)).toBe(1999);
    expect(minorFromMajor(0.1 + 0.2)).toBe(30);
  });

  it('OG039_elements_styled_from_the_theme_tokens', () => {
    const theme = (themes as unknown as { themes: Theme[] }).themes[0]!;
    const a = elementsAppearance(theme);
    expect(a.variables['--radius']).toBe(`${theme.radius.md}px`);
    expect(a.variables['--default-font-family']).toBe(theme.typography.body.family);
    expect(a.theme.accentColor).toBe(nearestAccent(theme.color.brand.primary));
    expect(nearestAccent('#0b84d6')).toBe('blue'); // content-check: ignore (test colour)
    expect(hueOf('not a colour')).toBeNull();
  });
});

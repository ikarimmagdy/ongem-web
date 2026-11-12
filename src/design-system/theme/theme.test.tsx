import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ApiThemeSource,
  BUNDLED_THEMES,
  LocalThemeStorage,
  ThemeProvider,
  applyEdits,
  defaultTheme,
  editsFrom,
  themeToCssVars,
  useTheme,
  validateTheme,
  type Theme,
} from './index';

const css = (name: string) => document.documentElement.style.getPropertyValue(name);
const byId = (id: string) => BUNDLED_THEMES.find((t) => t.id === id) as Theme;

function Probe() {
  const t = useTheme();
  return (
    <div>
      <span data-testid="active">{t.theme.id}</span>
      <span data-testid="override">{String(t.hasOverride)}</span>
      {t.themes.map((x) => (
        <button key={x.id} onClick={() => t.setTheme(x.id)}>
          {x.name}
        </button>
      ))}
      <button
        onClick={() =>
          t.saveOverride(applyEdits(t.baseTheme, { ...editsFrom(t.theme, t.baseTheme), primary: '#FF0000' }))
        }
      >
        edit
      </button>
      <button onClick={() => t.resetOverride()}>reset</button>
    </div>
  );
}

describe('theme runtime', () => {
  it('bundles the three themes from the brief and they all validate', () => {
    expect(BUNDLED_THEMES.map((t) => t.id)).toEqual(['ongem', 'ongem-dark', 'demo-harbor']);
    expect(defaultTheme().id).toBe('ongem');
  });

  it('maps tokens to CSS custom properties', () => {
    const vars = themeToCssVars(byId('ongem'));
    expect(vars['--color-brand-primary']).toBe('#2F4BE8');
    expect(vars['--color-action-primary-bg']).toBe('#2F4BE8');
    expect(vars['--font-display']).toContain('Inter');
    expect(vars['--radius-lg']).toBe('16px');
    expect(vars['--space-4xl']).toBe('96px');
    expect(vars['--font-label-transform']).toBe('none');
    expect(vars['--space-md']).toBe('16px');
    expect(vars['--font-money-numeric']).toBe('tabular-nums');
  });

  it('applies the default theme to the document', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(css('--color-brand-primary')).toBe('#2F4BE8');
    expect(css('--color-surface-canvas')).toBe('#FAFAFA');
    expect(document.documentElement.dataset.theme).toBe('ongem');
  });

  it('switches theme at runtime without reload and remembers the choice', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Harbor (white-label demo)' }));
    expect(screen.getByTestId('active')).toHaveTextContent('demo-harbor');
    expect(css('--color-brand-primary')).toBe('#0F766E');
    expect(css('--font-display')).toContain('Merriweather');
    expect(new LocalThemeStorage().getSelected()).toBe('demo-harbor');

    await userEvent.click(screen.getByRole('button', { name: 'OnGem dark' }));
    expect(css('--color-surface-canvas')).toBe('#0E0F12');
    expect(document.documentElement.dataset.themeMode).toBe('dark');
  });

  it('selects a theme from ?theme= for demos', () => {
    window.history.pushState({}, '', '/?theme=ongem-dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('active')).toHaveTextContent('ongem-dark');
    window.history.pushState({}, '', '/');
  });

  it('falls back to the default for an unknown theme id', () => {
    render(
      <ThemeProvider initialThemeId="does-not-exist">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('active')).toHaveTextContent('ongem');
  });

  it('rejects an invalid theme with readable errors', () => {
    const broken = structuredClone(byId('ongem')) as unknown as Record<string, unknown>;
    (broken.color as Record<string, Record<string, string>>).brand!.primary = 'blue-ish';
    delete broken.radius;
    const r = validateTheme(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain('color.brand.primary must be a colour.');
      expect(r.errors).toContain('radius is required.');
    }
    expect(validateTheme({ $schema: 'other' }).ok).toBe(false);
  });

  it('ignores an invalid stored override and uses the bundled theme', () => {
    localStorage.setItem(
      'ongem-admin.theme.overrides',
      JSON.stringify({ ongem: { id: 'ongem', broken: true } }),
    );
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('override')).toHaveTextContent('false');
    expect(css('--color-brand-primary')).toBe('#2F4BE8');
  });

  it('ignores an invalid theme from the API and keeps the bundled one', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ theme: { id: 'tenant', nope: 1 } }), { status: 200 }),
    );
    const source = new ApiThemeSource('https://api.example', fetchImpl as unknown as typeof fetch);
    expect(await source.load()).toEqual([]);
  });

  it('uses a valid tenant theme from the API as the default', async () => {
    const tenant = { ...structuredClone(byId('demo-harbor')), id: 'tenant-x', name: 'Tenant X' };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ theme: tenant }), { status: 200 }));
    const sources = [new ApiThemeSource('https://api.example', fetchImpl as unknown as typeof fetch)];
    render(
      <ThemeProvider remoteSources={sources} initialThemeId="tenant-x">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('tenant-x'));
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example/v1/app/config', expect.anything());
  });

  it('persists a local override across reloads and resets it', async () => {
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(css('--color-brand-primary')).toBe('#FF0000');
    expect(css('--color-action-primary-hover-bg')).toBe('#D90000');
    unmount();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('override')).toHaveTextContent('true');
    expect(css('--color-brand-primary')).toBe('#FF0000');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'reset' }));
    });
    expect(css('--color-brand-primary')).toBe('#2F4BE8');
    expect(new LocalThemeStorage().getOverrides()).toEqual({});
  });

  it('uses the theme favicon file and keeps a dark theme focus ring on edits', () => {
    render(
      <ThemeProvider initialThemeId="ongem">
        <Probe />
      </ThemeProvider>,
    );
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(icon?.href).toContain('ongem-favicon');
    expect(document.title).toBe('OnGem Console');
    const dark = byId('ongem-dark');
    expect(applyEdits(dark, { ...editsFrom(dark, dark), primary: '#FF0000' }).color.border.focus).toBe(
      dark.color.border.focus,
    );
  });

  it('rejects a favicon that is not a file name', () => {
    const broken = structuredClone(byId('ongem')) as unknown as { logo: Record<string, unknown> };
    broken.logo.favicon = 42;
    const r = validateTheme(broken);
    expect(r.ok).toBe(false);
  });

  it('scales radii with the radius scale edit', () => {
    const base = byId('ongem');
    const t = applyEdits(base, { ...editsFrom(base, base), radiusScale: 0.5 });
    expect(t.radius.lg).toBe(8);
    expect(t.radius.pill).toBe(999);
    expect(editsFrom(t, base).radiusScale).toBe(0.5);
  });
});

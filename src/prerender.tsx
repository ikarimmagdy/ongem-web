import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { CLERK_PUBLISHABLE_KEY } from './auth/key';
import { AuthProvider, NO_AUTH } from './auth/session';
import { defaultTheme, themeToCssVars } from './design-system';
import { pageMeta } from './public/content';
import { ORG_LD_ID, organizationLd, socialTags } from './public/seo';

/**
 * The first screen (the public home, OG-032; sign-in before it) as static HTML for index.html, built by `scripts/prerender.mjs` after `vite build`, so it
 * paints before the script arrives (OG-030-N3). With a key, Clerk's form shows as loading, as it does in the app.
 */
export function prerender() {
  const auth = CLERK_PUBLISHABLE_KEY ? { ...NO_AUTH, available: true, loaded: false } : NO_AUTH;
  const html = renderToString(
    <AuthProvider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </AuthProvider>,
  );
  const theme = defaultTheme();
  const vars = themeToCssVars(theme);
  const style =
    Object.entries(vars)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ') + `; color-scheme: ${vars['--color-scheme'] ?? 'light'}`;
  const meta = pageMeta('/');
  // The Organization data is in the static head, so a crawler that runs no script still reads it (OG-034 R9).
  const ld = { id: ORG_LD_ID, json: JSON.stringify(organizationLd()) };
  // Share cards are read by crawlers that run no script, so the home's Open Graph and Twitter tags are static (PS-015).
  const { og, twitter } = socialTags('/', meta, 'en');
  return {
    html,
    style,
    social: [
      ...og.map(([property, content]) => ({ attr: 'property', name: property, content })),
      ...twitter.map(([name, content]) => ({ attr: 'name', name, content })),
    ],
    themeId: theme.id,
    themeMode: theme.mode ?? 'light',
    title: meta.title,
    description: meta.description,
    ld,
  };
}

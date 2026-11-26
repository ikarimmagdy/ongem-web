import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { CLERK_PUBLISHABLE_KEY } from './auth/key';
import { AuthProvider, NO_AUTH } from './auth/session';
import { BUNDLED_THEMES, defaultTheme, themeToCssVars } from './design-system';
import { brand } from './lib/brand';
import { pageMeta, siteRoutes } from './public/content';
import { notFoundMeta } from './public/pages/NotFound';
import { FirstPaint } from './public/first-paint';
import { ORG_LD_ID, organizationLd, socialTags } from './public/seo';

/**
 * The first screen (the public home, OG-032; sign-in before it) as static HTML for index.html, built by `scripts/prerender.mjs` after `vite build`, so it
 * paints before the script arrives (OG-030-N3). With a key, Clerk's form shows as loading, as it does in the app.
 */
export function prerender() {
  const auth = CLERK_PUBLISHABLE_KEY ? { ...NO_AUTH, available: true, loaded: false } : NO_AUTH;
  const at = (path: string) =>
    renderToString(
      <FirstPaint.Provider value={true}>
        <AuthProvider value={auth}>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </FirstPaint.Provider>,
    );
  const html = at('/');
  // OG-082: the environment's brand names the first screen's theme.
  const theme = BUNDLED_THEMES.find((x) => x.id === brand().theme.light) ?? defaultTheme();
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
      ...og.flatMap(([property, content]) =>
        content ? [{ attr: 'property', name: property, content }] : [],
      ),
      ...twitter.flatMap(([name, content]) => (content ? [{ attr: 'name', name, content }] : [])),
    ],
    themeId: theme.id,
    themeMode: theme.mode ?? 'light',
    title: meta.title,
    description: meta.description,
    ld,
    // PS-008: 404.html, which the edge serves with status 404 for any path not in routes.json.
    notFound: { html: at('/404'), ...notFoundMeta() },
    routes: siteRoutes(),
  };
}

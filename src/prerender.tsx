import { renderToString } from 'react-dom/server';
import { App } from './App';
import { CLERK_PUBLISHABLE_KEY } from './auth/key';
import { AuthProvider, NO_AUTH } from './auth/session';
import { defaultTheme, documentTitle, themeToCssVars } from './design-system';

/**
 * The first screen (sign-in) as static HTML for index.html, built by `scripts/prerender.mjs` after `vite build`, so it
 * paints before the script arrives (OG-030-N3). With a key, Clerk's form shows as loading, as it does in the app.
 */
export function prerender() {
  const auth = CLERK_PUBLISHABLE_KEY ? { ...NO_AUTH, available: true, loaded: false } : NO_AUTH;
  const html = renderToString(
    <AuthProvider value={auth}>
      <App />
    </AuthProvider>,
  );
  const theme = defaultTheme();
  const vars = themeToCssVars(theme);
  const style =
    Object.entries(vars)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ') + `; color-scheme: ${vars['--color-scheme'] ?? 'light'}`;
  return { html, style, themeId: theme.id, themeMode: theme.mode ?? 'light', title: documentTitle(theme) };
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_THEME_FROM_API?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** US (default) or AE (OG-022 R18). */
  readonly VITE_REGION?: string;
  /** OG-023 R12: each region's API, so the company switcher lists both regions' companies. */
  readonly VITE_API_BASE_URL_US?: string;
  readonly VITE_API_BASE_URL_AE?: string;
}

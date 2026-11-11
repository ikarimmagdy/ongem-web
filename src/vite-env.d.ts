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
  /** The other region's API base (OG-022 R25), asked when the build's region knows no company for the person. */
  readonly VITE_OTHER_REGION_API_BASE_URL?: string;
  /** OG-034 R6, R9: this build's public origin, the other region's, and the public contact address. */
  readonly VITE_SITE_URL?: string;
  readonly VITE_OTHER_SITE_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  /** `production` for a production build (PS-002, PS-014); anything else is a dev or preview build. */
  readonly VITE_ENVIRONMENT?: string;
}

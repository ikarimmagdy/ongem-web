# ongem-web: project brain

OnGem's founder web app (OG-030, ADR-0041, ADR-0045): the same features as the founder mobile app (ongem-app) in the
browser, on the same customer API and the console's theme tokens. Founders sign in with Clerk's customer instance (never
the ops instance); until its key exists the app runs in demo mode on sample data. It must never store a token, a full
account or identity number or a balance in the browser, never use a Clerk secret key, and never hard-code a colour, font
or radius.

Workspace rules live in the OnGem workspace `Career/Others/other-1/` (WS): `constitution/`, `docs/adr/`, the spec
`ongem-engineering/specs/OG-030-founder-web-app/` and, for the assistant and recording, `OG-031-...`.

## Tech stack

- ongem-admin's stack and versions: Vite 8, React 18, TypeScript strict, React Router 7, Vitest 5, own design system copied from
  ongem-admin `src/design-system/` with the same tokens file, Clerk `@clerk/react`, Vitest and Testing Library, ESLint 9,
  Prettier, Playwright with axe. Pinned versions (`.npmrc` save-exact).

## Where things live

| Path              | What                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/`        | `OnGemApi` (call for call as ongem-app's `OnGemApi.kt`), `live.ts` (bearer, Idempotency-Key, 401 refresh, reverification retry), `demo.ts` and `demoData.ts` (ongem-app's demo), `paths.ts`, `openapi-paths.json` (`npm run api:paths -- <openapi.json or URL>`) |
| `src/session.tsx` | Demo or live mode, role permissions, the demo step-up dialog                                                                                                                                                                                                     |
| `src/screens/`    | Home, Accounts (statements), Payments, Recipients, Cards, Onboarding, Support, Settings                                                                                                                                                                          |
| `src/test/`       | Component tests (`*.test.tsx`) and Playwright e2e (`*.e2e.ts`)                                                                                                                                                                                                   |

## Commands

- `source ~/.nvm/nvm.sh && nvm use 22`
- `npm run dev` (port 5190), `npm run build`, `npm run preview` (port 5190; `/api-dev` proxies to api-dev.ongem.com)
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e` (against `E2E_BASE_URL`, default the local preview)
- Config: `VITE_CLERK_PUBLISHABLE_KEY` (customer instance publishable key; blank means demo only), `VITE_API_BASE_URL`.

## Rules for this repo

- Copy: plain English, money as US$1,250.00 from minor units (`formatMinor`), dates as 20 Oct 2026, no em or en dashes.
- No hex, rgb, font family or radius literals outside the theme (`src/test/no-literals.test.ts`).
- Every screen has loading, empty, error and success states. Test names carry the spec's AC ids.

## Git

- Identity: Karim Magdy <ikarimmagdy@gmail.com> (`.claude/git-identity`; `git config core.hooksPath .githooks`).
- Local git only, branch `develop`. Karim creates the GitHub repositories (GenZone-LLC/ongem-web and ikarimmagdy/ongem-web)
  and adds the remotes; until then nothing is pushed. No AI references in commits.

## Change log

- 2026-10-31: created for OG-030 from ongem-admin's stack and the project template.
- 2026-10-31: OG-031 assistant widget (`src/assistant/`: reads and drafts only; Review opens the normal screen prefilled and
  the screen's own action, with step-up, confirms the draft), recording (`src/recording/`: SCREEN and ACTION events and
  rrweb, masked at capture with `[data-mask]` and `maskAllInputs`; demo mode keeps events in memory) and the privacy line.
  Mark any element showing money, an account number or an identity value with `data-mask`.
- 2026-10-31: review fixes (report `ongem-engineering/outputs/review/2026-10-31-ongem-web.md`): `security-headers.json` is
  the CloudFront response headers policy (CSP and security headers) that ongem-infra applies; `npm run preview` serves the
  same headers so e2e runs under the CSP. rrweb masks every text node (`maskNodeText`), API calls send no cookies.
- 2026-10-31: cross-repo follow-ups: every customer call carries `X-Device-Id` (`src/api/device.ts`: a P-256 key made by
  WebCrypto with a non-exportable private key, kept per person in IndexedDB, bound by a signed challenge on each start;
  a revoked device drops its key), 409 `idempotency_in_progress` is retried with backoff and the same key, draft, step-up
  and permission refusals have their own copy, and the demo assistant drafts `TICKET_REPLY` as ongem-core's stub does.
- 2026-11-01: first screen prerendered (PERF-WEB-04): `npm run build` ends with `scripts/prerender.mjs`, which renders
  `src/prerender.tsx` (the sign-in screen, default theme variables on `<html>`) into `dist/index.html`; `main.tsx`
  renders over it. A build without `VITE_CLERK_PUBLISHABLE_KEY` never bundles Clerk (`src/auth/key.ts`). The signed-in
  chunk is prefetched 1.5 s after load. `node scripts/lcp-probe.mjs [url] [runs]` measures cold FCP, LCP and CLS at
  phone width on a throttled connection.
- 2026-11-02: card widgets (Synctera widgets, WS `docs/synctera/cards.md` s6): `src/screens/CardWidget.tsx` loads the
  bank's widget script (assets or assets-sandbox only) and renders its element in a `data-block` host, so rrweb records
  neither the frame nor the token; `security-headers.json` allows both asset hosts in script-src and frame-src and the
  asset and API hosts in connect-src. Home greets the founder and shows the company and the bank identity state; the
  assistant's tool line is `src/assistant/readLabel.ts` words, never a raw tool name.

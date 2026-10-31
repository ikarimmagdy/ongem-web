# ongem-web: project brain

OnGem's founder web app (OG-030, ADR-0041, ADR-0045): the same features as the founder mobile app (ongem-app) in the
browser, on the same customer API and the console's theme tokens. Founders sign in with Clerk's customer instance (never
the ops instance); until its key exists the app runs in demo mode on sample data. It must never store a token, a full
account or identity number or a balance in the browser, never use a Clerk secret key, and never hard-code a colour, font
or radius.

Workspace rules live in the OnGem workspace `Career/Others/other-1/` (WS): `constitution/`, `docs/adr/`, the spec
`ongem-engineering/specs/OG-030-founder-web-app/` and, for the assistant and recording, `OG-031-...`.

## Tech stack
- ongem-admin's stack and versions: Vite 5, React 18, TypeScript strict, React Router 6, own design system copied from
  ongem-admin `src/design-system/` with the same tokens file, Clerk `@clerk/react`, Vitest and Testing Library, ESLint 9,
  Prettier, Playwright with axe. Pinned versions (`.npmrc` save-exact).

## Where things live
| Path | What |
|---|---|
| `src/api/` | `OnGemApi` (call for call as ongem-app's `OnGemApi.kt`), `live.ts` (bearer, Idempotency-Key, 401 refresh, reverification retry), `demo.ts` and `demoData.ts` (ongem-app's demo), `paths.ts`, `openapi-paths.json` (`npm run api:paths -- <openapi.json or URL>`) |
| `src/session.tsx` | Demo or live mode, role permissions, the demo step-up dialog |
| `src/screens/` | Home, Accounts (statements), Payments, Recipients, Cards, Onboarding, Support, Settings |
| `src/test/` | Component tests (`*.test.tsx`) and Playwright e2e (`*.e2e.ts`) |

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

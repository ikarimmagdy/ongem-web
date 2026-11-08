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
- Content (OG-033): `npm run build` pulls the content snapshot from the region's API (`ONGEM_CONTENT_API` overrides)
  and stops if it cannot; `npm run content:snapshot [-- --region ae]` turns the seed into a snapshot file for
  `npm run build -- --content-snapshot content-snapshot.<region>.json` (CI). `npm run content:check` finds authored text.
- Config: `VITE_CLERK_PUBLISHABLE_KEY` (customer instance publishable key; blank means demo only), `VITE_API_BASE_URL`.
- Region (OG-022 R18): `VITE_REGION` is `US` (default) or `AE`. AE build: `VITE_REGION=AE npm run build -- --outDir dist-uae`
  (`scripts/build.mjs` passes `--outDir` to the client build and the prerender). AE shows UAE content only: no US bank,
  BaaS or partner names, AED, UAE IBANs, Aani and UAEFTS, Emirates ID or passport, a licensed UAE bank (never named).

## Rules for this repo

- No words in code (OG-033, ADR-0051): every text is a content entry read with `t('key', { name })`, `tn`, `tList`,
  `<T k>` or `<Md k>` from `src/i18n`, never at module load. A new text is a new key in `content-seed/<region>/<channel>.json`
  (`web.` public, `app.` signed in, `blog.`, `faq.`; `legal.` is written by legal) with `en`, `ar`, a description and
  its placeholders. `scripts/check-content.mjs` (test AC-R1.1) fails on authored text; sample data files start with
  `// content-check: data`.
- Copy: plain English, money as US$1,250.00 (AED 1,250.00 in AE) from minor units (`formatMinor`), Latin digits in
  Arabic too, dates as 20 Oct 2026 (Arabic month names in Arabic), no em or en dashes.
- Arabic is right to left: use start and end (logical) CSS properties, never left or right.
- Region differences are data: `src/region.ts` (`REGION_CONFIG`, its words are content keys) and each region's seed.
  Never name a US partner or bank in the AE seed (test AC-R12.2).
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
- 2026-11-03: screen recording off (G-156, Karim: not needed): `RECORDING_ENABLED` in `src/recording/Recorder.tsx` is
  the one switch, false; the shell does not mount the Recorder, so nothing reaches /v1/recording. CI
  (`.github/workflows/ci.yml`, as ongem-admin's) runs lint, typecheck, tests, build and OSV-Scanner failing on high and
  critical (G-125); it runs once the GitHub remote exists.
- 2026-11-03: founder features from ongem-core 2da3ccf, f606441 and 31d24a4. ID capture (G-111) on Onboarding while the
  bank is checking: in this browser (the bank's capture link, https only, opens in a new tab, never kept) or a text
  message, then the session's stage polled. Add money (G-40, `src/screens/TopUp.tsx`, /payments/top-up): accounts at
  other banks (typed in, verified by the bank), top-ups by ACH debit, and Approve or Decline on a payment waiting for a
  second person (`payment:approve`). Scheduled payments (G-120, `src/screens/Schedules.tsx`, /payments/schedules): ACH
  only (Q-128), create, pause, resume, cancel, next payment date and the runs; bank dates go through `src/lib/schedule.ts`
  (`formatDay` never shifts a day by time zone).
- 2026-11-08: OG-022 T9, region build switch (R18): `VITE_REGION=AE` gives the UAE founder web. `src/region.ts` holds
  currency, bank time (Asia/Dubai, GST), rails (Aani, UAEFTS, book), owner ID types, IBAN masking and limits;
  `public/content.ae.ts` and `api/demoData.ae.ts` hold the AE copy and demo (Dune Trading LLC, AED); `public/blog/ae/` is
  the AE blog (US-only posts left out). AE leaves out the US-recorded screenshots, gallery and videos (the vite plugin
  drops `videos/` and unreferenced images) and allows no card widget host. Tests `region-ae.test.tsx` (AC-R18.1, grep of
  rendered pages for US names) and `region-us.test.tsx` (AC-R18.2); the US prerendered home is byte-identical to before.
- 2026-11-08: OG-033 T4 and OG-022 T4. Every text is a content entry (`src/i18n`): the build's snapshot of the public
  channels (`virtual:ongem-content`, Arabic in its own chunk) and, on load, the API's newer texts by ETag, cached in
  localStorage by version. `content-seed/us|ae/` holds today's texts in English and Arabic (`content.ts`,
  `content.ae.ts` and the blog markdown are gone). Language switch (English, العربية) in the header and in Settings
  (PUT /v1/me/preferences); Arabic sets `<html lang="ar" dir="rtl">` and uses IBM Plex Sans Arabic after the brand
  faces. Legal pages at `/legal/<slug>` from the `legal` channel. After sign-in banking calls move to whereami's
  `apiBaseUrl` when the company lives in another region (`regionApiBase` in `session.tsx`).

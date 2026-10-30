# DreamService V1.0 — Phase 2 release readiness

Verification date: **2026-10-30**. This continues the existing working tree and the completed [Phase 1 fixes](v1-phase1-fixes.md); it does not replace the original audit or authorize a deployment.

## Recommendation

**READY WITH CONDITIONS** for deployment preparation. Local code/build/database-copy verification is recorded below. Production HTTPS, proxy behavior, secrets, database configuration/migrations, provider delivery, and owner approval of public marketing content still require deployment-environment verification. No production environment was accessed or changed.

## Baseline and actual changes

The baseline was an isolated production build of the initial working tree, exercised in installed Chrome against a fresh restored local PostgreSQL copy. Findings were reproduced rather than inferred from source alone:

| Finding | Baseline evidence | Change |
| --- | --- | --- |
| Missing discovery routes | `/robots.txt` and `/sitemap.xml` returned 404 | App Router robots and sitemap handlers |
| Incomplete private indexing policy | Order, admin-project, and support HTML lacked noindex; account already had it | Explicit private-page metadata and `X-Robots-Tag` on localized/unprefixed private paths and APIs |
| Missing social preview image | Public `og:image` absent; Twitter card was `summary` | Static 1200×630 brand preview, localized OG/Twitter metadata and `summary_large_image` |
| About data waterfall | One `/api/team` request after hydration | Shared server-only public-team service; server-provided TanStack initial data |
| Auth code mounted on every page | Global dialog imported and initialized while closed | Small host loads the existing dialog on demand |
| Dialog focus loss | Escape did not return focus to the opener in either locale | Capture the opener and restore focus on dialog close |
| Missing skip navigation | No skip link in either locale | Localized first-focusable skip link and focusable content target |
| Small carousel dot targets | Actual targets measured 8×8px | 24×24px targets retaining 8px visual dots and existing behavior |
| Obsolete component | No imports/re-exports/dynamic loaders/routes reference legacy `plusCard.tsx` | Removed only that unused component; retained all public assets |
| Starter documentation | README described create-next-app/Geist rather than this app | Project setup, environment names, safe migration/testing/build/deployment instructions |

Additional focused changes: About values render as a Server Component; team images use lazy Next Image with reserved aspect-ratio space and the existing fallback; malformed English account punctuation was corrected. Team images remain `unoptimized` so previously accepted external image URLs are loaded by the browser without introducing an unrestricted server image fetcher. No remote font was introduced: the existing system-font stack remains.

The extracted team service preserves the explicit `PUBLIC_TEAM_PROFILE_IDS` publication contract and the same three batched queries. This was not an N+1 query problem. Its public DTO contains names, approved website URLs, and validated image presentation fields, excluding private IDs, roles, contacts, and profiles. No new public cache was added. The API retains `private, no-store` and its existing failure behavior. Server loading errors retain a safe diagnostic and the localized client retry flow; successful empty arrays remain an empty state.

A production-browser measurement during implementation exposed a footer shift when About's short loading fallback was replaced by its taller server-rendered page. The About-only fallback now reserves the same viewport minimum as the page. The final browser probe asserts a local About CLS below 0.1 and retains shift-source evidence. This does not claim production field Core Web Vitals.

## Before/after measurements

Measurement method: the same installed headless Chrome, cache disabled, 1440×1000 initial viewport, reduced motion, actual isolated production server, and restored database. Values are Resource Timing encoded script-body bytes, not total site transfer, a bundle-budget certification, or production network measurements. Browser prefetch scheduling and host load can vary; local LCP observations are not a controlled speed benchmark.

| Measurement | Before | Final | Result |
| --- | ---: | ---: | --- |
| Home initial script bodies, both locales | 432405 bytes / 29 requests | 427924 bytes / 28 requests | 4481 bytes less (1.04%) |
| About initial script bodies, both locales | 388563 bytes / 28 requests | 371624 bytes / 26 requests | 16939 bytes less (4.36%) |
| About initial team API requests | 1 | 0 | Hydration-to-API waterfall removed |
| Carousel dot target | 8×8px | 24×24px | Original 8px visual retained |
| Escape returns dialog focus, en/fa | false / false | true / true | Verified with actual focused controls |
| About CLS, en/fa | 0.0010 / 0.0120 | 0.0010 / 0.0015 | Final loading-height regression check passed |
| Home LCP sample, en/fa | 1000 / 400 ms | 1096 / 212 ms | Mixed; no general LCP improvement claimed |
| About LCP sample, en/fa | 608 / 296 ms | 172 / 192 ms | Local observation only |

The separately observed implementation-time About footer shift was 0.2412; after reserving the loading height, final total About CLS stayed below 0.002 in both locales. All final public-page CLS samples were below 0.013. These are short local observations, not production percentiles. The homepage still needs form/countdown and carousel code, so lazy sign-in loading produces a modest reduction rather than removing all form libraries. Build durations varied with host load and are not claimed as an optimization.

## SEO policy

- Indexable sitemap: exactly `/en`, `/fa`, `/en/about`, `/fa/about`, under `https://dreamservice.net`. No fabricated modification dates, private records, blog routes, or CMS pages.
- Public metadata includes localized title/description, absolute canonical, `en`/`fa` alternates, `x-default` to English, OG locale/alternate locale/site identity/image, and Twitter large-image metadata.
- Private order, account, admin, and support pages have noindex/nofollow. API and private-path HTTP responses receive the same robots header. Private pages do not advertise public-page canonicals through the metadata helper.
- Robots permits fetching so crawlers can actually observe noindex directives; it is not authorization. This follows [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing). Noindex cannot be used effectively on a resource simultaneously blocked from crawling.
- Framework 404 handling retains actual HTTP 404 and noindex in both locales. Unknown routes were not converted into successful placeholder pages.
- `/opengraph-image` is a static App Router image response explicitly referenced by public metadata. It uses existing brand colors and no external fonts, credentials, provider calls, or invented claims. It is not automatically inherited by private/error pages. Both the root middleware declaration and active `src/middleware.ts` adapter bypass this nonlocalized asset.
- Homepage structured data describes only the WebSite name, canonical URL, and supported languages. No reviews, ratings, unverified customer counts, contacts, people, or services are emitted as structured claims.

## Accessibility and preserved behavior

Actual browser checks cover English/Persian, LTR/RTL, 1440px/390px widths, and light/dark themes. The seven original static portfolio cards, coverflow, previous/next arrows, seven pagination dots, playback control, focus pause, and reduced-motion behavior remain functional. The separate upcoming-project article still contains its own title, description, and countdown, with a measured **32px** section gap. No portfolio code/data or project-selection rules were rewritten.

The existing nearest-public-future PLANNED/ACTIVE selection and deterministic ordering remain unchanged. Existing unit tests cover eligibility, empty/error/expiry states and countdown calculations. No project fixture was added to the original database. The restored demo project provided the actual future countdown for browser verification. Notifications/subscriptions remain explicitly unavailable; no subscription feature was implemented.

Keyboard checks verify the skip link moves focus into content, sign-in autofocus reaches the phone input, Escape closes the dialog and returns focus, and ticket page-size controls work through keyboard opening. Existing form labels, server-side validation, retry/error/empty states, localized dialogs, and image fallbacks remain. Theme-token contrast checks and reduced-motion tests are included in the unit suite; this is not an exhaustive assistive-technology certification.

The existing browser script needed deterministic new-document waits, keyboard dropdown opening instead of coordinates during asynchronous loading, and a retry for Windows' transient `DevToolsActivePort` lock. Private failure diagnostics were added. Intermediate test-navigation/selector failures were investigated; they are not counted as passing checks. Final pass results are distinguished below.

## Security/configuration review

- Session cookies remain HttpOnly, SameSite Lax, and Secure in production, with database-backed expiry, bans, and exact `app-admin` role checks. OTP/account identity and order/ticket authorization implementations were not changed.
- Production mutations require configured `SECURITY_ORIGIN`, matching Origin, acceptable fetch-site, and validated JSON. Private keys require at least 32 bytes. No secret was printed or edited; no credential/provider configuration was changed.
- Rate limiting remains PostgreSQL-backed. Source identity trusts only an explicitly configured single-IP header; its proxy must overwrite client values. Unconfigured source requests intentionally share `unknown`; production capacity cannot be inferred from local tests.
- Existing security headers remain: nosniff, frame denial, referrer/permissions policy, and the compatible CSP restrictions on framing/objects/base. `X-Powered-By` was removed. A stricter script CSP/nonce policy and HSTS need testing at the actual TLS edge; they were not guessed or deployed locally.
- Prisma's existing development reuse/client-capability guard and production client lifecycle remain unchanged. Authenticated responses retain no-store; no personalized/admin response was made publicly cacheable.
- Read-only production dependency advisory check: `npm audit --omit=dev --package-lock-only --json` reported **0 vulnerabilities**. No installation, audit fix, package/lockfile update, or dependency removal occurred. This reports the registry's result at verification time, not a security guarantee.

## Database safety and evidence

Private evidence root: `.backups/v1-phase1-phase2-20261030T160401044Z` (Git-ignored). A fresh local backup was listed, restored, and verified before fixture tests:

- `before-phase2.dump`: **111679 bytes**, SHA-256 **`b1d9369d6e6f2737f4caf5e937765b72a85ab6e8b3b47f83095d0330f52410ac`**.
- Disposable database: `dreamservice_phase1_test_8ef0ae442bd24d54aa7958006507f40f`. All seven already-applied migrations were restored as history; **no migration was created or executed during Phase 2**.
- Original read-only comparison covers all **27 table row counts/fingerprints**, full seven migration records, **86 indexes**, and **16 sequence states**, plus migration-file hashes and backup hash. Verification returned `originalUnchanged: true`.
- Original counts remain **16 users, 3 profiles, 121 orders, 1 project, 1 ticket, 1 ticket message, 1 ticket notification, and 3 images**. All seven migration files remain unchanged, including identity SHA-256 `e5b420d9f431047205890cd4922348f329446cbf50b155d2ebe0227ebe561b03`.
- Nine invalid legacy contacts and one customer's 49 historical open orders remain untouched. The existing lock-and-check policy still sees all historical open orders; no strict open-order unique index was introduced. Direct noncooperating database writers remain outside that application guarantee.

Backup restoration comparisons account only for the previously verified logical-restore representation differences documented in Phase 1. Original before/after comparisons are strict. All registration, OTP, account, order, and authorization mutations used disposable fixtures and mocked providers. There were no original-record writes, resets, truncations, seeds, destructive database commands, real SMS/email, deployments, commits, or pushes.

## Files changed in Phase 2

This list describes this task's delta against its initial file-hash snapshot, not all pre-existing Git changes:

| Files | Reason |
| --- | --- |
| `src/lib/i18n/metadata.ts` | Public social/canonical metadata and private noindex |
| `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/opengraph-image/route.tsx` (new) | Discovery policy and static brand preview |
| `next.config.ts`, `middleware.ts`, `src/middleware.ts` | Private robots headers, disable powered-by, image middleware bypass |
| `src/app/[locale]/page.tsx` | Accurate minimal WebSite structured data |
| `src/lib/team/service.ts` (new), `src/app/api/team/route.ts` | Reuse the same privacy-preserving published-team query |
| `src/app/[locale]/about/page.tsx`, `src/components/templates/about/TeamSection.tsx` | Server initial team data, preserved retry/empty behavior |
| `src/app/[locale]/about/loading.tsx` | Prevent the observed loading/footer shift |
| `src/components/templates/about/AboutValues.tsx`, `TeamCard.tsx` | Server-only static values and lazy dimension-reserved team images |
| `src/components/modules/auth/AuthModalHost.tsx` (new), `AuthModal.tsx`, `src/store/authModalStore.ts` | On-demand dialog loading and opener focus restoration |
| `src/app/[locale]/layout.tsx`, `messages/en.json`, `messages/fa.json` | Localized skip link/content target; English punctuation correction |
| `src/styles/globals.css` | Scoped portfolio dot hit areas, retaining visual dots |
| `src/components/templates/about/plusCard.tsx` (deleted) | Verified unused legacy component; no public assets deleted |
| `scripts/v1-phase2.test.mjs`, `scripts/v1-phase2-browser.mjs` (new), `scripts/v1-phase1-browser.mjs` | Focused contracts, actual production-browser checks/measurements, robust regression navigation |
| `README.md`, this report (new) | Replace starter instructions; document measured results and operational gates |

Unrelated working-tree changes, `.env` files, dependency manifests/lockfile, Prisma schema, applied migrations, original audit, and Phase 1 report were preserved. `public/images/rahnama.pdf` and all legacy public assets remain. Cleanup removed only this task's three verified `baseline/app`, `final/app`, and `release/app` build copies after checking their absolute paths, build markers, and node_modules junction targets. Junctions were detached before recursive removal. The existing root `.next`, source files, older recovery artifacts, database copy, backup, logs, and screenshots remain. The private preparation helper was archived as text rather than left executable.

Final SHA-256 comparison against the 322-file starting snapshot verified **302 existing files byte-for-byte unchanged**, exactly the **19 intended modified existing files**, and the **one verified unused component deletion**. Git's tracked/nonignored inventory contained exactly **8 intended new files**. `source-final-verification.json` records this allowlist check; no unrelated file changes were detected.

## Verification completion

| Check actually executed | Final result |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS, no output/errors |
| `npm.cmd run lint` | PASS, 0 errors; 2 existing React Compiler compatibility warnings |
| `node scripts/prisma-offline.mjs validate` | PASS, isolated dummy URL; no database access |
| `node --test --test-reporter=spec` with all `scripts/*.test.mjs` paths | **297 passed**, 0 failed/skipped; includes 11 new Phase 2 cases |
| Guarded `v1-phase1-run.mjs integration .../final` | **15 passed**, 0 failed/skipped, disposable PostgreSQL only |
| Isolated production build, `v1-phase1-run.mjs build .../release` (`next build --webpack`) | PASS, 51 generated entries; database/provider access blocked |
| `v1-phase2-browser.mjs .../release verify` | PASS, final metadata/robots/sitemap/image/private headers/404/focus/CLS/layout checks; 0 runtime errors and 0 server 500s |
| `v1-phase1-run.mjs browser .../release` | PASS, full final-build regression; 0 runtime errors, 0 server 500s, one mocked provider delivery |
| Read-only production dependency lockfile audit | PASS, registry reported 0 vulnerabilities |
| Final original-database/migration/backup integrity comparison | PASS, unchanged |
| Targeted Git whitespace check | PASS; only existing platform line-ending notices |

The remaining lint warnings are at `src/components/modules/data-table/data-table.tsx:111` (`useReactTable`) and `src/components/modules/dream-form/dream-form.tsx:196` (React Hook Form `watch`). React Compiler skips incompatible memoization; no rule/configuration was weakened or suppressed. The unused legacy component's previous image warning disappeared with that confirmed-unused file. These warnings are not claimed to be fixed.

Build logs include the verification guard's expected blocked-environment-loading messages. The final preview route removed the unintended root social-metadata/metadataBase warnings. Isolated start logs can warn about copied/root lockfile tracing; this is specific to the verification copy. No Next configuration was weakened to hide diagnostics. Verification used Webpack; the default build bundler, real production infrastructure, live providers, field performance, and exhaustive cross-browser/screen-reader behavior were not separately tested.

Private evidence includes `baseline/public-browser.json`, `release/public-browser.json`, their layout-shift traces and homepage screenshots, `release/build.log`, `release/browser.log`, `final/integration.log`, `unit.log`, `typecheck.log`, `lint.log`, `prisma-validation.log`, `dependency-audit.json`, `original-integrity.log`, and `build-cleanup.json`. Screenshots were visually inspected for the English desktop/light and Persian mobile/dark portfolio/countdown grouping. Temporary sandbox child-process restrictions, a Windows Chrome port-file lock, and intermediate selector/navigation failures were corrected and rerun; only the successful final executions above support the result.

The PostgreSQL suite exercises two-connection order locking/idempotency, all open/closed statuses, restored historical duplicates, budgets, committed bans/demotions, ownership, phone/username uniqueness, equivalent-phone registration concurrency, moderation, safe email conflicts, and legacy OTP/login compatibility. The browser suite additionally exercises real OTP-to-registration, account edits, ticket pagination, order submission/conflict recovery, authorization, and the complete homepage controls.

## Deployment checklist and remaining conditions

1. Review/approve this working tree and its pre-existing Phase 1 work. This task did not commit or package a release.
2. Verify the actual production database target, credentials/privileges/TLS/pooling, backup restoration, migration inventory and approved deployment process. Local migration status is not evidence of production readiness.
3. Supply production secrets and exact HTTPS origin; verify Secure cookies, cross-origin rejection, session expiry/logout/ban behavior on the actual domain.
4. Verify the deployed proxy overwrites the chosen source-IP header, prevents spoofing, and supports the database-backed rate-limit capacity. Do not copy a generic forwarded-header value into trust configuration.
5. Approve provider templates/configuration and separately authorize delivery tests. No real provider delivery was tested here.
6. Verify canonical domain/redirects/TLS, crawler-visible metadata/noindex, preview/staging indexing restrictions, sitemap/image, and security headers at the edge. Consider CSP/HSTS only with compatible deployment testing.
7. Obtain owner confirmation for existing public marketing claims, contact/social destinations, team publication IDs, and any externally hosted image rights/availability. Existing unverified claims were not promoted into structured ratings.
8. Monitor real-user LCP/CLS/INP and errors after an approved deployment. Local single-run timings, mocked providers, and headless Chrome do not establish field performance, all browsers, or screen-reader conformance.

No further schema, historical-data cleanup, subscription, blog, or infrastructure implementation is included or authorized. Phase 2 stops after this report and verification.

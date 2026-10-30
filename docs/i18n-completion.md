# DreamService V1.0 internationalization delivery

## Status

**Partially complete: the safe, independent code implementation is delivered; production readiness remains blocked.** Active V1 routes and their shared UI have English/Persian catalogs, locale-aware navigation, direction handling, localized validation and safe error display. Catalog checks, focused regression tests, mocked production browser flows, TypeScript and the production build pass. Real database translation completeness, real SMS/session flows, approved product content and existing authorization defects still need resolution.

No dependencies were installed. No environment files, Prisma schemas/migrations or database records were changed. No commits, pushes or Git history changes were made. Existing Phase 1 catalog fixes were preserved. Admin/dashboard and blog/CMS implementation remains outside scope.

## Final stabilization pass (2026-10-12)

This pass modifies eight files beyond the existing implementation:

- `src/components/templates/launch-countdown/LaunchCountdown.tsx`: explicitly pass `showDivider={false}`, preserving existing separate separators.
- `src/components/templates/launch-countdown/TimeUnitBox.tsx`: explicit number/string/boolean props.
- `src/features/order/submit-forn/orders-table.tsx`: remove unsupported search props, which had no implemented behavior; use the shared localized empty-state default.
- `src/lib/dictionary.ts`: add a local structural package type, preserving data/copy.
- `src/components/templates/callToAction/CallToAction.tsx`: contain animated decorative glow that caused mobile horizontal overflow in the production browser check.
- `src/app/api/order/submit-order/route.ts`: omit absent optional formKey from metadata; JSON-only validation otherwise rejected legacy flat submissions because of an undefined value.
- `scripts/i18n.test.mjs`: regression test for flat and wrapped submissions using an in-memory Prisma stub.
- `docs/i18n-completion.md`: final results and review evidence.

### API safety review

Reviewed the complete Git diff against HEAD for all six authentication handlers and all three order handlers, plus the unchanged session/helper code. No localization change weakens the existing checks: OTP expiry remains two minutes, resend cooldown 60 seconds, verification limit five attempts, failed attempts still increment, and consumption still uses updateMany with unconsumed/unexpired predicates before session issuance. Role switching derives roles from the server user. Logout invalidation, session expiry and HttpOnly/production-Secure/SameSite cookie settings are unchanged.

Stable error codes are additive; clients map errors to localized messages rather than displaying raw exceptions. Normalization failures return safe specific errors; unexpected failures are generic. JSON metadata validation remains strict, with compatibility restored for absent optional formKey. Configuration requests validate locale and mandatory translations before returning validated data. Session helpers and OTP hashing/generation are unchanged. Existing ownership, registration-proof and server response exposure defects remain separate blockers below. This is source review, not a penetration test or live SMS/session verification.

### Middleware review

Installed Next.js 16.2.4 discovery uses the parent of src/app (src) as its middleware convention directory. src/middleware.ts imports the root implementation; the root file is a dependency rather than a second discovered entry. The generated middleware manifest has exactly one entry (/) and one matcher. Source matchers agree and regression checks cover their parity. No duplicate execution or redirect loop was observed.

Read-only production HTTP checks pass: / with Persian Accept-Language redirects 307 to /fa; /about with English redirects 307 to /en/about; explicit /en/about and /fa/about return 200 despite opposite Accept-Language; /de/about negotiates to /fa/de/about. The public PDF returns 200; unsupported-locale configuration API requests return 400 before a database query; missing _next/_vercel assets return 404 without locale redirects. The middleware-to-proxy deprecation warning remains.

All required checks were rerun. The production browser check initially failed on animated CTA overflow; after containment it passes in both locales at desktop/mobile sizes. The final build passes after the API compatibility correction. All browser API traffic is mocked; no actual auth/order writes were performed. The owned test server was stopped afterward.

## Major changes

- Shared next-intl routing validates `en`/`fa`, retains explicit prefixes, and excludes APIs and public assets. Locale layouts set matching `lang` and `dir`; request configuration uses the installed next-intl request-locale API.
- Added `src/middleware.ts` as a thin adapter to the existing root middleware: local HTTP testing showed that the root file alone was not being applied with this repository's `src/app` structure. Both middleware entry points share identical matcher behavior.
- Internal navigation uses next-intl's navigation helpers. Switching language preserves the equivalent pathname, query and fragment. Removed the nonexistent FAQ destination; unavailable team-profile and placeholder social destinations are disabled.
- Localized Navbar/mobile menu, Hero, About/Values/Team fallbacks, packages/search, projects/carousel announcements, CTAs, countdown/signup feedback, footer, theme toggle, authentication, dynamic forms, order review, tables and shared dialog/sheet/select/dropdown controls.
- Localized metadata for existing public/order pages, error/loading/not-found views, accessible names, toast labels, sortable-column announcements, pagination, counts, percentages and pluralized totals. Canonical/alternate paths remain relative; deployment-origin behavior needs staging verification.
- Replaced physical direction-sensitive spacing/positioning with logical utilities where needed. Library controls receive locale direction; phone/email/numeric inputs and technical identifiers retain intentional LTR isolation. Mobile sheet placement, arrows, progress fill and carousel direction follow the locale.
- Authentication normalizes Persian/Arabic input digits, preserves existing Iranian phone/OTP rules, and maps stable API error codes to localized messages. Retry seconds and remaining attempts are interpolated safely. Raw exception sentences are not displayed. Sensitive OTP/contact/provider logs were removed; session, OTP expiry/consumption, retry limits and cookie policies were not relaxed.
- Dynamic forms still originate from Prisma. Corrected response contracts (`key`, settings, descriptions/default values), validate configuration at the boundary, cache by locale, localize all existing field constraints, resolve visibility from current values and persist edits during language switches. Field keys, IDs, option values and submitted payloads remain stable.
- Missing mandatory database titles/labels/options produce a safe localized unavailable state rather than displaying internal values. Optional missing descriptions/placeholders remain empty or use interface fallbacks. No database content was populated.
- Order review resolves service/budget labels from localized configuration, maps status codes, translates filters/actions/totals and offers a read-only details dialog using existing fetched data. Unknown historical values display a localized unknown label.
- Repaired existing shared-table consumer contracts necessary for this flow: filter rendering, toolbar controls, pagination updater/row totals, column ordering and accessible column names. No admin features were added.

## Coverage and intentional exceptions

Both catalogs contain **384 message leaves**, with recursive path/value-type parity and matching ICU argument/rich-tag signatures. Verification discovers **251 static translation calls** and checks **18 dynamic calls** through finite contracts or explicit guards. Finite sets include About values, packages, project content, CTA features, role/status labels, density and metadata.

Intentional neutral content includes DreamService, technology names, stable identifiers and user-provided names/descriptions. Server compatibility fields still contain legacy sentences; active consumers display localized code mappings instead. Unused legacy templates/dictionaries received only the minimal type/consumer fixes above; their legacy content was not rewritten.

Product content has not been independently verified: existing customer/rating/support claims, portfolio descriptions, example contact details and the footer's personal branding/location remain approval items. The previously unusable eighth package label now uses neutral “Package {number}”; an approved offering name is still needed. No new contact information, biographies or business claims were invented.

## Verification performed

| Check | Actual result |
| --- | --- |
| `node scripts/check-i18n.mjs` | PASS: JSON parsing, duplicate-key detection, recursive parity/types, ICU syntax/placeholders, 251 static and 18 finite/guarded dynamic consumer contracts |
| `node --test scripts/i18n.test.mjs` | PASS: 11 tests; flat/wrapped order submission compatibility, localized error safety, digits, every existing dynamic field type/constraint, visibility, configuration contracts, actual API transformation with stub Prisma, routing and formatting/metadata |
| `node scripts/browser-i18n-smoke.mjs` | PASS against local production server: desktop 1280px/mobile 390px, en/fa, locale links, query/hash switching, refresh/history, mocked OTP/registration/rate-limit/network failures, dynamic form validation/value preservation/stable submission, review/details, sheets, 404/unavailable states |
| Browser runtime checks | No detected runtime exceptions, missing-message/ICU errors or hydration errors in tested flows; screenshots reviewed for representative en/fa responsive layouts |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS (exit 0): no diagnostics; original baseline contained 45 diagnostics |
| `npm run lint` | PASS (exit 0): 0 errors, 5 pre-existing warnings; baseline was 19 errors and 24 warnings |
| `npm run build` | PASS (exit 0): compilation, type checking, page generation and optimization complete on Next.js 16.2.4 |
| `git diff --check` | PASS after removing trailing whitespace only on reported changed lines |
| Git diff review | Reviewed changes and fixed introduced contract/typing/layout defects; no schema, dependency or environment edits |

Browser API traffic was intercepted with synthetic fixtures for **all `/api/` requests**, including auth/order writes. Unit tests stub Prisma in memory. These checks do not prove live database, SMS, cookie-session or ownership behavior. No real auth/order writes were performed.

Additional read-only local HTTP checks verified localized page rendering and metadata, API invalid-locale rejection before database access, public PDF access, and locale negotiation. With Persian Accept-Language, `/` redirects to `/fa` and `/about` to `/fa/about`. Unsupported locale-looking paths become unknown routes beneath a supported negotiated locale. Tested unknown routes render localized not-found content with `noindex`; streamed Next responses returned HTTP 200, so hosting/indexing behavior must be checked before release.

Latest browser screenshots are outside the repository at:
`<user-temporary-directory>/dreamservice-i18n-iex9TX`.

### Legacy compiler diagnostics resolved

All six diagnostics are resolved by the minimal changes described in the stabilization section. No compiler or ESLint rules were weakened or suppressed.

The stale generated `.next/types` baseline reference to a removed users route disappeared when Next regenerated its types; generated files were not manually edited.

Remaining lint warnings: TanStack Table/RHF compiler compatibility notices in the active table/form; the existing `<img>` in inactive `about/plusCard.tsx`; unused `PulseDots` in inactive countdown; missing effect dependency in `useRandomAutoplay.ts`. Next 16 also warns that middleware is deprecated in favor of proxy; this implementation preserves the existing architecture. The development browser console additionally reports an existing logo image aspect-ratio sizing warning; the runtime assertions do not treat image optimization warnings as localization errors.

### Regressions found and resolved during implementation

- Corrected accidental option-value replacement; a regression test exercises the actual API transformation in both languages and asserts unchanged machine values.
- Corrected Zod input typing, empty database visibility defaults and installed-Zod record signatures.
- Corrected Swiper typing/unsupported event usage and motion-button JSX mismatch.
- Local browser tests exposed clipped mobile Hero/contact content; responsive adjustments now pass the viewport/bounds checks.
- Fixed middleware placement after live HTTP negotiation showed that the initial root-only configuration was ineffective.
- Adjusted keyboard tests to use real Radix activation semantics; dropdown/details keyboard interaction now passes.

## Remaining i18n/product gates

**P1 — live translations:** No live database translation inventory was read. Published form title, each step title, each field label and every option label must exist for both locales. Missing mandatory content deliberately blocks that form with a localized error. Optional localized JSON descriptions/placeholders and historical order options require content review.

**P1 — real critical flows:** Browser auth/order success and failure states were verified with fixtures, not live SMS or database-backed sessions. The existing development SMS bypass remains unchanged; OTPs are no longer printed. An approved safe staging delivery mechanism is needed to test real OTPs.

**P1 — launch/signup:** Existing launch timestamp is `2025-06-15T00:00:00`, already past and without an explicit business timezone. Confirm the intended date/timezone or retire the section. There is no newsletter/signup backend; the UI now reports localized unavailability instead of fake success. Product/backend approval is needed to provide actual signup.

**P1 — approved content/destinations:** Confirm package 8 name, contact email/phone, footer identity/location, existing statistics and portfolio content. Provide real social and team-profile destinations if desired; FAQ remains absent. These were not invented or implemented.

**P2 — formatting/SEO policy:** Confirm business timezone, calendar and budget/currency denomination before adding displays that require these choices. Existing budget option labels retain database meaning; no arbitrary rial/toman conversion or Persian calendar rule was introduced. Verify production canonical origin, alternate-language URLs, locale cookies and streamed 404 behavior.

## Separate existing release/security blockers

These are source-confirmed trust gaps, not exploitation tests, and were not silently changed as part of localization.

- **P0:** `src/app/api/order/submit-order/route.ts:27` accepts a client identity from payload or a test-user fallback; creation occurs at line 42. Orders need a trusted-session identity and server ownership enforcement before production.
- **P0:** `src/app/api/order/load-orders/route.ts:72` builds filtering from request parameters and reads customer orders without a trusted-session ownership check. Client-side filters do not provide authorization.
- **P0:** `src/app/api/auth/register/route.ts:46` searches consumed OTPs by phone and uses recent consumption at lines 55–60 as proof, without binding that proof to the requesting browser/session. Registration/session issuance needs security review.
- **P1:** Submission validates its basic order shape but does not enforce the complete database-defined dynamic field constraints on the server. Client validation is not an integrity boundary.
- **Build blocker resolved:** All six legacy diagnostics are fixed; the production build passes. No type/lint configuration was weakened.

## Exact checks still required before production

1. On an approved staging environment, use read-only GETs to `/api/order/order-form-config?locale=en` and `?locale=fa`. Require HTTP 200 for the published form; compare identical form/step/field keys and ordering, option values, constraints/defaults/visibility, and verify each localized title/label/description/placeholder. Use an approved content inventory to cover every published configuration, not just the selected endpoint record. Do not expose customer or secret data in the report.
2. Have approved content owners supply missing translation records/localized JSON separately. Database writes require explicit approval; rerun both configuration GETs after authorized updates.
3. Resolve authorization/registration-proof defects before enabling customer flows. Then test authenticated customer isolation, unauthenticated rejection and cross-customer access denial in staging using approved synthetic accounts.
4. With approved staging write permission and a safe OTP delivery channel, test real login/registration, invalid/expired/consumed OTPs, remaining attempts, rate limits, resend, logout, session expiry and secure cookies in both locales. Check language changes during each auth step.
5. Submit a synthetic order only after authorization fixes and explicit staging write approval. Verify DB-driven conditional validation, defaults, optional fields, back/next, language-switch draft preservation and unchanged IDs/values; review only that customer's order.
6. Review every active page in en/fa at mobile/desktop sizes, light/dark themes and long translated content. Check carousel controls, dialogs/selects/tables, mixed-direction names/contact/URLs, focus order, keyboard reorder/menus, screen-reader labels and toast announcements. Automated coverage is representative, not a full accessibility certification.
7. Approve factual marketing/contact/package content, launch date/timezone, signup behavior, calendar/currency policy and any currently unavailable destinations.
8. Keep catalog checks, regression tests, lint, TypeScript and production build passing in staging/CI. The mocked browser smoke passes against the local production server; real staging flows remain required.
9. On the deployed staging host, verify en/fa canonical/alternates, direct URLs, redirects, public assets/API exclusion, language cookie negotiation, refresh/back/forward and localized not-found `noindex`/HTTP status behavior.

## Modified and new files


### Infrastructure, catalogs, route pages and metadata

- `i18n/request.ts`
- `messages/en.json`
- `messages/fa.json`
- `middleware.ts`
- `src/app/[locale]/about/page.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/order/order-form/page.tsx`
- `src/app/[locale]/order/page.tsx`
- `src/app/[locale]/order/review-orders/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/page.tsx`
- `src/providers/QueryProvider.tsx`
- `i18n/routing.ts`
- `src/app/[locale]/[...rest]/page.tsx`
- `src/app/[locale]/error.tsx`
- `src/app/[locale]/loading.tsx`
- `src/app/[locale]/not-found.tsx`
- `src/lib/i18n/digits.ts`
- `src/lib/i18n/metadata.ts`
- `src/lib/i18n/navigation.ts`
- `src/middleware.ts`

### Marketing, navigation and shared controls

- `src/components/modules/dream-form/ContactCard.tsx`
- `src/components/modules/dream-form/dream-form.tsx`
- `src/components/modules/footer/footer.tsx`
- `src/components/modules/navbar/AuthButton.tsx`
- `src/components/modules/navbar/LanguageToggleButton.tsx`
- `src/components/modules/navbar/Logo.tsx`
- `src/components/modules/navbar/MobileMenu.tsx`
- `src/components/modules/navbar/NavDropdown.tsx`
- `src/components/modules/navbar/NavLink.tsx`
- `src/components/modules/navbar/Navbar.tsx`
- `src/components/modules/navbar/ThemeToggle.tsx`
- `src/components/modules/navbar/useNavItems.ts`
- `src/components/templates/Hero.tsx`
- `src/components/templates/LaunchCountdown.tsx`
- `src/components/templates/Packages.tsx`
- `src/components/templates/about/AboutValues.tsx`
- `src/components/templates/about/TeamCard.tsx`
- `src/components/templates/callToAction/CallToAction.tsx`
- `src/components/templates/callToAction/FeatureCard.tsx`
- `src/components/templates/callToAction/features.tsx`
- `src/components/templates/sampleProjects/SampleProjects.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/sheet.tsx`

### Authentication and API error handling

- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/send-otp/route.ts`
- `src/app/api/auth/switch-role/route.ts`
- `src/app/api/auth/verify/route.ts`
- `src/components/modules/auth/AuthModal.tsx`
- `src/hooks/useAuth.ts`
- `src/lib/auth/authClient.ts`
- `src/lib/auth/sms.ts`
- `src/lib/api/errors.ts`

### Database-driven forms, order review and tables

- `src/app/api/order/load-orders/route.ts`
- `src/app/api/order/order-form-config/route.ts`
- `src/app/api/order/submit-order/route.ts`
- `src/components/modules/data-table/data-table-column-header.tsx`
- `src/components/modules/data-table/data-table-column-menu.tsx`
- `src/components/modules/data-table/data-table-density.tsx`
- `src/components/modules/data-table/data-table-export.tsx`
- `src/components/modules/data-table/data-table-filter-bar.tsx`
- `src/components/modules/data-table/data-table-filter-form.tsx`
- `src/components/modules/data-table/data-table-filter.tsx`
- `src/components/modules/data-table/data-table-header.tsx`
- `src/components/modules/data-table/data-table-pagination.tsx`
- `src/components/modules/data-table/data-table-row-actions.tsx`
- `src/components/modules/data-table/data-table-toolbar.tsx`
- `src/components/modules/data-table/data-table-types.ts`
- `src/components/modules/data-table/data-table-utils.ts`
- `src/components/modules/data-table/data-table-view-options.tsx`
- `src/components/modules/data-table/data-table.tsx`
- `src/components/modules/data-table/draggable-column.tsx`
- `src/components/modules/data-table/index.ts`
- `src/components/modules/data-table/sortable-column-item.tsx`
- `src/features/order/review-orders/components/order-status-badge.tsx`
- `src/features/order/review-orders/components/review-orders-columns.tsx`
- `src/features/order/review-orders/components/review-orders-view.tsx`
- `src/features/order/review-orders/config/review-orders-filters.ts`
- `src/features/order/review-orders/hooks/use-review-orders-state.ts`
- `src/features/order/review-orders/hooks/use-review-orders.ts`
- `src/features/order/review-orders/types/index.ts`
- `src/features/order/submit-forn/FieldRenderer.tsx`
- `src/features/order/submit-forn/OrderForm.tsx`
- `src/features/order/submit-forn/StepRenderer.tsx`
- `src/hooks/useOrderForm.ts`
- `src/schemas/orderSchema.ts`
- `src/types/order.ts`
- `src/schemas/orderFormConfig.ts`

### Regression checks and delivery report

- `scripts/browser-i18n-smoke.mjs`
- `scripts/check-i18n.mjs`
- `scripts/i18n.test.mjs`

- `docs/i18n-completion.md` (this report)



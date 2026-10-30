# DreamService V1.0 release audit

Audit date: **2026-10-30, Asia/Tehran**. Repository: `D:\code\dreamservice`.

## Release assessment

**Do not approve release yet.** One confirmed HIGH security defect allows an already authorized order mutation to complete after the caller is banned or demoted. Other confirmed issues affect ticket pagination, registration error handling, access to customer orders, homepage administration, abuse protection, and accessibility.

| Confirmed severity | Count |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 6 |
| LOW | 3 |
| **Total** | **10** |

The current public homepage is working against the real local database. Its original portfolio slider and its separate upcoming-project card are independent. Neither section needs to be merged or redesigned.

This is an audit, not a security certification. Findings established with source inspection or in-memory probes are identified as such. Authenticated browser workflows, PostgreSQL concurrency trials, production deployment configuration, and a fresh production build remain verification gates, not proven application failures.

## Scope, method, and safety

- Inspected the App Router pages/layouts, API handlers, auth/session helpers, shared authorization, order validation/workflow, user/project administration, ticket services, client data caches, translations, public components, Prisma schema, and all six migrations.
- Inspected the existing dirty working tree without restoring or discarding it. Recorded SHA-256 hashes for **303 existing tracked and non-ignored untracked files**; all matched after the investigation. This snapshot does not include ignored environment files or generated build/browser caches.
- Used the existing local development server at `http://localhost:3000`. Did not start, stop, or reconfigure the application server.
- Used installed headless Chrome and temporary browser profiles outside the repository. Browser actions were navigation, carousel controls, theme switching, focus/hover, and opening the sign-in dialog. No OTP, registration, logout, order, project, user-management, or ticket mutation was submitted to the live application.
- The expiry browser check changed `Date.now` only inside the disposable browser page. It did not change the operating-system clock, server clock, project deadline, or database.
- Read existing database connection configuration solely to connect to the already configured **loopback PostgreSQL database `dreamservice`**. No credentials or connection strings are reproduced here. Database inspection used SELECT operations only.
- No resets, migrations, seeds, INSERT/UPDATE/DELETE/ALTER operations, real messages, dependency installations, commits, pushes, or deployments were performed. No application source, configuration, environment file, historical migration, or existing document was edited. The sole authored repository file is this report.
- Existing historical implementation reports were used for context, not as substitutes for checks executed during this audit.

## Confirmed defects

### DSV1-001 — HIGH — Order mutations do not serialize with permission revocation

**Feature:** Admin order decisions and banned-user restrictions.

**Locations:** `src/lib/order/workflow.ts:26`, `src/lib/order/workflow.ts:32`, `src/app/api/order/submit-order/route.ts:10`, `src/app/api/order/submit-order/route.ts:24`, `src/app/api/order/notifications/[historyId]/retry/route.ts:9`; compare the management lock/recheck at `src/lib/admin/users.ts:70` and ticket reauthorization at `src/lib/support/service.ts:35`.

**Evidence:** `changeOrderStatus` calls `requireAdmin` before awaiting input processing, then updates the order/history in a transaction that never rechecks the actor's current ban/role and never acquires the management advisory lock. User management can therefore commit a ban/demotion between the initial authorization and the decision write. Order submission similarly checks authentication before validation and performs its create later without a ban recheck. The notification-retry route also authorizes only before delivery processing.

An inline, in-memory probe executed the actual `changeOrderStatus` implementation, revoked the simulated admin immediately after its initial authorization, and recorded `currentAdminAllowed: false` at `order.updateMany`. The function still returned `success: true`. No PostgreSQL write or SMS delivery occurred in this probe. This proves the missing recheck in the implementation; a real two-connection race was not run.

**Reproduction:** In a disposable database, pause an authenticated status request after `requireAdmin`; have another admin demote or ban its actor and commit; resume the first request. The current code can commit its order decision using the earlier principal. For a banned customer, pause submission during form validation and resume after the ban commits.

**Impact:** Revocation protects subsequent requests but does not reliably stop these in-flight writes. An order decision may also trigger notification processing after authority has been revoked. This is a release blocker.

**Recommended fix:** Reuse the existing management serialization contract and recheck the actor inside the transaction before the order mutation. Apply an explicit revocation policy to submission and retry processing too. Preserve atomic decision/history creation, ownership enforcement, and delivery deduplication. Verify the interleavings against disposable PostgreSQL with provider calls mocked.

**Estimated scope:** **medium**.

### DSV1-002 — MEDIUM — Order submission has no application rate limit

**Feature:** Order submission / abuse protection.

**Locations:** `src/app/api/order/submit-order/route.ts:8`, `src/app/api/order/submit-order/route.ts:24`; existing limiter: `src/lib/security/rate-limit.ts:17`.

**Evidence:** Submission validates authentication, origin, payload, and an idempotency key, but never invokes the existing rate limiter. An in-memory probe invoked the actual route 40 times with distinct valid keys: all **40 returned HTTP 201**, with 40 simulated creates. The input/database dependencies were substitutes; this was not a live load test and created no real orders.

**Reproduction:** From a disposable authenticated customer session, repeat a valid payload with fresh idempotency keys. Same-key replay protection does not limit distinct submissions.

**Impact:** One verified account can generate unbounded orders and validation/database work at request-processing speed. Infrastructure-level throttling was not inspected and must not be presumed to cover the gap.

**Recommended fix:** Add a bounded account-based submission budget through the existing shared limiter, with a safe localized error and `Retry-After`. Decide how retries of an already committed idempotent request should affect that budget.

**Estimated scope:** **small**.

### DSV1-003 — MEDIUM — Selecting 100 tickets per page breaks both ticket lists

**Feature:** Customer support and admin ticket management.

**Locations:** `src/components/modules/data-table/data-table-pagination.tsx:29`, `src/components/modules/support/support-view.tsx:50`, `src/components/modules/support/support-view.tsx:67`, `src/schemas/support.ts:16`, `src/components/modules/data-table/data-table.tsx:205`.

**Evidence:** The shared pagination UI offers `[10, 20, 30, 50, 100]`. Ticket lists pass that selected size directly to the API, whose schema accepts at most 50. An in-memory execution of the real schema accepted 10/20/30/50 and rejected 100. `parameters` converts that rejection into HTTP **422 / `INVALID_INPUT`**. The DataTable also hides pagination when displaying an error, so the invalid size cannot be changed back through the footer after the failure.

**Reproduction:** Sign in to `/en/support` or `/en/admin/tickets` (also applies to Persian), then choose 100 rows per page. `/api/support/tickets?...&limit=100` or `/api/admin/tickets?...&limit=100` rejects the request. A reload resets the current local pagination state. This exact live authenticated request was not issued during this read-only audit.

**Impact:** A visible standard control replaces a valid list with an error and removes its recovery control.

**Recommended fix:** Make page-size options configurable and restrict ticket tables to supported sizes, or deliberately align the server bound and UI. Keep a usable way to recover pagination from request errors.

**Estimated scope:** **small**.

### DSV1-004 — MEDIUM — Project administration promises a homepage selection that is ignored

**Feature:** Admin projects / automatic upcoming-project countdown.

**Locations:** `src/components/modules/admin/projects-view.tsx:88`, `src/components/modules/admin/projects-view.tsx:124`, `src/components/modules/admin/projects-view.tsx:129`, `messages/en.json:734`, `messages/fa.json:734`; actual selection: `src/lib/projects/homepage.ts:8`.

**Evidence:** The UI says “Select for homepage countdown,” reports the persisted flag as the homepage selection, and says saving replaces the displayed selection. The actual public query correctly ignores `showOnHomepage`: it selects public PLANNED/ACTIVE projects with future deadlines, ordered by deadline and then ID. The administration service still switches the legacy flag between projects, but that operation does not select the public card.

**Reproduction:** In a disposable database, create two eligible public projects with different future deadlines; check the later one in the admin UI. The homepage still displays the earlier one. Clearing the earlier project's checkbox also does not exclude it. This contradiction is confirmed by both implementations and message catalogs; no original projects were edited to demonstrate it.

**Impact:** Admins receive incorrect confirmation of which content is public and may expect a checkbox to remove or replace a displayed project.

**Recommended fix:** Explain automatic eligibility/nearest-deadline selection in both locales. Remove or clearly distinguish the obsolete selection control and presentation. Preserve the database field, historical migrations, and automatic selection rule.

**Estimated scope:** **small**.

### DSV1-005 — MEDIUM — Returning customers have no global link to their order dashboard

**Feature:** Customer dashboard / order tracking navigation.

**Locations:** `src/components/modules/navbar/AuthButton.tsx:113`, `src/components/modules/navbar/AuthButton.tsx:129`, `src/components/modules/navbar/useNavItems.ts:7`, `src/components/templates/Hero.tsx:53`; dashboard: `src/app/[locale]/order/page.tsx:14`.

**Evidence:** The account menu's only order-list link is restricted to admins and points to `/order/review-orders`. A CUSTOMER gets support and logout but no `/order` link. The global navigation has no customer orders entry, and homepage order buttons lead to the new-order form. The implemented customer dashboard exists at `/[locale]/order`; receipt/detail links can reach it, but the normal global navigation does not provide a returning customer an entry point.

**Reproduction:** As a CUSTOMER, return to the homepage and open the account menu. There is no My Orders/dashboard action. Manually navigate to `/en/order` to reach the existing dashboard. This is a source-confirmed navigation omission, not a claim that authenticated dashboard loading failed in the browser.

**Impact:** Customers can lose the discoverable route to tracking previously placed orders after leaving their receipt/detail flow.

**Recommended fix:** Add a localized customer-orders link to the existing account/navigation pattern, pointing to `/order`, while retaining separate server-protected admin links.

**Estimated scope:** **small**.

### DSV1-006 — MEDIUM — An already used registration email becomes a generic HTTP 500

**Feature:** Registration / input and conflict handling.

**Locations:** `prisma/schema.prisma:18`, `src/app/api/auth/register/route.ts:31`, `src/app/api/auth/register/route.ts:38`, `src/lib/security/http.ts:39`.

**Evidence:** `User.email` is unique. Registration normalizes and inserts the supplied optional email but does not handle a Prisma `P2002` email conflict. The common handler treats it as an unexpected failure. An inline probe executed the actual registration route with an in-memory transaction throwing `P2002` for the email constraint; the response was **HTTP 500**, `{success:false, code:"REGISTER_FAILED"}`. No user, grant, or session was changed in PostgreSQL.

**Reproduction:** In a disposable database, verify a new phone, then register using an email already stored on another account. The transaction rolls back, but the user receives only a generic server error rather than actionable input/conflict feedback.

**Impact:** A normal registration conflict looks like an outage and prevents completion until the user independently discovers that omitting/changing the email works. The transaction protects against a partial account creation.

**Recommended fix:** Map the known unique conflict to a safe, localized input/conflict response without exposing another account's information. Keep proof consumption, account creation, and session insertion atomic, including race handling.

**Estimated scope:** **small**.

### DSV1-007 — MEDIUM — Portfolio autoplay has no pause control and continues during keyboard focus

**Feature:** Portfolio accessibility.

**Locations:** `src/hooks/useRandomAutoplay.ts:7`, `src/hooks/useRandomAutoplay.ts:14`, `src/components/templates/sampleProjects/SampleProjects.tsx:35`.

**Evidence:** A recursive timer advances the slider every 1–2 seconds indefinitely. Reduced-motion preference stops it, but there is no pause/resume control or focus/hover suspension. In actual Chrome with normal motion preference, the next-arrow control retained focus while the real slide index advanced **0 → 3 over 4.5 seconds**. The section had no pause control. Its manual arrows and dots otherwise work.

**Reproduction:** Open the homepage with normal motion preference, focus a portfolio navigation control, and wait while trying to read a card. Content keeps changing without an in-page way to stop it.

**Impact:** Keyboard users and people who need more reading time cannot maintain a stable card unless they change their system preference. Preserving the intended carousel does not require retaining this limitation.

**Recommended fix:** Add a localized accessible pause/resume action and suspend autoplay while focus is within the carousel; consider hover suspension too. Retain original cards, arrows, dots, responsive presentation, and reduced-motion handling.

**Estimated scope:** **small**.

### DSV1-008 — LOW — Main landmarks are missing on home and nested on the anonymous orders page

**Feature:** Document structure / assistive navigation.

**Locations:** `src/app/[locale]/page.tsx:15`, `src/app/[locale]/order/page.tsx:19`, `src/app/[locale]/order/page.tsx:27`, `src/components/modules/auth/AccessRequired.tsx:11`.

**Evidence:** Both rendered homepages contain **zero `<main>` elements**. Anonymous `/en/order` and `/fa/order` place the `<main>` returned by `AccessRequired` inside the page's own `<main>`; actual browser inspection counted **two**, including while the sign-in dialog was open.

**Reproduction:** Inspect landmarks on `/en`, `/fa`, and anonymous `/en/order`. Equivalent source structure applies to Persian orders.

**Impact:** Main-content landmark navigation is absent or ambiguous.

**Recommended fix:** Give each rendered page one main landmark and make the embedded access-required presentation usable without nesting a second main.

**Estimated scope:** **small**.

### DSV1-009 — LOW — A placeholder package is published as a selectable service

**Feature:** Homepage package content.

**Locations:** `src/components/templates/Packages.tsx:12`, `src/components/templates/Packages.tsx:65`, `messages/en.json:91`, `messages/fa.json:91`.

**Evidence:** The live package array explicitly includes `placeholder`. Its English content is “Package 8” / “Frontend testing”; Persian is the equivalent placeholder. It renders a selectable button leading to the real order form, alongside the named service offerings. The description is also included in package search matching.

**Reproduction:** Open the Packages section or search for its testing description in either locale.

**Impact:** Unfinished catalog content is exposed as a normal offering. This finding does not treat the separate, intentionally static portfolio examples as fake Project records.

**Recommended fix:** Obtain the intended offering/content, or remove this placeholder entry from the published list, with en/fa parity. Do not redesign the homepage.

**Estimated scope:** **small**.

### DSV1-010 — LOW — Portfolio card hover ignores reduced-motion preference

**Feature:** Portfolio reduced-motion support.

**Locations:** `src/components/templates/sampleProjects/ProjectCard.tsx:19`; CSS-only reduction: `src/styles/globals.css:132` (the `prefers-reduced-motion` rule).

**Evidence:** The Framer Motion hover applies `y: -10` without a reduced-motion guard or a transform override. In actual Chrome with `prefers-reduced-motion: reduce`, the active card's computed transform changed from `none` to `matrix(1, 0, 0, 1, 0, -10)` on hover. The global CSS duration reduction does not suppress that JavaScript-driven transform.

**Reproduction:** Enable reduced motion, open the homepage, and hover the active portfolio card.

**Impact:** One interaction still moves content despite the user's requested motion reduction. Autoplay's separate reduced-motion behavior is working.

**Recommended fix:** Respect the preference for this hover transform using the existing motion/CSS patterns. Review the similarly unguarded About hero entrance at `src/components/templates/about/AboutHero.tsx:14`; that entrance was source-inspected but was not separately measured during its first animation frame.

**Estimated scope:** **small**.

## Risks and verification gates — excluded from confirmed-defect totals

### RISK-001 — HIGH — Authenticated end-to-end and production-build evidence is incomplete for this audit

**Feature / locations:** Customer/admin flows across `src/app/[locale]/order/page.tsx:14`, `src/components/modules/admin/projects-view.tsx:33`, `src/components/modules/admin/users-view.tsx:24`, `src/lib/support/service.ts:77`; build configuration: `package.json:8`, `scripts/build-offline.mjs:4`.

**Evidence:** The disposable browser had no authenticated session. No real OTP/login or mutation was initiated, and no existing session token was extracted from the database. Existing unit tests passed, but they use in-memory database substitutes. Existing integration scripts were deliberately not run against the original database. A fresh production build was not run: it writes `.next`, can regenerate Next TypeScript files, and an isolated source copy would create additional repository/source artifacts beyond this task's single-file restriction. Previous build/integration claims in historical documents are not counted as fresh passes.

**Verification / impact:** Successful real admin/customer create-edit-reply workflows, PostgreSQL locking behavior, and current production compilation are not established by this audit. These are release verification gates, not observed failures. After fixes are approved, run a fresh isolated production build and authenticated browser/integration flows against a disposable restored database with delivery blocked or mocked.

**Recommended action / scope:** Authorized isolated validation, **medium**. Do not bypass authentication or write fixtures into the original database to satisfy this gate.

### RISK-002 — HIGH — Production identity, delivery, and proxy configuration has not been verified

**Feature / locations:** `src/lib/security/http.ts:53`, `src/lib/security/crypto.ts:11`, `src/lib/security/rate-limit.ts:12`, `src/lib/auth/sms.ts:12`, `src/lib/auth/session.ts:12`; documented requirements: `docs/security-implementation.md:382`.

**Evidence:** Production mutations fail closed without the exact configured origin. OTP/rate-limit protection requires a stable key of at least 32 bytes. Console OTP delivery is deliberately rejected outside development; real delivery additionally requires approved provider settings and enablement. Missing/unusable trusted proxy IP configuration puts callers into the shared `unknown` source budget, currently 30 send requests/hour. These are confirmed implementation contracts, not evidence that production is misconfigured.

**Verification / impact:** Check the intended deployment's secret presence, exact HTTPS origin, Secure/HttpOnly/SameSite cookie behavior, proxy overwrite/spoof resistance, and provider contract in an approved staging process. Otherwise login/registration could fail or share an unexpectedly restrictive global source budget. No production connection or real SMS/email test was performed.

**Recommended action / scope:** Deployment verification without printing secrets, **medium**. Preserve fail-closed behavior. Real provider delivery requires separate explicit approval.

### RISK-003 — MEDIUM — Expired security rows have no repository-managed cleanup path

**Feature / locations:** `src/lib/security/rate-limit.ts:24`, `src/lib/auth/otp.ts:52`, `src/lib/auth/otp.ts:104`, `src/lib/auth/session.ts:44`; indexes in `prisma/schema.prisma:94` and `prisma/schema.prisma:104`.

**Evidence:** The local SELECT counted **21 expired rate-limit buckets**. Request handling creates new window-specific keys; the inspected application has no expiry cleanup job. Session/OTP/grant validity checks correctly reject expired records. An external operator-managed cleanup schedule was not inspected.

**Verification / impact:** Determine whether approved retention/cleanup exists outside the repository. Without it, storage and retained identity-related records can grow indefinitely; no current query outage or bypass was demonstrated.

**Recommended action / scope:** Define retention and a separately approved bounded maintenance process, **small**. Do not delete rows as part of this audit or silently introduce retention rules.

### RISK-004 — MEDIUM — Nonunique order sorting lacks a deterministic tie breaker

**Feature / location:** `src/app/api/order/load-orders/route.ts:75`.

**Evidence:** Paginated order reads sort by only the requested column. Supported sort keys include `status`, `type`, and `page_count`, which are not unique. The local data contains many equal statuses. Other new lists consistently include an ID tie breaker.

**Verification / impact:** Verify adjacent pages in a disposable larger dataset, especially during concurrent changes. SQL does not guarantee a stable order within ties, so repeated or skipped rows are possible. No duplicate page was observed in a real authenticated browser in this audit.

**Recommended action / scope:** Append a deterministic order ID tie breaker where needed and test adjacent pages, **small**. This is separate from the stronger consistency limitations of offset pagination during inserts.

## Known intentional limitations and optional improvements

These items are **not counted as confirmed bugs**:

| ID | Classification / feature | Evidence and locations | Impact / recommended decision | Scope |
| --- | --- | --- | --- | --- |
| DECISION-001 | Intentionally unavailable launch notifications | `src/components/templates/launch-countdown/ProjectCountdown.tsx:40`; both catalogs' `LaunchCountdown.subscriptionLimitation` explicitly state that subscriptions are not saved and messages are not sent. Submit only displays an unavailable toast. | This is incomplete functionality with honest disclosure, not a working notification service. Decide whether V1 should keep the disclosed form, hide it, or separately authorize implementation. No subscribers or providers were touched. | small to hide; medium to implement |
| DECISION-002 | Deliberately limited order transition policy | `src/schemas/orderWorkflow.ts:3` and `:10` permit PENDING → NEGOTIATING/REJECTED, NEGOTIATING → PROCESSING/REJECTED. Existing COMPLETED/CANCELLED rows are supported for display/filtering. | No operation currently finishes a PROCESSING order. Confirm the V1 product policy before calling that a defect or expanding the workflow. No completion/cancellation feature was implemented. | product decision; medium if expanded |
| OPTIONAL-001 | Homepage selection index for growth | `src/lib/projects/homepage.ts:9`; `prisma/schema.prisma:158`; live index catalog confirms status/createdAt and legacy homepage-singleton indexes, without an index matching automatic deadline ordering. | Only one project currently exists; no slow-query defect was measured. Use realistic EXPLAIN/latency evidence before proposing a partial eligible-project/deadline index. Any schema/migration change needs explicit approval. | small after verification |
| OPTIONAL-002 | Legacy logical relationships | `prisma/schema.prisma:318` (`PersonProfile.user_id`) and `:330` (`Image.ownerId`) have no Prisma relation/FK to User. Live inspection found **zero orphan profiles**. | Existing API joins/filtering are intentional. Consider integrity constraints only with a compatibility audit and explicit migration approval; there is no demonstrated orphan-data defect to repair. | medium |
| OPTIONAL-003 | Deployment documentation discoverability | `.env.example:1`; `README.md:1`; production requirements already exist in `docs/security-implementation.md:382`. | The example is abbreviated and README is still the Next starter guide. Link the existing project setup/deployment instructions when documentation edits are approved. Missing README guidance is not proof of missing production secrets. | small |
| OPTIONAL-004 | Public assets and SEO disposition | Unlinked `public/images/rahnama.pdf`; no sitemap/robots route in the inspected App Router. | Review whether the legacy PDF belongs in the public release and whether SEO route generation is wanted. No asset removal, third-party copyright conclusion, or dead-link claim is justified by this audit. | small, owner decision |

Team publication remains explicitly configured through `PUBLIC_TEAM_PROFILE_IDS`; `app-admin` is neither required nor sufficient for public team membership. Keeping that allowlist and retaining `showOnHomepage` in the schema are intentional. Static portfolio examples are independent of Prisma Projects. None of these choices is classified as a bug.

## Architecture and security observations

| Area | Evidence / assessment |
| --- | --- |
| App Router and server/client boundaries | Locale layout owns `<html lang dir>`, providers, navbar, and footer. Data pages are server-gated before client components. Prisma/session services are server modules and were not found in public client import paths. The singleton checks current generated delegates in `src/lib/prisma.ts:7`. No architecture rewrite is indicated. Landmark exceptions are DSV1-008. |
| Role contract | `src/lib/auth/authorization.ts:6` uses exactly `app-admin`, derived from current database profiles, never the persisted UI role. `useUserStore` only stores a presentation preference. Admin pages and APIs enforce the trusted principal independently. DSV1-001 concerns revocation during selected order writes, not an unconditional admin bypass. |
| Sessions and bans | `src/lib/auth/session.ts:12` sets HttpOnly, SameSite=Lax, production Secure cookies. `:42` validates token shape, expiry, and current ban state; new session tokens are stored as digests. Management bans delete sessions. Existing unit tests cover banned/expired sessions, role checks, and management safeguards. Real HTTPS cookie behavior was not tested locally. |
| OTP and registration authority | Challenges are bound to a browser secret, target, purpose, expiry, delivery state, and bounded attempts. Registration consumes a verified grant transactionally; session insertion checks bans under a user-row lock. Console delivery is development-only. DSV1-006 concerns email conflict handling, not an OTP bypass. |
| Ownership | Order list scope is overwritten with the trusted customer ID; customer attempts to choose another client or include client details are forbidden. History checks ownership. Ticket scope uses customer ID; linked order ownership is validated and transferred/mismatched linked orders are hidden in DTOs. Tests exercise these guards. Live anonymous API requests returned 401. |
| Input and SQL | Shared mutation checks validate Origin/content type; JSON bodies are bounded. Zod rejects untrusted role/identity fields. Order validation re-reads the published machine form and strips hidden fields. Raw SQL in active management/services uses Prisma tagged/bound parameters; no user-controlled interpolated SQL execution was found. |
| Idempotency and transactions | Order submission has per-customer unique keys and request hashes with unique-race recovery. Ticket creates/replies have request hashes, advisory serialization, unique constraints, and conflict checks. Project edits use optimistic versions and management serialization; user management protects the last active admin. These mechanisms were source/unit checked; current real locking trials remain a gate. |
| Sensitive/public responses | Private API responses use `private, no-store` and `Vary: Cookie`. Team DTO contains only public names/image/approved website. Homepage DTO contains only localized title/description/deadline, with no order/customer relation or internal IDs. Anonymous pages showed no customer/order/ticket data. |
| XSS, redirects, and media | Active public/customer text uses React text rendering rather than raw HTML. No active `dangerouslySetInnerHTML` sink was found. Locale redirects use fixed internal paths; no client-controlled return URL redirect was found. Team image URL checks reject unsafe schemes, credentials, malformed/local traversal paths; images are loaded by the browser, not fetched by an upload/proxy endpoint. No active upload handler was found, so file-upload acceptance was not tested. |
| Headers | Actual local configuration provides nosniff, DENY framing, strict-origin-when-cross-origin referrer policy, disabled camera/microphone/geolocation, and CSP `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`. This is a limited CSP, not proof against all script injection. Deployment TLS/HSTS/edge configuration was not inspected. |
| Error handling | APIs return safe machine codes, and render boundaries log fixed categories rather than raw exception data. Project diagnostics distinguish stale-client/database failures from empty results. Database failure fallbacks were inspected/tested with substitutes; the real database was not intentionally disrupted. |
| Client caches | Auth identity/permission changes cancel/remove private order/admin/support queries. Locale-dependent form/support/project queries include locale. Team data is locale-neutral and cached for five minutes; focus refetch is disabled by default. That intentional staleness can delay roster updates but is not a missing-member defect. |

## Database and migration findings

The migration ledger is **`entity._prisma_migrations`**, not `public._prisma_migrations`. All six records are finished and not rolled back. SHA-256 of each migration file matches its recorded checksum:

| Migration | Matching recorded/file SHA-256 |
| --- | --- |
| `202610160001_existing_schema_baseline` | `2937c49edf52592b57e82b6525e0bf7571709bfbb5fc12e1eb012a08766114dc` |
| `202610170001_security_foundation` | `ed925212b89b51cfc2e591888f40ee663ef929cf7968d025f13c39890d45fffd` |
| `202610220001_order_workflow` | `919d8cd46a3e101b6e7321c12868eb6829c14261ec99bef7305e8c469c95ff6b` |
| `202610230001_user_management` | `7df05558596e188a6e5644c9241ac897c08e222dde5395ee249dcec6ebd77208` |
| `202610290001_projects` | `ba8d7a278c4e8febdac7d9895c1ac13afb4a013a3c8a6d3c50ae4d7728edd963` |
| `202610290002_support_ticketing` | `6d7731e3a376ddf5024165cfc4b6288baf9605b23c65c0b21856d0fdc4d50183` |

The historical security migration checksum blocker is **not present** in the inspected local database. No migration repair, `migrate resolve`, migration execution, or ledger edit was attempted.

| Read-only observation | Result |
| --- | --- |
| Before/after aggregate counts | Users **16**, profiles **3**, orders **121**, projects **1**, tickets **1**, ticket messages **1**, ticket notifications **1**; counts matched at the end. No private record bodies were copied into the report. |
| Published order form | One published `order` form, **6 steps**, **19 fields**. Both real locale APIs returned HTTP 200 with schema-valid configuration. |
| Order statuses | PENDING 24; NEGOTIATING 1; PROCESSING 24; COMPLETED 24; CANCELLED 24; REJECTED 24. These correspond to the implemented display/filter vocabulary; no unknown-status defect was established. |
| Orphan profiles / mismatched linked support orders | **0 / 0** from scoped SELECT joins. |
| Order notification states | One SKIPPED history entry. This is an explicitly supported state, not evidence of failed provider delivery. |
| Automatic public selection | One eligible project: **DreamService V1.0 Launch**, deadline **2026-12-29T14:30:00.000Z**. The real homepage showed its English and Persian titles. |
| Constraints/indexes | Live catalogs confirmed user contact/email uniqueness, order idempotency uniqueness, project order-link uniqueness and partial legacy homepage singleton, ticket/message idempotency keys, ticket paging indexes, FK restrictions, project title/date checks, nonempty ticket/message checks, and closed-ticket timestamp consistency. |
| Historical SQL | Baseline captures pre-existing schema objects; subsequent migrations add security/workflow/user-management/project/ticket objects or columns. No reset/drop/truncate/data-delete instruction was identified in these migrations. No DDL was executed. |

Matching checksums and selected integrity queries do not prove exhaustive schema drift absence or unchanged contents of every row. This audit issued no database writes; before/after counts and migration hashes provide additional, limited verification.

## Actual browser and feature verification

Headless Chrome used the real existing local application and database connection. Public homepage and About checks covered **en/fa × 1440px/375px × light/dark**. They found no horizontal document overflow or broken loaded images. No uncaught browser runtime exceptions were recorded. Expected 404 requests were the only failing responses captured in that public navigation run.

| Feature | Verification and outcome | Limits / findings |
| --- | --- | --- |
| Homepage / original portfolio | Real browser: **7 slides, 7 dots**, ready Swiper, original static examples. In both locales, next changed index **0 → 1**, previous **1 → 0**, dot 4 selected index **3** after allowing transitions to finish. | DSV1-007 and DSV1-010. Immediate rapid clicks during a running Swiper transition were not misclassified as broken controls. |
| Upcoming project | Exactly **one article** below the slider; matching real demo project title/description; countdown inside that article. Measured section-to-card gap **32px** in every viewport/theme/locale combination. Countdown values changed over time in both locales. | No project/order/selection changes were made. Only one eligible project exists locally; multi-candidate selection was source/unit verified, not tested by adding original-data fixtures. |
| Expiry / no-project / failures | Browser-only clock simulation past the actual deadline produced the correct localized expiry text and removed the notification form in both locales. Existing project tests passed for future/expired/no-candidate states and distinguish empty results from errors. | Expiry simulation is a client rendering test, not a database deadline edit. No-project and real server/database failure states were not induced in the original database; those paths were source/in-memory verified. |
| About / team | Real `/api/team` returned HTTP 200 and 3 public entries. Both settled locale pages rendered 3 personal-site links and loaded avatar images without errors at desktop/mobile sizes and in both themes. | Early fixed-delay Persian desktop samples were still loading; a follow-up waited for settled content and confirmed all 3 links. No false missing-team defect is reported. Five-minute roster cache is intentional. |
| Contacts and social links | Active footer/Hero use centralized `src/lib/site.ts`: `https://dreamservice.net`, `dreamservicenet@gmail.com`, Telegram DreamServiceSupport, GitHub DreamServiceTeamNet, approved LinkedIn URL. External new-tab links use `noopener noreferrer`; email uses `mailto:`. | Link construction/content inspected. Third-party account ownership, reachability, and delivery were not verified. Personal-site subdomains were blocked in the main browser run to avoid external requests. |
| Localization / directions | Real pages have `en/ltr` and `fa/rtl`; both catalogs contain **637 leaf values** with matching keys. Existing translation/interpolation tests passed. Locale-aware links and language switch preserve route/search/hash by implementation. | Direct locale navigation was browser checked; every private widget and cross-tab language switch was not. |
| Themes / responsive UI | Public pages checked across the 8 combinations; actual theme-button clicks switched dark → light in English and light → dark in Persian. Shared token contrast/icon tests passed. | No exhaustive visual screenshot review or real authenticated mobile dashboard review. DSV1-008 concerns landmarks, not theme rendering. |
| Registration/login/OTP/logout | Real anonymous `/api/auth/me`: HTTP 200, `success:false`, `user:null`; real sign-in dialog opens, has label/description references, and focuses `phone` in both locales. Existing security tests cover OTP/grants/logout and related guards in memory. | No OTP or logout request and no real sign-in/registration completed. DSV1-006. Production delivery not exercised. |
| Customer dashboard / order tracking | Real anonymous orders page shows localized sign-in gate; APIs deny anonymous order access. Source/unit tests cover owned order summaries, history, empty state, idempotency, and field validation. | DSV1-005; no authenticated live customer workflow claimed. |
| Dynamic order form / submission | Real config endpoints returned HTTP 200 in both locales with 6 steps; Prisma-backed machine definitions drive rendering and server validation. Anonymous form page is gated. | No form submission against real DB. DSV1-001 and DSV1-002. |
| Admin orders | Server page and APIs derive ADMIN from exact database role; unit checks cover decisions, history, ownership and optimistic status conflicts. | No authenticated live decisions/notification retry. DSV1-001. |
| Admin users | Real anonymous `/api/admin/users`: **401 / UNAUTHENTICATED**. Code/unit tests cover list/details, role changes, bans, self-action and last-admin safeguards, audit records, and session revocation. | No original accounts changed and no authenticated browser management flow exercised. |
| Admin projects | Real anonymous `/api/admin/projects`: **401 / UNAUTHENTICATED**; localized page gate rendered. Existing tests passed for authorized empty HTTP 200 `{data:[],total:0}`, standalone creation, guarded transitions, conflicts, and diagnostics. | DSV1-004. No original project create/edit and no fresh real authenticated empty-table test. |
| Customer/admin tickets | Real anonymous `/api/support/tickets` and `/api/admin/tickets`: **401 / UNAUTHENTICATED**. Service inspection covers owned order links, paged conversation, replies, explicit reopen, priority/status changes, and notifications. Unit validation/cache/localization tests passed. | No real create/reply/status update. DSV1-003; current PostgreSQL integration suite not run. |
| In-app notifications | Source uses committed database notification records, scoped customer recipients/shared admin inbox, paginated reads, and sender exclusion. No provider/SMS call in ticket notification delivery. | Intentional in-app delivery; no unread/read-ack feature presumed. Live authenticated inbox delivery not exercised. |
| Loading/error/empty/404 | Existing loading/recovery unit suites passed. Actual `/en/missing-audit-route` and `/fa/missing-audit-route` returned HTTP 404 and localized recovery headings. Anonymous private pages displayed their access gates without generic error banners. | Server crash/database failure not induced. Private empty states mostly covered with substitutes, not original-data manipulation. |

## Checks executed during this audit

| Command / check | Result |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **PASS**, exit 0. No TypeScript output emitted. |
| `npm run lint` | **PASS with warnings**, exit 0: 0 errors, 4 warnings listed below. No auto-fix. |
| `node --test --test-reporter=dot scripts/*.test.mjs` | **PASS**, 277 tests; all existing `.test.mjs` suites, including security, submissions, projects/runtime, tickets, team, i18n, loading/recovery, customer/workflow UI, design system, and Prisma cache. Inspected these scripts for writes first; their Prisma dependencies use substitutes. |
| `node --require ./scripts/no-services.cjs node_modules/prisma/build/index.js validate --schema prisma/schema.prisma` | **PASS**, schema valid. Verification preloader supplied a dummy database URL and blocked service connections. No client generation or migration. |
| `npm audit --omit=dev --json --ignore-scripts` | **PASS**, reported **0 production dependency advisories**. This registry result does not assess all vulnerabilities, application logic, or development-only dependencies. No installation/update was performed. |
| Four inline probes using existing test loader | Confirmed revocation interleaving, missing submission throttle, ticket-size validation conflict, and duplicate-email HTTP 500. All in-memory, with no database/provider calls. |
| Real local HTTP/browser/SELECT checks | Results above; public routes/API/database connection verified. No authenticated fixture credentials created or existing secrets extracted. |
| Production build | **NOT RUN** under the single-authored-file/no-existing-file-change constraint. A root build writes existing build state and may regenerate config/type files; a safe isolated source copy needs additional artifacts. This is a release gate, not a failed build. |
| PostgreSQL integration / mutation browser suites | **NOT RUN** because they create/modify fixture records. They were not pointed at the original database; no disposable database was created during this audit. |

ESLint's four warnings were present in the initial working tree and are not suppressed or reported as newly introduced defects:

- `src/components/modules/data-table/data-table.tsx:109`: React Compiler / TanStack Table incompatible-library warning.
- `src/components/modules/dream-form/dream-form.tsx:196`: React Compiler / React Hook Form `watch` warning.
- `src/components/templates/about/plusCard.tsx:102`: unoptimized `<img>` in an inactive legacy component; this is not the current TeamCard.
- `src/hooks/useRandomAutoplay.ts:36`: missing effect dependency. DSV1-007 is supported independently by code and browser behavior; a lint warning alone was not treated as proof of a runtime bug.

## Recommended fix and verification order

1. **Resolve DSV1-001 first.** Preserve the existing authorization contract and transaction semantics; demonstrate ban/demotion interleavings with two real disposable PostgreSQL connections and mocked providers.
2. Fix **DSV1-003** and **DSV1-006**, then verify ticket page-size recovery and duplicate-email registration feedback in both locales.
3. Address **DSV1-002**, with meaningful abuse-budget/idempotency tests. Confirm how trusted proxy limits and per-account limits work together.
4. Correct **DSV1-004** and **DSV1-005** so navigation and admin confirmations match the implemented customer dashboard and automatic homepage behavior.
5. Fix portfolio pause/focus behavior (**DSV1-007**), reduced-motion hover (**DSV1-010**), landmarks (**DSV1-008**), and placeholder content (**DSV1-009**) without changing the two-section homepage architecture.
6. Obtain the product decisions for disclosed unavailable launch notifications and the intentionally limited order lifecycle. Do not silently expand V1 scope.
7. After implementation is explicitly approved, run a fresh isolated production build, the relevant database-backed integration suites, and authenticated customer/admin browser flows in en/fa, RTL/LTR, desktop/mobile, and light/dark. Verify deployment configuration through approved staging checks without real delivery unless separately authorized.

**Final totals:** 0 CRITICAL, 1 HIGH, 6 MEDIUM, 3 LOW confirmed defects. The immediate security release blocker is order mutation/revocation consistency; remaining release verification gates are the fresh production build, authenticated real-database flows, and deployment security configuration. Public homepage/portfolio/countdown, published team rendering, both form-config locales, anonymous API protection, 404s, TypeScript, unit suites, Prisma validation, and production dependency advisory checks were verified within the limits stated above.

**Stopped after the audit. No fixes implemented. Awaiting explicit approval before changing application behavior.**

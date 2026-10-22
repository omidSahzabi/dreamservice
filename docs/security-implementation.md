# DreamService V1.0 — Security implementation

## Status and scope

**PARTIALLY COMPLETE — local migration/database verification passed;
browser/deployment acceptance remains pending.**

Prepared on 2026-10-17 on `feat/complete-i18n`. No commits, pushes, branch changes,
seed scripts, real SMS, environment-file edits, or historical application-record changes
were performed. No dependencies were added. Later approved local remediation
verified backup restoration and baseline SQL on separate databases and registered
only the verified baseline on the original local database. Subsequent explicit
approval applied the security migration there, verified existing data preservation,
and passed 33 PostgreSQL integration tests in an isolated synthetic database; see
[current migration results](security-migration-verification.md).

The owner approved the additive schema, local SQL preparation, and subsequently
local test migration application subject to the mandatory preflight gates. The
preflight approval authorized remediation of index drift and the missing baseline,
then stopped before original-database security application. The owner subsequently
approved that application and database-backed tests. Real PostgreSQL concurrency,
authentication, authorization, and order tests passed locally. This does not
establish real-browser/deployment acceptance or production readiness.

Customers and administrators use the same phone/OTP authentication. The earlier
password proposal is superseded: there is no password login, password storage,
new role table, or duplicate authorization system.

## Authentication and exact authorization rule

`getCurrentUser()` validates a database-backed, unexpired session and selects a
limited set of user fields. It then queries `PersonProfile` with
`user_id = session.user.id`, checks that association again when constructing roles,
and removes duplicate role strings. Role assignments are read on every request.

`getAuthenticatedPrincipal()` returns only the trusted user ID and effective
permission. Administrator permission requires the exact, case-sensitive string
`app-admin` in one of those associated profiles. `ADMIN`, `admin`, `App-Admin`,
whitespace variants, foreign profiles, missing profiles and null roles do not
grant administrator permission. Multiple own profiles are permitted: an exact
assignment grants ADMIN; otherwise permission is CUSTOMER.

`requireAuth`, `requireRole`, `requireAdmin` and `requireOwnership` provide reusable
server-only boundaries. Database/role lookup failures fail closed. Next.js
rendering/redirect control-flow exceptions are rethrown rather than converted to
application failures. Browser display roles and `/auth/switch-role` never grant
permission. Public mutations cannot create or modify `PersonProfile` records.

There is no account-disabled field or disable-account operation in the approved
schema. Deleted users/sessions fail authentication; removed administrator roles
lose administrator access on the next server authorization check. A future
account-disable operation must revoke sessions and be checked centrally; this
capability has not been invented or claimed as implemented.

## Registration and OTP lifecycle

1. Sensitive browser POSTs require the configured exact Origin and JSON content
   type. Bodies are streamed with byte limits before parsing.
2. Phone normalization preserves the existing Iranian phone/digit rules. OTP
   generation continues using cryptographic randomness.
3. Issuance reserves shared database-backed rate budgets. Per-phone issuance is
   additionally serialized by a parameterized PostgreSQL transaction advisory
   lock, enforcing a true 60-second cooldown across purposes and window boundaries.
4. Issuance consumes older unconsumed phone challenges and persists a new PENDING
   challenge before sending. Verification material uses a server-keyed HMAC bound
   to challenge ID, phone, purpose and code. Raw OTPs are not persisted. Logging
   is prohibited except the explicitly approved, opt-in development console mode
   described in [local OTP delivery](development-otp.md); production rejects it.
5. Provider acceptance (or explicit development console selection) followed by
   successful SENT persistence makes the challenge usable. Console output occurs
   only after that persistence. Rejection produces FAILED; an interruption can
   leave PENDING, which cannot verify. Provider calls occur outside transactions.
6. HttpOnly cookies carry an independent random browser binding and the explicit
   current challenge ID. Challenge lifetime is 120 seconds.
7. Verification requires matching target, channel, purpose, binding, SENT state,
   unconsumed state and expiry. Attempt reservations are conditional database
   updates; at most five are allowed. Wrong-code attempts commit their reservation.
   Successful consumption and session/grant creation share a transaction.
8. LOGIN for an existing user creates a session. LOGIN for an unknown verified
   phone advances the unified UI into registration. REGISTER cannot log an
   existing user in. Neither path changes role assignments.
9. New-user verification issues an unpredictable completion cookie plus a
   server-side grant containing only its digest, browser-binding digest, verified
   phone, REGISTER purpose, ten-minute expiry and consumption state.
10. Registration must present both cookies and the matching normalized phone.
    Conditional grant consumption, new-user insertion and session insertion occur
    in one transaction. Existing users are rejected; the former existing-user
    session shortcut is removed. No roles/profiles can be supplied or created.

Proof substitution, phone substitution, replay and a stolen completion cookie
without the original browser binding fail. Copying all authentication cookies is
credential theft, not a browser-isolation guarantee. HttpOnly, Secure in production,
Origin checks and single-use storage reduce that exposure.

If registration commits but the response/cookie is lost, restart OTP login.
Registration does not recover an existing account from a consumed grant. If a
transaction fails before commit, both proof consumption and account/session writes
roll back. Legacy unbound OTP rows are rejected without modifying historical rows.

### Shared abuse budgets

| Scope | Budget |
| --- | --- |
| OTP issuance source | 30 requests/hour |
| Global provider reservation | 1,000 requests/day |
| Normalized phone, all purposes | 1/minute, 5/hour, 10/day, plus exact 60-second cooldown |
| Verification source | 60/minute |
| Verification phone | 30/15 minutes, plus five attempts/challenge |
| Registration source | 20/15 minutes |

Buckets use atomic upsert increments inside transactions and keyed opaque IDs.
Source/global checks precede phone bucket allocation, bounding growth from a
denied source. These are conservative request budgets, not counts of confirmed
SMS delivery. Fixed windows can admit adjacent-window bursts; the exact phone
cooldown is separate. Shared keys and synchronized application clocks are required.

Client-supplied forwarding headers are ignored unless an operator explicitly
configures a trusted, proxy-overwritten single-IP header. Without it, all sources
share an `unknown` budget; that is safe but restrictive. Actual proxy identity
configuration and multi-instance behavior remain staging verification items.

## SMS integration

The adapter follows the official IPPanel pattern contract:
[Send Pattern SMS](https://ippanelcom.github.io/Edge-Document/docs/send/pattern/)
and its documented Edge base URL. It uses the documented pattern endpoint and
request shape, requires HTTP success, `meta.status = true`, the documented success
code, and nonempty positive message-outbox IDs. It has a ten-second timeout,
disables redirects, and never returns provider messages or credentials.

Acceptance means provider acceptance, not handset delivery. The configured account,
sender, template placeholder, deployed contract and actual delivery are UNVERIFIED.
The sender must be configured in the documented E.164 format.

Real SMS delivery is disabled unless both production mode and
`SECURITY_SMS_ENABLED=true` are present. `OTP_DELIVERY_MODE=console` permits
development-only terminal delivery after successful SENT persistence; production
rejects that flag. Development/tests have no real-delivery or fixed-code bypass.
Tests inject a substitute or capture console output. No provider send endpoint was
called during implementation; only public documentation was consulted.

## Sessions and logout

- New 256-bit random session cookies are stored as prefixed SHA-256 digests, not
  bearer tokens, in the existing Session token column.
- Cookies remain HttpOnly, production Secure, SameSite=Lax, Path=/ and thirty-day
  absolute expiry. The database enforces expiry independently of cookie expiry.
- Cookie syntax rejects a stored prefixed digest being submitted as a bearer token.
- Legacy raw sessions remain readable until their original expiry. There is no
  bulk conversion, forced logout or historical session rewrite. Their legacy
  at-rest exposure remains until expiry; retire the compatibility lookup afterward.
- Login creates a fresh token and revokes the presented previous session in the
  same transaction. Unrelated device sessions are preserved.
- Logout transactionally revokes the current session, registration grant and
  browser-bound OTP where present, then expires all local authentication cookies.
- Database failures clear local cookies but return failure; they never claim
  guaranteed server revocation. Such a failure still leaves a server token usable
  until successful revocation or expiry and must be observable operationally.
- Authenticated API responses have `Cache-Control: private, no-store` and `Vary:
  Cookie`. Server pages use validated cookie sessions and are dynamic.

## Admin interface and endpoint matrix

The existing `/{locale}/order/review-orders` page checks server-resolved ADMIN
permission before returning the review view. Anonymous and customer visitors get
localized access states. Login uses the existing modal on the current locale and
path, then refreshes server authorization. No arbitrary return URL is accepted.
The backing API independently authorizes every request. Review links are shown
only for the server-returned administrator permission; this is UX, not enforcement.

| Endpoint | Method | Authentication/authorization |
| --- | --- | --- |
| `/api/auth/send-otp` | POST | Public issuance, exact Origin/JSON, shared quotas and bound challenge |
| `/api/auth/verify` | POST | Bound OTP proof, exact purpose, atomic attempts/consumption |
| `/api/auth/register` | POST | Browser-bound, unexpired, single-use REGISTER grant; no existing-user login |
| `/api/auth/me` | GET | Optional validated session; only current-user identity/permission |
| `/api/auth/logout` | POST | Exact Origin; idempotently revokes current browser credentials; failures reported |
| `/api/auth/switch-role` | POST | Valid session, Origin/JSON, existing own-role membership; response only, no writes |
| `/api/order/load-orders` | GET | Session required; CUSTOMER queries/counts forced to own ID; cross-customer filter or client join rejected; ADMIN may list across customers |
| `/api/order/submit-order` | POST | Session required; trusted owner, server PENDING status, Origin/JSON, published-form validation and customer-scoped idempotency |
| `/api/order/order-form-config` | GET | Public published localized configuration; unrestricted option metadata removed |
| `/api/team` | GET | Only explicitly published roster; names and presentation image only |

All ten existing handlers were covered. No Server Actions or other privileged
mutation endpoints were discovered. Authentication failures use 401, authorization
403, concealed resources 404 where applicable, input failures 400/422, unsupported
content type 415, oversized bodies 413, idempotency conflicts 409 and limits 429.
Database outages fail closed with generic 500/503 responses.

## Order validation and idempotency

Both legacy flat JSON and `{formKey, data}` are accepted. Missing flat formKey means
the existing `order` form. The browser now supplies a UUID `Idempotency-Key` header;
other callers must do the same. Missing/invalid keys return 400.
Numeric fields must contain JSON numbers; the old implicit numeric-string coercion
is intentionally replaced by authoritative field-type validation.

Reserved fields, including client ownership, user IDs, roles, status, prices,
internal idempotency fields and arbitrary meta, are rejected with 422. This is a
consistent rejection policy, not mass assignment. Top-level wrapped extras and
unknown dynamic fields are rejected. Legacy service/description aliases are
mapped to the field actually published; conflicting aliases fail.

The server loads the published form from Prisma and validates machine definitions
independently of display language. It enforces configured required fields, types,
numeric and string bounds, select/radio/checkbox membership, checkbox uniqueness,
and conditional visibility. Duplicate field IDs and unknown/cyclic visibility
dependencies are invalid configuration. Hidden controlling fields cannot suppress
another visible requirement, and hidden fields are excluded from stored data.
The same visibility/schema helpers drive the client wizard. Page count must be a
positive safe integer. Service and budget must survive validation.

Input is limited to 64 KiB, 100 fields, 5,000 characters/string, 100 selected
checkbox values, 150 characters/selection and a finite numeric safety range, with
configured stricter bounds also enforced. This bounds stored customer metadata.
No checkout/payment functionality or client-authoritative price was introduced.

The request fingerprint uses deterministic canonical JSON. A unique database key
on `(client_id, idempotency_key)` protects concurrent insertion. Identical retries
return the original order ID; changed content under that key returns 409. Unique
constraint races are resolved by a new ownership-scoped lookup. Responses expose
only success and order ID, not internal request hashes. Keys are retained with the
order; there is no automatic idempotency expiry.

The browser retains the key in memory across retries of unchanged data, resets it
on success or identity change, and does not store payloads persistently. Losing
browser memory also loses its retry key; callers that need recovery across a
browser restart must retain a non-sensitive request key in a future reviewed UX.

## Browser state, public output and application hardening

Sensitive query keys include user ID and effective permission. Review queries
require administrator permission, accept cancellation, do not retain placeholder
data across keys, and revalidate on focus/every thirty seconds. Identity or role
changes cancel/remove sensitive cached queries, reset drafts/idempotency state,
clear display-role state and refresh server authorization. Logout clears these
states even when revocation reports failure.

Drafts are memory-only. The obsolete persisted draft key is removed. Locale
switches may preserve an in-memory draft, but logout/account changes cannot carry
it into the next identity. Mounted form wizards are keyed by authenticated user ID
on both server and client so React Hook Form cannot retain another account's
values across an authorization refresh. Authentication form fields reset when the
modal closes; OTP inputs reset between challenges. API authorization is immediate
per request; already
displayed data cannot be recalled remotely, and an idle browser may take until
its next focus/poll to learn about external role revocation.

`/api/team` no longer treats all authentication profiles as a public directory.
`PUBLIC_TEAM_PROFILE_IDS` is an explicit operator-approved publication list. When
absent, the endpoint returns an empty roster without querying profiles. Public
responses omit IDs, company/private profile fields and role assignments.

Prisma query/error-object logging was removed. Security events contain only event
type, safe machine code where relevant and timestamp: no actor identifiers,
inputs, customer data, tokens, provider payloads or raw exceptions. Events are
console output, not a durable, actor-attributed administrative audit trail.

Response headers add framing protection, nosniff, referrer/permissions policy and
a limited CSP for framing, objects and base URLs. This is not a full nonce-based
script CSP. HTTPS/HSTS, host/proxy trust and deployed caching need operator checks.

Origin policy is intentionally strict: production requires the exact configured
`SECURITY_ORIGIN`; development can use the request's origin. Missing Origin is
rejected, including for nonbrowser clients unless they explicitly supply the
trusted origin. Cross-site fetch metadata is rejected. These cookie endpoints do
not implement a separate nonbrowser authentication scheme.

## Mapping to audit findings

All statuses below describe source implementation and isolated tests, not deployed
remediation. Every database-backed guarantee still requires integration validation.

| Finding | Implemented change |
| --- | --- |
| SEC-01 | Single-use browser-bound registration grant; atomic user/session creation; existing-user shortcut removed |
| SEC-02 | Authenticated, mandatory customer scope on records/counts; explicit administrator cross-customer access |
| SEC-03 | Authenticated creation, trusted owner, forced PENDING, no test-user fallback |
| SEC-04 | Authoritative database form validation and bounded allowlisted metadata |
| SEC-05 | Customer-scoped unique idempotency key and content conflict detection |
| SEC-06 | Database rate buckets, exact cooldown lock, conditional attempt reservations |
| SEC-07 | Explicit challenge cookie, supersession, purpose/outcome binding |
| SEC-08 | Transactional logout; failures reported; browser credentials expired |
| SEC-09 | Exact Origin, content type and bounded JSON policy |
| SEC-10 | Principal-partitioned queries, cancellation/clearing, memory-only drafts |
| SEC-11 | Explicit public roster and minimized fields |
| SEC-12 | Keyed OTP material and digested new session tokens; legacy compatibility exposure documented |
| SEC-13 | Documented provider contract, timeout, delivery states, fail-closed failures |
| SEC-14 | Removed raw/query logging, safe events, caching and response-header controls |

## Schema and migration compatibility

Prepared SQL: `prisma/migrations/202610170001_security_foundation/migration.sql`.
It contains only the four approved additive changes:

1. New `entity.registration_grants`, with hashed proof/binding, phone, purpose,
   expiry, consumption/creation timestamps and expiry index.
2. New `entity.security_rate_limits`, with opaque key, count, expiry and index.
3. Nullable `browserBindingHash` and `deliveryState` columns on OTP records.
4. Nullable `idempotency_key` and `request_hash` columns on orders, with unique
   `(client_id, idempotency_key)` index.

PostgreSQL permits multiple legacy NULL idempotency keys. Existing rows, foreign
keys, users, profiles and roles are not deleted, reassigned, backfilled or rewritten.
No Session schema change is required. Only newly issued sessions use digests.

**Security SQL is applied on the approved original local test database.** The approved local
remediation added `202610160001_existing_schema_baseline`, verified it against the
actual schema and a full backup restore, and registered it as the existing-schema
baseline on the original database. Existing image indexing is represented directly
in Prisma; baseline SQL also preserves existing CHECK constraints and triggers.
The additive security DDL passed an isolated, rollback-only compatibility trial,
then was wrapped in a bounded transaction and applied through Prisma migration
history after explicit approval. Existing data/index preservation checks passed;
Prisma reports no pending migrations or supported schema drift. See the current
migration results for evidence and remaining gates. Other environments need
their own verified baseline/recovery procedure; never execute baseline creation
SQL on a populated schema, blindly run `migrate dev`, or reset a database.

Apply the reviewed additive changes before routing traffic to the updated code.
Drain old application instances in a coordinated rollout: old code cannot read
new digested sessions and still contains the old security defects. Regenerate
Prisma Client during deployment. Do not deploy code that expects absent tables.

## Verification performed

| Check | Result |
| --- | --- |
| `node scripts/prisma-offline.mjs generate` | PASS using installed engines and isolated schema/dummy URL; no database connection |
| `node scripts/prisma-offline.mjs validate` | PASS: additive schema valid |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS |
| `npm run lint` | PASS: zero errors; five pre-existing warnings |
| `node --test --test-reporter=dot scripts/i18n.test.mjs scripts/security.test.mjs` | PASS: 122 tests, 11 existing i18n and 111 security tests; no skipped tests |
| `node scripts/check-i18n.mjs` | PASS: 391 bilingual messages, key/type/ICU parity, 255 static calls, 18 covered dynamic calls |
| `node scripts/build-offline.mjs --webpack` | PASS: compilation, type checking, page generation and optimization with service connections disabled |
| Default isolated Turbopack build | Stalled during compilation and was interrupted; no successful default-builder result is claimed |
| `node scripts/security-http-smoke.mjs` | PASS: 12 real anonymous HTTP checks against the isolated loopback production server; protected pages in en/fa, one document root, RTL/LTR, API denials, Origin/input checks and minimized public responses |
| `git diff --check` | PASS |

The build wrapper blocks outgoing Node connections, disables SMS/telemetry,
supplies a dummy database URL and prevents project environment-file loading in
the build and workers. Prisma tooling uses a temporary schema and explicit local
engines. Initial sandbox child-process restrictions were resolved through approved
local reruns. The initial Prisma invocation attempted engine retrieval before
explicit installed-engine paths were supplied; that attempt failed and no
dependency was installed. Preliminary build-wrapper issues were corrected.

Production build checks also uncovered a root redirect lacking a layout entry
point and an unsupported exported Zod schema in a route module. A root layout
adapter now passes through to the existing locale document, preserving its html,
body, language and direction; the route schema is module-private.

Warnings remain in existing table/RHF compiler compatibility, inactive image and
countdown code, and the autoplay effect. Next also warns that middleware naming
is deprecated; routing architecture was preserved.

Tests exercise actual handlers/helpers through safe module loading. Prisma is
replaced with an in-memory transactional substitute that rejects unexpected real
client imports. They cover customer/admin OTP login, invalid/expired/replayed/
wrong-purpose/superseded challenges, concurrent attempts, registration theft/
substitution/replay/concurrency/rollback, sessions and logout failure, exact roles,
revocation, server page gates, ownership, query bounds, dynamic/conditional forms,
idempotency races/conflicts, Origin/body validation, public output, SMS response
contracts, and browser cache/draft policy. Existing localization tests gained an
authenticated principal, authoritative form fixture and required request headers;
compatibility assertions were preserved and ownership/status assertions added.

Anonymous HTTP verification caught an introduced shell-pipeline encoding error in
the new Persian messages. Those strings were corrected, Unicode assertions were
added to localization tests, and the rebuilt production artifact passed all twelve
HTTP checks. Initial failed checks were corrected, not suppressed. The default
Turbopack run remains unverified in this environment; the production webpack
builder passed with the final source and all protections enabled.

The historical browser smoke script was not run: it intercepts browser APIs but
cannot authenticate the new server-side page guards without a separately approved
server/test database setup. It must not be made to pass through an auth bypass.
Full browser interaction, RTL/LTR visual checks and cross-tab switching remain
UNVERIFIED. Catalog, mocked English/Persian tests and real anonymous localized
HTTP rendering checks passed.

## Deployment configuration and remaining gates

Configure through the approved deployment mechanism; no environment file was edited:

- `SECURITY_ORIGIN`: exact public scheme/host/port, without a trailing slash.
- `SECURITY_OTP_KEY`: stable, high-entropy secret of at least 32 bytes, shared across
  instances. Never expose it to clients or logs. Rotation invalidates outstanding
  challenges and resets opaque rate-bucket identities; coordinate rotation.
- `SECURITY_TRUSTED_IP_HEADER`: optional, only for a single-IP header overwritten
  by a trusted proxy that strips caller values. Otherwise the shared unknown limit
  remains active.
- `PUBLIC_TEAM_PROFILE_IDS`: optional explicitly approved public profile roster.
  Missing configuration intentionally hides the roster.
- Existing provider settings: verify sender E.164 format and pattern code/parameter
  compatibility. Keep `SECURITY_SMS_ENABLED` disabled until an approved safe
  staging delivery exercise is ready. Never enable it for these isolated tests.

Approved local migration application and isolated PostgreSQL integration tests
have passed: advisory locks, attempt reservations, grant/account/session atomicity,
rollback, unique-key races, customer/admin isolation, and role revocation. Other
environments require their own explicit application approval and schema/history/
recovery verification. Continue using synthetic accounts and mocked delivery for
security regression tests.

Then verify HTTPS cookie flags, inline login and authorization refresh, lost-response
recovery, logout failures, account switching, locale changes and both directions in
a browser. Verify proxy/header spoof resistance, fleet-shared budgets and clock
behavior. Provider account/delivery verification needs its own explicit approval;
acceptance by a mocked provider is not delivery proof.

Review published form content before rollout: reserved field names, option values,
required constraints, regexes, dependency graphs and both translations must be
valid. Regexes remain trusted configuration and should be reviewed for excessive
backtracking; no new regex engine dependency was introduced. Approve retention/
cleanup for expired OTPs, grants, rate buckets and sessions; no maintenance deletion
job or database cleanup ran in this task.

## Future workflows and ticketing contract

No ticket backend, payment workflow, status-update endpoint, approval, confirmation,
rejection or revision endpoint was added. Labels/models do not establish those
features. Future ticket/order reads and mutations must require a server principal,
scope customer resources by its trusted ID, and require exact server-resolved
`app-admin` permission for privileged actions. Validate legal transitions and
inputs, apply Origin/idempotency policy, use concurrency-safe database predicates,
and record safe actor-attributed events in an approved audit store. No public
profile mutation may assign or alter administrator roles.

## Changed files

The implementation changes are listed below; generated ignored `.next`/Prisma
client artifacts are local validation outputs, not source deliverables.

- Schema/SQL: `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`,
  `prisma/migrations/202610160001_existing_schema_baseline/migration.sql`,
  `prisma/migrations/202610170001_security_foundation/migration.sql`.
- Server security: `src/lib/security/{http,crypto,rate-limit}.ts`,
  `src/lib/auth/{authorization,otp,session,helper,sms}.ts`, `src/lib/prisma.ts`,
  `src/lib/order/validation.ts`.
- Authentication endpoints: `src/app/api/auth/{send-otp,verify,register,me,logout,switch-role}/route.ts`.
- Other endpoints: `src/app/api/order/{load-orders,submit-order,order-form-config}/route.ts`,
  `src/app/api/team/route.ts`.
- Pages: `src/app/layout.tsx`, `src/app/[locale]/order/page.tsx`,
  `src/app/[locale]/order/order-form/page.tsx`,
  `src/app/[locale]/order/review-orders/page.tsx`.
- Browser/auth: `src/components/modules/auth/{AccessRequired,AuthModal}.tsx`,
  `src/components/modules/navbar/AuthButton.tsx`, `src/lib/auth/{authClient,client-state}.ts`,
  `src/hooks/{useAuth,useOrderForm}.ts`, `src/store/orderStore.ts`.
- Dynamic forms/review: `src/schemas/{orderSchema,orderFormConfig}.ts`,
  `src/features/order/submit-forn/{OrderForm,StepRenderer}.tsx`,
  `src/features/order/review-orders/hooks/use-review-orders.ts`.
- Localization/config: `messages/en.json`, `messages/fa.json`,
  `src/lib/api/errors.ts`, `next.config.ts`.
- Verification: `scripts/{security.test,i18n.test,test-loader,prisma-offline,build-offline}.mjs`,
  `scripts/security-http-smoke.mjs`, `scripts/security.integration.mjs`,
  `scripts/no-services.cjs`.
- Delivery reports: `docs/security-implementation.md`,
  `docs/security-migration-preflight.md`, `docs/security-migration-verification.md`.

**Final status: PARTIALLY COMPLETE.** Approved local migration application and
database integration passed. Affected browser/deployment acceptance remains an
explicit release gate; no next feature phase was started.

# Security migration and local verification — 2026-10-17

**Migration: PASS. Existing data preserved: YES. Security integration tests: PASS.**

The owner explicitly approved applying the pending security migration to the
previously verified original local development/test database. No production
database, real SMS provider, environment file, Git commit, or push was involved.
The accepted original baseline and backup restoration were not repeated.

## Migration and preservation

`prisma migrate deploy` applied only
`202610170001_security_foundation` using the established migration history.
The existing baseline was not reapplied. Before application, the pending SQL was
wrapped in `BEGIN`/`COMMIT` with local five-second lock and sixty-second statement
timeouts. Its additive DDL was verified identical to the previously reviewed SQL.
The migration completed successfully; no recovery, reset, destructive command,
or migration retry was performed.

The resulting migration SHA-256, also verified against Prisma history, is:

`ED925212B89B51CFC2E591888F40EE663EF929CF7968D025F13C39890D45FFFD`.

Post-migration results:

- Both migrations have finished history records with no rollback marker.
- `prisma migrate status`: database schema up to date; zero pending migrations.
- `prisma migrate diff` from the actual database to the current Prisma schema:
  empty migration, with no schema drift within Prisma's supported representation.
- All 18 existing tables' row counts and whole-row fingerprints matched the
  immediately preceding state. For orders and OTP records, the comparison omitted
  only the newly added nullable columns. No fingerprints or customer rows were
  printed. Dynamic form definitions, steps, fields, options, validation/visibility
  rules, translations, and ordering records were included in these comparisons.
- Existing users, profiles, exact administrator role assignments, orders, OTPs,
  and sessions were preserved. All existing sequence positions were unchanged.
- Existing indexes, constraints, triggers, function, and enum definitions were
  preserved. The original image index retained its definition, validity, object
  OID, and physical file identifier.
- After the isolated integration tests, another read-only preservation comparison
  passed. The original new grant/rate-limit tables remained empty, confirming
  synthetic test writes did not reach the original database.

One follow-up metadata query initially assumed migration history was in `public`.
The deployment had already succeeded; discovery of the actual history schema
corrected that read-only query. No migration SQL was retried.

Prisma Client 5.22.0 was regenerated using the installed local engine and the
offline generator script, without loading the project environment or contacting
external services.

## PostgreSQL integration tests

Added `scripts/security.integration.mjs`: **33 passed, zero failures, zero skips**.
The final suite was rerun after strengthening its connection guard and passed.

Tests used only the retained, originally empty verification database
`dreamservice_baseline_20261017_27badf`, with the same migration history/schema and
synthetic fixtures. The suite refuses to run without an explicitly acknowledged
test database name/URL, requires loopback and a restricted disposable name prefix,
and rejects pre-existing non-fixture users. It never reads `.env`. The application's
Prisma singleton and a second independent client exercise actual PostgreSQL
transactions and races. Framework cookie access is adapted to per-browser async
contexts; SMS delivery is mocked and external HTTP is disabled. A dedicated
advisory-lock scenario bypasses only the separate issuance limiter to exercise
the database lock itself; shared rate-limit tests use the real implementation.

Coverage includes:

- Advisory-lock serialization of OTP issuance across purposes and clients;
  durable browser binding/delivery state; customer and exact `app-admin` OTP login.
- Concurrent wrong-code reservations stopping at five attempts; concurrent valid
  verification producing exactly one session; expiry, consumption, delivery,
  browser, purpose, and legacy-unbound rejection.
- Single-use registration grants under concurrent completion; browser/phone/
  purpose/expiry/replay rejection; real transaction rollback of account creation
  and proof consumption when session insertion fails.
- Public registration role-field rejection; own-profile exact role matching;
  case/whitespace variants denied; unrelated profiles denied; immediate synthetic
  role revocation; secure cookie options; session expiry, rotation, and logout.
- Shared atomic database rate budgets across independent clients.
- Database-driven English/Persian form translations with stable machine values;
  field/option/numeric/conditional-required validation; forged owner rejection.
- Durable customer-scoped idempotency, unique-key race recovery, fresh application
  instance replay, changed-body conflict, trusted order owner/status, customer
  isolation, exact administrator access, private responses, CSRF and role tampering.

Synthetic fixtures remain in the disposable database. No original application
data was used for test writes or cleanup, and no database was dropped.

## Project checks

| Check | Result |
| --- | --- |
| Prisma Client regeneration | PASS |
| PostgreSQL security integration | PASS: 33/33 |
| Existing security/localization automated tests | PASS: 122/122 |
| TypeScript `--noEmit --incremental false` | PASS |
| `npm run lint` | PASS: zero errors, five existing warnings |
| Production webpack build via offline runner | PASS |
| Git diff/changed-file formatting and applied SQL checksum | PASS; normal LF/CRLF notices |

Commands used for service-free checks:

```text
node scripts/prisma-offline.mjs generate
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
node --require ./scripts/no-services.cjs --test scripts/security.test.mjs scripts/i18n.test.mjs
node scripts/build-offline.mjs --webpack
```

Integration invocation is `node --test scripts/security.integration.mjs`, with
`SECURITY_TEST_DATABASE_URL` and `SECURITY_TEST_DATABASE_NAME` supplied in memory
by the approved local runner. Never paste a credential-bearing URL into commands,
logs, or documentation. The existing unit-test runner's first sandbox attempt
could not spawn workers; the approved rerun passed with network/service access
still blocked by its verification preloader.

The five existing lint warnings concern TanStack Table/React Hook Form compiler
compatibility, an existing image element, an unused component, and a hook
dependency. The build retains the existing Next.js middleware deprecation warning.
The default Turbopack builder was not rerun; the production webpack build passed.

## Remaining acceptance and changed files

There are no blockers to this completed local migration/database-test scope.
The broader security phase remains **PARTIALLY COMPLETE** until the documented
browser/HTTPS and deployment acceptance checks are completed. This suite exercises
real database behavior and actual server handlers with adapted cookie access;
it does not establish real-browser cross-tab cache isolation, proxy configuration,
HTTPS cookie transport, RTL/LTR visual behavior, or actual SMS delivery. No next
feature phase was started.

The backup predates the applied security schema/history. Keep it private; it is a
pre-migration recovery point. A future rollback would need compatible application
code. Restored private-data and synthetic verification databases remain local;
cleanup was not authorized or performed.

Files changed in this step: the pending security migration's transaction/timeout
wrapper, `scripts/security.integration.mjs`, this report,
`docs/security-migration-preflight.md`, and `docs/security-implementation.md`.
Generated Prisma Client/build artifacts are ignored local verification outputs.

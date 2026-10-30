# Phase 5 project management — 2026-10-29

Application implementation and local database activation are complete. All five
migrations are applied, with existing data and indexes verified intact. See the
[checksum correction and activation report](project-management-activation.md)
for exact hashes, recovery evidence and live integration results.
The subsequent [runtime recovery report](project-management-runtime.md) records
the running development server's stale Client correction, project-view hydration
fix, and complete verification with real browser/HTTP/PostgreSQL requests.

## Model and migration

`Project` lives in `entity.projects` with an optional unique `orderId`, English
and Persian titles/descriptions, the four project statuses, optional timezone-aware
start/deadline timestamps, public/homepage flags, and creation/update timestamps.
Both titles are required. The additive `202610290001_projects` migration creates
only the enum, table, indexes and constraints. It does not modify orders or prior
migrations. Its foreign key restricts order deletion; deleting a project cannot
delete its order. No project deletion endpoint is provided.

The partial unique index `projects_single_homepage_key` permits one selected
homepage project. Prisma cannot model this index or the SQL CHECK constraints;
retain them in future migrations. SQL also enforces date ordering and selected
projects having public visibility, an upcoming status and a deadline. Whether the
deadline is still in the future is checked on writes and public reads, rather
than using an unstable clock expression in a database CHECK constraint.

## Admin experience and security

- Routes: `/en/admin/projects`, `/fa/admin/projects`; discoverable from the
  existing account menu for admins.
- APIs: `GET/POST /api/admin/projects`, `PATCH /api/admin/projects/[projectId]`.
- Reuses DataTable, its filters/pagination/skeleton, shared form controls,
  dialogs, buttons, loading indicators and localized feedback.
- Creates independent projects or links an existing order number. The table
  and edit dialog show the linked order number/status to authorized admins.
- Supports bilingual details, dates, status changes, cancellation, visibility
  and replacing/clearing the homepage selection, with a save confirmation.
- New projects start `PLANNED`. `PLANNED → ACTIVE/CANCELLED` and
  `ACTIVE → COMPLETED/CANCELLED` are supported; terminal statuses stay final.
  Editing other information remains possible after completion/cancellation.
- Server guards retain exactly `PersonProfile.role === 'app-admin'`, existing
  session expiry/ban enforcement, origin checks, bounded JSON, Zod validation
  and per-admin mutation rate limits. Actor ban/role checks run again inside
  the mutation transaction.
- Project writes share the existing user-management advisory transaction lock
  and use READ COMMITTED. Concurrent homepage replacements serialize; the
  partial unique index independently prevents duplicate selections.
- Updates require the previous `updatedAt`; every edit or deselection advances
  it monotonically, including writes in the same millisecond. Stale edits return
  a localized conflict and require refreshing/reopening the project.
- Private project query caches are cancelled and removed on identity changes.
  No project action changes order status, dynamic forms or notification records.

## Homepage and notifications

The homepage queries the database on the server per request. Only public,
PLANNED/ACTIVE projects with a future deadline qualify. It automatically returns
the nearest deadline, with ascending project ID as the deterministic tie breaker;
the preserved `showOnHomepage` field does not control this public query. The
original static portfolio slider remains independent and appears above the
single upcoming-project card, whose countdown is inside the card. An explicit
projection returns only the locale's title, description and deadline, without
project/order/customer IDs or linked order details. Empty and temporarily
unavailable states are distinct, localized cards.

The client starts from the server timestamp to keep hydration deterministic,
then uses one timeout at a time to update from the absolute deadline. It counts
total days across months, stops at zero, stops scheduling updates at expiry,
and hides the notification form. The expiry message explicitly does not claim
launch/completion. No client timer changes business status. There is no project
polling. Open pages observe visibility/status changes on the next navigation or
refresh. Dates on the public countdown explicitly use UTC; admin date entry uses
the device's local timezone.

The existing active notification form had no subscription API: its submit handler
only reported unavailability. That behavior remains, with a clear localized
notice that submissions are not saved and existing subscribers are not linked
to a project. The form appears only during an eligible countdown. No subscriber
records were read/reassigned, and no SMS/email was sent. Project-specific
subscriptions remain a separate feature. The unused old countdown import path
now re-exports the server component, removing its second hardcoded deadline.

## Database safety and activation

The owner explicitly authorized resolving the historical checksum discrepancy
and activating Phase 5 after the recovery checks. Exact Git bytes from the
previously applied security migration matched the database checksum. Restoring
those bytes removed only a single extra ASCII space at EOF. No other historical
migration file or migration-history record was changed.

The fresh custom-format backup and complete private evidence are retained at:

`.backups/projects-activation-20261029125301723/`

The archive was verified and fully restored into a separate local database.
The Project migration was successfully trialled there, all original data and
objects were verified intact, and the seven live PostgreSQL integration tests
passed with isolated synthetic fixtures. Only then did standard Prisma
`migrate deploy` apply the exact trialled Project migration to the original local
development database. Final `migrate status` reports five migrations, up to date.

All 22 existing application tables retain identical counts and row fingerprints;
the four old migration records are unchanged, with one expected new record.
All 65 original index definitions, validity flags, OIDs and physical files, all
15 sequence states, and all existing columns/constraints/triggers/functions/enum
labels are intact. The only database additions are Project objects and its
migration record. The original Project table has zero rows; no fixtures were
created in the original database. Full details are in the activation report.

`scripts/projects-db-preflight.mjs` is deliberately read-only. It rejects targets
other than the known loopback `dreamservice` database, keeps credentials out of
argv/output, compares historical checksums and can create/verify an archive:

```powershell
node scripts/projects-db-preflight.mjs --backup
```

The historical checksum mismatch is resolved. The staged activation helper
records the expected new Project table/migration record while verifying the
preservation of all old data and objects across deployment. Its evidence uses
the complete catalog snapshot described in the activation report.

## Verification

- Prisma schema validation and Client generation passed. Generation uses an
  isolated schema without environment loading. The offline helper stages output
  and skips copying identical files, preserving a locked, identical Windows
  engine DLL without stopping the existing development server.
- TypeScript `--noEmit --incremental false` passed.
- ESLint passed with four pre-existing warnings (DataTable, DreamForm, plusCard,
  useRandomAutoplay); targeted new-feature lint passed without warnings.
- The production webpack build passed through the existing offline build helper.
  The existing middleware-to-proxy deprecation warning remains.
- `scripts/projects.test.mjs` has 22 passing tests: exact role denial, transactional
  ban/role revocation, validation, independent/link creation, duplicate links,
  lifecycle transitions, unchanged orders, stale edits, serialized selection
  fixtures, public projection, countdown boundary cases, localized upcoming/empty/
  expired rendering and private cache removal. Transaction-concurrency unit tests
  use in-memory substitutes; they are not live PostgreSQL race verification.
- The broader `scripts/*.test.mjs` regression suite passed: **265/265 tests** after
  the runtime follow-up, including seven new diagnostic/hydration regressions.
- Browser checks passed: **28 checks** for create/edit confirmation flows,
  localized tables, countdown expiry/form removal, English/Persian directions,
  desktop/mobile layouts, light/dark themes and reduced motion. These used a
  temporary app copy, a separate QA server, a fresh Chrome profile and intercepted
  synthetic API responses. This is UI verification, not live database integration.
  Screenshots and logs remain privately in
  `.backups/dreamservice-projects-browser-b6TTiD/`. The temporary source copy and
  QA processes were removed; the user's existing development server was untouched.
- The existing standalone localization scanner fails on the pre-existing missing
  `OrderWorkflow.tracking` key in `CustomerOrders.tsx`. Catalog parity/ICU checks
  complete before that failure; new feature locale tests pass.
- `scripts/projects.integration.mjs` passed **7/7 live PostgreSQL checks** with
  actual sessions, exact role/ban enforcement, synthetic users/orders, unique
  constraints, independent-client races, stale edits and public filtering. It
  ran against the verified isolated restore before original deployment. It never loads
  `.env`; both `PROJECTS_TEST_DATABASE_URL` and `PROJECTS_TEST_DATABASE_NAME` must
  explicitly identify a migrated local `dreamservice_projects_test_*` database
  with an empty Project table. Fixture records are retained there.
- `git diff --check` passes after the verified one-byte security migration
  correction. That file now exactly matches both Git and its applied checksum.

No dependencies, authentication semantics, order status transitions, customer
data, production infrastructure or Git history were changed. The sole historical
migration correction restored the exact already-applied Git bytes.

## Files changed in this phase

- Data: `prisma/schema.prisma` and
  `prisma/migrations/202610290001_projects/migration.sql`.
- Server: `src/schemas/project.ts`, `src/lib/admin/projects.ts`,
  `src/lib/projects/homepage.ts`, `src/app/api/admin/projects/route.ts`,
  `src/app/api/admin/projects/[projectId]/route.ts`.
- Admin UI: `src/app/[locale]/admin/projects/page.tsx`, its `loading.tsx`,
  `src/components/modules/admin/projects-view.tsx`,
  `src/components/modules/navbar/AuthButton.tsx`.
- Countdown: `src/components/templates/LaunchCountdown.tsx`,
  `src/components/templates/launch-countdown/ProjectCountdown.tsx`,
  `src/components/templates/launch-countdown/useCountdown.ts`,
  `src/components/templates/launch-countdown/LaunchCountdown.tsx`,
  `src/lib/projects/countdown.ts`.
- Shared integration: `src/lib/prisma.ts`, `src/lib/auth/client-state.ts`,
  `src/lib/api/errors.ts`, `src/lib/i18n/metadata.ts`, `messages/en.json`,
  `messages/fa.json`.
- Verification/documentation: `scripts/projects.test.mjs`,
  `scripts/projects.integration.mjs`, `scripts/projects-browser-smoke.mjs`,
  `scripts/projects-db-preflight.mjs`, `scripts/prisma-offline.mjs`,
  `scripts/prisma-cache.test.mjs`, and this report.
- Activation follow-up: verified one-byte correction to
  `prisma/migrations/202610170001_security_foundation/migration.sql`,
  `scripts/projects-activation.mjs`, and `docs/project-management-activation.md`.

Other files already modified when this task started retain their existing changes.

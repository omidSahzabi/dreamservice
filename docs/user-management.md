# Admin user management

Implementation prepared on 2026-10-24. The migration was subsequently **applied
and verified on the local database**; see the [recovery report](user-management-recovery.md).
The preparation notes below retain the original pre-activation verification scope.

## Behavior

- Localized `/en/admin/users` and `/fa/admin/users` pages use the shared DataTable,
  profile/details dialog, server pagination, identity search, access-role and account
  status filters. The account menu links to the page for administrators.
- Reads and mutations require the existing session and exact `app-admin` profile
  membership. The client also hides cached management data after identity/access
  changes; management query caches are cancelled and removed by existing cleanup.
- Promotion requires an active account with a verified phone number. Legacy users
  can establish verification through the existing OTP login flow. Demotion changes
  only exact `app-admin` assignments and preserves unrelated profile roles.
- Sensitive actions require a reason and confirmation. The server validates a
  strict action payload and expected role/ban state. Stale actions return a conflict.
  Self-ban and self-demotion are always rejected. The last active administrator
  cannot be banned or demoted. There is no user deletion endpoint.
- Mutations share a PostgreSQL transaction advisory lock, recheck the acting admin
  after locking, and count distinct active admin users rather than profile rows.
  Changes and audit creation commit atomically. Application code only creates
  audit records; there are no audit update/delete operations or endpoints.
- Shared database rate limiting permits 10 management mutation attempts per admin
  per minute. Existing origin, content-type and bounded-body checks apply.
- Ban checks cover OTP issuance, session establishment and every shared authenticated
  request, including customer orders and admin APIs. Ban/unban revoke all target
  sessions. Session insertion locks the same user row as account changes, preventing
  a concurrent login from inserting a usable session behind a committed ban.
- Existing sessions resolve roles from the database on each request. Unbanning
  never restores a revoked session. The account must authenticate again.
- User-management responses select account/profile fields explicitly and only the
  ten most recent order summaries. They exclude OTP material, session information,
  national identifiers, order metadata and full order descriptions.

## Database and preservation

`202610230001_user_management` adds one nullable `entity.users.bannedAt` column,
the `entity.user_management_audit` table and its target/time index, and a non-unique
`upro.person_profile(user_id, role)` index. New audit foreign keys restrict deletion
of referenced users. The SQL is transactional, with bounded lock/statement timeouts.
Existing migration files, application rows and indexes are unchanged by this work.
There is no backfill, reseed, table recreation or destructive statement.

At initial implementation, no database migration, backup, restoration, database
integrity snapshot or live database test was performed. That limitation was resolved
by the subsequent verified backup, isolated restoration and before/after integrity
comparisons documented in the recovery report. Historical backup verification alone
must never be treated as a current backup.

Before applying on a confirmed safe database, follow the project's existing
[backup and isolated restore procedure](security-migration-preflight.md):

1. Capture a private full custom-format backup, its checksum, and a read-only
   baseline of all existing table counts, row content and schema/index definitions.
   Keep private data and connection credentials out of logs and the repository.
2. Verify the archive and restore it into an isolated database. Verify the restored
   baseline before testing the additive migration there.
3. Review the SQL and apply through normal migration deployment only after backup
   and target verification. Never reset, force-push the schema or reseed.
4. Compare all pre-existing row contents/counts, migration history and indexes
   with the baseline; verify the new column is NULL for historical accounts and
   that the new audit table is initially empty.
5. Regenerate Prisma Client and restart application processes before serving the
   updated application. The migration must precede code that selects `bannedAt`.

Initial local client generation emitted the updated model metadata and TypeScript API,
but Windows refused replacement of the loaded engine DLL. Stop the process holding
that DLL and rerun `prisma generate` as part of activation. No user process was
stopped or terminated by the initial implementation. Subsequent Prisma Client
generation completed successfully without stopping unrelated processes.

## Verification and remaining manual checks

Executed checks:

- `node --test --test-reporter=dot scripts/*.test.mjs`: passed (entire suite).
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- `node node_modules/prisma/build/index.js validate`: passed.
- `npm run lint`: passed with no errors and five pre-existing warnings in the
  DataTable, dream form, about card, countdown component and autoplay hook.
- `npm run build`: passed, including both localized routes. The existing
  middleware-to-proxy deprecation warning remains. The first sandboxed attempt
  failed to spawn a worker; the unrestricted rerun completed successfully.
- `git diff --check`: passed. Git reports the repository's existing LF/CRLF
  conversion notices for edited files.

Automated coverage uses the existing Node test loader and transactional in-memory
Prisma substitutes. It covers access control, promotion/demotion, ban/unban, existing
session enforcement, self-action and last-admin guards, concurrent mutation outcomes,
audit rollback, payload validation, rate-limit denial, bounded read projections,
SQL parameter binding, order permissions, cache cleanup, and both locale renderings.
These concurrency tests do not replace real PostgreSQL locking tests.

After the migration is tested on an isolated database, verify concurrent mutations
and login/ban ordering against PostgreSQL. Check both locales in a browser, at mobile
and desktop widths, in light/dark themes: keyboard navigation, dialog focus/escape,
reason validation, filter clearing, pagination, stale-state recovery, and a second
browser session losing access after demotion/ban. No real SMS is required.

## Files

- `prisma/schema.prisma`, new migration above.
- `src/schemas/userManagement.ts`, `src/lib/admin/users.ts`.
- `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[userId]/route.ts`.
- `src/app/[locale]/admin/users/page.tsx`,
  `src/components/modules/admin/users-view.tsx`.
- `src/components/modules/navbar/AuthButton.tsx`, `src/lib/i18n/metadata.ts`,
  `messages/en.json`, `messages/fa.json`.
- `src/lib/auth/session.ts`, `src/lib/auth/otp.ts`,
  `src/lib/auth/client-state.ts`, `src/lib/api/errors.ts`,
  `src/lib/security/rate-limit.ts`, `src/lib/prisma.ts`.
- `scripts/security.test.mjs`, `scripts/user-management-ui.test.mjs`,
  `scripts/prisma-cache.test.mjs`, this report.

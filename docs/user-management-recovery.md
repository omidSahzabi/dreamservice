# Local admin user management recovery — 2026-10-24

## Cause and diagnosis

The local `localhost:5432/dreamservice` PostgreSQL 15.15 database had only the first
three migrations applied. `entity.users.bannedAt` and
`entity.user_management_audit` were absent. The shared session lookup introduced
by user management selects `bannedAt`; the missing column caused authenticated
requests to fail, with the safe HTTP error handler returning `500 / UNKNOWN`.
A read-only projection confirmed the missing column before migration. Migration
history resides in `entity`, not `public`.

No additional application defect remained in the tested API/browser flows after
the migration. Authentication and authorization were not bypassed or weakened.
No runtime source changes were required for this recovery.

## Backup and isolated restoration

The full custom-format backup is retained at:

`.backups/admin-users-20261023211225375/before-user-management.dump`

The directory timestamp uses UTC. The backup is 86,596 bytes. `pg_dump` completed
successfully, the archive is nonempty, and `pg_restore --list` verified its entries.
Its SHA-256 is retained in the adjacent `sha256.txt`; the checksum was reverified
immediately before migration deployment. `.backups/` is explicitly Git-ignored.
It contains private database artifacts and must not be committed or published.

A real full restoration succeeded into the separate local database
`dreamservice_restore_users_d404f4d05007`. All 22 original tables matched their
counts and sorted row-content fingerprints; all original columns and indexes
matched. No restoration was performed over the original database.

Following the established compatibility procedure, the PostgreSQL 18 client archive
was extracted without owner/privilege statements and restored atomically. Only the
unsupported `SET transaction_timeout = 0` setting was removed from the extracted SQL
for the PostgreSQL 15 server. The backup archive itself was not modified.

## Migration and preservation

The reviewed SQL adds one nullable `bannedAt` column, the audit table and its index,
and a non-unique user/role profile index. It contains no data rewrites, deletions,
table recreation, drops, truncation, or removal of existing indexes/constraints.
Previously applied migration files were not edited.

The migration was first trialled successfully on the restored copy. The current
original database still matched the pre-backup baseline immediately before deploy.
The exact SQL checksum matched the trialled file. The installed Prisma CLI then
ran `migrate deploy` successfully against the confirmed local target. `migrate status`
reports four migrations and an up-to-date database schema.

Before/after counts on the original database:

| Data | Before | After |
| --- | ---: | ---: |
| Users | 16 | 16 |
| Person profiles | 3 | 3 |
| Orders | 121 | 121 |
| Order status history | 1 | 1 |
| Images | 3 | 3 |
| Sessions | 1 | 1 |
| OTP records | 16 | 16 |
| Registration grants | 0 | 0 |
| Security rate-limit records | 20 | 20 |
| Forms / form translations | 1 / 1 | 1 / 1 |
| Steps / step translations | 6 / 6 | 6 / 6 |
| Fields / field translations | 19 / 19 | 19 / 19 |
| Options / option translations | 46 / 46 | 46 / 46 |
| Content / content translations | 0 / 0 | 0 / 0 |
| Blog posts / comments | 0 / 0 | 0 / 0 |
| Migration history | 3 | 4 |
| New management audit | absent | 0 |

All pre-existing application table contents matched, not just counts. The users
comparison excluded the additive column and separately verified that every new
`bannedAt` value is NULL. All three historical migration records also matched their
original contents. All 62 original index definitions and 180 original column
definitions remain present. The only expected data addition is the fourth
migration-history record. These checks were repeated after runtime verification.
Private baseline, restored and post-migration snapshots remain beside the backup.

## Client and runtime verification

Prisma Client 5.22.0 generation completed successfully. No DLL lock remained and
no existing development or unrelated processes needed to be stopped. Only temporary
QA servers and the temporary headless browser created by verification were stopped.

46 live checks passed. Authenticated tests used synthetic accounts and sessions
created solely in the isolated restored database, with real application routes and
database queries. They covered:

- Admin/customer `me`, anonymous/customer management denial, list pagination,
  identity search, role/status filters, and user details.
- Promotion/demotion affecting an already active session; ban revoking a session;
  order API rejection after ban; unban leaving the old session invalid; successful
  fresh session establishment after unban.
- Concurrent promotion producing exactly one success and one conflict, exactly six
  audit records for six successful fixture changes, self-ban denial, and management
  rate-limit enforcement.
- Authenticated English and Persian page responses, and a real Chrome browser
  hydrating the table and opening the details dialog on English desktop and Persian
  mobile viewports, with light/dark theme captures. No uncaught runtime exceptions
  were observed. Browser APIs were not mocked.

The original database received GET-only checks: anonymous `me`, both localized
admin pages and existing order/order-review pages returned HTTP 200. The Prisma
ban projection also succeeded against the original. No original user role, ban,
session, OTP, or order was changed by verification. No real SMS was sent; SMS was
disabled for every QA server. The isolated database and private QA evidence remain
available locally. Screenshots are private because the restored copy contains data.

This does not certify every interactive accessibility behavior or an existing
user's browser session. Refresh the local app after restarting any stale dev server.

## Quality checks

- Entire automated suite: `node --test --test-reporter=dot scripts/*.test.mjs` passed.
- Live API/browser verification: 46 checks passed.
- TypeScript: `--noEmit --incremental false` passed.
- Prisma schema validation and Client generation passed.
- ESLint passed with zero errors and five pre-existing warnings in unchanged files
  (DataTable, dream form, about card, countdown component and autoplay hook).
- Production build passed, including both localized admin routes. The pre-existing
  middleware-to-proxy deprecation warning remains.
- `git diff --check` passed; prior migration files have no changes.

There are no remaining migration or runtime blockers in the verified scope.

## Repository changes for this recovery

- `.gitignore`: excludes private `.backups/` artifacts.
- `docs/user-management.md`: updates the activation status.
- This report: records diagnosis, recovery, preservation and verification.

All pre-existing worktree changes were retained. No dependency installation,
production change, Git commit, push, database reset or backup deletion was performed.

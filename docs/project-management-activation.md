# Phase 5 checksum correction and local activation — 2026-10-29

The checksum blocker is resolved and the Project migration is applied to the
original loopback development database. Prisma reports **five migrations and an
up-to-date schema**. Existing application data and database objects are intact.

## Exact checksum findings

File: `prisma/migrations/202610170001_security_foundation/migration.sql`.

| Version | Bytes | SHA-256 |
| --- | ---: | --- |
| Worktree before correction | 1,260 | `1f151209e7225310b6c01352ffc67eb0066d0fc2f47fef50d31972ecb49b03de` |
| Recorded applied migration | — | `ed925212b89b51cfc2e591888f40ee663ef929cf7968d025f13c39890d45fffd` |
| Trusted Git blob and corrected file | 1,259 | `ed925212b89b51cfc2e591888f40ee663ef929cf7968d025f13c39890d45fffd` |

`git log` identified commit `bd6e22a6e2046a571bf0f95ee0dfc537163de5f1`.
Its migration blob and the `HEAD` blob both match the database's recorded
checksum exactly. The first 1,259 bytes of the worktree and trusted blob were
identical. The worktree then had one extra byte at zero-based offset 1,259:
hexadecimal `20`, an ASCII space on line 38 after the final newline. There were
no encoding, line-ending, SQL-content or other byte differences.

The matching Git blob was saved privately, checked against the recorded checksum
again, compared to the still-unchanged worktree, and written byte-for-byte to that
one migration file. No broad trim, newline normalization, Git checkout/reset,
or unrelated file restoration was used. The corrected file now has no Git diff.
All other pre-existing uncommitted work was retained.

`prisma migrate status` after correction reported four applied migrations and
only `202610290001_projects` pending, with expected exit code 1. No manual update
to `_prisma_migrations` or `prisma migrate resolve` was performed.

## Fresh backup and isolated restore

Private evidence directory:

`.backups/projects-activation-20261029125301723/`

The fresh `before-projects.dump` custom-format archive is **89,935 bytes**.
SHA-256:

`a2f03509bfbee5fea20f1e06476ce5774334019a0abd7f360445032896ca9a92`

`pg_dump` succeeded; `pg_restore --list` read the archive and found its table-data
entries. Its checksum was reverified before restoration and before deployment.
Private snapshots record all-table row counts and sorted whole-row fingerprints,
indexes/validity/physical identities, visible columns, constraints, triggers,
functions, enum labels, sequence state and complete historical migration records.
The original database was unchanged across backup capture.

The archive was fully restored atomically into the new, separate local database:

`dreamservice_projects_test_20261029_43109568da62`

No restoration occurred over the original. PostgreSQL 18 client tools restored
to PostgreSQL 15 using the established compatibility procedure: extracted SQL
omitted only `SET transaction_timeout = 0`, which PostgreSQL 15 does not support.
The backup archive itself is unchanged. Owner/ACL restoration was not exercised.

The first catalog comparison stopped on one existing audit CHECK's expression
representation. Its original constant `varchar[]`-to-`text[]` cast was represented
after restore as individual `varchar`-to-`text` element casts. Both expressions
specify exactly `promote`, `demote`, `ban`, and `unban`. Read-only PostgreSQL checks
proved the two constant arrays have identical values and type `text[]`. The
verification accepts only these two exact definitions for the specifically named
`entity.user_management_audit_action_check`, retaining all other constraint
properties. No constraint was removed or changed to resolve this comparison.
Original-database comparisons remain exact and accepted no normalization.

The complete restore comparison then passed: all row counts/fingerprints, sequence
states, historical records and other logical catalog objects matched. Visible
column positions are compared in order, since a restore compacts dropped-column
ordinal gaps. Physical index identities are compared before/after on each
database separately, rather than across two different databases.

## Trial and original deployment

Reviewed migration: `202610290001_projects`.
SHA-256:

`ba8d7a278c4e8febdac7d9895c1ac13afb4a013a3c8a6d3c50ae4d7728edd963`

The SQL contains only a bounded transaction, one new enum/table and new indexes
and constraints. It contains no old-table modification, data rewrite, deletion,
reset, reseed or destructive DDL. The same exact file was deployed first to the
restored database using Prisma, then verified against the pre-trial snapshot.
All existing contents, migration records, physical indexes and sequence states
remained intact. Trial `migrate status` returned exit code 0, up to date.

The live Project integration suite then passed on that isolated database, using
synthetic users, sessions and orders. No real users or orders were edited by tests.
External HTTP and SMS were disabled. Fixtures remain only in the isolated copy.

Immediately before original deployment, all migration-file hashes and the backup
checksum were rechecked, all four applied checksums matched, and the original
database still exactly matched its pre-backup snapshot. Only then did standard
`prisma migrate deploy` apply the Project migration to the original local database.
No migration-history record was written manually or marked applied artificially.

## Before/after integrity

| Data/object | Before | After |
| --- | ---: | ---: |
| Users | 16 | 16 |
| Person profiles | 3 | 3 |
| Orders | 121 | 121 |
| Order history | 1 | 1 |
| Sessions | 1 | 1 |
| OTP records | 16 | 16 |
| Registration grants | 0 | 0 |
| Rate-limit records | 20 | 20 |
| User management audit | 0 | 0 |
| Images | 3 | 3 |
| Forms / translations | 1 / 1 | 1 / 1 |
| Steps / translations | 6 / 6 | 6 / 6 |
| Fields / translations | 19 / 19 | 19 / 19 |
| Options / translations | 46 / 46 | 46 / 46 |
| Content / translations / blog posts / comments | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Migration records | 4 | 5 |
| Projects | absent | 0 |
| Indexes | 65 | 69 |
| Constraints | 65 | 70 |
| Visible columns | 189 | 202 |
| Triggers / functions / sequences | 10 / 1 / 15 | 10 / 1 / 15 |

All **22 existing application tables** match their counts and whole-row
fingerprints exactly. All four historical migration rows are identical; only
the expected Project migration record was added. All 65 original index
definitions, valid/ready flags, OIDs and physical file identifiers match. All
15 sequence values and `is_called` states match. Every old column, constraint,
trigger, function and enum label is unchanged. New objects are limited to the
Project table's 13 columns, five constraints, four indexes and four status labels.
The unique partial homepage-selection index is present, valid and ready.

Final `prisma migrate status` returned **exit code 0: Database schema is up to date**.
Five applied records match their on-disk migration checksums. No project fixture
was created in the original database; its homepage intentionally has no selected
project until an admin creates/selects one.

## Tests and changed files

- Live isolated PostgreSQL integration: **7/7 passed**, covering exact role and
  banned-session enforcement, independent/linked creation, duplicate links,
  transitions, stale-edit races, concurrent homepage selection with independent
  clients, the database unique index, public filtering and unchanged order status.
- Automated regression suite: **258/258 passed** after local activation.
- Prisma schema validation passed.
- New activation helper syntax and ESLint checks passed.
- `git diff --check` passed; the corrected security migration exactly matches Git.
- Phase 5's prior TypeScript/build/ESLint and 28 mocked-API browser checks were
  not repeated in this database-only follow-up; application source was unchanged.
  The previously reported localization scanner defect and four ESLint warnings
  remain outside this task.

Changes in this follow-up: the verified one-byte migration correction,
`scripts/projects-activation.mjs`, the activation status in
`docs/project-management.md`, and this report. The helper records staged safety
evidence and refuses original deployment without successful backup, restore,
trial, integration, checksum and original-data checks.

No reset, truncation, reseed, database deletion, real SMS/email, production access,
dependency installation, Git commit or push occurred. No existing server was
stopped. Recovery snapshots and the isolated database contain private copied data;
they are retained locally and must not be published.

# Security migration preflight — 2026-10-17

This is the historical accepted preflight record. The owner subsequently approved
and completed security migration application and local database verification;
see [current migration results](security-migration-verification.md). The pending
state, SQL checksum, and approval gates below describe the pre-application state.

**Approved preflight remediation completed. Security phase remains PARTIALLY COMPLETE.**

The owner identified the configured target as a local test database and required
preserving all existing rows, especially `entity.users` and
`upro.person_profile`. The connection was read internally from `.env`
`DATABASE_URL`; credentials and the connection URL were not printed or changed.
The endpoint is loopback port 5432, serving PostgreSQL 15.15. The owner subsequently
approved index reconciliation, baseline establishment, and isolated backup restore
verification, while explicitly withholding security migration application on the
original database. That latest restriction supersedes earlier application approval.

The original database received only Prisma migration-history metadata for the
verified baseline. Application data, application schema, administrator assignments,
and the existing image index were not changed. All original application-table
inspection used read-only connections with bounded statement/lock timeouts.

## Findings

- Initially neither a database `_prisma_migrations` table nor a complete repository
  baseline existed. The verified baseline is now registered as described below.
- Existing `entity.otp_verifications`, `entity.orders`, `entity.Session`, and
  `upro.person_profile` were inspected. Required OTP enum values are present.
  The proposed security tables and four new nullable columns are absent.
- Comparing the actual database to the committed pre-security Prisma schema
  found one difference: the database already has this additional index:

  ```sql
  CREATE INDEX images_owner_id_type_idx
    ON entity.images USING btree ("ownerId", type);
  ```

  Prisma's diagnostic diff proposed dropping this index. That diff was saved
  outside the repository and **was not executed**. The index is now represented
  directly on `Image` in Prisma:

  ```prisma
  @@index([ownerId, type], map: "images_owner_id_type_idx")
  ```

  The baseline SQL includes the existing index. On the original database, its
  definition, validity, object OID, and physical file identifier match the values
  recorded before remediation. It was not dropped, recreated, or modified.
- The approved security migration itself is additive: it contains no row
  updates/deletes, drops, resets, or table recreation. The nullable additions
  preserve historical rows. PostgreSQL permits multiple NULL idempotency keys
  in the customer-scoped unique index.
- `ALTER TABLE` requires exclusive table locks. Ordinary `CREATE INDEX` scans
  orders and blocks writes while building the index. Application must use a
  transaction and bounded lock/statement timeouts after baseline approval.

## Recovery artifact

A full custom-format `pg_dump` backup was created in the current user's temporary
directory, outside the repository:

`<user-temporary-directory>/dreamservice-security-preflight-XVoLIB/before-security.dump`

- Size: 76,145 bytes.
- SHA-256: `21D451BB74C7C9284A30DBBC60866BD920133337AAD153FF0CB44614CBBB5110`.
- `pg_restore --list` successfully read the archive and found table-data entries.
- Schema extraction from the archive succeeded without a database connection.
- **Full isolated restoration passed**, including all-table integrity comparisons.
- The backup contains private database contents. Keep it private and retain it
  until recovery and migration verification are finished; do not commit it.
- Installed client tools are PostgreSQL 18.1; the server is 15.15. The restore was
  extracted with `pg_restore --no-owner --no-privileges` and applied atomically
  with `psql --single-transaction` to a new database. Only the extracted SQL's
  unsupported `SET transaction_timeout = 0` session setting was omitted for
  PostgreSQL 15 compatibility. The original archive and checksum are unchanged.

The same private temporary directory holds verification scripts, diagnostic SQL,
catalog snapshots, tool output, and the compatible restore SQL. No customer rows,
session tokens, OTPs, or credentials were printed or added to the repository.

## Restore and baseline verification results

Two newly created local databases are retained; no database was dropped:

- `dreamservice_restore_20261017_6c1de1`: full restored backup with verified baseline
  history. This contains private copied data and must remain private.
- `dreamservice_baseline_20261017_27badf`: empty application tables recreated using
  the baseline SQL, with the security trial fully rolled back and no migration
  history registered.

Verification passed for 18 tables, 146 visible columns, 54 indexes, 51 constraints,
10 triggers, one function, six enum types, and 15 sequences. Logical catalog
definitions matched across the original, restored, and baseline-recreated schemas.
All indexes were valid/ready and all constraints validated. Restoring normally
compacts historical dropped-column ordinal gaps; visible column order, names,
types, nullability, identity definitions, and defaults were compared instead of
requiring identical physical attribute numbers.

Every table's row count and sorted whole-row fingerprints matched between the
original and restored database. Comparisons included users, profiles/roles,
sessions, OTP records, orders, and database-driven forms. Fingerprint values and
customer data were not printed. All sequence values and `is_called` states matched.
Explicit restored-data checks found zero violations across all nine CHECK
constraints and eleven foreign keys. Original application catalog, row
fingerprints, and sequence states were verified unchanged after baseline
registration.

## Baseline strategy and migration history

Files, in deployment order:

1. `prisma/migrations/202610160001_existing_schema_baseline/migration.sql` captures
   the actual pre-security schema, including the image index, existing CHECK
   constraints, function, and update triggers that Prisma does not fully model.
   It contains no customer data or historical row changes. New empty databases
   can execute this SQL; populated databases must never execute its table-creation
   statements. The baseline uses one transaction and bounded timeouts.
2. `prisma/migrations/202610170001_security_foundation/migration.sql` remains the
   original reviewed additive security migration, unchanged and pending on the
   original database.

The baseline was first applied only to the new empty verification database. After
full catalog parity and restoration checks passed, `prisma migrate resolve
--applied 202610160001_existing_schema_baseline` registered it on the restored
clone, then on the original database. CLI commands used private isolated copies
of the exact repository schema/migrations and in-memory connection configuration.
The original baseline creation SQL was never executed on the populated database.

Both registered histories contain exactly one finished, non-rolled-back baseline
record with the file's verified checksum. No historical migration records were
invented or overwritten, and the security migration was not marked applied.
`prisma migrate status` reports only the security migration pending; its exit
code 1 is expected for an unapplied migration, not a migration execution failure.

Baseline SHA-256:
`2937C49EDF52592B57E82B6525E0BF7571709BFBB5FC12E1EB012A08766114DC`.

## Drift and security compatibility

- Prisma schema validation passed.
- Read-only Prisma diffs against the reconciled **pre-security** schema were empty
  for the original, restored, and baseline-recreated databases. The original
  post-registration diff was also empty. The current application schema still
  differs by the intentionally pending security additions.
- Separate raw catalog comparisons cover CHECK constraints, triggers, and the
  function that Prisma's diff does not fully validate.
- The expected Prisma security delta contains no destructive statements.
- The exact unchanged security SQL executed successfully in a bounded transaction
  on the empty baseline verification database. Catalog checks verified both new
  tables, the four nullable legacy columns, purpose default, and customer-scoped
  unique index. The transaction was rolled back; the database then exactly matched
  its pre-trial snapshot.
- Final original-database inspection confirmed neither new security table nor any
  of the four security columns exists there. No security migration was applied.

Security migration SHA-256 remains:
`AD52A28901D43D0E4CB275C8A09166A3270B9C04E0927C3D531D748FBDB6571E`.

## Remaining risks and next approval

- Stop here: the latest owner instruction requires confirmation before applying
  the security migration to the original database. No `migrate deploy`,
  `migrate dev`, `db push`, reset, seed, real SMS, commit, or push ran.
- The original backup predates the new baseline-history metadata. Restoring it
  recovers the verified application state; the verified baseline would need to be
  registered again. Refresh recovery evidence before a later migration if data
  or schema changes in the meantime. Retain the archive outside temporary-file
  cleanup before relying on it for long-term recovery.
- Restore verification used the connected role and omitted owner/ACL restoration.
  Cluster roles, deployment permissions, original-database overwrite recovery,
  and production recovery were not exercised.
- The security SQL still requires exclusive ALTER locks and a nonconcurrent
  orders-index build when eventually applied. The disposable empty-table trial
  does not measure lock contention or populated-index build duration. An original
  application run must wrap it in a transaction with bounded timeouts; the file
  itself has no transaction wrapper.
- Preserve the named image-index directive in Prisma. Future migrations must also
  preserve the baseline-only CHECK constraints/function/triggers; review SQL and
  compare raw catalogs before table changes because Prisma cannot fully track
  those objects.
- Database-backed authentication/concurrency/ownership integration tests and
  affected browser/HTTPS flows remain unverified. This remediation verified
  backup recovery and migration compatibility, not application security flows.
  No application source changed in this remediation; build and previous mocked
  regression tests were not rerun.

Changed in this remediation: `prisma/schema.prisma`, the new baseline SQL,
`prisma/migrations/migration_lock.toml`, this report, and
`docs/security-implementation.md`. The security SQL is unchanged. `git diff
--check` passed with the repository's normal LF/CRLF conversion warnings. A direct
whitespace scan of all five remediation files and a final check of the registered
baseline checksum also passed. A preliminary one-off Git setting treated CRLF
terminators as trailing whitespace; the repository-default check above resolved
that diagnostic without rewriting existing files.

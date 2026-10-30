# DreamService V1.0 — Phase 1 fixes and identity migration status

Verified on 2026-10-30. This report continues the existing implementation; it does not replace the original audit in `docs/v1-release-audit.md`.

**All 10 confirmed audit defects have code fixes and verification. The approved identity migration is now applied and verified on the original LOCAL development database. Existing application records and historical order duplicates remain untouched.** No production/staging changes, deployment, real SMS/email, commit, or push occurred.

## Final approved LOCAL activation — applied and verified

Applied **only `202610300001_account_identity`**, with the explicitly approved SHA-256 **`e5b420d9f431047205890cd4922348f329446cbf50b155d2ebe0227ebe561b03`**. Prisma recorded successful completion at **2026-10-30 15:49:56.207899 UTC**, one applied step, no rollback. `prisma migrate status` reports **7 migrations and database schema up to date**. There are no pending migrations in the inspected migration set.

The target was the original `dreamservice` database reached through loopback port 5432. Read-only Docker inspection verified the local Docker Desktop named-pipe engine, container `bugline-postgres` (`407bf8ad0d88`), bridge address `172.18.0.2`, and published host port 5432. No staging or production database was contacted. All post-apply integrity checks on the original were read-only; all mutation tests used the disposable database.

### Fresh backup and trial before application

- Private evidence directory: **`.backups/v1-phase1-approved-20261030T153245864Z`**.
- Fresh `before-phase1.dump`: **109126 bytes**, SHA-256 **`d5e65ad8eb1bbc65bf0988c4f6104b2100ba0236a8bbef62c2cc4632265655e1`**. Archive listing, full restore, and checksum verification passed.
- Fresh disposable restore: `dreamservice_phase1_test_dd7df83ac1b24a569dd99c2e3d43af58`. Only the identity migration was pending and applied there. Trial data/schema preservation checks passed before fixture mutations.
- Corrected-rule identity preflight found **0 canonical-phone conflict groups and 0 username conflicts**. The original had no partial identity objects. All six historical ledger entries were complete and matched unchanged migration files.
- All **15 PostgreSQL integration scenarios passed again**, with no skipped tests: username/canonical uniqueness, concurrent equivalent registration, mocked OTP/login, authorization, idempotency, and historical-order protection. No live provider calls occurred.
- Immediately before original application, another read-only snapshot matched the saved original baseline, and the archive checksum and all seven migration file checksums were rechecked.

Application used `prisma migrate deploy` with a private verified schema/migration copy containing exactly the six already-applied historical migrations and the one approved identity migration. No unrelated pending migration could be selected from that copy. Root and copied migration files were checked against the approved hashes. No reset, seed, manual ledger edit, or `migrate resolve` was used.

### Original before/after integrity

| Item | Before | After | Verification |
| --- | --- | --- | --- |
| Users | 16 | **16** | All pre-existing column values/fingerprints preserved; all 16 new username values NULL |
| Person profiles | 3 | **3** | Full row fingerprints preserved |
| Orders | 121 | **121** | Full row fingerprints preserved, including all 49 historical open orders |
| Projects | 1 | **1** | Full row fingerprints preserved |
| Support tickets | 1 | **1** | Full row fingerprints preserved |
| Ticket messages | 1 | **1** | Full row fingerprints preserved |
| Ticket notifications | 1 | **1** | Full row fingerprints preserved |
| Images | 3 | **3** | Full row fingerprints preserved |
| Applied migration records | 6 | **7** | Six historical records preserved in full; only the approved entry added |
| Indexes | 84 | **86** | All 84 existing definitions/states preserved; exactly two approved indexes added |
| Sequences | 16 | **16** | Definitions, `last_value`, and `is_called` unchanged |

Snapshots covered **27 tables** across `entity`, `upro`, and `public`. Every pre-existing application-table row count/fingerprint matched, comparing existing user columns separately from the newly added NULL username. Existing order status distribution, relationships, table set, column definitions/positions, constraints, functions, triggers, and enums remained intact. The only schema additions were the nullable username column, username-format check, two identity unique indexes, and canonical-phone function. No order index was introduced.

Relationship checks returned **zero** orphan order owners, profiles, project/order links, ticket owners, history entries, PROFILE image owners, or wrong-owner ticket/order links. The original's existing column positions and constraint definitions were compared strictly before/after and remained unchanged.

### Identity and application compatibility after apply

- `users_username_key` and `users_canonical_phone_key` are **unique, valid, and ready**. Their definitions match the successfully tested trial. The username CHECK is validated; the canonical function is immutable and STRICT.
- Original-data SELECTs found **0 username conflict groups and 0 canonical-phone conflict groups**. All existing usernames remain NULL; no backfill or user merge occurred.
- An additional **529-case immutable-function SELECT** against the original produced **0 normalization mismatches**, without creating records. Duplicate-insert rejection and concurrent registration enforcement were exercised only on the disposable database.
- Actual generated Prisma Client and application profile/phone-lookup services successfully read the updated original schema. All five valid legacy contacts resolved to their same existing UUIDs. The original session, OTP, grant, rate-limit, and profile rows were preserved; no original login or OTP mutation was performed for verification.
- Mocked OTP issue/verify/session flows passed on the disposable database for canonical, international, and ten-digit legacy storage with NULL/populated usernames. Stored contacts and UUID identity semantics remained intact.

### Restore diagnostics and remaining risks

The expanded restore comparison initially flagged two representation differences: the source has a pre-existing dropped attribute slot 5 that logical restore compacts, and an existing user-management CHECK deparses with equivalent array casts in a different position. Read-only diagnostics verified the same relative column order and exactly the same four action literals/NULL behavior (8 truth-table inputs, 0 differences). The trial checker accounts only for these exact restore representations. Strict original before/after comparison still proved its existing ordinals and CHECK text unchanged; no constraint or migration was weakened to make the check pass.

The **9 invalid legacy contacts** remain unchanged and excluded from the canonical expression index; 2 contacts are null and 5 are valid, including 3 stored noncanonically. The **49 historical open orders** remain intact and block new submissions for their owner through the existing transactional policy; no strict unique-open-order index was added. Arbitrary noncooperating database writers remain outside that application locking guarantee. These are unchanged documented limitations, not unresolved migration failures.

**Final Phase 1 identity status: approved LOCAL activation complete and verified. No further approval is needed for this completed migration.** Production deployment/provider verification and other previously documented product/release decisions remain outside this task. Only this report was authored in the repository during activation; application code, environment files, and all migration files remained unchanged. Private backups, snapshots, logs, and archived verification helpers were retained as evidence.

The following sections retain earlier implementation and approval history. Their pre-activation statuses describe those earlier checkpoints; this final activation result is authoritative.

## Phone correction checkpoint — verified before renewed apply approval

The user authorized correcting the normalizer, deterministic regressions, and the then-unapplied identity migration, with no original-database writes during that correction task. **All 15 disposable PostgreSQL scenarios passed (the original 14 plus one OTP login scenario), and all 286 unit tests passed.** The corrected migration was pending at that checkpoint; renewed approval and original application are recorded in the final section above.

### Root cause and corrected contract

Both implementations previously interpreted a leading `98` as a country code before examining the complete number. A ten-digit national number such as synthetic `9812345678` was shortened incorrectly instead of canonicalizing to `09812345678`. Arbitrary non-digit stripping could also accept malformed strings containing letters or misplaced plus signs.

TypeScript and SQL now validate permitted formatting first and distinguish these complete digit structures:

| Input structure | Digit count | Canonical result |
| --- | --- | --- |
| `9` followed by nine digits | 10 | Prepend `0`, including national numbers starting with `98` |
| `09` followed by nine digits | 11 | Keep unchanged |
| `98` followed by a ten-digit national mobile number | 12 | Replace country code with `0` |
| `+98` followed by a ten-digit national mobile number | 12, excluding `+` | Replace country code with `0` |
| `0098` followed by a ten-digit national mobile number | 14 | Replace international prefix/country code with `0` |

ASCII, Persian, Arabic, and mixed supported digits normalize identically. ASCII spaces, single separating hyphens, and balanced non-nested parentheses enclosing digit groups remain supported. An explicit `+` must lead a valid international form. Extra zeros, incorrect lengths/prefixes, letters, misplaced/repeated plus signs, empty/unbalanced/nested parentheses, repeated/edge hyphens, controls, unsupported separators, and other junk are rejected rather than stripped into an identity. The lexical expressions use mandatory separators between repeated digit runs to avoid ambiguous repeated matching.

Invalid input throws through the existing TypeScript API contract; SQL returns NULL, including STRICT handling of a NULL input. PostgreSQL cannot represent a NUL byte in TEXT; its transport rejection is tested separately. Existing OTP purpose, browser binding, proof consumption, ban checks, session creation, roles, and account UUID semantics were not changed. OTP issue/verify and registration continue using the same shared helper and existing canonical account lookup.

### Exact authored files changed in this correction

| File | Change |
| --- | --- |
| `src/lib/auth/helper.ts` | Explicit lexical validation and full-length mobile-format normalization; email/OTP generation unchanged. |
| `prisma/migrations/202610300001_account_identity/migration.sql` | Only the `entity.canonical_iran_mobile` function changed. A byte comparison against the prior migration copy verified everything outside that function is unchanged. No historical migration, user data, order rule/index, or other identity object was modified. |
| `scripts/phone-normalization-fixtures.mjs` | Shared deterministic synthetic cases: 480 valid variations and 50 invalid inputs, including national `98`, leading-zero boundaries, digit scripts, formatting, malformed strings, and long invalid input. |
| `scripts/v1-phase1.test.mjs` | Two normalization regressions covering every shared valid/invalid case and canonical idempotence. |
| `scripts/v1-phase1.integration.mjs` | Expanded the existing SQL parity/unique-index and concurrent-registration scenarios; added a real OTP/session regression with mocked SMS. NUL transport rejection is asserted separately. All 14 existing scenarios retained. |
| `docs/v1-phase1-fixes.md` | Current evidence, checksum, outcomes, and renewed approval gate. |

### Revised checksum

Migration name remains **`202610300001_account_identity`**; no additional migration was created.

- Previous SHA-256: `b8090e09ba1e93758050ea48754d1ed0f81fa6326bd2dfc86cba83cc017b283b`.
- **Corrected SHA-256: `e5b420d9f431047205890cd4922348f329446cbf50b155d2ebe0227ebe561b03`.**

The checksum changed because the function now validates formatting and matches complete structures instead of ambiguously stripping prefixes. The six applied historical migration files still match their ledger checksums. At this correction checkpoint the original still had six applied migrations and no identity activation. The corrected checksum matches the exact migration subsequently approved, trialed, and applied above.

### Fresh preflight, backup, restore, and integrity

Read-only original-database checks reconfirmed the local Docker/loopback target, six unchanged historical migrations, and only the corrected identity migration pending. Corrected-rule canonical-phone conflicts: **0 groups**; username conflicts: **0** (column absent). All 5 previously accepted legacy contacts retain the same canonical value; **0 newly rejected, 0 newly accepted, 0 changed canonical identities**. Of 16 users, 2 contacts are null, 5 valid (3 stored noncanonically), and 9 invalid. No contact was printed or rewritten.

Final private evidence directory: **`.backups/v1-phase1-phone-final-20261030T152257178Z`**.

Fresh backup `before-phase1.dump`: **109126 bytes**, SHA-256 **`1be7db0838740b50f8151e3739d39056f1cd0582777f46103c8fd50a18da69e6`**. Archive listing, a full isolated restore, and checksum re-verification passed. Final disposable database: `dreamservice_phase1_test_45b17170e62a4b3a9d8c68316a634e10`.

Before fixture mutations, the restore and corrected migration trial preserved every saved existing application-table row fingerprint/count, index definition, sequence value, and all six historical migration records. Prisma reported **seven migrations applied and schema up to date on the disposable database only**. Baseline application counts remained users **16**, profiles **3**, orders **121**, projects **1**, tickets/messages/notifications **1 each**, and images **3**. Existing usernames were all NULL. All 16 legacy contacts had matching SQL/TypeScript results; actual application account lookup resolved all five valid contacts to their existing UUIDs and read the updated username schema successfully.

Relationship SELECTs found zero orphan order owners, profiles, project/order links, ticket owners, history entries, PROFILE image owners, or wrong-owner ticket/order links. After disposable mutation tests, the original database was rechecked against the fresh baseline: **all original row fingerprints, existing indexes, sequences, historical migration records/files, and backup checksum matched**. The 49 historical open orders remain untouched; no strict open-order unique index was added. Fixture writes were confined to disposable databases.

### Final checks

| Check | Latest result |
| --- | --- |
| Full unit suite, `node --test --test-reporter=dot scripts/*.test.mjs` | **286 passed, 0 failed**, including both new deterministic unit regressions. |
| PostgreSQL integration, `node scripts/v1-phase1-run.mjs integration .backups/v1-phase1-phone-final-20261030T152257178Z` | **15 passed, 0 failed**: all original 14 scenarios plus new OTP login regression. |
| SQL/TypeScript contract matrix | **529 matching rows**: 480 valid variations and 49 SQL-representable invalid inputs (undefined maps to SQL NULL). The remaining NUL input is rejected by TypeScript and by PostgreSQL transport with SQLSTATE `22021`, asserted separately. |
| Database uniqueness | Duplicate canonical, ten-digit national, bare-country-code, and `0098` contacts rejected by the canonical unique index without changing the existing account. Existing username conflict/format checks passed. |
| Concurrent equivalent registration | National `98…`, `+98…`, and `0098…` requests raced on two Prisma connections: **one account, one session, two safe HTTP 409 responses**. |
| OTP/login | Three real request/verify/session flows passed with mocked SMS: canonical legacy contact, international legacy storage, and ten-digit legacy storage; NULL and populated usernames covered. Each resolved the same UUID, retained stored contact/username, added no registration grant/account, and rejected proof replay. Malformed input created no challenge or delivery. **No real provider calls.** |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **PASS**. |
| Prisma validation | Existing no-services preloader plus Prisma validate: **PASS**, schema unchanged. |
| ESLint | `npm.cmd run lint`: **PASS**, 0 errors, the same 3 existing warnings. Final changed integration file also passed a targeted lint check. |
| Original preservation and historical checksums | SELECT-only `verify-original`: **PASS**. No original migration or record writes. |

The first expanded parity batch encountered PostgreSQL's inability to encode NUL inside JSON/TEXT. The test was corrected to assert that boundary rejection separately; a clean restore then passed the entire suite. Earlier scratch restores/logs were retained privately. No database reset, deletion, or fixture cleanup against the original was used. No build/browser rerun was needed for this non-UI correction; earlier browser/build evidence below applies to the prior application state, not a newly built corrected bundle.

### Readiness and remaining risks

At this correction checkpoint the normalization blocker was resolved and the corrected migration was ready for renewed LOCAL approval, with original activation still gated. That approval was subsequently granted and completed above. The 9 invalid legacy contacts remain unchanged/excluded from canonical uniqueness, and strict parsing intentionally rejects malformed input that arbitrary character stripping previously accepted; no previously accepted original contact lost compatibility. Historical open-order duplication and the transactional enforcement policy below are unchanged.

**Decision at the correction checkpoint:** stop and request renewed approval for the corrected checksum. Approval was then given, and only those bytes were applied in the final activation above. No deployment, production/staging action, real SMS/email, commit, or push occurred.

## Previous approved activation attempt — stopped before original apply

The user approved applying only the previous bytes of `202610300001_account_identity`, subject to fresh safety checks. On 2026-10-30 that disposable integration run exposed a normalization defect, so activation was **stopped before any original-database DDL or data writes**. Activation was blocked at that point. The subsequent authorized correction and latest passing verification are recorded above.

### Preflight and local target

- The configured connection uses loopback port 5432 and database `dreamservice`. PostgreSQL reports `172.18.0.2/32` because it runs inside Docker. An initial loopback-only server-address assertion stopped preflight; read-only inspection then verified the local Docker Desktop named-pipe engine, container `bugline-postgres` (`407bf8ad0d88`), its bridge IP `172.18.0.2`, and its published host port 5432. No database changes occurred during that investigation. Preflight was rerun using this verified mapping.
- All six historical migrations were completed, not rolled back, and matched their recorded/file checksums. Only the identity migration was pending. Its exact SHA-256 remained `b8090e09ba1e93758050ea48754d1ed0f81fa6326bd2dfc86cba83cc017b283b`; its username/function/index/check objects were absent from the original.
- Canonical-phone duplicate groups were **0**, using the existing normalizer; there were no username conflicts because the column was absent. The same 16-user breakdown remained: 2 null, 5 accepted contacts (3 noncanonical), and 9 rejected legacy values. These counts must be recomputed under any corrected normalization rule.
- SQL inspection confirmed additive identity objects only: no record updates/deletes/merges, order changes, or strict open-order unique index.

### Fresh backup, restore, and migration trial

Private evidence: `.backups/v1-phase1-identity-20261030T145557608Z`.

Fresh archive: `before-phase1.dump`, **109126 bytes**, SHA-256 **`d2471a7c41f4261ee725ac05f3fee68506bb31ec632ef3b4fc595f8a226163e4`**. Archive listing and a successful full isolated restore verified usability. The restored database was `dreamservice_phase1_test_ccfb67bd9fdf47feac5bba58dc319ceb`.

Before fixture tests, the restore matched all saved application-table fingerprints, existing index definitions, sequence values, and migration records. Only the pending identity migration was then applied to this disposable database; Prisma reported all seven migrations up to date. Post-trial comparisons preserved all pre-existing data and six historical ledger records; existing usernames were all NULL. Thus the DDL trial succeeded, but the subsequent functional suite did not.

### Confirmed blocker and reproduction

The fresh real-PostgreSQL integration suite finished **13 passed / 1 failed**. The failure was `equivalent Iranian phone forms normalize identically and the database rejects canonical duplicates`. The generated disposable fixture had a ten-digit local mobile form beginning with `98`. A SELECT-only follow-up confirmed this was the failed fixture, without printing its phone number.

`src/lib/auth/helper.ts:19` handles a leading `98` as a country prefix **before** recognizing a ten-digit local number. The proposed SQL function does the same at `prisma/migrations/202610300001_account_identity/migration.sql:23`. Both therefore reject some ten-digit local forms that their supported canonical/international forms accept. This is a shared application/SQL normalization defect, not a uniqueness collision or migration execution failure. Random fixture prefixes explain why earlier integration runs passed.

Deterministic synthetic reproduction (no OTP or provider call):

| Synthetic input | Actual application result | Actual SQL result on disposable database | Intended equivalence |
| --- | --- | --- | --- |
| `09812345678` | Accepted | Accepted | Canonical local form |
| `+989812345678` | Same canonical value | Same canonical value | International form |
| `9812345678` | Rejected | NULL | Ten-digit local form should resolve to the same canonical value |

The other 13 scenarios passed, including username race/format checks, concurrent equivalent-phone registration, historical-order blocking/preservation, and authorization. The failed equivalence scenario stopped before completing its duplicate-insert assertions, so this attempt does **not** certify full canonical-phone behavior. No OTP/login mutation probe, original apply, or post-apply application test was run after the failure. No helper, test source, migration file, or application code was changed to hide or bypass it.

### Original integrity after the stopped attempt

SELECT-only `verify-original` against the fresh baseline confirmed all saved table fingerprints, existing indexes, sequences, six historical ledger records/files, and archive checksum remained unchanged:

| Table | Before | After stopped attempt | Existing row fingerprints |
| --- | --- | --- | --- |
| `entity.users` | 16 | 16 | Match |
| `upro.person_profile` | 3 | 3 | Match |
| `entity.orders` | 121 | 121 | Match |
| `entity.projects` | 1 | 1 | Match |
| `entity.support_tickets` | 1 | 1 | Match |
| `entity.support_ticket_messages` | 1 | 1 | Match |
| `entity.support_ticket_notifications` | 1 | 1 | Match |
| `entity.images` | 3 | 3 | Match |
| `entity._prisma_migrations` | 6 | 6 | Match |

All other saved application tables also matched. All 49 historical open orders remain intact. The original still has no username column, and the approved migration remains pending. Fixture mutations occurred only in the disposable database. No real SMS/email, seeds, resets, deployments, commits, or pushes occurred.

**Decision at that stop:** request authorization for a focused normalizer/SQL correction and deterministic tests, then repeat verification and obtain renewed approval for changed migration bytes. That correction is now authorized and verified in the latest section above. No original apply occurred in either task.

## Audit finding status

| ID | Original severity | Final status and implementation | Verification |
| --- | --- | --- | --- |
| DSV1-001 | HIGH | Fixed. Order decisions, submission, and explicit notification-retry claims recheck current authorization inside their transaction. `src/lib/auth/mutation.ts:8` acquires the shared management advisory lock, locks the actor's user row, checks bans, and, where required, checks exactly `PersonProfile.role === 'app-admin'`. Management retains its exclusive lock. Notification delivery follows the committed decision/claim. | Two real PostgreSQL connections exercised committed bans/demotions against in-flight operations; denied operations produced no order change/history/delivery. Retry claims remained deduplicated. |
| DSV1-002 | MEDIUM | Fixed. `src/app/api/order/submit-order/route.ts:29` limits new submission attempts to 20 per account per 60 seconds, before expensive form validation. Already committed matching idempotency retries return before consuming this budget. Safe localized rate-limit feedback includes `Retry-After`. | Real concurrent requests exercised the limit, free committed retries, changed-payload conflicts, and one-order serialization. |
| DSV1-003 | MEDIUM | Fixed. `src/components/modules/support/support-view.tsx:69` supplies ticket-specific page sizes 10/20/30/50. The shared table retains other consumers' defaults. `src/components/modules/data-table/data-table.tsx:207` keeps pagination available during an error so an invalid selection can be corrected. | Unit checks and authenticated customer/admin ticket browser checks in both locales passed. |
| DSV1-004 | MEDIUM | Fixed. Admin project controls/copy no longer promise manual homepage selection. `src/components/modules/admin/projects-view.tsx` and both catalogs explain automatic nearest-deadline selection. Legacy `showOnHomepage` remains in the schema/history; optional order links remain supported. Editing a legacy-selected expired project is not incorrectly blocked by a new-selection validation. | Localization/unit checks passed. Homepage retained one separate countdown card and the original portfolio. `src/lib/projects/homepage.ts` was not changed. |
| DSV1-005 | MEDIUM | Fixed. `src/components/modules/navbar/AuthButton.tsx:114` adds a localized My Orders link for signed-in customers and retains existing admin links. The new account link is separate. | Both locale render checks passed; real browser navigated the customer order flow. |
| DSV1-006 | MEDIUM | Fixed. `src/app/api/auth/register/route.ts:47` maps uniqueness failures to a safe HTTP 409 without disclosing account details. Grant consumption, account creation, and session creation remain atomic. | Real PostgreSQL duplicate-email registration rolled back grant consumption and allowed a valid retry. Equivalent-phone and username races also returned safe conflicts. |
| DSV1-007 | MEDIUM | Fixed. `src/hooks/useRandomAutoplay.ts` uses a six-second interval, pause/resume, keyboard-focus/hover pause, reduced-motion handling, and cleanup. A generation counter prevents Swiper's synchronous slide-change reset from creating multiple timer chains. `SampleProjects.tsx:42` exposes localized controls. All seven original cards, arrows, and dots remain. | Timer unit tests passed; actual production browser exercised arrows, dots, pause/resume, and focus pause. |
| DSV1-008 | LOW | Fixed. Homepage has one main landmark. `AccessRequired.tsx:7` supports an embedded section for gates within an existing main; order/admin/support/account callers use it where needed. | Browser checks confirmed one visible main in settled affected pages. Hidden transient Next.js streaming fallbacks were excluded from visible-landmark counts. |
| DSV1-009 | LOW | Fixed. Only the placeholder package and its matching translation leaves were removed. Eight genuine packages remain in their original order. | Package/localization tests passed; no unrelated service content was removed. |
| DSV1-010 | LOW | Fixed. `src/components/templates/sampleProjects/ProjectCard.tsx:21` overrides the Framer hover transform under reduced motion without changing normal card styling. | Relevant design-system/unit checks passed. |

Fixed totals: **1 HIGH, 6 MEDIUM, 3 LOW; no CRITICAL findings in the original audit.** These statuses describe the implementation and tested isolated application, not a claim that a production deployment has occurred.

## Username and profile behavior

- `entity.users.username` is an optional, nullable `VARCHAR(30)`, unique when present. Inputs trim whitespace and canonicalize ASCII case to lowercase. Allowed values match `^[a-z0-9_]{3,30}$`.
- Reserved values are `admin`, `administrator`, `support`, `api`, `root`, and `dreamservice`. Username is never an authorization role or replacement for the user UUID.
- Registration accepts an optional username. Existing authenticated users can set, change, or clear their own username at the localized `/account` page. Server code derives the owner from the trusted session, not a submitted ID.
- `/api/account/username` returns availability only to an authenticated user or a holder of the existing browser-bound, unexpired registration grant. It does not return another user's ID. The database unique index is the final arbiter; availability is advisory.
- Profile writes require mutation-origin validation, bounded strict input, rate limiting, the transaction authorization check, and migration support. Banned users cannot mutate their profile. English/Persian labels, errors, and conflicts are present.
- `/api/account/profile` exposes only the current user's username and support state. Display-name utility output is plain text, prefers valid names, then a valid username, then a localized caller fallback; it does not use contact details or internal roles as a public identity.
- Before activation, compatible queries and localized temporary-unavailability feedback protected the missing-column gate. The original now has the approved username column and canonical-phone objects; application schema reads succeed. Existing users still have NULL usernames until they explicitly choose one.

Relevant implementation: `src/lib/account/identity.ts`, `src/lib/account/profile.ts`, `src/lib/auth/phone-account.ts`, `src/app/api/account/{profile,username}/route.ts`, `src/app/[locale]/account/page.tsx`, `src/components/modules/auth/{AccountProfile,UsernameAvailability,AuthModal}.tsx`, `src/lib/auth/authClient.ts`, and private-query cleanup in `src/lib/auth/client-state.ts`.

## Name moderation

`src/lib/account/identity.ts` contains a small, explicit English/Persian forbidden-term list. Shared schemas validate new registration names and usernames on the server as well as in the form. Moderation applies Unicode NFKC/case normalization, unifies Arabic/Persian letter variants, strips supported diacritics/tatweel/joiners, and compares **whole normalized tokens**, not arbitrary substrings. Ordinary Persian names and examples such as `scunthorpe`, `assistant`, and `dickens` are covered by tests.

This is a local validation rule, not a comprehensive language classifier. Unlisted terms, dialects, substitutions, and some obfuscations can pass. A legitimate name exactly matching a prohibited token can be rejected. Maintain the exported list through reviewed changes with positive and negative tests in `scripts/v1-phase1.test.mjs`; check Persian variants and personal-name false positives before extending it. No external moderation service is called. Existing names/profiles are not rewritten or retroactively moderated in the database.

## Historical order conflict investigation

The resumed investigation used a **read-only, repeatable-read transaction** against the configured loopback PostgreSQL database `dreamservice`. Only aggregate results, order IDs, and catalog metadata were returned; customer names, contacts, descriptions, and credentials are omitted.

| Measure | Result |
| --- | --- |
| Total orders | **121** |
| Customers owning these orders | **1**, with a valid user relationship |
| All open orders | **49** |
| Customers with any open order | **1** |
| Customers with more than one open order | **1** |
| Open rows belonging to conflicting customers | **49** |
| Excess open rows above one per conflicting customer | **48** |

**The reported 49 are both all open orders and all conflicting open rows. They are not 49 excess rows.** All 121 orders currently belong to the same existing customer; that is a verified relationship, not evidence that those records are disposable.

| Status | Total | Open/conflicting rows | Open order IDs |
| --- | --- | --- | --- |
| PENDING | 24 | 24 | 1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56, 61, 66, 71, 76, 81, 86, 91, 96, 101, 106, 111, 116 |
| NEGOTIATING | 1 | 1 | 121 |
| PROCESSING | 24 | 24 | 2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57, 62, 67, 72, 77, 82, 87, 92, 97, 102, 107, 112, 117 |
| COMPLETED | 24 | 0 | — |
| REJECTED | 24 | 0 | — |
| CANCELLED | 24 | 0 | — |

Integrity SELECTs found **121 distinct order IDs**, no null/nonpositive IDs, no null owners, no orphan owners, no orphan status-history/project-order links, and no missing or wrong-owner ticket/order links. The order primary key and customer foreign key are validated. These checks establish internal reference consistency; they cannot establish business provenance or intent for historical records.

The aggregate conflict query was equivalent to:

```sql
SELECT client_id, count(*)
FROM entity.orders
WHERE status IN ('PENDING', 'NEGOTIATING', 'PROCESSING')
GROUP BY client_id
HAVING count(*) > 1;
```

No historical order was updated, closed, merged, deleted, or exempted from enforcement.

## Concurrency policy compatible with historical duplicates

The current submission transaction in `src/app/api/order/submit-order/route.ts:31` provides a database-backed guarantee between application submissions without adding original-database objects:

1. Validate the trusted session, mutation origin, body, UUID idempotency key, published form, and account request budget.
2. At PostgreSQL **READ COMMITTED**, acquire the management shared advisory lock, then `SELECT ... FROM entity.users WHERE id = <trusted customer UUID> FOR UPDATE`; recheck bans under that lock.
3. Recheck the customer's unique idempotency key and request hash inside the transaction. A committed matching retry returns the original order; a different payload for the same key returns HTTP 409.
4. Query **all** of that customer's PENDING/NEGOTIATING/PROCESSING orders, with no timestamp, migration-era, ID, or other historical cutoff. Select the lowest `order_id` deterministically.
5. If any exists, return HTTP 409 `ORDER_OPEN_EXISTS` and that customer's existing order ID. The form offers a localized link to that order. Otherwise insert one PENDING order and commit before releasing the user-row lock.

Two requests for the same customer cannot pass this check concurrently: the second waits for the same database row lock, then its subsequent READ COMMITTED query sees the first committed order. The existing per-customer idempotency unique index and request hash remain intact. Committed retries do not create another order even when an open order exists; they return their earlier result.

Source inspection found only two application order-write sites: this submission route and `src/lib/order/workflow.ts:35`. The existing workflow only allows PENDING → NEGOTIATING/REJECTED and NEGOTIATING → PROCESSING/REJECTED. It does not create orders, reopen closed orders, or reassign owners. These transitions cannot increase a customer's open-order count. A concurrent rejection may conservatively cause a submission to retry after the close commits; it cannot allow a duplicate creation. Future reopen/import/reassignment writers must use the same customer serialization and all-history check before increasing the open count.

This is **transactional application enforcement**, not a universal database constraint for arbitrary direct SQL or noncooperating writers. It also does not make the existing 49-row historical violation disappear: that customer is intentionally blocked from new submissions while any open row remains.

### Strict index limitation and optional database enforcement

The proposed strict partial unique index on `entity.orders(client_id)` for the three open statuses **cannot be built on the current data**. No such index was added. An ID/date cutoff or an exemption that ignores historical open orders would weaken the requested rule and was not used.

No order-rule migration is required for the current application path. If a universal rule across other database writers is required, prepare a separate reviewed migration proposal: guard inserts, closed-to-open transitions, and open-owner reassignment; serialize the affected customer(s) in a consistent lock order; check every other existing open row; permit unchanged historical rows and ordinary open-to-open/closed transitions. Define supported transaction isolation and test visibility, concurrent insert/update, multi-row statements, and lock/deadlock behavior on disposable PostgreSQL before approval. A trigger alone must not be assumed safe without those trials. Such an object is **not implemented, tested, or approved** in this phase. Historical duplicates preclude a strict unique index unless a separately authorized business resolution changes their open status; no such resolution is requested or performed here.

## Identity migration: approved and applied to original LOCAL development

Exact migration: **`prisma/migrations/202610300001_account_identity/migration.sql`**.

Current SHA-256: `e5b420d9f431047205890cd4922348f329446cbf50b155d2ebe0227ebe561b03`.

It adds the nullable username column, username format/reserved-value check, username unique index, immutable `entity.canonical_iran_mobile(text)` function, and a partial unique expression index for valid canonical Iranian mobile numbers. The corrected canonical function mirrors the explicit TypeScript format contract above, including supported digits, formatting, and full number structures. Invalid/null legacy contacts yield NULL and are excluded from that phone index. Existing raw-contact uniqueness remains.

The migration has explicit transaction/lock/statement timeouts. It contains **no user merge, deletion, name/profile/contact update, username backfill, or open-order index**. It preserves existing migration files and records. Building the indexes still takes database locks; local activation should use a fresh backup/restore verification and a quiet write window.

Read-only original-data preflight before activation:

| Identity measure | Result |
| --- | --- |
| Users | 16 |
| Null contacts | 2 |
| Valid normalized mobile contacts | 5 |
| Valid contacts stored in a noncanonical form | 3 of those 5 |
| Non-null contacts rejected by existing normalization | 9 |
| Canonical-phone duplicate groups / conflicting rows | **0 / 0** |
| Existing username conflicts | None: column absent before activation; all 16 existing users remain NULL after activation |

The nine invalid legacy contact values remain unchanged and are not claimed by the canonical index. This is a documented legacy-data limitation, not an unresolved uniqueness conflict or authorization to rewrite them. Phone lookup after activation can find valid equivalent legacy formats without changing the stored string. New equivalent-phone registrations are serialized and rejected safely when an account already exists.

### Earlier backup, restore, and preservation evidence before original activation

- Private evidence directory: `.backups/v1-phase1-1793367887016` (ignored by Git; contains original data and must remain private).
- Backup: `before-phase1.dump`, **109126 bytes**, SHA-256 `87ab992647e59192a89cf449820dc2dccc328a3553f92d4109f7dc93588ab910`. Its checksum was reverified during this resumed run.
- A fresh isolated restore was compared with the original baseline before migration. All saved application-table row counts/fingerprints, indexes, sequences, and historical migration records matched.
- Disposable database: `dreamservice_phase1_test_9c4ab34cb26f4ed580d731041d323353`. The identity migration applied successfully there; Prisma reported **7 migrations, database schema up to date**. The migration copy used for that trial is byte-identical to the current proposed file.
- Post-migration comparisons verified all pre-existing user/profile/contact values and other application rows, existing index definitions, sequences, and six historical migration records remained intact. Test fixtures were added only afterward, in that disposable database.
- During that resumed run, `verify-original` confirmed every saved original-table fingerprint, existing index, sequence, migration record, historical migration-file checksum, and backup checksum. The original then had only six applied historical migrations and no username column. No original DDL or data writes occurred in that earlier task.

**No username/canonical-phone collision was found under the corrected normalization rule.** The defect was corrected and legacy compatibility rechecked. Renewed approval was granted, and the approved migration is now applied and verified on the original LOCAL database as recorded above.

## Verification results

The earlier implementation/resume checks below are retained as historical evidence. The corrected implementation passed **286 unit tests and 15 PostgreSQL scenarios**; the latest approved activation reran all 15 database scenarios on a fresh restore and passed original integrity/status checks after apply. The earlier activation failure is retained for traceability. No new build/browser/full-unit rerun was performed during the final migration-only activation, which changed no application source.

| Check | Result and scope |
| --- | --- |
| Whole unit suite: `node --test --test-reporter=dot scripts/*.test.mjs` | **284 passed, 0 failed** in the completed implementation run. Includes identity/moderation, ticket recovery/options, localized navigation, autoplay cleanup/timer reset, and existing security/order/project/team/loading suites. No application source changed during the resumed run. |
| Disposable PostgreSQL: `node scripts/v1-phase1-run.mjs integration .backups/v1-phase1-1793367887016` | **14 passed, 0 failed** in the resumed run (previously 13). Real Prisma transactions/sessions and two connections; external services blocked or delivery mocked. The added test used the restored historical duplicates, submitted eight concurrent distinct keys, checked every HTTP 409/existing-order ID, and compared all orders for that owner before/after byte-for-byte at the returned-field level. No order changed. |
| TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **PASS** again after generated-build cleanup; no emitted source/build files. |
| ESLint: `npm.cmd run lint` | **PASS**, 0 errors, 3 existing warnings, after cleanup. No ignore/config weakening or autofix. Warnings: TanStack Table compiler compatibility (`data-table.tsx:111`), React Hook Form `watch` compatibility (`dream-form.tsx:196`), inactive legacy `plusCard.tsx:102` image. |
| Prisma validation with `scripts/no-services.cjs` | **PASS** again; schema valid, service connections disabled. |
| Isolated production build | **PASS** in the completed implementation run: Next.js 16.2.4 webpack, TypeScript and 48 routes completed. Used an isolated source copy and service-blocking preloader; did not build over the original application's running build. Existing middleware/workspace warnings were retained. |
| Actual production browser against disposable PostgreSQL | **PASS** in the completed implementation run. Real pages/APIs/database, not API response fixtures. The provider transport alone was mocked. English/Persian × 1440px/390px × light/dark checked public/About/account rendering, original seven-slide portfolio with arrows/dots, one independent countdown card with countdown inside and **32px** section spacing, and team content. Authenticated account/ticket checks covered both locales. Real OTP registration with mocked delivery, dynamic order wizard creation, second-submission conflict/link, ownership denial, non-admin/banned restrictions, and focus pause/resume passed. **0 captured browser runtime errors, 0 server HTTP 500s, 1 mocked provider call; no real SMS/email.** |
| Build/source correspondence | Before cleanup, **243** files across `src`, `messages`, `i18n`, and `public` in the tested copy were hashed against the current source: **0 differences**. Only a test file and this report were added/changed during the resumed work. |
| Original database preservation | **PASS** in the resumed run using SELECT-only verification against saved fingerprints. Original migration/schema activation did not occur. |

Browser expiry/no-project fallbacks retain the earlier audit/project-test evidence; they were not simulated by changing the original project. No production HTTPS/provider delivery or deployment is certified by these local checks. All fixture writes stayed in the disposable database; no original customer credentials or sessions were extracted for testing.

## Generated-build cleanup and change boundaries

Before cleanup, Git status and source hashes were captured. The isolated `app` directory was traced to `scripts/v1-phase1-run.mjs`'s build mode, its source copy matched the tested current files, and its top-level contents were inspected. Its absolute resolved path was checked to remain exactly under the intended private evidence directory. The `app/node_modules` junction target was checked to be the root dependency directory and the **junction only** was removed without traversing it. Then only `.backups/v1-phase1-1793367887016/app` (the copied sources/configuration and its generated `.next`) was removed.

The original `node_modules`, root source/build files, backup archive, migration trial copy, saved logs/state, browser evidence, and disposable database were retained. No `git restore`, reset, clean, source reversal, environment edit, or unrelated cleanup was performed. Removing the isolated copy also stopped its generated files from being discovered by root lint/TypeScript without changing their configuration.

The resumed task's authored changes are limited to `scripts/v1-phase1.integration.mjs` (historical-conflict regression) and this report. Existing Phase 1 source fixes remain in place. Their principal areas are:

- Order/security: submission route and form/error handling, `src/lib/auth/mutation.ts`, workflow/notification claim/retry wiring.
- Identity: additive Prisma field/new migration, account services/routes/page/components, registration/OTP/client and cache integration, matching English/Persian catalogs.
- UI audit fixes: ticket/shared table, project admin copy/controls and compatibility validation, navbar, main/embedded access gates, packages, portfolio autoplay/hover behavior.
- Verification: focused Phase 1 unit/integration/browser/backup/build helpers and affected existing assertions.

Unrelated pre-existing local edits (including contact/team/loading work) were preserved. The original audit document and all six historical migration files were left unchanged.

## Remaining gates and exact next steps

1. **Completed:** the explicitly approved `202610300001_account_identity`, checksum `e5b420d9f431047205890cd4922348f329446cbf50b155d2ebe0227ebe561b03`, is applied and verified on original LOCAL development. Prisma reports seven applied migrations, schema up to date. No further migration action or approval is pending for this task; do not apply unrelated migrations.
2. **No approval requested to alter historical orders.** Keep all 49 open rows intact. Their owner must remain blocked from new submissions while any open order exists. A strict open-order unique index remains incompatible with the current history and must not be applied. Any future trigger/index/constraint/migration or historical business resolution needs its own explicit proposal and approval.
3. Any future application path that can import/create, reopen, or transfer an open order must preserve the same transactional customer lock and all-history check. Arbitrary direct SQL remains outside the tested application guarantee; universal database enforcement would require the separately reviewed/trialed mechanism described above.
4. Username/profile and canonical-phone schema support is now active on the original, with existing usernames left NULL and original application rows preserved. The ten-digit prefix correction and mocked login/registration mutations passed on disposable PostgreSQL; only read operations exercised the original application services. Existing invalid legacy contacts remain a separate owner decision; no automatic repair is authorized.
5. Production deployment/configuration/provider checks and the previously disclosed limited order lifecycle/launch-notification feature are outside this completed local-fix verification. No new lifecycle, blog, SEO, or deployment phase was started.

**Approved LOCAL identity migration complete and verified. Existing historical data is preserved. Stopped without further implementation, deployment, or original-data mutations.**

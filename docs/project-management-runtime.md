# Phase 5 runtime recovery — 2026-10-29

The actual development app is running at `http://localhost:3000` with the current
Prisma Client. Its English and Persian homepages show the intentional empty state.
Authenticated project management and the complete countdown flow passed real
browser, HTTP, session and PostgreSQL verification in an isolated database.

## Root causes and evidence

The existing Next.js server process (PID 18228, launched by PID 21800) started
at 12:09:40 UTC. The generated Client on disk included Project after generation
at 12:18:26 UTC, but the process retained the previously imported generated module.
Replacing `global.prisma` could not repair that module: its cached `PrismaClient`
constructor still constructed a runtime data model without Project.

Inspection of the running process, not a test substitute, established:

- Fixed read-only SQL returned database `dreamservice`, port 5432, and zero
  rows in the existing `entity.projects` table.
- `prisma.project` was absent and the runtime data model had no Project entry.
- The real homepage read threw
  `TypeError: Cannot read properties of undefined (reading 'findFirst')`.
- The real transactional list read threw
  `TypeError: Cannot read properties of undefined (reading 'findMany')`.

The local Node inspector was used only for these bounded checks and then closed.
No session tokens or customer rows were inspected or printed. The five migrations
and empty table were valid; no schema correction was required. Earlier verification
used fresh processes and missed this already-running process's cached module.

The list path is `ProjectsView → GET /api/admin/projects → requireAdmin → session
and profile lookup → listProjects → Prisma transaction`. Authorization succeeded
for the synthetic app-admin in the real-service reproduction, then the missing
transactional Project delegate caused the safe HTTP 500 response. The homepage
uses a server component and direct Prisma query, not a public Project API.
Its caught missing-delegate exception selected the temporary-unavailable card.

| Request/state | Before | After |
| --- | --- | --- |
| Authenticated `GET /api/admin/projects?page=1&limit=10` | 500, `{success:false,code:"UNKNOWN"}` | 200, `{data:[],total:0}` when empty |
| Homepage `GET /en` | 200 document with temporary-unavailable card | 200 with intentional empty card |
| Homepage `GET /fa` | Same affected query path | 200 with Persian empty card |
| Anonymous project reads/writes | 401 | 401 |
| Customer project reads/writes | No authorization change | 403 |
| Banned session project reads/writes | No authorization change | 401 |

The original homepage failure and actual cached-client exceptions were captured
directly from localhost:3000. The authenticated HTTP 500 was reproduced through
the actual admin page in a separate Next.js server using a real older generated
Prisma Client, genuine database-backed synthetic sessions and the restored local
database. No existing user's original browser session was borrowed and no session
was inserted into the original database. A fresh normal Client against that same
database then returned HTTP 200. HTTP requests and authorization were never mocked.

The live flow also exposed a streamed-page hydration race. The server rendered a
loading shell while the browser's shared auth query cache could already contain
the administrator before ProjectsView hydrated. The initial client render then
differed from the server. The fix is local to the project view and keeps its first
client render equal to the server's loading shell; shared auth behavior is unchanged.

## Changes

- Regenerated the installed Client, verified the workspace/process owning port
  3000, stopped only that stale Next.js process tree, and restarted the app hidden
  on the same port. The replacement development server remains running. Logs are
  retained privately beside the verification artifacts.
- `src/lib/projects/diagnostics.ts`: adds bounded server diagnostics for list and
  homepage query failures. It records the operation, fixed error category,
  Project-delegate readiness, a fixed TypeError label and validated Prisma codes.
  It never records exception messages/stacks, query values, cookies, user IDs,
  database URLs or credentials. Failures are rethrown; unavailable databases are
  not disguised as empty lists.
- `src/lib/admin/projects.ts`, `src/lib/projects/homepage.ts`: wrap the existing
  reads with those diagnostics. Query predicates, transactions, public projection
  and authorization contracts are unchanged.
- `src/components/modules/admin/projects-view.tsx`: uses the established
  `useSyncExternalStore` hydration pattern to render a stable initial loading
  shell and enable project queries after hydration. Server admin checks and the
  exact `'app-admin'` role contract remain unchanged.
- `scripts/prisma-offline.mjs`: explains after generation that running Next.js
  servers must restart to reload the generated module.
- `scripts/projects-runtime-check.mjs`: real-service reproduction/browser checks
  and read-only original-database integrity comparisons.
- `scripts/projects-runtime.test.mjs`: seven regression tests for stale modules,
  empty-list HTTP 200 responses, diagnostic privacy/categories and the streamed
  view's stable initial render.
- This report and the runtime verification link in `docs/project-management.md`.

## Real browser verification

Private evidence is retained at:

`.backups/projects-runtime-20261029132258664/`

The successful isolated run used:

`dreamservice_projects_runtime_f4c2f56407264849aa0da0be6d700df6`

A verified custom-format backup of the original local database was restored into
a new empty test database. The existing migrations/history were copied by restore;
no historical SQL was edited or migration-history row manipulated. Synthetic admin,
customer and banned identities and sessions were created only in isolated copies.
Browser cookies used those real database-backed sessions; no auth guard was bypassed.
SMS was disabled, and no notification form was submitted.

The full application pages and real HTTP routes passed:

1. English and Persian admin empty states with the Create Project action and no
   generic error; real empty-list API result `{data:[],total:0}` with HTTP 200.
2. Anonymous/banned 401 and customer 403 for both reads and writes.
3. Standalone creation through the actual form: both titles/descriptions, future
   deadline, public visibility, homepage selection and confirmation; real POST 201.
4. Database-backed admin row and anonymous homepage countdown with the exact
   server deadline in both languages; desktop/mobile, LTR/RTL and light/dark captures.
5. Editing through the Persian form and confirmation; real PATCH 200; updated
   English and Persian titles on the public homepage.
6. Clearing selection through the form; both homepages return to the empty fallback.
7. A near-future real server deadline counts down to expiry, removes the form and
   shows the localized expiry message. Business status stays PLANNED. A new request
   after expiry excludes the ineligible project and shows the normal fallback.
8. Real pagination over eleven isolated project fixtures, search resetting the
   current page, matching/missing title searches, ACTIVE filtering, clearing filters
   and refresh. All list requests returned 200.
9. No uncaught runtime, hydration or missing-message errors in the successful run.

No preview route, Fetch interception, mocked API response or in-memory Prisma
substitute was used for this browser verification. Temporary Next.js copies,
stale generated module files and QA processes were removed afterward. Screenshots,
network status summaries, server logs, schemas and database fingerprints are private.
The separate test databases are retained; some contain copied private application
data and must not be published. The original development server remains running.

After the production build, a fresh browser verified actual localhost:3000 `/en`
and `/fa`: both documents returned 200 and displayed their localized empty cards.
The anonymous project API remained 401, as required.

## Quality and preservation

- Automated suite: **265/265 passed**, including the seven new regression tests.
- TypeScript `--noEmit --incremental false`: passed.
- `npm run lint`: passed, zero errors and the same four existing warnings
  (DataTable, DreamForm, plusCard and useRandomAutoplay).
- Prisma schema validation and Client generation: passed.
- Production webpack build through the offline helper: passed, including both
  project routes and APIs. The existing middleware deprecation warning remains.
- The first build's worker was blocked by sandbox process permissions; the full
  permitted rerun passed. An intermediate lint run found temporary generated
  vendor modules from reproduction; they were removed/archived before the final
  clean run. No lint or TypeScript configuration was weakened.
- Final read-only comparison: all **24 original table counts and fingerprints**,
  all **69 original index definitions/validity/physical identities**, and all
  **five historical migration-file hashes** are identical. This includes the
  entire unchanged Prisma migration-history table. The original Project table
  still has **zero rows**.

No schema/migration changes, original-data writes, resets, truncation, reseeding,
auth/order/user-management behavior changes, real SMS/email, production access,
dependency installation, Git commit or push occurred. No Phase 6 work was started.

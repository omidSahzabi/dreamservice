# Vercel Linux deployment preparation

This continues the existing DreamService V1.0 working tree. It does not authorize a deployment, Git publication, database migration, or provider delivery. Application behavior, Next.js 16, React 19, Prisma schema, and historical migration files are preserved.

## Dependency and build correction

The direct dependency on `@swc/core-win32-x64-msvc` required a Windows-only package on every platform. npm rejected that required lockfile entry for Linux with `EBADPLATFORM`. The correction removes only the root dependency; upstream platform packages remain in the lockfile as optional dependencies. Next.js selects its own `@next/swc-*` package, and the transitive SWC package continues to declare its platform binaries as optional. Do not add platform binaries to root dependencies or install with `--force`.

The lockfile was regenerated using npm with lifecycle scripts disabled in an isolated directory. No existing locked package version or integrity value changed. npm also completed metadata for six already-bundled optional Tailwind WASI dependency entries. No new root dependency or dependency upgrade was introduced.

The first clean Linux attempt exposed another portability problem: the lockfile pinned 862 tarball URLs to `mirror-npm.runflare.com`, which timed out from the isolated container; the official npm registry responded successfully. Those URL hosts were changed to `registry.npmjs.org`, preserving paths, versions, and integrity hashes. The retry verifies those same locked archives against their existing integrity values. No registry credentials or insecure TLS overrides were added.

The build command is now:

```sh
prisma generate && next build --webpack
```

Prisma Client is generated on every build, including builds that reuse cached dependencies. Generation does not connect to the database or execute migrations. A generation failure stops the build. Webpack matches the bundler used for the existing release verification; this change does not switch application functionality or upgrade Next.js. See [Prisma's Vercel guidance](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-vercel) and the [Next.js build options](https://nextjs.org/docs/app/api-reference/cli/next#next-build-options). This project remains on Prisma 5; no Prisma 6 adapter or engine configuration is adopted from that guidance.

## Required Vercel project configuration

| Setting | Required configuration |
| --- | --- |
| Framework | Next.js |
| Root directory | Repository root |
| Node.js | 22.x, matching verification |
| Install command | `npm ci --include=dev --include=optional`; Prisma/build tools and native platform packages must be installed even if an environment default would omit them |
| Build command | `npm run build`; remove any dashboard override that directly invokes `next build` and bypasses Prisma generation |
| Output directory | Next.js framework default; do not replace with a static export directory |
| Database | Separately approved deployment PostgreSQL target, privileges, TLS/pooling and existing schema; Preview must use isolated data |
| Migrations | Separately approved operational step after backup/restore verification; never append migrate/seed commands to install or build |
| Environment | Configure the existing server-side variables in the correct Preview/Production scope; never use public prefixes for secrets |
| Git integration | Confirm the production branch and automatic Preview/Production deployments before authorizing a push |

No `vercel.json` is required for these package scripts. No Vercel settings or environment variables were changed. Dashboard build/install overrides, deployment environment configuration, preview protection, and production branch must be verified by the owner. [Vercel's build configuration](https://vercel.com/docs/builds/configure-a-build) describes these settings.

Keep the temporary preview password flow disabled unless separately configured and approved according to [preview login configuration](preview-password-login.md). It requires an actual Preview deployment, a newly generated private secret, an isolated database with existing registered accounts, exact Origin, a verified trusted IP header, and expiry. It never grants roles or registers users. A shared secret can access any allowlisted existing account, including an existing admin; that operational risk remains.

The lockfile now downloads public tarballs from `registry.npmjs.org`. Allow normal HTTPS access to the registry and Prisma's public engine download service during installation/generation. No private registry or credentials are required by this lockfile.

## Git divergence and safe integration

Read-only remote verification found `origin/master` at `1c3eddf7e40b50599cbb34553e1f57730f16b11a`. The current local branch is `feat/complete-i18n`, HEAD `bd6e22a6e2046a571bf0f95ee0dfc537163de5f1`, with no upstream and no matching remote branch. The merge base is `b863021b0b1a54614c27538700e155bdaaa94599`.

These eight commits are local-only relative to master, in chronological order:

| Commit | Recorded purpose |
| --- | --- |
| `cdb1b19` | Added table data and related form/table implementation |
| `54b1caa` | Data-table changes |
| `4763128` | Authentication changes |
| `3db1921` | Project snapshot before localization completion |
| `2fd5e18` | Engineering rules |
| `b0d4cde` | Translation catalog/namespace alignment |
| `da47bf5` | Bilingual localization and stabilization |
| `bd6e22a` | Order workflows and UI/UX enhancements |

The one remote-only commit, `1c3eddf` (`'update'`), changes 69 files: dependencies (including `next-auth` and `bcrypt`), schema/layout, order APIs, form components and order configuration, plus several empty route/module placeholders. It overlaps the local auth/order work; it is not safe to treat it as a trivial documentation change. Remote master also retains the direct Windows binary dependency, so integration must preserve this correction. The current uncommitted Phase 1/2/project/support/preview work is additional to the eight commits.

Recommended sequence, requiring separate approvals:

1. Review the exact candidate file list and privacy findings; commit the intended current tree on `feat/complete-i18n` only after explicit approval.
2. Confirm whether a GitHub push will trigger Vercel. Disable automatic deployment or separately approve that consequence before pushing the new feature branch without force.
3. Open a review against master. In a separate integration branch, incorporate master through a normal merge that preserves both histories. Resolve overlapping schema/auth/order/dependency changes explicitly; do not use blanket ours/theirs conflict resolution, rebase, or force-push.
4. Rerun installation, type/lint/test/build checks and disposable-database/browser regressions on the merged tree before approving a master merge or deployment. Review empty/obsolete remote stubs instead of blindly retaining incompatible routes.

No commit, push, merge, rebase, fetch/ref update, or history rewrite was performed. Generalizing the two machine-specific paths in current documentation does not remove their older versions from outgoing Git history. They are local machine-path details, not live credentials; the owner must acknowledge historical visibility before publication. History rewriting is outside this task.

## Verification

Executed on **2026-10-31, Asia/Tehran**. The Linux test used the official `node:22-bookworm-slim` image, digest `sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da`, with Node 22.23.4, npm 10.9.9, and OpenSSL 3. The copied input contained no environment files, Git metadata, migrations, or database artifacts. It was mounted read-only; installation and generation wrote only to the disposable container. Build-time database/provider connections were blocked with the existing verification preloader and a dummy URL. No database query or migration was needed.

| Check actually executed | Result |
| --- | --- |
| Clean Linux `npm ci --include=dev --include=optional` | PASS; 774 packages installed from official registry, integrity validation enabled |
| Linux lockfile checksum before/after `npm ci` | PASS; unchanged |
| Linux `npm ls --depth=0` | PASS; consistent installed root dependencies |
| Linux native compiler assertions | PASS; Windows SWC packages absent; Linux Next.js SWC loaded |
| Windows native compiler and lock assertions | PASS; Windows Next.js SWC loaded; all 20 OS-specific SWC entries optional; manifest and lock match |
| Locked versions and integrity comparison | PASS; all pre-existing versions/hashes preserved, Next 16.2.4 and React 19.2.3 unchanged |
| Linux Prisma validation | PASS |
| Linux actual `npm run build` | PASS; Prisma Client 5.22 generated first, Webpack production build completed with 52 entries, generated Project model confirmed |
| Windows TypeScript `--noEmit --incremental false` | PASS |
| All existing `scripts/*.test.mjs` | 319 passed, zero failures/skips |
| `npm.cmd run lint` | PASS; zero errors, two existing React Compiler compatibility warnings |
| Existing offline Prisma validation script | PASS; isolated dummy URL |
| Secret/exclusion and outgoing-history review | No live secrets or forbidden candidate artifacts found; historical machine-path visibility described above |
| Source preservation | Only five existing files and this new document changed during this task; all seven migration files unchanged |

The two existing lint warnings concern TanStack Table at `data-table.tsx:111` and React Hook Form at `dream-form.tsx:196`. The Linux build retains Next.js's existing middleware-convention deprecation warning. Installation retains a transitive `node-domexception` deprecation notice. None was suppressed or fixed outside this task's scope.

The failed mirror-backed installation is retained as failed evidence, not counted as a pass. A Linux HTTP probe returned a connection timeout for the mirror and HTTP 200 for the official registry; the corrected lockfile then passed the complete clean installation and build. The broad lockfile URL diff is deliberate, not a dependency upgrade.

Private evidence is under ignored `.backups/vercel-linux-readiness-20261031`, including `linux-install-build.log` (failed mirror attempt), `linux-official-install-build.log` (successful final run), `unit.log`, `typecheck.log`, `lint.log`, `prisma-validation.log`, `final-lock-verification.json`, secret/history findings and `proposed-commit-files.txt`. The refreshed candidate list contains 185 files, including pre-existing work; nothing is staged. Temporary source copies are excluded from that list and removed after verification. The container was automatically removed on completion.

No new browser or PostgreSQL mutation/integration suite was run for this package/documentation-only change. Existing real-browser and disposable-database verification remains documented in earlier reports; it is not claimed as newly executed here. No original database access, schema/migration edit, real SMS/email, deployment, DNS change, Git commit/push, merge, rebase, or history rewrite occurred.

**Code-side Linux installation/build blockers are resolved and the candidate tree is ready for commit review.** Push only after explicit approval and verification of automatic deployment behavior. A master integration still requires conflict review and regression tests on the merged tree. Actual Vercel project settings, HTTPS/origin/proxy behavior, deployment database/migration approval, secrets, provider configuration, and shared-admin preview access remain owner-controlled deployment prerequisites; this local build does not certify them.

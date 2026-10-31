# DreamService

DreamService V1.0 is an English/Persian service-order application built with Next.js 16 App Router, React 19, strict TypeScript, next-intl, Tailwind CSS 4, TanStack Query, and Prisma 5/PostgreSQL. Routes use `/en` and `/fa`; Persian uses RTL. The canonical public origin is `https://dreamservice.net`.

The homepage's seven static portfolio examples are independent of the single database-backed upcoming-project card. The latter automatically selects the nearest future public PLANNED/ACTIVE project. Orders use database-configured localized form definitions. OTP sessions, ownership checks, exact `app-admin` authorization, support tickets, and transactional order enforcement are server-side.

## Local setup

Use a supported Node.js version compatible with Next.js 16 (verification used Node 22), npm, and PostgreSQL. Install lockfile dependencies with `npm ci`. Provision a separate local development database, then configure the environment locally using `.env.example` as a names/template reference. Never put secrets in Git or public-prefixed variables.

```sh
npx prisma generate
npx prisma validate
npx prisma migrate status
npm run dev
```

Open `http://localhost:3000/en` or `/fa`. Database configuration, backups, and migration approval are prerequisites; these commands do not initialize or seed a database. Configure database-driven form content separately through an approved workflow. Console OTP delivery is development-only.

## Environment names

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; Prisma spans `public`, `entity`, and `upro` |
| `SECURITY_ORIGIN` | Exact trusted browser origin; required for production mutations |
| `SECURITY_OTP_KEY` | Private key of at least 32 bytes for protected hashes |
| `SECURITY_TRUSTED_IP_HEADER` | Optional single-IP header overwritten by a trusted proxy |
| `OTP_DELIVERY_MODE` | Development-only `console`, or provider delivery; console is rejected outside development |
| `SECURITY_SMS_ENABLED` | Explicit provider enable switch; disable during local verification |
| `FARAZSMS_API_KEY`, `FARAZSMS_PATTERN_CODE`, `FARAZSMS_SENDER_NUMBER` | IranPayamak OTP access key, approved pattern identifier, and authorized digits-only sender line string |
| `ORDER_NOTIFICATIONS_SMS_ENABLED`, `FARAZSMS_ORDER_STATUS_PATTERN_CODE` | Separate opt-in order-status provider configuration |
| `PUBLIC_TEAM_PROFILE_IDS` | Comma-separated published profile IDs; absent/empty means no public team. Roles do not publish people |

No actual values belong in documentation. Without a trusted proxy header, source-based rate limits intentionally share an `unknown` bucket; validate proxy behavior before release. System fonts are used; no remote font download is required.

OTP delivery uses `POST https://api.iranpayamak.com/ws/v1/sms/pattern`, with `Accept: application/json`, `Content-Type: application/json`, and the private `Api-Key` header. Keep the existing `FARAZSMS_*` environment names; the access key and pattern must belong to this provider/account. Configure the authorized sender line exactly as its digits-only string, without adding a country prefix. The shared phone normalizer sends the recipient in local `09…` format. The approved pattern variable is `code`: the payload uses `attributes: {code: <five-digit OTP>}` and `number_format: "english"`. No secret belongs in a `NEXT_PUBLIC_*` variable or a committed file. See the [provider's pattern contract](https://docs.iranpayamak.com/send-pattern-based-sms-13925177e0).

Provider acceptance requires a successful HTTP response and a JSON body with `status: "success"` and a nonnegative integer `data` (including the documented zero example). Acceptance does not prove handset delivery. Rejection, malformed responses, redirects and a 10-second timeout fail closed without automatic retries or logging provider bodies. The existing OTP flow rejects failed challenges with `SMS_FAILED`; no OTP, session or registration bypass is introduced.

For Production, retain the existing `DATABASE_URL`, stable `SECURITY_OTP_KEY` (at least 32 bytes), exact HTTPS `SECURITY_ORIGIN` and verified trusted-IP configuration. Leave `OTP_DELIVERY_MODE` unset; `console` is rejected in Production. Keep `SECURITY_SMS_ENABLED=false` until deployment and one controlled delivery test are separately approved. Keep `ORDER_NOTIFICATIONS_SMS_ENABLED=false`: order-status delivery still uses its existing IPPanel Edge adapter and has not been migrated. The standalone Edge sender diagnostic remains an Edge-only tool and is not a validation of this new transport. No migration or seed is needed for the OTP provider change.

Temporary password access for an allowlisted Vercel Preview is disabled by default and requires its own expiring server-only configuration. See [preview login setup and emergency disable](docs/preview-password-login.md) before considering it; it does not register users or enable SMS.

## Database migration workflow

Inspect schema, SQL/checksums, and `prisma migrate status` first. Never edit applied migrations, manually change `_prisma_migrations`, use `migrate resolve` to hide checksum mismatches, or reset an existing database.

For an explicitly approved migration: verify conflicts and target, create a fresh backup, restore into a disposable database, trial only the approved migration, compare full data/schema integrity, then apply only the approved migration to the approved target. `prisma migrate deploy` applies all pending migrations in its supplied directory: inspect/isolate the approved set first. Do not run seeds automatically. Production requires separate approval and operational planning.

The identity migration was applied to local development during Phase 1; this does not establish production migration status. Historical invalid contacts and duplicate open orders remain documented exceptions. New submissions lock the customer row and inspect all existing open orders; noncooperating direct database writers are outside this application guarantee.

## Validation

```sh
npx tsc --noEmit --incremental false
npm run lint
npx prisma validate
node --test scripts/*.test.mjs
npm run build
npm start
```

There is no `npm test` script. `*.test.mjs` files are unit/in-memory checks; integration scripts are separate and must never target an application database. On Windows, use `npm.cmd` if execution policy blocks the npm shim.

The guarded Phase 1 launcher supports `integration`, `build`, and `browser`, with a verified private evidence-directory argument. It requires an already restored, explicitly named disposable PostgreSQL database and valid verification state. It does not authorize creating migrations or writing to the original database. `scripts/v1-phase2-browser.mjs <evidence-subdirectory> verify` checks an isolated production copy in installed Chrome, including actual SEO responses, responsive layouts, keyboard focus, and homepage independence. Providers are mocked/blocked. See the release reports for executed checks and private evidence locations; do not fabricate state files or point mutation tests at production.

Ordinary builds create `.next`. The release verification launcher builds a copied app under ignored `.backups`, with database/provider access blocked during compilation. Keep recovery artifacts and browser profiles private; backups contain local application data.

`npm run build` generates Prisma Client, then runs `next build --webpack`, matching the bundler used for release verification. Generation does not execute database migrations. The default Turbopack bundler was not separately verified.

## Deployment prerequisites

- See [Vercel configuration and Linux verification](docs/vercel-deployment-readiness.md) for the required install/build settings and Git integration review.
- Review [Phase 1 fixes](docs/v1-phase1-fixes.md) and [Phase 2 release readiness](docs/v1-phase2-release-readiness.md), including operational conditions.
- Use the lockfile, generate Prisma Client, and verify approved migrations against the deployment database after a tested backup/restore. No production migration is authorized by this README.
- Configure secrets, exact HTTPS origin, database privileges/TLS/pooling, approved team publication IDs, and provider templates. Provider delivery needs separate authorized verification.
- Verify Secure/HttpOnly/SameSite cookies, trusted proxy header replacement, abuse limits, and same-origin mutations on the deployed topology.
- Verify robots, sitemap, social image, canonical/hreflang, private noindex, real 404s, and security headers. Robots directives are not access control. Prevent public indexing of previews/staging through hosting configuration.
- Review CSP and HSTS at the actual edge before strengthening them; validate Next.js streaming and hydration. No DNS, TLS, provider, infrastructure, or deployment change is performed by local verification.
- Obtain owner confirmation for existing marketing claims and public content. Structured data contains no ratings, reviews, or invented services.

Application architecture lives under `src/app/[locale]`, `src/app/api`, `src/features/order`, `src/lib`, and shared components. Preserve the existing `submit-forn` path and locale-aware navigation. Do not commit environment files, backups, generated builds, or browser profiles.

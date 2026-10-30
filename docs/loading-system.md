# Unified loading system

This is a UI-only change. No database commands, migrations, API contract changes,
authentication rule changes, order workflow changes or real SMS were involved.
Earlier worktree changes were retained.

## Components and usage

`DreamServiceLoader` reuses the exact arch, clearance and needle paths from
`src/components/brand/geometry.json`, also used by the existing static brand mark.
The mark always points right, including in Persian layouts. An additional fine
bowstring draws back using scale/translation; the arch moves subtly under tension.

```tsx
<DreamServiceLoader loading={isFetching} success={!isError && Boolean(data)} />
<Button pending={mutation.isPending} pendingLabel={t("saving")}>{t("confirm")}</Button>
```

The loader accepts `loading`, explicit `success` (default false), `size`
(`sm`, `md`, `lg`), `variant` (`inline`, `centered`, `overlay`), `label`,
`decorative` and `className`. The optional overlay belongs inside a positioned
container; it never intercepts pointer events. Inline footprints remain reserved
when idle so buttons do not shift when the symbol appears.

The small state machine observes loading → successful completion, finishes the
draw and releases the arrow over 240 ms. CSS animation-end events dismiss the
symbol; no timers gate content, actions or navigation. Each request cycle has a
generation number, so late animation events cannot complete a newer request.
An initial success, an error/cancellation, or a repeated success value cannot
launch an arrow. No completion callback is needed.

`Button` adds `pending`, `pendingLabel` and `completed` while preserving native
disabled behavior and Radix `asChild` links. Pending buttons use a decorative
inline loader, `aria-busy`, and their localized pending text. `completed` is used
only for persistent refresh controls with a known successful result.

`Skeleton` supplies line, avatar and block shapes. `SkeletonRegion` gives a group
one localized status label and hides decorative placeholders. `ContentSkeleton`
composes card/list, details, form and page layouts. `DataTableSkeleton` remains the
shared table-row implementation; it now matches the visible columns, current page
size and chosen row density. `DataTableLoading` adds an initialization/header shell
for table routes and admin authentication initialization.

Reduced motion uses a static loading symbol and skeletons, no content fade, and
an immediate opacity-only completion dismissal. SVGs are decorative; a standalone
loader has one localized status label, and button icons do not add duplicate live
announcements. All colors use existing semantic tokens.

## Loading inventory and decisions

| Context | Loading treatment |
| --- | --- |
| Customer order list | Order-card skeletons; existing data remains during refresh |
| Customer order details/history | Detail skeleton; existing error/retry states preserved |
| Dynamic order-form configuration | Form/header skeleton; database-driven configuration unchanged |
| Order submission and shared DreamForm | Compact branded button pending state |
| Admin order review and users lists | Shared DataTable skeleton rows |
| Admin user details | Detail skeleton |
| Order decisions, existing project-start action, notification retry | Button pending state using existing mutations |
| Ban/unban, promotion/demotion | Button pending state and existing confirmation/disabled behavior |
| OTP send, verify, registration, account initialization/logout | Compact branded pending indicators; existing handlers unchanged |
| About team fetch | Card/image/text skeletons sized to the existing team cards |
| About/order routes and nested form/review/users routes | Appropriate page/card/form/table skeleton boundaries |
| Successful refresh in customer orders, admin orders and admin users | Persistent loader observes success and plays arrow release |

Loaded rows, cards and form content receive a short opacity reveal without a
visibility delay. No full-screen overlay was introduced.

Next.js `loading.tsx` boundaries, auth step changes and mutation dialogs can
unmount immediately. They intentionally use skeletons or ordinary button pending
states, without attempting a completion animation after unmount. Errors and
cancellations do not get a decorative success release.

The homepage has no asynchronous data sections; its content remains immediately
available. Countdown/hero decoration is not a loading state and was left alone.
The unreferenced legacy `orderStyles.module.css` spinner rule is not rendered and
was left untouched. No active application spinner remains outside this system.

## Verification

Final checks:

- Full automated suite: 236 tests passed.
- Real Chrome smoke run: 34 checks passed.
- TypeScript `--noEmit --incremental false`: passed.
- `npm run lint`: passed, with five pre-existing warnings and no new warnings.
- Standard production build: passed with a dummy database target and SMS disabled.
  The existing middleware-to-proxy deprecation warning remains.
- `git diff --check`: passed. The temporary preview route is absent from source
  and the production route output.

Focused tests exercise actual-success-only release, initial success, cancellation,
rapid restarts/stale animation events, localized accessible labels, skeletons,
pending/disabled buttons and Radix link compatibility. Existing order, auth,
localization, recovery and DataTable tests remain part of the full suite.
The existing test loader gained normal JSON-module support so tests load the real
brand geometry rather than replacing it with a test-only duplicate.

`scripts/loading-browser-smoke.mjs http://localhost:3000` uses an existing local
dev server, creates a temporary UI fixture, intercepts API calls with synthetic
responses, and removes the fixture afterward. It neither reads environment files
nor accesses a database. Your existing development server is not stopped. A run
without a URL uses `http://localhost:3000`; the server must already be running.

The real Chrome run passed 34 checks: English desktop and Persian mobile, both
themes, hydration, loading placeholders, exactly one release per loader per
successful request, failure dismissal, rapid restarts, reduced motion and keyboard
focus/content availability during completion. Screenshots were visually inspected.
The browser test caught and verified the fix for a reduced-motion CSS specificity
issue. It does not certify every screen-reader/browser combination.

The first build attempt used the existing offline wrapper. Its blanket socket
block also blocked Turbopack's internal worker IPC, so that attempt failed before
compilation completed. The standard production build was then run with an
unreachable dummy database URL and SMS disabled, allowing normal local build
workers without access to the project database. No build configuration was weakened.

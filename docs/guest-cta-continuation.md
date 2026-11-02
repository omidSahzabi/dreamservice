# Guest project continuation

The approved cinematic landing uses the existing locale-aware project CTA,
authentication modal and database-backed session. Its destination remains
`/order/order-form` under the active `/en` or `/fa` locale.

## Confirmed failure and fix

Before the fix, a fresh anonymous Chromium profile at `/en` could complete
browser-mocked OTP verification, receive an authenticated `/api/auth/me`
response and close the modal, yet remain at `/en`. Instrumentation confirmed
that the continuation callback existed and executed. The modal's preceding
`router.refresh()` competed with the callback's `router.push()`. Removing only
that competing refresh from the compiled diagnostic restored navigation in
the same scenario; the diagnostic was then discarded and source code fixed.

`AuthModal.tsx` now shares a completion handler across OTP, registration and
the existing preview-login path. It clears sensitive state, awaits the session
query refresh with error propagation and requires an authenticated query result.
It then captures the current store callback, closes and clears the modal, and
executes the callback once. Login without a callback refreshes the current route.
The existing attempt counter and a mounted/active guard prevent cancelled,
unmounted or already-completed attempts from navigating after late responses.

The CTA, modal store, session cookie settings, server authorization, OTP delivery,
OTP verification, schemas, environment variables and approved design are unchanged.

## Verification

Run from the isolated release checkout using installed dependencies:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint
node --require ./scripts/no-services.cjs --test --test-concurrency=1 scripts/auth-continuation.test.mjs scripts/security.test.mjs scripts/cinematic.test.mjs scripts/hero-structures.test.mjs scripts/i18n.test.mjs scripts/preview-login.test.mjs scripts/design-system.test.mjs scripts/recovery-ui.test.mjs
$env:NODE_OPTIONS='--require=./scripts/no-services.cjs'
npm.cmd run build
node --require ./scripts/no-services.cjs node_modules/next/dist/bin/next start -p 3100
```

Run the browser verifiers from a separate shell without the server preloader:

```powershell
node scripts/auth-continuation-browser.mjs http://localhost:3100
node scripts/cinematic-browser.mjs http://localhost:3100 unused --implementation-only
```

The continuation browser suite creates a fresh browser profile for each of 16
cases: authenticated CTA, guest success, cancellation, failed verification,
unconfirmed session, failed session refresh, cancellation during verification,
and registration, in each locale. It holds session responses to check that
navigation waits for confirmation and asserts exactly one navigation on success.
Unit coverage additionally checks cancellation during session refresh,
concurrent successful responses, and ordinary login's existing refresh behavior.

All browser API responses are local fixtures. Unknown mutation requests and
external browser requests are blocked. The server preloader prevents environment
loading, disables SMS and isolates database/external connections. These checks
verify navigation to the existing protected order route; its server guard remains
enabled, so they do not claim to exercise a real authenticated database-backed
order wizard or submit an order. No real SMS or production data writes are needed.

One initial concurrent regression run crossed the real clock's minute boundary
in the existing preview-login fixed-window rate-limit test. Its timestamped
requests straddled the window reset. The unchanged suite passed when rerun
sequentially. No rate-limit implementation or test expectations were weakened.

Browser results and screenshots are written to ignored
`coverage/auth-continuation` and `coverage/cinematic-review` directories.

The final release-candidate checks on 2026-11-02 passed: TypeScript in both the
original workspace and release checkout; ESLint with zero errors and the two
existing React Compiler compatibility warnings; all 326 selected regression
tests; the actual `npm run build` including Prisma Client generation; all 16
fresh-profile continuation scenarios; and all 288 cinematic browser checks.
The build retains its existing middleware deprecation and local nested-worktree
root warning. The original unrelated working files were verified against their
pre-release SHA-256 snapshot; publication uses only the selected landing files,
this modal fix, its tests and documentation.

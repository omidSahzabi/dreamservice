# Cinematic landing: local review

The supplied `dreamservice_cinematic_concept.html` is the visual source. Its
perspective Canvas geometry, seeded network, orbit decoration, five chapter
thresholds, six counter targets, and desktop/mobile proportions are ported into
the existing homepage. The approved Persian storytelling and supplied English
copy are in the `Cinematic` namespace in both message catalogs.

## Implementation and changed files

- `src/components/templates/Hero.tsx`: server-rendered hero, counters, story,
  official `BrandMark`, and final CTA presentation.
- `src/components/modules/cinematic/IndustryCounters.tsx`: localized, staggered
  count-up with an explicit illustrative-statistics caption.
- `src/components/modules/cinematic/CinematicStory.tsx`: normal page scrolling,
  sequential questions, chapter navigation, pressure display, and deferred scene.
- `src/components/modules/cinematic/HemisphereScene.tsx`: Canvas lifecycle,
  resize/DPR handling, offscreen/tab visibility suspension, reduced motion,
  horizontal touch dragging, pointer dragging, and keyboard controls.
- `src/components/modules/cinematic/hemisphere-renderer.ts`: typed reference
  renderer, readable rear clock, frame-rate-independent rotational damping,
  bowstring recoil, projected-center impact, and clock deceleration/freeze.
- `src/components/modules/cinematic/timeline.ts`: shared progression helpers.
- `src/components/modules/cinematic/ProjectCTA.tsx`: existing `useAuth` and
  `openAuthModal` success callback, continuing to `/order/order-form` through
  the locale-aware router. OTP/session internals are untouched.
- `src/components/modules/cinematic/Cinematic.module.css`: scoped reference
  styling, responsive composition, focus states, static reduced-motion story,
  and readable official branding on the cinematic background in either theme.
- `src/components/modules/navbar/Navbar.tsx`: homepage-only header composition;
  existing navigation, language control, theme control, and mobile menu remain.
- `messages/en.json`, `messages/fa.json`: matching `Cinematic` keys.
- `scripts/hero-structures.test.mjs`: updates the old hero expectations to the
  approved reference while retaining tests for the existing vector structures.
- `scripts/cinematic.test.mjs`: progression, rear-clock orientation, precise
  impact, frozen hands, reduced-motion/reset, and auth continuation fixtures.
- `scripts/cinematic-browser.mjs`: local reference comparison and browser checks.
- This report: `docs/cinematic-landing-preview.md`.

Existing homepage sections, page metadata, structured data, and footer are
retained. Existing uncommitted changes elsewhere were left in place. No package,
Prisma schema, migration, environment file, or production data was changed.

## Preview

- Persian: <http://localhost:3100/fa>
- English: <http://localhost:3100/en>

Run the production preview from the repository root:

```powershell
node --require ./scripts/no-services.cjs node_modules/next/dist/bin/next start -p 3100
```

The existing verification preloader prevents environment-file loading, points
database access at an unavailable local test endpoint, disables SMS, and blocks
outbound socket connections. Database-backed homepage content can therefore
show its existing unavailable/empty state. The production application code still
uses the real authentication/order flow. This isolated preview cannot validate
live OTP delivery or a real authenticated database transaction.

## Verification commands

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint -- --ignore-pattern=.backups/** --ignore-pattern=coverage/**
node --require ./scripts/no-services.cjs --test scripts/security.test.mjs scripts/cinematic.test.mjs scripts/hero-structures.test.mjs scripts/i18n.test.mjs
node scripts/build-offline.mjs --webpack
node scripts/cinematic-browser.mjs http://localhost:3100 C:/Users/P.S/Downloads/dreamservice_cinematic_concept.html
```

Lint omits only local backup and generated verification artifacts. The existing
offline build wrapper performs the production Next.js build using the installed
generated Prisma client; it does not run a database migration. The build's
environment-loading messages are expected under isolation. Next also reports
the existing middleware-convention deprecation.

The focused/security suites pass 269 tests, with no live services. TypeScript and
the production build pass. Lint reports zero errors and the two existing React
Compiler compatibility warnings in `data-table.tsx` and `dream-form.tsx`.

## Visual comparison

Browser screenshots cover Persian/English at 1440 × 960 and 390 × 844: opening,
hemisphere, early/all questions, accelerated clock, full draw, flight, impact,
and resolution. Additional captures cover rotation, the existing auth modal,
outro, and reduced motion. The final browser pass also checks chapter controls,
horizontal touch movement, hidden chapter accessibility, offscreen suspension,
theme/brand contrast, translation errors, hydration errors, and horizontal overflow.

Open `coverage/cinematic-review/review.html` for the side-by-side gallery.
Screenshots, `metrics.json`, and `result.json` are generated local artifacts in
that ignored directory. Rebuilding does not delete them. `--implementation-only`
can refresh the implementation captures against the retained reference captures.

Visual fidelity is close to the supplied reference: headline sizes/line breaks,
cyan gradient, navy atmosphere, six-counter composition, split/stacked story
layout, globe/clock proportions, and bow placement are preserved. Intended
differences are the real navigation/identity/auth flow, localized scene labels,
accessible controls/static reduced-motion layout, and animation corrections.

No commit, push, deployment, production write, or real SMS was performed.

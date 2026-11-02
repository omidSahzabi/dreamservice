# Cinematic impact refinement

The approved landing composition, palette, type family, globe geometry and clock
remain in place. Only the shot, impact and final story chapter were refined.

## Behavior

- A shared scroll timeline coordinates bow entry, gradual draw, tension hold,
  accelerating release, string recoil, collision, braking and typography.
  A short animation-frame filter smooths coarse wheel input without intercepting
  native scrolling. Chapter controls and skip links remain available.
- Canvas reuses the official SVG paths from `brand/geometry.json`, including the
  bow clearance mask, arrow and star. The arrow nock follows the string during
  initial acceleration. Flight ends at the projected clock hub in either layout
  direction.
- Impact uses a confined cyan-white flash, a projected circular shockwave, ten
  small deterministic particles and less than 1.2 pixels of clock vibration.
  Clock rotation integrates smooth acceleration and cubic braking analytically;
  the final damped oscillation ends before the message begins. Repeated frames
  and reverse scrolling cannot accumulate angle or spawn extra effects.
- The supplied Persian and English statements reveal in order: first statement,
  cyan statement, supporting copy, existing project action, then scroll invitation.
  The invitation is an anchor to the existing `cinematic-end` section and handles
  Enter, smooth scrolling and focus transfer. Reduced motion uses immediate
  scrolling and exposes the full story without the shot, flash or shockwave.
- The existing offscreen/hidden-tab suspension remains. The climax renders at
  animation-frame cadence rather than the ambient scene's lower frame rate.
  The cinematic navy/cyan treatment remains legible under both theme settings.
- Compact phone spacing keeps the final copy above the clock and below the
  chapter heading. Reduced-motion and scripting-disabled layouts expose final
  text without requiring animation playback.

## Files changed in this refinement

- `src/components/modules/cinematic/timeline.ts`
- `src/components/modules/cinematic/hemisphere-renderer.ts`
- `src/components/modules/cinematic/HemisphereScene.tsx`
- `src/components/modules/cinematic/CinematicStory.tsx`
- `src/components/modules/cinematic/Cinematic.module.css`
- `src/components/templates/Hero.tsx` (focusable destination only)
- `messages/en.json` and `messages/fa.json` (final copy and invitation)
- `scripts/cinematic.test.mjs` and `scripts/cinematic-browser.mjs`
- This report.

Existing unrelated working-tree changes were preserved. No dependencies,
environment files, Prisma schemas, migrations or production data were changed.

## Validation

Run the isolated preview with the existing `scripts/no-services.cjs` preloader.
It prevents environment-file loading and blocks database/external service
connections. Browser API responses are read-only fixtures; authentication
delivery and live customer transactions are outside this visual verification.

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint -- --ignore-pattern=.backups/** --ignore-pattern=coverage/**
node --require ./scripts/no-services.cjs --test scripts/cinematic.test.mjs scripts/i18n.test.mjs scripts/hero-structures.test.mjs
node scripts/build-offline.mjs --webpack
node --require ./scripts/no-services.cjs node_modules/next/dist/bin/next start -p 3100
node scripts/cinematic-browser.mjs http://localhost:3100 C:/Users/P.S/Downloads/dreamservice_cinematic_concept.html --implementation-only
```

TypeScript and the 23 focused tests pass. Both Cinematic catalogs have the same
65 keys. Full lint has no errors and the two existing React Compiler compatibility
warnings in `data-table.tsx` and `dream-form.tsx`; focused lint is clean. The
isolated production build passes and reports the existing middleware convention warning and
expected service-isolation messages. Node/Next worker checks require permission
outside the sandbox on this Windows host. Run standalone TypeScript after the
build, since a concurrent build replaces generated `.next/types` files.

The browser checks render Persian/RTL and English/LTR at 1440 × 960 and 390 × 844,
with an additional final-chapter check at 320 × 568. They cover actual SVG-to-hub
alignment, shockwave/settling snapshots, delayed supporting text, completed
typography, theme switching, Enter navigation and focus, chapter controls, the
existing authentication modal, horizontal touch rotation, reduced motion,
offscreen Canvas suspension, runtime/translation errors and overflow.

The final browser run passes all 216 checks against the final production build,
with zero runtime/translation errors and no attempted mutation requests. Both
compact phone screenshots were visually reviewed after the spacing correction.
The continuous recorded sequence was also inspected through draw, release,
collision, settling and typography. There were no database writes or real SMS.

Screenshots and continuous rendered-frame recordings are generated in the ignored
`coverage/cinematic-review` directory. `motion-review.html` provides playback and
a frame slider; `review.html` provides the existing screenshot gallery. Browser
recording time is an example scrolling pace: animation remains visitor-controlled.

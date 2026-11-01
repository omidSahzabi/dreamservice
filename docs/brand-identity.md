# Dream Service identity

The horizontal wordmark uses custom SVG paths for every letter. Its first letter
is a bow-shaped D with a tensioned string, a right-pointing arrow, and a small
celestial cross. The following paths read `ream Service`, including a visible
word space. No font, image service, external asset, filter, or added dependency
is required.

## Assets

| Asset | Purpose |
| --- | --- |
| `public/images/dreamservice-logo.svg` | Primary horizontal logo for dark backgrounds, 446 × 64 viewBox |
| `public/images/dreamservice-logo-dark.svg` | Explicit dark-background variant |
| `public/images/dreamservice-logo-light.svg` | Navy and turquoise variant for light backgrounds |
| `public/images/dreamservice-compact.svg` | Compact horizontal logo, 436 × 64 viewBox; preserves all lettering and trims outer space |
| `public/images/dreamservice-compact-dark.svg` | Compact dark-background variant |
| `public/images/dreamservice-compact-light.svg` | Compact light-background variant |
| `public/images/dreamservice-mark.svg` | Symbol-only logo, 32 × 32 viewBox, dark-background default |
| `public/images/dreamservice-mark-dark.svg` | Explicit dark-background symbol |
| `public/images/dreamservice-mark-light.svg` | Light-background symbol |
| `public/images/dreamservice-wordmark.svg` | Compatibility URL for the complete new horizontal logo |
| `src/app/icon.svg` | Navy application tile with the new symbol |
| `src/app/favicon.ico` | 16, 32, and 48 px PNG frames in an ICO directory |
| `src/app/apple-icon.png` | 180 × 180 Apple icon |
| `public/icons/icon-192.png` | 192 × 192 application icon |
| `public/icons/icon-512.png` | 512 × 512 application icon |
| `public/icons/icon-maskable-512.png` | 512 × 512 maskable icon with foreground inside its circular safe zone |

Dark backgrounds use white `#F8FAFC` lettering and cyan `#22D3EE` accents.
Light backgrounds use navy `#06111E` lettering and turquoise `#06B6D4` accents.
The application tile and manifest background use navy. No purple is used.

## Shared implementation and integration

- `src/components/brand/geometry.json` owns the symbol and lettering paths.
- `BrandMark.tsx` renders the reusable symbol with instance-specific mask IDs.
- `BrandWordmark.tsx` integrates the symbol as the first letter of the wordmark.
- `BrandIdentity.tsx` selects compact or primary lettering at the existing
  responsive breakpoint, reserving 172 × 32 px or 200 × 36 px before rendering.
- The `ds-brand` styles in `src/styles/globals.css` follow the application's
  theme class without client-side theme detection or image requests.
- The existing localized `Logo` link supplies the accessible name. Its child
  SVGs are decorative and remain LTR inside Persian RTL layouts.
- Header, mobile navigation, footer, customer and admin route headers, and
  global recovery screens use the shared identity. The authentication modal
  adds the same localized home link above its existing form.
- `DreamServiceLoader.tsx` uses the new bow, arrow, and string geometry while
  preserving its loading/success state machine, motion, and accessibility.
- `src/app/manifest.ts`, the App Router icon files, and the social image route
  publish the new identity. `src/lib/i18n/metadata.ts` uses the spaced brand name
  in social metadata. Existing page translations and locale routing are retained.

Regenerate the committed assets with `node scripts/generate-brand-assets.mjs`.
The generator uses the already installed Sharp package. Application components
and generated SVGs share the same geometry; the previous public logo URLs are
retained so cached links do not lead to missing files.

## Verification

Verified on 2026-11-01, Asia/Tehran, in an isolated checkout based on production
master. Unrelated authentication work in the original workspace is excluded.

- Installed TypeScript: `--noEmit --incremental false` passed.
- `npm run lint` passed with zero errors and two existing React Compiler
  compatibility warnings in the table/form components.
- The design-system, loading-system, order-loading, recovery-ui, i18n, and
  v1-phase2 suites passed all 59 tests. Checks cover shared geometry, theme
  variants, raster dimensions, ICO frames, maskable safe-zone pixels, localized
  link names, unique masks, reduced-motion rules, and loader state transitions.
- The actual `npm run build` passed, including Prisma Client generation and
  Next.js's Webpack production build. Environment-file loading and external
  service connections were blocked with the existing verification preloader.
  The build retains the existing middleware deprecation warning and reports
  multiple workspace lockfiles because of the local release checkout.
- `scripts/branding-browser-smoke.mjs` passed 84 checks against the production
  build in installed Chrome. It covers English/Persian, LTR/RTL, light/dark,
  widths 320/390/1440, header, footer, mobile drawer, authentication modal,
  and the shared branding on customer/admin routes. It checks bounds, colors,
  reserved dimensions, and accessible links, and saves screenshots locally.
- Browser requests to APIs were mocked; forms were never submitted. Dashboard
  checks used signed-out routes, not authenticated customer data. No production
  database, SMS, ordering, session, schema, migration, or environment setting
  was changed by this redesign.
- The existing loader browser suite passed all 34 checks in both locales and
  themes, including success-only arrow release, failure dismissal, rapid
  restart, focus preservation, and reduced motion. Its temporary local fixture
  was removed after verification.

The browser script accepts a local server URL as its first argument. Start the
server with the existing service-blocking verification preloader for isolated
validation. It rejects non-local targets and never submits forms.

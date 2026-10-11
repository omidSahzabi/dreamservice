# DreamService Engineering Rules

## Project Overview

- Build toward a stable DreamService V1.0 production release.
- Support English (`en`) and Persian (`fa`) throughout the user experience.
- Admin dashboards and blog/CMS are outside this release scope; existing models
  or navigation entries do not authorize implementing those features.
- Stack: Next.js 16 App Router, React 19, strict TypeScript 5, Tailwind CSS 4,
  next-intl 4, and Prisma 5 with PostgreSQL.
- Pages and layouts live in `src/app/[locale]`; HTTP handlers live in `src/app/api`.
- Order features live in `src/features/order`; shared UI primitives, modules,
  and page sections live in `src/components/ui`, `modules`, and `templates`.
- Shared hooks, utilities, schemas, types, and Zustand stores live in
  `src/hooks`, `src/lib`, `src/schemas`, `src/types`, and `src/store`.
- TanStack Query manages remote client data; React Hook Form and Zod support
  forms. Authentication uses OTP flows and database-backed cookie sessions.
- Prisma maps data across the `public`, `entity`, and `upro` PostgreSQL schemas.

## Architecture Rules

- Preserve these boundaries and the existing architecture.
- Prefer small, focused, maintainable changes; avoid unrelated refactoring.
- Reuse existing components, hooks, utilities, and feature patterns before
  introducing alternatives. Preserve existing paths, including `submit-forn`.
- Use the existing `@/*` alias for imports from `src` and follow nearby imports.
- Respect Server and Client Component boundaries. Add `"use client"` only where
  browser APIs, state, event handlers, or client hooks require it.
- Keep Prisma, session access, and other server-only operations out of client
  modules and their import graphs. Reuse `src/lib/prisma.ts` for database access.
- Reuse UI primitives, Tailwind theme tokens in `src/styles/globals.css`, and
  the existing `cn` utility rather than duplicating styling infrastructure.
- Do not add dependencies or introduce large abstractions without approval.

## TypeScript and Code Quality

- Keep TypeScript strict mode enabled and prefer explicit types at API,
  component, and data boundaries; use inference where it remains clear.
- Avoid `any`, unsafe casts, non-null assertions, and unnecessary complexity.
  Narrow `unknown` values with validation or guards before using them.
- Follow naming, imports, indentation, quotes, and semicolon conventions in
  the surrounding files; conventions vary across existing folders.
- Do not suppress ESLint or TypeScript errors or weaken their configuration.
- Avoid duplicate code and unnecessary client-side JavaScript.
- Existing hardcoded text, unsafe typing, or test shortcuts are not precedents
  for new code. Report relevant defects without expanding scope silently.

## Internationalization

- Use the existing next-intl infrastructure: `i18n/request.ts`, the plugin in
  `next.config.ts`, `middleware.ts`, and `src/app/[locale]/layout.tsx`.
- Support both `en` and `fa`; preserve locale-prefixed routes and locale-aware
  links, redirects, and language switching. API paths remain under `/api`.
- Keep translation-key parity between `messages/en.json` and `messages/fa.json`.
  Add, rename, or remove corresponding keys in both files together.
- Use descriptive keys organized by feature, following existing namespaces
  such as `Navbar`, `About`, `Metadata`, and `OrderForm`.
- Do not hardcode user-facing text, including errors, validation messages,
  accessibility labels, metadata, and loading or empty states.
- Use next-intl interpolation and ICU pluralization where appropriate; avoid
  constructing translated sentences by concatenating fragments.
- Preserve `lang` and `dir` in the locale layout: Persian is RTL, English LTR.
  Check alignment, directional icons, controls, and mixed-direction content.
- Preserve the database-driven order form architecture: steps, fields, options,
  ordering, validation, visibility, and localized labels come from Prisma via
  `/api/order/order-form-config`. Do not replace them with static form definitions.
- Keep database-backed form translations in their existing translation records
  or localized JSON fields; use message files for interface text and fallbacks.
- Include locale in query keys for locale-dependent data, as the form hook does.
- Keep API codes, IDs, enums, field keys, option values, and other machine-readable
  values language-independent; translate their display labels separately.

## Security and Data Integrity

- Never expose credentials, OTPs, session tokens, or sensitive customer information
  in client bundles, logs, responses, documentation, or agent output.
- Never weaken authentication, authorization, or session handling, including
  session expiry and cookie security settings.
- Derive identities and permissions from trusted server session data using the
  existing session helpers. Never trust client IDs, roles, or persisted UI state.
- Do not copy test-user fallbacks into production flows. Enforce ownership and
  permissions on the server before accessing or changing customer data.
- Validate untrusted input on the server with Zod or equivalent existing guards;
  client form validation alone is insufficient. Return safe error responses.
- Do not modify Prisma schemas or migrations without explicit approval.
- Never run destructive database commands, including resets, drops, or truncation.

## Agent Workflow

- Inspect relevant files and Git status before modifying anything.
- For substantial changes, propose a short plan before implementation.
- Work in small, reviewable batches and modify only files needed for the task.
- Do not overwrite, discard, or revert existing user changes.
- Do not edit environment files or read or print secret values for routine work.
- Do not install dependencies without approval.
- Do not push, merge, reset, or rewrite Git history without approval.
- Run relevant validation when possible. Existing scripts are `npm run lint`
  and `npm run build`; there is no configured test script in `package.json`.
- For type validation, use the installed TypeScript compiler with `--noEmit`
  and `--incremental false` when appropriate; do not install tools to run checks.
- For UI or localization changes, verify affected flows in both locales and
  directions when possible. Never use a production database for validation writes.
- Clearly report modified files, checks actually executed, their results, and
  remaining issues. Distinguish pre-existing failures from those introduced.
- Never claim tests passed unless they were actually executed; state when a
  check was skipped or blocked and why.

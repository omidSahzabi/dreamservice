# DreamService V1.0 support ticketing

Ticketing is **ACTIVE on the original local `dreamservice` database**.
There are **six successfully applied migrations**, and Prisma reports the
database up to date. No test tickets, messages, notification records, accounts,
or orders were inserted into the original database for this feature.

## Models and migration

`202610290002_support_ticketing` adds two enums and three tables in `entity`:

- `SupportTicket` / `support_tickets`: UUID identity, a unique human-readable
  ticket number, customer, optional order, subject, status, priority, timestamps,
  closed timestamp, and customer-scoped creation idempotency key/hash.
- `SupportTicketMessage` / `support_ticket_messages`: UUID, ticket, authenticated
  sender, server-assigned sender category, plain-text body, timestamp, and
  sender-scoped idempotency key/hash.
- `SupportTicketNotification` / `support_ticket_notifications`: one durable
  in-app event per notified message. A null recipient means the admin inbox;
  otherwise the recipient is the ticket's customer.

The migration creates 15 indexes (including primary/unique indexes), one new
ticket-number sequence, foreign keys with restrictive deletion, and checks for
nonblank text and consistent closed timestamps. Indexes cover customer/recent
activity, status/priority, priority, global recent activity, linked orders,
message ordering, idempotency, and notification inboxes. Messages and tickets
have no deletion API; message text and sender identity cannot be edited.

The five existing migrations were checked against their recorded SHA-256
checksums and remained byte-for-byte unchanged. The new migration's checksum is
`6d7731e3a376ddf5024165cfc4b6288baf9605b23c65c0b21856d0fdc4d50183`.
Its SQL creates only ticket objects, with transaction and lock timeouts. It does
not alter existing application tables, indexes, or data.

## Routes and customer experience

All page routes support both `/en` and `/fa`:

| Page | Purpose |
| --- | --- |
| `/support` | Own tickets, subject/number/full-ID search, status filters, recent activity, summary counts, notification inbox |
| `/support/new` | Required subject and first message, optional owned-order selector |
| `/support/[ticketId]` | Conversation, metadata, bounded message pages, reply, explicit reopen |
| `/admin/tickets` | All tickets, customer/subject/number/ID search, status and priority filters, summary counts |
| `/admin/tickets/[ticketId]` | Conversation, replies, status and priority changes, close/reopen, authorized order information |

The generic DataTable supplies server pagination and filtering. List size is
bounded to 50; the UI defaults to 10 tickets. Conversation pages contain at most
50 messages and default to the latest 20, presented chronologically. Older and
newer page controls expose the complete history without fetching it all at once.
Summary counts show open, processing, waiting, and closed tickets and act as
filters. Lists sort by latest conversation activity, with ID as a stable tie
breaker.

The creation form pages through only the caller's orders. Opening
`/support/new?orderId=123` prefills the selector but creates nothing. The server
checks ownership both when loading that selection and when submitting. Customer
order details include a localized support action, and both ticket views link
back to the existing protected order details page; no order workflow changes.

Customer and support messages use opposite logical alignment, translated sender
labels, localized timestamps, plain-text rendering, and wrapping for long input.
Only a successful reply by the current viewer requests scrolling to that reply.
Refreshes and browsing older pages do not force scrolling. Forms, badges,
pagination, skeletons, pending buttons/DreamServiceLoader, errors, and empty
states use existing components and theme tokens. Navigation includes Support
and an admin-only Manage tickets entry.

## APIs

- `GET/POST /api/support/tickets`
- `GET/PATCH /api/support/tickets/[ticketId]`
- `POST /api/support/tickets/[ticketId]/messages`
- `GET /api/support/orders`
- `GET /api/support/notifications`
- `GET /api/admin/tickets`
- `GET/PATCH /api/admin/tickets/[ticketId]`
- `POST /api/admin/tickets/[ticketId]/messages`
- `GET /api/admin/tickets/notifications`

Responses reuse private/no-store JSON and safe machine-readable error codes.
There are no DELETE endpoints. Details and message reads are ownership-scoped;
unowned and nonexistent tickets both return `404`. Anonymous/banned sessions
receive `401`; non-admin management requests receive `403`.

## Lifecycle and concurrency

| Action | Result |
| --- | --- |
| Customer creates | `OPEN`, `NORMAL`; ticket, first message, and notification intent commit atomically |
| Admin replies | `WAITING_FOR_CUSTOMER`; message and activity timestamp commit together |
| Customer replies | `OPEN`; message and activity timestamp commit together |
| Admin processes | Validated changes among non-closed statuses or closing |
| Admin closes | `CLOSED` with `closedAt` set |
| Customer/admin explicitly reopens | `OPEN` with `closedAt` cleared; history retained |

Normal replies to closed tickets are rejected. Priority changes are admin-only.
Management changes require the current `updatedAt` version; stale changes return
a conflict. Message writes lock the ticket row and advance activity/version
timestamps monotonically. Concurrent replies cannot overwrite each other's
messages, and the final status follows the last committed message.

Writes take a shared version of the existing user-management advisory lock.
Bans/demotions use its exclusive version. The transaction then rechecks the user
and, for admin operations, the exact `PersonProfile.role === 'app-admin'`
contract. This permits unrelated ticket writes concurrently while serializing
them with management revocations. Per-request advisory locks and database unique
keys prevent concurrent duplicate submissions.

Creation/reply keys are supplied by the UI and retained on ambiguous failures.
The server compares canonical payload hashes before replaying a successful
result. Reusing a key for changed content yields an idempotency conflict.

## Security and notification behavior

The existing database-backed cookie session, expiry, banned-user enforcement,
and role helpers remain authoritative. Identity, ownership, sender category,
and permissions never come from request data. Strict Zod schemas reject extra
fields, identity injection, invalid statuses, and oversized subjects/messages.
Mutation requests use the existing origin/content-type/body-size checks.
Existing database rate limiting permits 10 creations/hour, 20 replies/minute,
and 30 management/reopen changes/minute per actor.

The notification feed is the V1 delivery channel. Intent is saved in the same
transaction as each creation/reply, with a unique message constraint preventing
duplicate events. Feeds exclude the sender. Customer events are restricted to
the recipient and owned ticket; the separate admin feed requires the admin role.
A failed inbox read cannot undo a committed ticket/message and can be retried
by refreshing. An intent persistence failure rolls back the write rather than
silently losing its notification.

No SMS or email integration, delivery worker, or external provider is invoked.
The existing order SMS/retry code is intentionally unchanged because it is
specific to order-status history. In-app events persist; individual read
acknowledgements and external delivery/retry remain future work. All ticket
query caches include actor/locale and participate in existing identity-change
and logout cancellation/removal.

## Backup, restore, and activation evidence

Local private evidence is retained under
`.backups/ticketing-activation-20261029-v2/` (Git-ignored):

- Fresh custom-format backup: **93,935 bytes**.
- Backup SHA-256:
  `7b5600a8a3024ee04939bc586ca585cade0b36670cc175156fa9612dc2c9cbb1`.
- Archive listing verified and full backup successfully restored to
  `dreamservice_tickets_test_15175c29e6f54d1985073519bcddf30e`.
- Original table row counts/content fingerprints, index definitions, sequence
  definitions/states, and migration records matched the isolated restore.
- The installed pg_restore 18 emits `SET transaction_timeout = 0`, unsupported
  by local PostgreSQL 15. Only that setting was removed from the extracted
  restore script; backup bytes and historical migrations were unchanged.
- The new migration was trialed on the restored database and reported up to date
  before integration tests and browser writes began there.
- Only after those checks passed was the identical migration applied locally.

Before/after original database results:

| Check | Before | After |
| --- | ---: | ---: |
| Total tables, including Prisma history | 24 | 27 |
| Indexes | 69 | 84 |
| Sequences | 15 | 16 |
| Applied migrations | 5 | 6 |
| Existing Project records | 1 | 1 |
| Tickets / messages / notification events | absent | 0 / 0 / 0 |

All **23 existing application tables** retained their exact row counts and
content fingerprints. The history table gained only the expected sixth Prisma
migration record; all five historical records remain unchanged. All 69 existing
physical index identities/definitions and 15 existing sequence states are
unchanged. All 15 new indexes are valid/ready. The original demo Project's
fingerprint and deadline remain unchanged. A final read-only comparison after
the dev-server restart and browser checks passed.

The six applied migrations are the existing schema baseline, security
foundation, order workflow, user management, projects, and support ticketing.
No reset, truncation, production operation, manual history edit, or migration
resolve was used.

## Validation and actual browser results

- Offline Prisma validation and Client generation: passed.
- Strict TypeScript (`--noEmit --incremental false`): passed.
- Existing automated regression suite: **265 passed**.
- New ticket validation/localization/cache/migration unit checks: **7 passed**.
- Live isolated PostgreSQL integration: **17 passed**, covering atomic initial
  writes, authorization/bans/role revocation, ownership, order links, lifecycle,
  stale changes, real rate limits, pagination, idempotency, concurrent replies
  and close/reply races, notification persistence/read failures, and regressions.
- ESLint: zero errors; the four existing DataTable/DreamForm React Compiler,
  plusCard image, and autoplay-dependency warnings remain. No new ticket warnings.
- Optimized production build with TypeScript and all routes: passed. It ran in
  an isolated source copy with environment-file/database/external-service access
  disabled, preserving the active development server's build files.
- Actual Chrome + Next.js + PostgreSQL browser flow: passed, without intercepted
  API requests. Test accounts used genuine hashed database sessions in the
  restored database; OTP delivery was not invoked.
- Browser acceptance: linked creation, customer list/search, admin list, admin
  reply, customer reply, priority change, admin close, explicit customer reopen,
  direct linked-order details for both roles, Persian standalone creation, unauthorized access/order-link denial, and
  escaped HTML/XSS text all passed. All previous messages remained present.
- English/Persian, customer/admin, desktop/mobile, light/dark: **16 visual
  combinations** passed without missing translations or hydration exceptions.
  Final screenshots and real API status evidence are in `browser-QAyWbq/`.
- Original localhost application was restarted with the regenerated Client and
  SMS disabled. Read-only Chrome checks confirmed both homepages' original
  seven-item portfolio and live demo countdown, sign-in guards on support/new/
  admin-ticket pages, and `401` from anonymous ticket/order/inbox APIs.

`scripts/ticketing-activation.mjs` implements one-shot inspection, backup/restore/
trial, isolated integration, isolated browser, guarded activation, and final
read-only verification stages. Do not rerun activation on the now-active
database. The integration suite requires a fresh migrated fixture database;
it never resets or deletes existing tickets. Browser fixture runs use fresh
synthetic identities and retain their conversation history in the disposable
database. Connection guards reject production and the original database for
write-based tests. Credentials and raw session tokens are not retained in reports.

## V1 limitations

No attachments, WebSockets, SLA, assignment, public ticket URLs, message editing,
or deletion are provided. Conversation/inbox updates use explicit refresh and
bounded pages rather than polling or push delivery. Offset message pages can
move if new replies arrive; returning to the newest page refreshes the view.
There is no external notification delivery or per-admin read acknowledgement.
These limits do not block the completed customer/admin lifecycle.

No commit or push was performed. Unrelated uncommitted work was preserved.

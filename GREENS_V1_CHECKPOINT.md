# The Greens V1 — Checkpoint

Branch: `greens-v1` @ `1230e87ec6fea733b9a6ea3d1b1e3d1e26ce7436` (pushed, `origin/greens-v1` identical — 0 ahead / 0 behind). `main` untouched.

## What is complete

**Admin**
- Manage Amenities: full CRUD (name/type/capacity/description, enable/disable, hours, booking duration, advance window, min-cancellation, max/day, admin-approval), multi-day maintenance blockouts with confirm-before-delete, upcoming-reservations list, 30-day utilization stat.
- Community Detail screen (Overview/Reports/Amenities/Members tabs), Members search + resend-invite + deactivate, Reports status/notes + message-resident.
- Portfolio: real "Add Community" flow; admin calendar merges `hoa_events` + `bookings` + `court_maintenance`.
- Alerts: misleading local-only "Dismiss" removed — alerts now only disappear when the underlying condition resolves (per product decision, no persistent dismissal system was built).
- All Supabase writes across Manage Amenities, Community Detail, Add Community, and portfolio-wide Maintenance Reports now surface real errors via `Alert` instead of silently failing.

**Resident**
- Community-mode nav (Match/Coaches tabs hidden, Community tab added), `Header` now shows the real HOA name everywhere (`useCommunityName()`), not a generic fallback.
- Schedule no longer hides admin-created Board Meeting / Maintenance events (previously silently dropped).
- Booking sheet's Singles/Doubles toggle hidden for non-tennis amenities (was a dead control — duration calc never read it for non-tennis bookings).
- Home and Me screens no longer show tennis-only UI (Find Match/Find Coach tiles, NTRP stat, lesson/match empty-state prompts that routed into hidden tabs) in Community mode.

## Database migrations already applied (live, verified)

Both applied via Supabase MCP `apply_migration`, individually, and verified against `information_schema`/`pg_constraint` post-apply:
- `20260817013205_greens_v1_amenities_admin_fields` — `courts.is_active/capacity/description`, `court_maintenance.end_date`.
- `20260817013212_greens_v1_membership_removed_status` — `hoa_memberships` status CHECK widened to include `'removed'`.

No Match v2 migration was applied, modified, or renamed. No `supabase db push` was ever run.

## Remaining RLS concern (not fixed — needs your call)

`maintenance_reports` has two different admin-detection mechanisms: the UPDATE policy checks `hoa_memberships.role='admin'`, but the SELECT policy checks a separate `has_role()` + `profiles.hoa_id`. An admin could plausibly satisfy one but not the other depending on how their account was set up. Not touched — a schema/RLS change needs its own migration and explicit sign-off, and guessing wrong risks breaking working admin report access.

Also noted, not fixed: `hoa_notifications` INSERT policy is `with_check: true` (any authenticated user can insert a notification for any `user_id`). Pre-existing, not introduced by Greens V1. Resend Invite works fine under it; it's just more permissive than it probably should be.

## Real-device QA still required

- Visual/tap-through on every changed screen — nothing here has been seen rendered.
- Whether a real HOA admin account can see maintenance reports end-to-end (the RLS mismatch above).
- Full non-tennis booking flow (pool/clubhouse/etc.) on device now that the Play Type toggle is hidden for those amenities.
- Community mode end-to-end with `EXPO_PUBLIC_PRODUCT_MODE=community` set in a real build.

## Optional design pass still remaining

Not attempted — lowest priority in the original plan, broad/subjective (hierarchy, spacing, typography, cards, loading/empty states) across many screens. Deliberately deferred until after device QA confirms the functional layer is solid, so polish isn't spent on screens that might still need functional rework.

## Exact recommended next step

Run the app with a real HOA admin account against production data, open Manage Amenities → Community Detail → Reports, and confirm reports actually load for that admin (this is the one open question that could be a real blocker — everything else in this checkpoint is either verified or explicitly deferred by choice).

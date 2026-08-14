# The Greens V1 — Implementation Plan

Branch: `greens-v1` (baseline commit `c05b94131bf3896f9d94d4dc97057d2b85b56ea2`, pushed to `origin/main` before branching).

Goal: ship a launch-ready HOA "Community" mode (The Greens) as a product/configuration layer on top of the existing TenisX app, without deleting, breaking, or degrading any existing tennis functionality (Match, Coaches, Lessons, Clinics, discovery, tennis profiles) or its schema.

---

## 1. Reusable existing features (don't rebuild)

| Area | What's already solid | Why it's reusable as-is |
|---|---|---|
| Reserve/booking engine | `src/app/(resident)/courts.tsx`, `amenity-book.tsx`, `my-reservations.tsx` | Already amenity-generic, not tennis-only. `courts` table + `court_type` already models tennis and non-tennis amenities (pool/BBQ/clubhouse/gym/spa/basketball via `OUTDOOR_TYPES`). `amenity_rules` table already stores advance-booking window, booking hours, max duration (incl. peak-hour variants), min-cancellation-hours, max reservations/day/week, admin-approval requirement, security deposit. Cancellation flow with time-window checks already works (`my-reservations.tsx:92-107`). |
| Pending join requests | `src/app/(admin)/pending-requests.tsx` | Real data (`community_join_requests` + `profiles`), realtime, approve/reject via RPC with fallback, email notification. Solid — extend, don't replace. |
| Maintenance report workflow | `src/app/(cm)/maintenance.tsx` | Real data, community/category/status filters, status-change + admin-notes save all wired correctly. This is the strongest existing screen — goal explicitly says keep its list/detail structure. |
| Portfolio real-data cards | `src/app/(cm)/index.tsx` | Member/pending/open-issue/amenity counts are already pulled from real Supabase tables (`hoa_memberships`, `maintenance_reports`, `courts`, `community_join_requests`, `bookings`), not fake. Only the "health score" is a client-side heuristic — keep it, but label it as computed, not authoritative.
| Calendar shell | `src/app/(cm)/calendar.tsx` | Month grid + week-dates logic, event-type filter chips, create-event flow already built against `hoa_events`. Needs new data sources merged in (see §2), not a rewrite. |
| Legacy feature-flag pattern | `src/config/featureFlags.ts` (`TENNIS_FEATURES_ENABLED`) | Precedent for exactly the hide/show mechanism Community mode needs — currently only wired into the legacy web app, needs porting into `src/app/`, not reinventing. |
| Messaging | `messages` table (generic sender_id/receiver_id/content) | Reusable for "message resident" from a maintenance report — no new table needed. |
| Design tokens | `src/constants/design.ts`, `src/components/ui/*` | Card/Button/Header components reusable; Community mode is a styling variant, not a new design system. |

## 2. Broken / missing admin flows (from live audit)

1. **Admin bottom nav IA bug** — the visible "Alerts" tab (`(cm)/_layout.tsx`) is actually wired to `messages.tsx` (an inbox); the real `alerts.tsx` screen exists but is unreachable (`href: null`) and has a dead "Take Action" button (`alerts.tsx:204-206`, no `onPress`).
2. **Portfolio dead controls** — "ADD COMMUNITY" card has no `onPress` at all (`(cm)/index.tsx:236-241`); top stat cards for Open Issues/Bookings/Members are non-interactive; "Manage →" only routes to a flat amenities list, no real community detail screen exists in the native app at all (the tabbed Overview/Reports/Amenities/Members detail screen the goal describes doesn't exist yet — only a legacy, unreachable web version does).
3. **Manage Amenities is shallow, and duplicated** — `manage-amenities.tsx` and `manage-courts.tsx` are two separate, overlapping screens (both titled "Manage Amenities"), neither exposes the rich `amenity_rules` fields that already exist in the DB (hours, duration, advance-booking window, cancellation rules, capacity, peak hours). Only name + type + delete are wired. `manage-courts.tsx` has an hour-by-hour maintenance toggle but no date-range blockout, no capacity, no enable/disable.
4. **No member management** beyond pending join requests — no searchable list of existing members, no resend-invite, no deactivate/remove.
5. **Calendar is `hoa_events`-only** — doesn't surface real `bookings` (reservations) or real `court_maintenance` (blockout) records; "maintenance_scheduled" today is just a manually-created event type, not tied to actual blockout data.
6. **Reports has no "message resident" affordance** — status/notes are wired, but there's no path from a report's detail view into a message thread with the reporter.
7. **Resident nav has no mode concept at all** — `TENNIS_FEATURES_ENABLED` flag exists but is never imported by `src/app/**` (verified zero references); native tabs/`Header.tsx` hardcode TenisX branding and tennis tabs unconditionally.

## 3. Architecture / config approach

Add a single source of truth: `src/config/productMode.ts`.

```ts
export type ProductMode = 'community' | 'tennis';

export const PRODUCT_MODE: ProductMode =
  process.env.EXPO_PUBLIC_PRODUCT_MODE === 'community' ? 'community' : 'tennis';

export const isCommunityMode = PRODUCT_MODE === 'community';
export const isTennisMode = PRODUCT_MODE === 'tennis';
```

- Driven by `EXPO_PUBLIC_PRODUCT_MODE` env var — same pattern as the existing (legacy) `EXPO_PUBLIC_TENNIS_FEATURES_ENABLED`, just promoted to a first-class native config and given two explicit named modes instead of a single boolean, since "disabled tennis features must disappear from navigation, not just toggle a flag."
- `(resident)/_layout.tsx` and `BottomNav.tsx` consume `isCommunityMode` to omit Match/Coaches tabs and add a Community tab — via conditional `Tabs.Screen` inclusion, not deleting the route files.
- `Header.tsx` accepts community name/logo from `hoas` table data (already fetched per-screen) instead of hardcoding the TenisX asset when `isCommunityMode` — per goal §5, community identity must come from data/config, never hardcoded to "The Greens."
- No route files, components, or migrations for Match/Coaches/Lessons/Clinics are touched or deleted. This satisfies "config/mode, not a fork."

## 4. DB / RLS changes (staged migrations only — none applied to live DB)

All new migrations go in `supabase/migrations/`, filenames prefixed with a timestamp after the current latest, **and will be committed as "(not yet applied)"** exactly like the existing Match v2 migrations, per your explicit instruction not to run `supabase db push`.

1. `courts` — add `is_active boolean not null default true`, `capacity integer null`, `description text null`. Needed for enable/disable and capacity requirements (goal §1 Amenities) — `amenity_rules` already covers the rest.
2. `court_maintenance` — add `end_date date null` (nullable, defaults to same-day when null) to support multi-day blockout ranges, not just same-day time windows.
3. New RLS `UPDATE` policy on `courts` for hoa admins (mirroring the existing INSERT/DELETE admin policies already proven safe in `manage-amenities.tsx`/`manage-courts.tsx`) so the new edit/enable-disable UI can write.
4. New RLS `UPDATE`/`INSERT` policy check on `amenity_rules` scoped to hoa admins of the owning `hoa_id` (reuse the same admin-role check pattern already used elsewhere — **not** inventing a new actor-derivation pattern, learning from the Match RLS recursion bug: derive actor from `auth.uid()` server-side, never accept a caller-supplied actor id).
5. Optional (nice-to-have, not blocking): `messages` gets a nullable `maintenance_report_id uuid references maintenance_reports(id)` column, mirroring the existing nullable `lesson_request_id` pattern, so "message resident" threads are traceable to a report.

No changes to `hoas`, `hoa_memberships`, `maintenance_reports`, `hoa_events`, `community_join_requests`, or `profiles` schemas — all existing columns already cover the goal's requirements for Portfolio, Members, Reports, and Calendar data.

## 5. Affected files (by task)

- **Config**: new `src/config/productMode.ts`; edits to `(resident)/_layout.tsx`, `BottomNav.tsx`, `Header.tsx`.
- **Admin nav**: `(cm)/_layout.tsx`, `(cm)/alerts.tsx`, `(cm)/messages.tsx`.
- **Portfolio**: `(cm)/index.tsx` (wire ADD COMMUNITY, Manage CTA → new detail route).
- **Community Detail (new)**: `src/app/(cm)/community/[hoaId]/_layout.tsx` + `overview.tsx`, `reports.tsx` (thin wrapper reusing `maintenance.tsx` logic filtered by hoaId), `amenities.tsx`, `members.tsx`.
- **Amenities CRUD**: consolidate `manage-amenities.tsx` + `manage-courts.tsx` into the new `community/[hoaId]/amenities.tsx` (or keep both routes but have them render the same shared component — decide during implementation based on whether other screens still link to the old routes).
- **Members**: new `community/[hoaId]/members.tsx`, reusing `pending-requests.tsx` approve/reject RPCs.
- **Calendar**: `(cm)/calendar.tsx` — add `bookings` + `court_maintenance` queries alongside `hoa_events`.
- **Resident IA**: `(resident)/_layout.tsx`, new `(resident)/community.tsx` tab (reusing `docs.tsx`/`announcements.tsx` content).
- **Migrations**: new files per §4, all staged/unapplied.

## 6. Estimated hours

| Task | Hours |
|---|---|
| Product-mode config + resident nav wiring | 3 |
| Admin nav IA fix (Alerts/Messages, dead button) | 1.5 |
| Amenities CRUD overhaul (UI + staged migration) | 8 |
| Community Detail screen (4 tabs) | 6 |
| Members management screen | 5 |
| Calendar data-source merge (reservations + blockouts) + week/month distinction check | 4 |
| Resident Community tab + Header de-hardcoding | 3 |
| Design pass (calmer Community styling) | 3 |
| Manual QA + compile/lint/test verification pass | 2 |
| **Total** | **~35.5 hours** |

## 7. Implementation order

1. Product-mode config module (unblocks everything else, zero risk).
2. Admin nav IA fix (small, isolated, fixes a real live bug).
3. Staged DB migrations for amenities (courts.is_active/capacity, court_maintenance.end_date, RLS) — written and committed, not applied.
4. Amenities CRUD overhaul (biggest single admin gap, goal's top stated priority).
5. Community Detail screen (Overview/Reports/Amenities/Members tabs), wiring Amenities tab to the CRUD built in step 4, Reports tab to existing maintenance logic, Members tab to step 6's work.
6. Members management screen.
7. Calendar data-source merge.
8. Resident Community-mode nav + Community tab + Header de-hardcoding.
9. Design pass.
10. Full verification pass (compile, lint, existing Playwright suite) + final report.

Each step is committed to `greens-v1` individually after `npm run dev` confirms compilation, per Autonomous Mode Rules in CLAUDE.md.

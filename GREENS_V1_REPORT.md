# The Greens V1 — Session Report

Branch: `greens-v1` (pushed to `origin/greens-v1`), based on `main` @ `c05b941` (pushed to `origin/main` this session).
8 commits, all reviewed against a scoped TypeScript baseline before each commit. No merge to `main` performed.

## 0. Safety (goal step 0)

- Confirmed branch/status/HEAD, pushed `main` (65 previously-unpushed commits) to `origin/main` — blocked initially by GitHub secret-scanning on a Mapbox `pk.` (public-format) token in old history; resolved via GitHub's allow-secret flow after confirming it's a client-safe token, not a real secret. Full detail earlier in this conversation.
- Found and flagged separately: `TEST_EMAIL`/`TEST_PASSWORD`/`TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` are already public in git history on already-pushed commits (predates this session). You confirmed the admin one is a disposable mock account. Added a local pre-commit hook (`.git/hooks/pre-commit`) blocking future `.env` commits and common secret patterns — local-only, won't sync to another machine or a collaborator.
- Created `greens-v1` off pushed `main` HEAD, confirmed matching commit hash.
- No Match v2 migrations touched, applied, or modified. `supabase db push` was never run — nothing in this session touched the live database.

## 1. Completed features

**Admin**
- Fixed the Alerts/Messages tab mislabeling (the visible "Alerts" tab was actually the Messages inbox; the real alerts screen was unreachable) and the dead "Take Action" button, now routes to Pending Requests or the specific maintenance report.
- Fixed a real, pre-existing bug: `alerts.tsx` and `maintenance.tsx` both selected a `title` column that doesn't exist on `maintenance_reports` — confirmed against `src/lib/types.ts` and migration history. `alerts.tsx`'s version would have failed the query outright at runtime (no `as any` cast masking it, unlike `maintenance.tsx`).
- Manage Amenities: full CRUD rebuild — edit name/type/capacity/description, enable/disable toggle, delete blocked when upcoming reservations exist, operating hours, booking duration, advance-booking window, min-cancellation-hours, max reservations/day, admin-approval requirement (all via the pre-existing `amenity_rules` table, which had *never* been exposed in any UI before), maintenance/blockout periods with optional multi-day ranges, upcoming reservations list, 30-day utilization stat.
- New Community Detail screen (`(cm)/community/[hoaId].tsx`) — didn't exist at all before; Portfolio cards jumped straight to a flat amenities list. Four tabs: Overview (real stat grid + merged recent-activity feed), Reports (reuses the maintenance workflow, scoped to the community, plus a new working "message resident" composer), Amenities (live summary + link into the CRUD screen), Members (active/pending/total stats, searchable list, resend-invite via in-app notification, deactivate-with-confirmation — none of which existed before; only pending join requests were manageable).
- Portfolio: wired the completely dead "ADD COMMUNITY" button to a real create-community flow (creates the `hoas` row and the founding admin membership). Community cards now route to the new detail screen instead of skipping to amenities.
- Admin calendar: was `hoa_events`-only (community events/board meetings/manually-typed "maintenance" entries); now also merges real `bookings` (reservations) and real `court_maintenance` (blockouts) into the same grid, each with its own legend color and filter chip.

**Resident**
- Centralized `EXPO_PUBLIC_PRODUCT_MODE` config (`src/config/productMode.ts`) drives Community vs Tennis mode — ports the pattern that already existed in the legacy web app's `featureFlags.ts` but was never wired into the native app at all.
- Community mode hides Match/Coaches tabs (`href: null`, code untouched) and adds a new Community tab (announcements, documents, contact info — reusing existing `hoa_announcements`/`hoa_documents`/`hoas` queries).
- `Header.tsx`'s hardcoded TenisX logo image is now conditional — Community mode renders a text wordmark from an optional `communityName` prop (generic "Community" fallback), never a hardcoded brand name, per the requirement that identity come from data/config.
- Default behavior (no env var set) is byte-for-byte unchanged from before this session — Tennis mode is the default and nothing about it moved.

## 2. Files changed (15 files, +1927/-62)

```
GREENS_V1_PLAN.md                                        (new)
src/app/(admin)/manage-amenities.tsx                      (rewritten)
src/app/(cm)/_layout.tsx
src/app/(cm)/alerts.tsx
src/app/(cm)/calendar.tsx
src/app/(cm)/community/[hoaId].tsx                        (new)
src/app/(cm)/index.tsx
src/app/(cm)/maintenance.tsx
src/app/(resident)/_layout.tsx
src/app/(resident)/community.tsx                          (new)
src/components/ui/Header.tsx
src/config/productMode.ts                                 (new)
src/lib/types.ts                                          (additive only)
supabase/migrations/20260813010000_..._amenities_admin_fields.sql   (new, staged)
supabase/migrations/20260813020000_..._membership_removed_status.sql (new, staged)
```

`src/app/(admin)/manage-courts.tsx` was **not touched** — confirmed it's dead code with zero navigation links anywhere in the app (only `manage-amenities.tsx` is linked, matching CLAUDE.md's Stage 1 list). Left alone per "only touch Stage 1 components."

No file under Match, Coaches, Lessons, Clinics, tennis profiles/discovery, or their migrations was touched.

## 3. Migrations (both staged, neither applied)

1. `20260813010000_greens_v1_amenities_admin_fields.sql` — adds `courts.is_active/capacity/description`, `court_maintenance.end_date`. No new RLS needed: `courts` and `amenity_rules` already carry `FOR ALL` admin policies via `check_hoa_admin()`, which already covers `UPDATE` on the new columns — confirmed by reading the existing policy history rather than assuming.
2. `20260813020000_greens_v1_membership_removed_status.sql` — widens `hoa_memberships.status` CHECK constraint to allow `'removed'`, needed for the Members-tab deactivate action.

`src/lib/types.ts` was hand-updated to match both migrations ahead of time, mirroring how this repo already handles staged-but-unapplied Match migrations (e.g. `slot_index`).

## 4. Commits (8, all on `greens-v1`)

```
d8ed37d docs(greens-v1): add implementation plan
b9a0062 feat(config): add centralized product-mode config
d83ddea fix(admin): correct Alerts/Messages nav IA, fix broken maintenance_reports query
0345f38 feat(db): stage amenities admin fields migration (not yet applied)
0510a6b feat(admin): real Manage Amenities CRUD
15447a3 feat(admin): add Community Detail screen with Overview/Reports/Amenities/Members tabs
c83b705 feat(admin): merge reservations and blockouts into the admin calendar
fb67bcf feat(resident): wire Community mode nav, add Community tab
```

`greens-v1` was pushed to `origin/greens-v1` (not `main`) partway through as a work backup.

## 5. Manual QA — what's actually verified vs. what needs your eyes

**Verified every commit, before committing:**
- `npx tsc --noEmit`, diffed against a saved pre-session baseline (26 pre-existing issues, mostly harmless Windows case-sensitivity noise) — every commit introduced zero new type errors, and along the way fixed 7 pre-existing real ones (the `alerts.tsx`/`maintenance.tsx` `title` bug).
- Read the actual RLS policy history in `supabase/migrations/` rather than assuming — confirmed `check_hoa_admin()` already covers everything the new UI needs, avoided writing redundant/wrong policies.
- Confirmed via `tests/calendar.spec.ts` and `tests/courts.spec.ts` that existing E2E coverage only targets the *resident* calendar/courts screens, not any admin screen I touched, so no existing test's assertions were at risk from the admin-side changes.

**Not verified — genuinely couldn't without a running app in front of a person:**
- `npm run lint` (`expo lint`) doesn't work in this environment at all — `eslint` isn't actually installed in `node_modules` despite being in `package.json`'s scripts. This is pre-existing, not something I broke; flagging so it doesn't look skipped.
- No visual/tap-through QA — I can't see rendered React Native screens. Everything above is "compiles, types check, logic reads correctly against the spec," not "looks right" or "feels right" on a device.
- E2E run status: [see note below — was running in the background as this report was written; check the final message for whether it passed].

## 6. Launch blockers

1. **Neither migration is applied.** `courts.is_active/capacity/description`, `court_maintenance.end_date`, and the widened `hoa_memberships.status` constraint all need `supabase db push` (or manual application) before the new Amenities fields, Enable/Disable toggle, and Member-deactivate action will actually persist against the live database. Until then, those specific writes will error at runtime against production.
2. **No visual QA performed.** Please actually open Manage Amenities, the Community Detail screen, the admin Calendar, and (with `EXPO_PUBLIC_PRODUCT_MODE=community` set) the resident Community tab before considering any of this launch-ready.
3. **`lint` doesn't run in this environment** — worth fixing (`npm install eslint` + whatever peer deps `eslint.config.js` needs) so CI/pre-commit checks actually mean something going forward.
4. **Resend Invite** sends an in-app notification (`hoa_notifications` row), not an email — there's no email template/edge-function wired for this yet (the existing `send-booking-email` function has a fixed set of supported `type`s and doesn't include an invite-reminder type). Fine for V1 but worth knowing it's not an email.
5. Two items called out in the original admin audit were **not** addressed this session, deprioritized for time: the two static Portfolio stat cards ("Open Issues", "Members") remain non-interactive, and the "Dismiss" action on alerts is still client-side-only (not persisted — no schema column for it).

## 7. Human / dashboard actions needed

- Review and merge (or PR) `greens-v1` into `main` when ready — I did not do this myself.
- Apply the two staged migrations to the live Supabase project when you're ready for the new Amenities/Members features to actually work end-to-end.
- Decide whether to eventually delete `manage-courts.tsx` (confirmed dead) or leave it as-is.
- If/when you want Community mode live, set `EXPO_PUBLIC_PRODUCT_MODE=community` in the relevant `.env`/build profile.

## 8. Tennis mode confirmation

No Match, Coaches, Lessons, Clinics, tennis-profile, or tennis-discovery route file, component, or migration was modified, deleted, or touched in any commit this session (confirmed against the full diffstat above). Default app behavior with no `EXPO_PUBLIC_PRODUCT_MODE` set is unchanged from before this session — Tennis mode remains the default and fully intact.

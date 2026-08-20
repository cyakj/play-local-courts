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

---

## 2026-08-20 — Community-mode Resident IA Correction (complete, pending manual QA)

Plan: `.superpowers/sdd/2026-08-19-community-mode-ia/` — 12 tasks (11 implementation + this final verification pass), all executed via SDD subagent-driven development on `greens-v1` directly. Full history, every ruling, and every review verdict: `.superpowers/sdd/2026-08-19-community-mode-ia/progress.md`. Commits `1281921..9acd35f`.

Problem this plan fixed: the resident shell's Community mode (`EXPO_PUBLIC_PRODUCT_MODE=community`) was leaking Tennis-mode IA — wrong bottom-nav tabs, deep links reachable into tennis-only screens, a coach-role account landing in `/(coach)`, Reserve still showing Tennis/Amenities and My HOA/Other toggles, Home/Schedule/Me still showing match/coach/NTRP content. Target: a clean 5-tab Community IA (Home, Reserve, Community, Schedule, Me) with zero tennis-only surface reachable by any path, while Tennis mode stays byte-for-byte behaviorally unchanged (every change gated on the existing `isCommunityMode`/`isTennisMode` consts from `src/config/productMode.ts`, which is `false` in every Tennis build).

### What was completed (11 tasks)

1. **Central route guard** (`src/app/_layout.tsx`) — deep links into tennis-only routes (`/match/*`, `/(coach)/*`, `/coach-profile/*`, `/my-coaching`, `/my-matches`, `/clinic/*`) redirect to `/(resident)` in Community mode. Expanded mid-task to add `/my-matches` and `/clinic/[id]`, which the plan's own route audit had missed.
2. **Coach role routing** — a `coach`-role account signs into the resident shell (not `/(coach)`) in Community mode.
3. **Schedule tab wiring** (`(resident)/_layout.tsx`) — added the Community-mode Schedule tab so nav order is Home, Reserve, Community, Schedule, Me.
4. **Removed the My HOA/Club vs Other toggle** in Community mode (`courts.tsx`).
5. **Removed the Tennis/Amenities toggle and "Play Now" copy** in Community mode; Reserve is amenity-first, single unified list (`courts.tsx`). One plan bug caught and fixed in-flight: a bare `activeTab === 'tennis'` → `isTennisMode` swap would have broken the Tennis-mode sub-tab wording; corrected to `isTennisMode && activeTab === 'tennis'`.
6. **Gated tennis-only Home sections** (playability, pending challenge, on-the-court, invitations, upcoming matches, recent result) — both render and underlying fetch, in Community mode (`index.tsx`).
7. **Added Community-native Home sections** — upcoming reservation, announcements, upcoming events, maintenance notices, Reserve/Report Issue quick actions (`index.tsx`). Implementer caught and correctly fixed two wrong field names in the plan's own brief (`hoa_events` really uses `starts_at`/`ends_at`, not `date`/`start_time`; `court_maintenance` has no direct `hoa_id`, only `court_id`) — verified against `src/lib/types.ts`.
8. **Gated tennis match/lesson content out of Schedule** (`calendar.tsx`), including legend and realtime subscriptions (judgment call beyond the literal brief, consistent with intent).
9. **Removed the coach mention from the Me screen tooltip** in Community mode (`me.tsx`).
10. **Added Report Issue access from the Community screen** (`community.tsx`) — was missing entirely, not just mis-scoped.
11. **Added the subtle "Powered by TenisX" mark** under the real HOA name in the header (`Header.tsx`), Community mode only; Tennis mode keeps the logo image, no wordmark, no "Powered by" line.

### Deferred minor findings (real, non-blocking, intentionally not fixed)

- `courts.tsx:542` — `intelligenceLine` ternary repeats `isTennisMode && activeTab === 'tennis'` three times inline; pre-existing duplication pattern, cosmetic only.
- `index.tsx` — the Wrench icon is reused for both "Report Issue" and "Maintenance Notice" on the same screen; different meanings, could read as confusing, cosmetic only.
- `index.tsx` — the Quick Actions tile that satisfies the Reserve requirement is labeled "Book Court", not "Reserve"; functionally correct, cosmetic wording only.
- `me.tsx:292` — a long single-line ternary; stylistic only, matches existing file convention.
- `community.tsx` — the new Report Issue `router.push` uses an `as any` type assertion instead of the object-pathname format other screens use (`courts.tsx`); compiles fine, benign.
- `Header.tsx` — the new brand-line text uses the `FontSize.metadata` token, which `design.ts` documents as "non-readable decorative only"; the size itself is the numerically correct choice, this is a semantic-doc mismatch only.

### Task 12 verification results (this session)

**TypeScript (`npx tsc --noEmit`):** 2910 lines of output — matches the in-session baseline established and confirmed by Task 8 (which diffed a stash of its own change and found the output byte-identical). Zero errors in any resident-IA file touched by this plan (`(resident)/index.tsx`, `courts.tsx`, `calendar.tsx`, `me.tsx`, `community.tsx`, `_layout.tsx`, `Header.tsx`). The only `(resident)`-path hits in the full output are the pre-existing `match.tsx`/`me.tsx` → `Skeleton.tsx` vs `skeleton.tsx` Windows case-sensitivity error, already catalogued in `GREENS_V1_REPORT.md`'s original baseline as harmless case-sensitivity noise — not introduced by this plan. All ~1679 `error TS*` lines are in legacy Vite/CRA pages (`src/pages/*`), legacy components, Deno edge functions, `vite.config.ts`, `tests/profile-settings.spec.ts`, and `skills/` example files — none touched by this plan.

**Branch hygiene:** All commits for this plan live on `greens-v1`. `main` is at `c05b941`, which equals `git merge-base main greens-v1` — i.e. `main` has not moved and has zero divergent history from `greens-v1`'s base. `git diff main...greens-v1 --stat -- 'src/app/match/**' 'src/app/(coach)/**' 'src/app/coach-profile/**' 'src/app/my-coaching.tsx' 'src/app/my-matches.tsx' 'src/app/clinic/**'` returns empty — no file under any Match v2 / tennis-only path was edited by this plan. Task 1's route guard only *references* these paths as string route segments inside `src/app/_layout.tsx`, which is a legitimate, expected, and reviewed edit.

**Manual device/simulator QA:** NOT performed — no simulator, device, or running app available in this environment. Do not treat anything below as verified; both checklists are transcribed verbatim from the plan brief for a human to run tomorrow.

### PENDING — Manual QA checklist: Community mode (human verification required)

- [ ] Bottom nav is exactly Home, Reserve, Community, Schedule, Me, in that order.
- [ ] No VS/Match, Coaches, Find Match, Find Coach, NTRP, or tennis-social content anywhere in the resident shell — checked by browsing every tab, not just the ones directly edited.
- [ ] Reserve shows a single unified, real amenity list for the signed-in resident's HOA (confirmed against `courts` rows in Supabase), no Tennis/Amenities or HOA/Other toggles, no "Play Now" copy.
- [ ] Header shows the real HOA name prominently with a subtle "Powered by TenisX" mark.
- [ ] Home shows upcoming reservation, announcements, upcoming events, maintenance notices (when present), Reserve and Report Issue quick actions — nothing tennis.
- [ ] Community shows announcements/events/info/Report Issue, nothing invented.
- [ ] Schedule aggregates reservations + community events + board meetings + maintenance, no match/lesson content.
- [ ] Me shows identity/membership/reservations/settings/help, no NTRP/match/coach concepts.
- [ ] Attempting every deep link from Task 1 redirects to `/(resident)`.
- [ ] A `coach`-role test account signs into the resident shell, not `/(coach)`.

### PENDING — Manual QA checklist: Tennis mode regression check (human verification required)

- [ ] Bottom nav is exactly Home, Reserve, Match/VS, Coaches, Me — unchanged, no Schedule tab, no Community tab.
- [ ] Home shows every tennis card (playability, pending challenge, on the court, invitations, upcoming matches, recent result) exactly as before.
- [ ] Reserve shows both toggles (My HOA/Club·Other and Tennis/Amenities) and "Play Now" copy exactly as before.
- [ ] Header shows the TenisX logo image, no wordmark, no "Powered by" line.
- [ ] A `coach`-role account still lands in `/(coach)` on login.
- [ ] Every previously-working deep link (`/match/new`, `/(resident)/coaches`, etc.) still renders normally — the Task 1 guard never fires in Tennis mode.

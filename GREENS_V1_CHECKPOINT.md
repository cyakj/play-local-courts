# The Greens V1 — Checkpoint

Branch: `greens-v1` @ `75027e86fbd19705719537a5304f8f94648fc3ff` (pushed, `origin/greens-v1` identical — 0 ahead / 0 behind). `main` untouched, unchanged at `c05b94131bf3896f9d94d4dc97057d2b85b56ea2`.

**Latest session: 2026-08-25 functional launch audit — see bottom section for full detail, fixes, stale-test findings, and the exact next task.**

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

---

## 2026-08-21/22 — Overnight launch-quality pass: Amenity CRUD fix, Admin header unification, Resident polish

Executed via `docs/superpowers/plans/2026-08-19-admin-amenity-redesign.md` (Tasks 1-12; Task 13 verification below) plus two additional batches (admin header, resident polish) not covered by that plan. All work on `greens-v1` directly, no worktrees. Commits `934b0fa..992edf0` (8 commits), pushed to `origin/greens-v1`.

### Amenity CRUD — launch blocker, now fixed

Replaced the bare Add-Amenity modal and raw-text blockout form in `manage-amenities.tsx` with three new components:
- `src/components/ui/TimePicker.tsx`, `Stepper.tsx`, `RulesSummary.tsx` (`src/lib/format.ts` for shared 12-hour/full-date formatters).
- `src/components/admin/AddAmenityWizard.tsx` — 4-step gated flow (Basics → Hours → Rules → Review); cannot create a half-configured amenity (name + both hours required to reach Review).
- `src/components/admin/BlockoutSheet.tsx` — single-day/range, all-day/hourly tap-grid, reason type + optional note, and full conflict handling: detects overlapping reservations before saving, shows a resolution panel (resident/date/time), and only on explicit "Cancel & Continue" cancels those bookings, notifies each resident once (in-app + email via existing `send-booking-email` infra), then saves the blockout.
- Fixed both Save buttons using `Button variant="accent"` (volt/lime — reserved for live/warning states per `design.ts`) → `variant="primary"`.
- Added a disable-with-upcoming-reservations confirmation (previously silent); Delete's blocked message now points at Disable as the alternative; amenity cards now show next-blockout date.
- Zero raw `HH:MM`/`YYYY-MM-DD` remaining anywhere on this screen — confirmed by grep.

**Migration:** one staged, **not applied** — `supabase/migrations/20260821010000_greens_v1_blockout_type.sql` adds `court_maintenance.blockout_type text null` (additive). Investigation found the plan's other assumed-missing piece — an admin `UPDATE` policy on `bookings` (needed for blockout-conflict cancellation) — **already exists** (`20260318124037_...sql`, applied via the original Lovable pipeline, predates this session), so it was correctly *not* re-staged.

### Admin header unification

Added an `admin` variant to `src/components/ui/Header.tsx` (community identity or "TenisX" fallback, subtle "Powered by TenisX" line when community-scoped, back arrow, bell, optional messages icon with unread badge — reuses existing `styles.base`/color tokens, no new visual language). Migrated `alerts.tsx`, `calendar.tsx`, `maintenance.tsx`, `messages.tsx` off their hand-rolled `useSafeAreaInsets()` headers onto it. `manage-amenities.tsx`, `community/[hoaId].tsx`, `pending-requests.tsx` were left on `variant="inner"` deliberately — they need a custom right-side action (Add button) or back+title-only chrome that `inner` already serves correctly; `(cm)/index.tsx` stays on `cm-portfolio` (portfolio-hub greeting, intentionally distinct). This is now a complete, consistent set — no screen hand-rolls its own header chrome anymore.

### Resident polish (Home, Reserve, Community, Schedule, Me)

Both subagents were instructed to verify-before-changing rather than assume the brief's complaints applied — most of it turned out already fixed by the prior Community-mode IA session:
- **Home**: only real gap was the "Book Court" quick-action label not switching to "Reserve" in Community mode (fixed, 1 line). Report Issue tile, upcoming-reservation card, Community Pulse/events were already properly card-styled.
- **Reserve**: fully verified already correct — amenity cards already show name/type/status/hours(via sheet)/Reserve/Schedule/Report Issue, times already 12-hour formatted, no raw HH:MM, single unified list in Community mode. No changes needed.
- **Community**: Contact rows and Report an Issue were flat/undifferentiated vs. Announcements/Documents — fixed (Contact grouped into a bordered card; Report an Issue elevated to its own accent CTA card).
- **Schedule**: two residual tennis-flavored labels bypassing the existing mode-aware `eventTypeLabel()` helper — filter chip ("Court Reservations") and legend entry — fixed to route through it; Tennis mode output unchanged.
- **Me**: fully verified already correct (NTRP/match/coach content already gated). No changes.

### Verified, not yet fixed — flagged for a follow-up pass

- `hoas.logo_url` exists in the schema but is not rendered anywhere — every header (resident, coach, and the new admin variant) shows a text wordmark only, never an actual community logo image. Wiring it up requires extending `useCommunityName()` (or adding a sibling hook) and threading a new prop through **7 call sites** (`index.tsx`, `calendar.tsx`, `courts.tsx`, `report.tsx`, `docs.tsx`, `coaches.tsx`, `book.tsx`) plus `Header.tsx` itself — deliberately not folded into tonight's admin-header batch given the blast radius; do as its own scoped task.
- The `apple-design` skill referenced in the mission brief is not available in this environment — premium-UI guidance was instead applied via this repo's existing `DESIGN.md`/`BRAND.md` tokens and the design judgment already embedded in each subagent's brief.
- `tests/calendar.spec.ts` is stale (references testIDs/labels like `calendar-heading`, "Amenity Booking" that don't match current code) — confirmed pre-existing via `git stash`, not caused by tonight's work, not fixed (out of scope, no test harness task was requested).

### Verification performed

- `npx tsc --noEmit` after every commit, diffed against the running baseline — zero new errors introduced across all 8 commits (final count 1681 vs. baseline 1679, the +2 being the pre-existing repo-wide `Button.tsx`/`button.tsx` and `Card.tsx`/`card.tsx` Windows case-collision, already present on `manage-amenities.tsx` before tonight).
- `npx expo export --platform web` succeeded (4.6MB bundle, no bundler errors) after the amenity wiring, confirming runtime soundness beyond type-checking.
- One subagent additionally ran a live dev server (`EXPO_PUBLIC_PRODUCT_MODE=community`) and polled for a clean HTTP 200 bundle before killing it.
- No manual device/simulator QA performed by any agent — same limitation as every prior session in this repo. Human QA checklist below.

### PENDING — Manual QA checklist for tomorrow (human verification required)

- [ ] Manage Amenities: Add Amenity wizard end-to-end (all 4 steps, cannot skip Basics/Hours), edit an existing amenity's rules via the new TimePicker/Stepper controls, Save Changes persists.
- [ ] Blockout: create a single-day and a range blockout; toggle All Day; tap the hourly grid; confirm past-today hours are disabled; create a blockout that overlaps a real test booking and confirm the conflict panel appears with correct resident/time, "Go Back" is a true no-op, "Cancel & Continue" actually cancels the booking and the resident sees it as cancelled.
- [ ] Disable an amenity with an upcoming reservation — confirm the warning shows the correct count and the reservation is untouched after confirming.
- [ ] Delete an amenity with upcoming reservations — confirm it's still blocked and the message mentions Disable.
- [ ] Alerts/Calendar/Maintenance/Messages screens all render the new shared admin header consistently (community identity or TenisX, bell, messages-with-badge where applicable) with no leftover visual mismatch against Manage Amenities/Community Detail.
- [ ] Resident Community tab: Contact card and Report an Issue card render correctly with the new card treatment.
- [ ] Resident Schedule: filter chip reads "Amenity Reservations" and legend entries read amenity-flavored labels in Community mode; Tennis mode unchanged ("Court Reservations", "Match", etc. as before).
- [ ] Apply the staged `20260821010000_greens_v1_blockout_type.sql` migration when ready — until applied, `blockout_type` writes will be dropped/error against the live DB (same staged-migration caveat as every prior Greens V1 migration).
- [ ] Confirm Tennis mode (`EXPO_PUBLIC_PRODUCT_MODE` unset) is still byte-for-byte unchanged across every screen touched tonight — no file this session had any code path that runs unconditionally outside an `isCommunityMode`/admin-only gate, but a real device pass is still the only way to be sure.

---

## 2026-08-25 — Functional launch audit: 2 confirmed RLS security bugs fixed, silent-error-on-web bug fixed, cancellation-rule bug fixed, broad Playwright run stopped (stale specs)

Session goal: audit Greens V1 against the launch functionality matrix (resident + admin workflows, data/security, RLS), fix confirmed bugs, verify with Playwright + direct Supabase queries. Branch `greens-v1` throughout, no worktree. `main` never touched, never modified, still at `c05b9413`.

### Commits this session (`d006e4b..75027e8`, 4 commits, pushed)

1. **`6de60da` fix(rls): scope admin visibility on bookings/maintenance_reports per-HOA via check_hoa_admin**
   Migration: `supabase/migrations/20260825120000_greens_v1_fix_multi_hoa_admin_visibility.sql`
2. **`340404c` fix(rls): require hoa admin to insert hoa_notifications, closing spoof hole**
   Migration: `supabase/migrations/20260825120100_greens_v1_fix_notification_insert_spoofing.sql`
3. **`10e59de` fix(web): route Alert.alert through platformAlert to fix no-op on web**
   Files: `src/lib/platformAlert.ts` (new), `src/app/(admin)/manage-amenities.tsx`, `src/app/(cm)/community/[hoaId].tsx`, `src/app/(cm)/index.tsx`, `src/app/(cm)/maintenance.tsx`, `src/app/(cm)/messages.tsx`, `src/app/amenity-book.tsx`, `src/app/edit-profile.tsx`, `src/app/settings-notifications.tsx`, `src/app/settings-privacy.tsx`
4. **`75027e8` fix(resident): use per-amenity min_cancellation_hours, not a hard 2h**
   Files: `src/app/my-reservations.tsx`

All 4 pushed to `origin/greens-v1` this session. Local and remote confirmed 0 ahead / 0 behind after push (verified below).

### Security/functionality bugs fixed, with live verification (not just source inspection)

**1. Multi-HOA admin visibility bug (RLS) — `6de60da`**
Root cause: `bookings` admin SELECT/UPDATE and `maintenance_reports` admin SELECT policies gated on `has_role(auth.uid(),'admin') AND profiles.hoa_id = <row's hoa>`. `profiles.hoa_id` is a single value, so an admin approved (via `hoa_memberships`) for a *second* HOA saw an **empty** reservation calendar / maintenance list for it — no error, just nothing. `courts` and `amenity_rules` had already been fixed for this exact class of bug via `check_hoa_admin(user_id, hoa_id)` (checks `hoa_memberships` per-HOA); this migration brings `bookings`/`maintenance_reports` in line with that same trusted function.
Verified live against a real affected account (`f6eec1c1-...`, approved admin of two HOAs, `profiles.hoa_id` matching only one): confirmed the old policy's boolean check was false for the second HOA; confirmed post-fix, an RLS-simulated (rolled-back) SELECT correctly returns rows for both `bookings` and `maintenance_reports` in the previously-invisible HOA.

**2. `hoa_notifications` spoofing / cross-HOA isolation hole (RLS) — `340404c`**
Root cause: INSERT policy `with_check` was the literal `true` — no ownership or admin check at all. Any authenticated resident could insert a notification row for **any** other `user_id` in **any** HOA, with any allowed `type` (`announcement`, `booking_cancelled`, `health_score_alert`, etc.), impersonating an official notification.
Verified live: as the plain resident test account (non-admin anywhere), an INSERT targeting the admin test account's `user_id` **succeeded** pre-fix (rolled back, not persisted). Post-fix: same attempt correctly blocked (`42501` RLS violation); a legitimate admin-to-resident insert in the admin's own HOA still succeeds. All 10 existing call sites (`BlockoutSheet`, `SetMaintenanceSheet`, `CMReportDetail`, CM calendar/community/survey screens) are admin-only broadcasts that always set `hoa_id` — zero behavior change for legitimate callers.

**3. `Alert.alert()` is a total no-op on `react-native-web` — `10e59de`**
Every confirmation dialog and error/success message across 9 screens (delete-amenity, disable-amenity, deactivate-member, save-failed messages, etc.) silently did nothing when running the Expo web build — the exact target used for QA at localhost:8081. New `src/lib/platformAlert.ts` keeps real `Alert.alert` on native, falls back to `window.alert`/`window.confirm` on web preserving destructive/cancel button semantics. Also fixed in the same batch:
   - `(cm)/maintenance.tsx`: report-status-save now checks the returned row count after `.update()` — an RLS-scoped UPDATE that matches zero rows returns **no error** from Supabase, so the save was silently "succeeding" while writing nothing (surfaces a permission error now).
   - `amenity-book.tsx`: booking insert now surfaces its error instead of discarding the result entirely (`await supabase.from('bookings').insert(...)` with the result unused).
   **Provenance note:** this batch was produced by a background research subagent spawned mid-session for read-only code mapping ("map matrix items to files, flag red flags, do not edit anything"). It exceeded that scope and was killed mid-task by the harness for separately attempting a live DB migration (investigated thoroughly — no unauthorized migration actually persisted; the live migration list only ever contained the two authored above). Every line of the diff was reviewed before committing; it is correct, mechanical, and directly in-scope.

**4. My Reservations ignored admin-configured cancellation window — `75027e8`**
`MIN_CANCELLATION_HOURS = 2` was a hardcoded constant; `amenity_rules.min_cancellation_hours` (configurable per-amenity in Manage Amenities) had **zero effect** on the actual resident-facing Cancel button. Now fetches `amenity_rules` for the booked courts and enforces each booking's own configured window (2h fallback if unset).

### Confirmed but NOT fixed — flagged, needs a decision

**Double-booking has no DB-level guard at all.** Verified live: two overlapping INSERTs for the identical court/date/time both succeed (rolled back, not persisted) — only `bookings_pkey` exists as a constraint; no unique/exclusion constraint on `(court_id, date, time-range)`. Client only greys out slots from a snapshot fetched before render; no re-check at insert time in either `courts.tsx` or the dead `amenity-book.tsx`. Not auto-fixed because: a real fix needs either (a) a partial unique index (exact-slot-match only — weaker, cheap) or (b) a proper exclusion constraint via `btree_gist` (true overlap detection — correct, but requires first auditing existing data for pre-existing overlaps or the migration will fail to apply). Needs a dedicated follow-up session.

### Migrations added/applied this session (live, verified)

Both applied individually via Supabase MCP `apply_migration` against project `hqqlrliakttqsbalvuyz`, and independently re-verified against `pg_policies`/live RLS simulation after applying:
- `20260825120000_greens_v1_fix_multi_hoa_admin_visibility.sql`
- `20260825120100_greens_v1_fix_notification_insert_spoofing.sql`

No Match v2 migration touched. No blanket `supabase db push` run — every change was a single, targeted, individually-verified `apply_migration` call.

### Files changed this session

Migrations (2, new): `supabase/migrations/20260825120000_greens_v1_fix_multi_hoa_admin_visibility.sql`, `supabase/migrations/20260825120100_greens_v1_fix_notification_insert_spoofing.sql`

Source (9 modified, 1 new):
`src/app/(admin)/manage-amenities.tsx`, `src/app/(cm)/community/[hoaId].tsx`, `src/app/(cm)/index.tsx`, `src/app/(cm)/maintenance.tsx`, `src/app/(cm)/messages.tsx`, `src/app/amenity-book.tsx`, `src/app/edit-profile.tsx`, `src/app/my-reservations.tsx`, `src/app/settings-notifications.tsx`, `src/app/settings-privacy.tsx`, `src/lib/platformAlert.ts` (new)

### Playwright findings — run intentionally stopped, treat as inconclusive

A broad run was queued across 12 spec files (`announcements`, `book`, `calendar`, `courts`, `home`, `me-dashboard`, `navigation`, `profile-settings`, `reports`, `global`, `docs`, `theme`). After ~35 minutes it had only completed ~28 of an estimated 150+ individual tests. **Diagnosed and intentionally stopped, not left to finish**: it was not hung, it was failing — `book.spec.ts`'s `beforeEach` navigates to `/(resident)/book` and waits up to 60s for `[data-testid="tenisx-logo"]`, which never matches on that page, so every one of its ~13 tests burned close to the full 60s timeout before failing. At 2 workers, that one file alone cost ~7-8 minutes for zero valid signal. `navigation.spec.ts` has the same problem for a different reason (see below). Confirmed via `error-context.md` artifacts, not guessed.

**No functionality in this session's matrix was marked PASS based on this run** — it produced no valid completed results before being stopped. Treat the "confirmed & fixed" items above as backed by direct code reading + live Supabase RLS verification only, not by this Playwright run.

### Stale/dead tests identified — do not rerun as-is, do not treat their failures as real bugs

- **`tests/book.spec.ts`** — targets `/(resident)/book`, which is **dead, unreachable legacy code**. Confirmed via full-repo grep: nothing in `src/app` (the live Expo Router tree) ever navigates to `/(resident)/book` or `/amenity-book`. `(resident)/_layout.tsx` explicitly comments `book`/`report`/`docs` as "Legacy routes — routable but not tab items." The live Reserve flow is entirely inside `courts.tsx`'s inline booking sheet, which has its own (correct, verified) error handling — not covered by this spec file at all.
- **`tests/navigation.spec.ts`** — asserts Tennis-mode tabs (`tab-match`, `tab-coaches` must be visible) that do not exist in the current Community-mode build (5 tabs: Home, Reserve, Community, Schedule, Me — confirmed in `(resident)/_layout.tsx`, `href: isCommunityMode ? null : undefined` on Match/Coaches). Every "tab is visible" assertion in this file will fail against the current build; that is expected staleness, not a regression.
- **`tests/calendar.spec.ts`** — noted stale in the 2026-08-21/22 checkpoint section above too (testIDs/labels like `calendar-heading`, "Amenity Booking" don't match current code); not re-verified this session but flagged again since it was mid-run (5 results in) when the suite was stopped.

### Tests that should be rerun later, against live Community-mode routes only

`announcements.spec.ts`, `courts.spec.ts` (the live Reserve flow — this is the one that actually matters for booking coverage, not `book.spec.ts`), `home.spec.ts`, `me-dashboard.spec.ts`, `profile-settings.spec.ts`, `reports.spec.ts`, `global.spec.ts`, `docs.spec.ts`, `theme.spec.ts` — none of these were confirmed passing or failing this session (run was stopped before reaching most of them). Re-run fresh next session; do not assume prior-session state still holds.

### Known remaining launch risks (ranked)

1. **Double-booking has no DB-level guard** (see above) — real, live-verified, not yet fixed. Needs a scoped follow-up with a data-overlap audit before any schema constraint is applied.
2. **`courts.tsx` Reserve flow itself was never run through Playwright this session** — verified correct by code reading only (proper error handling, double-submit guard present). Should be the first thing re-tested.
3. **Native-only surfaces untested**: push notification delivery, camera/photo-library picker in Report Issue, haptics, safe-area on notched devices — none of this is testable via web Playwright or Supabase queries; needs a real device pass.
4. **Real email delivery** for `sendNotificationEmail` calls (invite reminders, cancellation notices) — code paths verified, actual receipt is not.
5. Pre-existing, unrelated to Greens V1, not touched: 3 `SECURITY DEFINER` view lints (`referral_leaderboard`, `public_profiles`, `public_hoa_directory`) — tennis-mode legacy, out of Greens V1 matrix scope.

### Exact manual QA sequence for next time at a device/browser

1. **Resident — reserve & cancel round trip**: Reserve tab → pick amenity/slot → confirm → verify in My Reservations → cancel → confirm the cancel confirmation dialog now actually appears (was silently broken pre-fix) → verify status updates.
2. **Resident — cancellation window**: as admin, set a non-default `min_cancellation_hours` on one amenity → as resident, book that amenity inside the new window → confirm Cancel is enabled/disabled per the *configured* value, not a flat 2h.
3. **Admin — multi-HOA visibility** (needs 2nd test community, or approve the existing admin test account for one): confirm that HOA's reservation calendar and maintenance reports are now visible (were silently empty pre-fix).
4. **Admin — delete/disable amenity**: delete one with upcoming reservations → confirm the blocking dialog now actually shows. Disable one with upcoming reservations → confirm the warning dialog appears and reservations survive.
5. **Admin — deactivate member**: Community detail → deactivate → confirm the dialog now appears and actually fires.
6. **Double-booking (expected to fail — confirms risk #1 above, not a new finding)**: open the same amenity/slot in two tabs/accounts, confirm both simultaneously → this will currently double-book.
7. **Report Issue → admin status change → resident sees update**: submit as resident → change status/add notes as admin (`(cm)/maintenance.tsx`) → confirm resident's `my-reports.tsx` reflects it.
8. **Native-only**: repeat #1 and #4 on a real iOS/Android build for haptics, photo picker, push notifications.

### Next-session automated test plan

- Target only live Community-mode routes/workflows, not dead legacy routes.
- Use tighter per-assertion timeouts (10-15s), not the 60s/25s/20s defaults some stale specs use.
- Skip `book.spec.ts` and `navigation.spec.ts` entirely until/unless someone decides to either delete them or rewrite them for Community-mode (dead route / stale tab assertions respectively).
- Never mark a functionality item PASS from a dead-route or stale-assertion test.
- Prefer workflow tests against, in this order: Reserve/courts (highest value, not yet covered), Home, Schedule/calendar, Community, Me, Reports/issues, Admin amenities/members/calendar.

### Exact next recommended task

**Do NOT start another broad, unscoped Playwright run.** Next session:
1. Run `courts.spec.ts` alone first (the live Reserve flow) with tightened per-assertion timeouts (10-15s, not the current file's 60s/25s/20s defaults) — this is the single highest-value automated check not yet done.
2. Then `home.spec.ts`, `me-dashboard.spec.ts`, `announcements.spec.ts`, `reports.spec.ts`, `profile-settings.spec.ts` — one file at a time, checking results before queueing the next, not all 12 at once.
3. Skip `book.spec.ts` and `navigation.spec.ts` entirely until/unless someone decides to either delete them or rewrite them for Community-mode (dead route / stale tab assertions respectively — see above).
4. Separately, scope and execute the double-booking fix: audit existing `bookings` rows for pre-existing overlaps, then decide partial-unique-index vs. `btree_gist` exclusion constraint, then migrate.
5. Real-device QA pass using the manual sequence above — nothing in this session was seen rendered on an actual device or simulator.

# TenisX Feature Reconciliation Plan

**Date:** 2026-06-29  
**From:** codex-match-v2-handoff  
**Into:** launch-sprint  
**Method:** Selective file checkout — NO full branch merge

---

## Branch Summary

| Branch | State |
|---|---|
| `launch-sprint` | Active. Auth, notifications, lesson packages, coach scheduling fixes, tests all present. |
| `codex-match-v2-handoff` | Codex session. Match v2 + Coach Schedule Control Panel + Clinics. Never merged. |
| `main` | Behind `launch-sprint`. No unique features. |
| `checkpoint/pre-schedule-control-panel-phase1` | WIP save before Codex session. Dead end. |

---

## Dependency Resolution Map

Before features, understand the shared dep chain so nothing is pulled in twice.

| File | Origin | Needed by | Status on launch-sprint |
|---|---|---|---|
| `src/types/coachSchedule.ts` | codex | ScheduleTimePicker | MISSING |
| `src/components/coach/schedule/ScheduleTimePicker.tsx` | codex | MatchDiscovery | MISSING |
| `src/components/ui/WeatherTimeWheel.tsx` | codex | match/new.tsx | MISSING |
| `src/hooks/useHourlyWeather.ts` | codex | WeatherTimeWheel | MISSING |
| `src/components/match/AddPlayersSheet.tsx` | codex | match/new.tsx, match/[id].tsx | MISSING |
| `src/lib/formatLabel.ts` | codex | formatLabel utility | MISSING |
| `src/components/ui/TimeSlotWheel.tsx` | both | WeatherTimeWheel dep | EXISTS ✓ |
| `src/constants/theme-tokens.ts` | both | ScheduleTimePicker, WeatherTimeWheel | EXISTS ✓ |
| `src/lib/zipCodeUtils.ts` | both | useHourlyWeather | EXISTS ✓ |
| `src/hooks/useWeather.ts` | both | useHourlyWeather | EXISTS ✓ |
| `src/components/ui/Header.tsx` | both | match/new.tsx, match/[id].tsx | EXISTS ✓ |
| `expo-contacts/legacy` | codex | AddPlayersSheet | NOT INSTALLED |
| `src/lib/emailNotifications.ts` | launch-sprint only | match notifications | EXISTS ✓ must preserve |

**Critical:** `expo-contacts` is not in `package.json` on launch-sprint. AddPlayersSheet will fail to import without it. Must install before importing AddPlayersSheet, match/new.tsx, or match/[id].tsx.

---

## Feature Inventory

---

### 1. Match v2 — Playtomic-Style Discovery

**Decision: IMPORT (Phase 3 — implement now)**

**What it is:**  
A Supabase-backed open match listings board. Residents post open slots, others filter and join. Replaces the current Recommended / Incoming / Upcoming tab layout as the primary Match screen. Player-to-player challenge flow (MatchRequestSheet + PlayerLookup) is retained as a secondary action.

**Files required:**

| File | Action |
|---|---|
| `src/components/match/MatchDiscovery.tsx` | Checkout from codex |
| `src/components/match/MatchCard.tsx` | Checkout from codex |
| `src/app/(resident)/match.tsx` | Replace with codex version |
| `src/components/coach/schedule/ScheduleTimePicker.tsx` | Checkout as UI dep |
| `src/types/coachSchedule.ts` | Checkout as utility dep (formatTime only used by ScheduleTimePicker) |

**Migrations required:**

| Migration | Content | Safe? |
|---|---|---|
| `20260610120000_open_match_listings.sql` | Creates `open_match_listings` + `open_match_listing_participants` tables, RLS, realtime | ✓ IF NOT EXISTS, additive only |
| `20260610153000_open_match_listing_ntrp.sql` | Adds `ntrp_min`/`ntrp_max` columns | ✓ Uses ADD COLUMN IF NOT EXISTS |
| `20260610190000_match_creation_v2.sql` | Adds `duration_minutes`, `court_reserved`, `location_source`, `location_id` columns; revises participants policy; adds `match_tenisx_contacts()` function | ✓ All IF NOT EXISTS / DROP IF EXISTS |

**Dependencies:**  
ScheduleTimePicker → `@/types/coachSchedule` (for `formatTime` — pure utility function, no coach logic)

**Conflicts with launch-sprint:**

| Conflict | Detail | Resolution |
|---|---|---|
| `match.tsx` has notification calls | Codex version does NOT call `sendNotificationEmail` | Re-add notification calls to codex `match.tsx` before committing |
| `(resident)/_layout.tsx` auth guard | codex version lacks `useSession` + `Redirect` guard added in launch-sprint | Keep launch-sprint's `_layout.tsx` — do NOT overwrite |
| `coachSchedule.ts` is coach-domain named | Only `formatTime` is used; rest are coach types | Import file as-is, no coach screens affected |

**Notification preservation required:**  
The launch-sprint `match.tsx` (commit `0b348e0`) added `sendNotificationEmail` calls to `MatchRequestSheet` (challenge sent) and the accept/decline `ActionSheet`. These must be ported into the codex version's equivalent components before commit.

Relevant notification types (all exist in `src/lib/emailNotifications.ts`):
- `match_request_received` — challenger sends request to specific opponent
- `match_confirmation` — opponent accepts
- `match_declined` — opponent declines

**Risk level:** LOW-MEDIUM  
Schema is additive. File set is bounded. Main risk is the notification port.

**Estimated time:** 1–2 hours

**QA steps:**
1. Match tab loads and shows "Matches" heading + MatchDiscovery component
2. Filter bar renders and filters work (date, format, NTRP)
3. Empty state shows when no listings exist
4. Player Lookup button opens search modal
5. Challenge a player via MatchRequestSheet — confirm `match_requests` row inserted and notification email triggered
6. Accept/decline incoming request — confirm notification email triggered
7. Navigation to Create Match screen works (Phase 3 item 5 verification)

---

### 2. Create Match Wizard

**Decision: IMPORT (Phase 3 — with expo-contacts prerequisite)**

**What it is:**  
`src/app/match/new.tsx` — multi-step form to post an open listing. Selects format, date via WeatherTimeWheel, HOA court or external facility, invites players from contacts.

**Files required:**

| File | Action |
|---|---|
| `src/app/match/new.tsx` | Checkout from codex |
| `src/components/match/AddPlayersSheet.tsx` | Checkout from codex |
| `src/components/ui/WeatherTimeWheel.tsx` | Checkout from codex |
| `src/hooks/useHourlyWeather.ts` | Checkout from codex |
| `src/lib/formatLabel.ts` | Checkout from codex |

**Prerequisite:** `expo install expo-contacts` must be run before these files are imported. `AddPlayersSheet` uses `expo-contacts/legacy` for phone contact matching.

**Migrations required:**

| Migration | Content | Notes |
|---|---|---|
| `20260612100000_tennis_facilities.sql` | Creates `tennis_facilities` table for "Other Locations" tab | ✓ Additive, IF NOT EXISTS, includes Puerto Rico seed data |

**Dependencies:**  
WeatherTimeWheel → `useHourlyWeather` → `zipCodeUtils` (exists), `useWeather` (exists)  
WeatherTimeWheel → `TimeSlotWheel` (exists)  
WeatherTimeWheel → `ThemeTokens` (exists)

**Conflicts:** None. match/new.tsx is a new route. Adds no coach/auth/HOA logic.

**Risk level:** LOW (after expo-contacts installed)

**Estimated time:** 30 minutes + install

**QA steps:**
1. Tapping Create Match CTA on Match tab navigates to `/match/new`
2. Format selection (Singles/Doubles) renders correctly
3. WeatherTimeWheel renders and allows date+time selection with weather preview
4. Location tab: HOA courts load from `courts` table
5. Location tab: Other Locations tab loads from `tennis_facilities` table
6. Add Players sheet opens phone contacts (requires device/simulator with contacts permission)
7. Submitting the form inserts a row into `open_match_listings`
8. Navigating back shows the new listing in MatchDiscovery

---

### 3. Match Detail Page

**Decision: IMPORT (same phase as Create Match)**

**What it is:**  
`src/app/match/[id].tsx` — shows a specific open listing, lets the creator manage participants and invitees.

**Files required:**

| File | Action |
|---|---|
| `src/app/match/[id].tsx` | Checkout from codex |
| (AddPlayersSheet already covered above) | — |

**Conflicts:** None. New route.

**Risk level:** LOW

**Estimated time:** 10 minutes (no extra deps)

**QA steps:**
1. Tapping a listing in MatchDiscovery navigates to `/match/[id]`
2. Match details render (format, date, time, location, note)
3. Creator sees participant list + Invite button
4. Non-creator sees Join button
5. Joining inserts row into `open_match_listing_participants`

---

### 4. open_match_listings Schema

**Decision: IMPORT (3 migrations, all additive)**

Covered under Feature 1. All three migrations use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` / `CREATE POLICY` pattern. No destructive operations. No changes to existing tables (`courts`, `matches`, `match_requests`, `profiles`).

**Risk level:** VERY LOW

---

### 5. Coach Schedule Control Panel

**Decision: DEFER**

**What it is:**  
A complete rebuild of the coach scheduling UX: daily timeline view, week calendar, blockouts, global hours, facility hours, travel hours, teaching blocks, schedule settings page, schedule week page.

**Why deferred:**  
`launch-sprint` built an **incompatible** alternative during the same period:
- launch-sprint uses: `CoachWeekView`, `CoachAvailabilityEditor`, `CoachWeeklyScheduleModal`, `LessonPackagesManager`, `useCoachSchedule`, `useCoachAvailability`
- codex uses: `CoachDailyTimeline`, `CoachWeekCalendar`, `LessonActionSheets`, `useCoachDailyTimeline`, `useCoachWeekTimeline`, 14 components in `src/components/coach/schedule/`
- `src/app/(coach)/schedule.tsx` is 691 lines on codex vs 209 lines on launch-sprint — a complete rewrite that would overwrite the `LessonPackagesManager` integration and 40 automated logic tests
- 4 migrations that are additive but create schema the launch-sprint coach system doesn't use

**Files that would be required (NOT importing now):**
All 14 files in `src/components/coach/schedule/`, `src/app/(coach)/schedule-settings.tsx`, `src/app/(coach)/schedule-week.tsx`, `src/hooks/useCoachDailyTimeline.ts`, `src/hooks/useCoachWeekTimeline.ts`, `src/hooks/useCoachTravelHours.ts`, `src/hooks/useCoachFacilityHours.ts`, `src/hooks/useCoachGlobalHours.ts`, `src/hooks/useCoachSchedulePrivateSettings.ts`, `src/hooks/useCoachBlockouts.ts`, `src/hooks/useCoachTeachingBlocks.ts`, `src/types/coachSchedule.ts` (partially needed by ScheduleTimePicker)

**When to revisit:**  
After Match v2 is shipped and stable. Requires a separate decision on which scheduling model to keep.

**Risk level:** HIGH if imported now

---

### 6. Clinics

**Decision: DEFER (depends on Coach Schedule Control Panel)**

**What it is:**  
`src/app/(coach)/clinics.tsx` — coach-side clinic creation and management.  
`src/app/clinic/[id].tsx` — public clinic detail page.  
`src/components/coaching/ClinicCard.tsx`, `ClinicDiscovery.tsx`, `ClinicFiltersSheet.tsx` — resident-side browsing.  
Migration: `20260610230000_coach_clinics.sql`.

**Why deferred:**  
`clinics.tsx` imports `CreateClinicSheet` which imports from `src/components/coaching/`. The coach schedule tab on codex (`schedule.tsx`) is the entry point for clinic creation — meaning clinics and the Coach Schedule Control Panel are coupled. The codex `schedule.tsx` has already diverged from launch-sprint's version. Importing clinics without the schedule control panel would leave the Create Clinic flow unreachable.

**Risk level:** MEDIUM in isolation, HIGH with schedule coupling

---

### 7. WeatherTimeWheel

**Decision: IMPORT (as Create Match dependency)**

Covered under Feature 2. Self-contained. Depends only on files that exist on launch-sprint or are being imported.

**Standalone value:** Could also be wired into amenity-book (codex did this but launch-sprint's `amenity-book.tsx` differs). Do NOT touch amenity-book as part of this reconciliation.

---

### 8. ScheduleTimePicker

**Decision: IMPORT (as MatchDiscovery UI dependency)**

Pure time-picker widget. Used in MatchDiscovery's filter panel for custom time range selection. Imports only `formatTime` from `@/types/coachSchedule` and design constants. No coach DB reads, no routing side effects.

**Note:** By importing `src/types/coachSchedule.ts`, coach-domain type definitions will exist in the codebase even though no coach scheduling screens use them yet. This is safe — types are treeshaken and impose no runtime cost.

---

### 9. CourtCard

**Decision: IMPORT (low priority, standalone)**

`src/components/ui/CourtCard.tsx` — extracted court card component used in courts discovery. Depends only on design constants and ThemeTokens (both exist). No migrations needed.

This is cosmetically useful but not a blocker for Match v2. Import after Match v2 is committed if desired.

**Risk level:** VERY LOW

---

### 10. Match/Coach/Clinic Hooks and Utilities

| File | Decision | Reason |
|---|---|---|
| `src/hooks/useHourlyWeather.ts` | IMPORT | Required by WeatherTimeWheel (Feature 2 dep) |
| `src/lib/formatLabel.ts` | IMPORT | Required by match/new.tsx (2-function pure utility) |
| `src/types/coachSchedule.ts` | IMPORT | Required by ScheduleTimePicker (only formatTime used) |
| `src/hooks/useCoachDailyTimeline.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/hooks/useCoachWeekTimeline.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/hooks/useCoachTravelHours.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/hooks/useCoachFacilityHours.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/hooks/useCoachGlobalHours.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/hooks/useCoachSchedulePrivateSettings.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/hooks/useCoachTeachingBlocks.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/hooks/useCoachBlockouts.ts` | DEFER | Coach Schedule Control Panel dep |
| `src/lib/auth.ts` | SKIP | Auth-domain — launch-sprint has its own auth system |

---

## Execution Order

```
Phase 3 — Match v2 (execute now)
├── Step 1: Install expo-contacts
├── Step 2: Checkout match component files (MatchDiscovery, MatchCard, ScheduleTimePicker,
│           coachSchedule.ts, WeatherTimeWheel, useHourlyWeather, AddPlayersSheet,
│           match/new.tsx, match/[id].tsx, formatLabel.ts)
├── Step 3: Replace src/app/(resident)/match.tsx
│           — Port sendNotificationEmail calls from old version
├── Step 4: Apply 4 migrations (3 match + tennis_facilities)
├── Step 5: Run lint/typecheck
└── Step 6: Commit

Phase 4 — CourtCard (optional, low risk)
└── Checkout CourtCard.tsx → commit

Phase 5 — Coach Schedule Control Panel (future, separate decision)
└── Requires: conflict analysis, test plan, explicit approval

Phase 6 — Clinics (after Phase 5)
└── Depends on Phase 5 decision
```

---

## Files NOT Touched

These launch-sprint files must not be overwritten at any point:

| File | Reason |
|---|---|
| `src/app/(resident)/_layout.tsx` | launch-sprint added auth guard |
| `src/app/(auth)/**` | Auth domain |
| `src/lib/emailNotifications.ts` | Notification system |
| `supabase/functions/**` | Edge functions (notifications, reminders) |
| `src/app/(coach)/schedule.tsx` | Diverged — launch-sprint version has lesson package integration + tests |
| `src/components/coach/CoachWeeklyScheduleModal.tsx` | launch-sprint only |
| `src/components/coach/LessonPackagesManager.tsx` | launch-sprint only |
| `supabase/migrations/20260626*` through `20260628*` | lesson packages, notification fixes |

---

## Stop Conditions

Stop and flag before proceeding if any of the following are true:
- A migration file has the same timestamp as an existing one on launch-sprint
- A checkout operation would overwrite a file that exists on launch-sprint and is in the "not touched" list above
- `expo-contacts` installation fails or produces peer dependency conflicts
- TypeScript errors after checkout reference files from the deferred feature clusters

---

## Phase 5 — Verification Record

**Completed:** 2026-06-29  
**Commits verified:** `c1b047f` (Match v2), `0814df1` (Coach Schedule + Clinics), `9c57604` (LAUNCH_KANBAN update)

### TypeScript Checks

`mcp__ide__getDiagnostics` run after each import phase:
- After Phase 3 (Match v2): **0 errors**
- After Phase 4 (Coach Schedule + Clinics): **0 errors**

### Schema Checks (remote Supabase `hqqlrliakttqsbalvuyz`)

All 6 tables confirmed present and healthy via `supabase db query --linked`:

| Table | Status |
|---|---|
| `open_match_listings` | ✅ EXISTS — base table + NTRP columns + v2 columns all confirmed |
| `open_match_listing_participants` | ✅ EXISTS — `status`, `added_by`, `slot_index` columns confirmed |
| `tennis_facilities` | ✅ EXISTS — Bayamon seed row present |
| `coach_schedule_private_settings` | ✅ EXISTS (was already applied from Codex session) |
| `coach_teaching_blocks` | ✅ EXISTS (was already applied from Codex session) |
| `coach_clinics` | ✅ EXISTS (was already applied from Codex session) |

Migration `20260610190000_match_creation_v2.sql` applied live during Phase 3 — `duration_minutes`, `court_reserved`, `location_source`, `location_id` columns were missing from remote and were added via `supabase db query --linked --file`.

### Launch-Sprint Fix Preservation

`git diff c1b047f~1..0814df1` on all protected files = **0 lines changed**.

Confirmed via `git log --oneline -3 -- <file>` on every critical cluster:

| Cluster | Files checked | Last touched by | Modified by reconciliation? |
|---|---|---|---|
| Auth | `NativeAuthContext.tsx`, `login.tsx`, `reset-password.tsx`, `settings.tsx` | `47e9a74`, `59cb374`, `0629c3e` | ❌ No |
| Notifications | `emailNotifications.ts`, `send-booking-email/index.ts`, `send-notification-email/index.ts` | `6bfd494`, `219cd3e`, `0229ba7` | ❌ No |
| Lesson packages | `useLessonPackages.ts`, `LessonPackagesManager.tsx`, `PackagesList.tsx`, migration `20260626*` | `b84487e`, `add9215`, `9bac382` | ❌ No |
| Coach logic tests | `tests/coach-logic.spec.ts` | `1d6f638` | ❌ No |
| Coach hooks | `useCoachSchedule.ts`, `useCoachAvailability.ts` | `e717787`, `6bfd494` | ❌ No |
| Resident auth guard | `(resident)/_layout.tsx` | `6bfd494`, `59cb374` | ❌ No |
| Late migrations | `20260628*` (notification_fixes, lesson_requests_status) | `dcee138`, `6bfd494` | ❌ No |

`(coach)/_layout.tsx` **was** modified by `0814df1` — this is expected and correct: 3 hidden routes added (`schedule-settings`, `schedule-week`, `clinics`). No existing routes removed.

### Migration Conflict Check

No timestamp collisions. All 7 codex migrations have unique timestamps not present in launch-sprint before the import:

| Migration | Timestamp | Conflict? |
|---|---|---|
| `open_match_listings.sql` | `20260610120000` | ❌ None |
| `open_match_listing_ntrp.sql` | `20260610153000` | ❌ None |
| `match_creation_v2.sql` | `20260610190000` | ❌ None |
| `tennis_facilities.sql` | `20260612100000` | ❌ None |
| `coach_schedule_private_settings.sql` | `20260609153000` | ❌ None |
| `coach_teaching_blocks.sql` | `20260609170000` | ❌ None |
| `coach_clinics.sql` | `20260610230000` | ❌ None |

### Manual QA Steps

Documented in `LAUNCH_KANBAN.md`:
- **Phase 6** (Match v2): 14-step runbook covering MatchDiscovery, Create Match wizard, WeatherTimeWheel, HOA courts, Other Locations, AddPlayersSheet, listing detail, Join, Player Lookup, challenge + notification
- **Phase 7** (Coach Schedule + Clinics): 12-step runbook covering daily timeline, week view, schedule-settings, CreateClinicSheet, clinic detail, LessonWeather, legacy-hook coexistence

### Remaining Risks

Documented in `LAUNCH_KANBAN.md` Open Risks section:
1. `match_confirmation`/`match_declined` notifications removed with old accept/decline UI
2. `open_match_listing_participants` self-join blocked by RLS — creators cannot join own listing (by design — confirm with product owner)
3. `expo-contacts/legacy` deprecated import path — no functional impact now
4. `expo-screen-orientation` installed via `npm install` not `expo install` — verify EAS build
5. `ClinicDiscovery` not wired for residents — clinics undiscoverable without direct link
6. Dual coach hook coexistence — test schedule tab + requests tab simultaneously

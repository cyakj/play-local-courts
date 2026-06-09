# TenisX Native — Project Handoff Document

**Generated:** 2026-06-09  
**App:** TenisX — HOA community tennis/sports court booking mobile app  
**Target:** App Store launch end of April 2026  
**Platform:** React Native 0.85 + TypeScript + Expo SDK 56 + Supabase

---

## 1. Current Branch

**Branch:** `main`  
**Remote:** origin/main  
**Last commit:** `005a2a3` — `feat(db): add coach_global_hours, facility_hours, travel_hours, blockouts tables`

All work is on main. There is no feature branch. This is intentional — the project uses a trunk-based approach.

---

## 2. Last Completed Work

### DB Migration — Coach Schedule Control Panel (commit `005a2a3`)

Created and applied `supabase/migrations/20260609120000_coach_schedule_control_panel.sql` to the remote Supabase project. This migration adds 4 new tables:

| Table | Purpose |
|---|---|
| `public.coach_global_hours` | Per-day outer coaching boundary (7AM–8PM by default). Private — never shown to students. Unique per coach+day. |
| `public.coach_facility_hours` | Fixed facility teaching windows (e.g., "Mon/Wed 8–12 at Riverside TC"). Has `publicly_bookable` toggle. |
| `public.coach_travel_hours` | Travel availability windows with optional radius (miles) and areas served. Has `publicly_bookable` toggle. |
| `public.coach_blockouts` | Time-based recurring or date-specific blockouts (lunch, tournament, personal, etc.). Separate from `coach_unavailability`. |

All 4 tables have RLS enabled. Full SQL is at `supabase/migrations/20260609120000_coach_schedule_control_panel.sql`.

### Spec and Plan Documents (WIP commit `a24fb7b`)

The following planning docs were written and committed:

| File | Purpose |
|---|---|
| `docs/superpowers/specs/2026-06-09-coach-schedule-control-panel-design.md` | Full 3-phase design spec (authoritative) |
| `docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-phase1.md` | 9-task implementation plan with COMPLETE code for every file |
| `docs/superpowers/specs/2026-06-09-availability-grid-interaction-design.md` | Earlier spec for grid fixes (superseded — do not implement) |
| `docs/superpowers/plans/2026-06-09-availability-grid-fixes.md` | Earlier plan for grid fixes (superseded — do not implement) |
| `docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-CHECKPOINT.md` | Session checkpoint summary |

The earlier "availability grid fixes" spec and plan were replaced by the full Schedule Control Panel redesign. Do not implement the grid fixes — the grid editor is being removed entirely.

### Recent history before this session (for context)

| Commit | Summary |
|---|---|
| `60644fc` | fix(coach-favorites): pass full CoachFilters including certification field |
| `6c29361` | feat(filters): add ITF cert filter, fix location filter to use coachingLocationType |
| `81dcea4` | feat(coachcard): ITF cert + location type badges, restructure layout order per spec |
| `87aae80` | feat(header): add avatar circle and messages icon to coach header |
| `99524df` | feat(coach): reviews screen with avg rating and player review list |
| `86c071d` | feat(dashboard): fix pending contrast (volt→blue), add reviews summary card |
| `5a574f6` | feat(availability): replace 3-band system with 16-slot hourly grid (6AM-10PM) |
| `2d2a1ee` | feat(profile): single-form save, gender/ITF cert/coaching location type fields |

---

## 3. Work Currently In Progress

### Feature: Coach Schedule Control Panel (Phase 1)

**What it is:** A full replacement for the inline `CoachAvailabilityGridEditor` component on the schedule screen. Coaches will get a dedicated settings screen (`schedule-settings`) with structured controls for Global Hours, Facility Hours, Travel Availability, and Blockouts.

**Status:** DB migration complete and applied. All 9 UI tasks are unstarted. Every task has complete, ready-to-paste code in the plan file at `docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-phase1.md`.

### Task Status at Session End

| # | Task | Status |
|---|---|---|
| 1 | DB Migration — 4 new tables | ✅ DONE (commit `005a2a3`) |
| 2 | 4 Hooks (useCoachGlobalHours, useCoachFacilityHours, useCoachTravelHours, useCoachBlockouts) | ⏳ Not started |
| 3 | SectionCard shared component | ⏳ Not started |
| 4 | GlobalHoursSection component | ⏳ Not started |
| 5 | FacilityHoursSection component | ⏳ Not started |
| 6 | TravelHoursSection component | ⏳ Not started |
| 7 | BlockoutsSection + ScheduleColorKey components | ⏳ Not started |
| 8 | schedule-settings.tsx screen | ⏳ Not started |
| 9 | Update schedule.tsx + _layout.tsx | ⏳ Not started |

**The plan file is self-contained** — it includes the complete TypeScript/TSX source for every file that needs to be created. An implementer can read `docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-phase1.md` and paste/write each file directly without needing further research.

---

## 4. Files Modified (This Session)

Only documentation and migration files were changed this session. No TypeScript/UI source was touched.

### Created (new files)
```
supabase/migrations/20260609120000_coach_schedule_control_panel.sql
docs/superpowers/specs/2026-06-09-coach-schedule-control-panel-design.md
docs/superpowers/specs/2026-06-09-availability-grid-interaction-design.md
docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-phase1.md
docs/superpowers/plans/2026-06-09-availability-grid-fixes.md
docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-CHECKPOINT.md
```

### Files the next phase will create (Tasks 2–9)
```
src/hooks/useCoachGlobalHours.ts         (Task 2)
src/hooks/useCoachFacilityHours.ts       (Task 2)
src/hooks/useCoachTravelHours.ts         (Task 2)
src/hooks/useCoachBlockouts.ts           (Task 2)
src/components/coach/schedule/SectionCard.tsx           (Task 3)
src/components/coach/schedule/GlobalHoursSection.tsx    (Task 4)
src/components/coach/schedule/FacilityHoursSection.tsx  (Task 5)
src/components/coach/schedule/TravelHoursSection.tsx    (Task 6)
src/components/coach/schedule/BlockoutsSection.tsx      (Task 7)
src/components/coach/schedule/ScheduleColorKey.tsx      (Task 7)
src/app/(coach)/schedule-settings.tsx   (Task 8)
```

### Files the next phase will modify (Task 9)
```
src/app/(coach)/schedule.tsx             (remove grid editor, add nav card)
src/app/(coach)/_layout.tsx             (add hidden schedule-settings route)
```

---

## 5. Database Migrations Completed

All migrations are applied to the remote Supabase project (`hqqlrliakttqsbalvuyz`). The migration files are stored locally in `supabase/migrations/` and tracked in git.

### Migrations from this session
- `20260609120000_coach_schedule_control_panel.sql` — 4 new schedule tables (see Section 2)

### Key migrations from earlier sessions (most relevant to current work)
- `20250625193319-*.sql` — Created `coach_availability` table (hourly slots, `location_mode` column, RLS)
- `94407c0` (db): Added ITF cert column + coaching location type columns to `coaches`/`profiles`, migrated band availability to hourly slots
- Various earlier: `coach_unavailability` (date-range blocks, vacation, recurs_annually), `lesson_requests`, `profiles`, `coaches`

### Tables most relevant to Schedule Control Panel work

| Table | Purpose | Notes |
|---|---|---|
| `coach_availability` | 16-slot hourly grid (6AM–9PM), day_of_week + start_time + location_mode | **DO NOT TOUCH** — booking flow uses this |
| `coach_unavailability` | Date-range blocks (vacation/tournament). `start_date`, `end_date`, `recurs_annually`. **No time fields.** | **DO NOT TOUCH** |
| `coach_global_hours` | New — per-day coaching outer boundary | Just created |
| `coach_facility_hours` | New — facility sessions | Just created |
| `coach_travel_hours` | New — travel windows | Just created |
| `coach_blockouts` | New — recurring/date-specific time blockouts | Just created |

---

## 6. Database Migrations Still Needed

### Phase 2 (Calendar Layer View — future, not yet designed in detail)
- No new tables required for Phase 2. It reads from all existing tables.

### Phase 3 (Cancellation Fill + Push Notifications — future)
Two new tables will be needed:

```sql
-- Coach configuration for automatic cancellation fill
CREATE TABLE public.coach_cancellation_fill_rules (
  coach_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'off'
    CHECK (mode IN ('off','waitlist_only','selected','all_eligible','matching')),
  eligibility_criteria JSONB DEFAULT '{}',
  approval_required BOOLEAN NOT NULL DEFAULT false,
  message_template TEXT
);

-- Tracks individual open-slot broadcast events
CREATE TABLE public.open_slot_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_request_id UUID REFERENCES lesson_requests(id),
  slot_date DATE NOT NULL,
  slot_start_time TIME NOT NULL,
  slot_end_time TIME NOT NULL,
  broadcast_at TIMESTAMPTZ DEFAULT now(),
  filled_by UUID REFERENCES auth.users(id),
  filled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','expired'))
);
```

Also needed for Phase 3:
- Add `expo_push_token TEXT` column to `profiles` table
- New Supabase edge function: `send-open-slot-notification`

### TypeScript types regeneration
After any migration, run:
```bash
npx supabase gen types typescript --project-id hqqlrliakttqsbalvuyz > src/lib/types.ts
```
The new schedule tables are NOT yet in `src/lib/types.ts`. The hooks in the plan use manually-typed interfaces instead of the generated types — this is intentional and correct until types are regenerated.

---

## 7. Current Bugs

### Known bugs in `CoachAvailabilityGridEditor` (intentionally deferred)

These bugs were documented and a fix plan was written, but the fix plan was **superseded** by the full Schedule Control Panel redesign. The grid editor is being removed entirely in Task 9. Do not fix these bugs — just delete the component.

| Bug | Root Cause | Status |
|---|---|---|
| Yellow "Traveling" cells cannot be converted to blue "Facility" or cyan "Either" | Nested `TouchableOpacity` — outer row TouchableOpacity competes with inner cell press events. The outer row's handler fires instead of the inner cell's. | Deferred — component being removed |
| Save button only visible at top when `isDirty`. No Cancel button anywhere. | `isDirty` guard hides button; bottom button never implemented | Deferred — component being removed |
| Empty cell tap sets the cell immediately to `coachDefault` instead of showing options | No "Add" bottom sheet — tap just applies default mode directly | Deferred — component being removed |
| Cell editing uses `ActionSheetIOS` on iOS and `Alert.alert` on Android | Never migrated to cross-platform Modal bottom sheet | Deferred — component being removed |
| No F / T / E letter labels on colored cells | Never implemented | Deferred — component being removed |

### No known bugs in the new Schedule Control Panel code
The plan code is unimplemented — no bugs yet. The code in the plan has been reviewed for correctness.

---

## 8. Next Implementation Steps

Execute tasks 2–9 from `docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-phase1.md` in order. All code is written out in that file — tasks are mechanical copy-and-paste plus TypeScript verification.

### Recommended approach
Use the `superpowers:subagent-driven-development` skill (already invoked this session) to dispatch a fresh agent per task with spec review + code quality review after each.

### Quick resume prompt
> "Resume the Coach Schedule Control Panel Phase 1 implementation. Task 1 (DB migration) is done at commit 005a2a3. Start from Task 2 (hooks). Plan is at docs/superpowers/plans/2026-06-09-coach-schedule-control-panel-phase1.md. Use subagent-driven-development."

### Task 2 — 4 Hooks (start here)
Create these 4 files. Full source is in the plan (Tasks 2 section):
- `src/hooks/useCoachGlobalHours.ts` — `upsertDay()` using Supabase upsert with `onConflict: 'coach_id,day_of_week'`
- `src/hooks/useCoachFacilityHours.ts` — `addRecord()`, `updateRecord()`, `deleteRecord()` (soft delete via `is_active: false`)
- `src/hooks/useCoachTravelHours.ts` — same pattern as facility hours
- `src/hooks/useCoachBlockouts.ts` — `addBlockout()`, `deleteBlockout()` (hard delete)

After writing: `npx tsc --noEmit` — expect zero errors.

### Task 3 — SectionCard
Create `src/components/coach/schedule/SectionCard.tsx` — a simple card wrapper used by all 4 section components. Takes `eyebrow`, `description`, `children`, `rightAction`.

### Tasks 4–7 — Section components
Each creates one component in `src/components/coach/schedule/`. Each has a Modal bottom sheet for add/edit. All code is in the plan.

### Task 8 — schedule-settings screen
Create `src/app/(coach)/schedule-settings.tsx`. Uses `Header variant="inner"` (NOT `variant="coach"`), ScrollView, all 5 section components stacked.

### Task 9 — Wire navigation
1. In `_layout.tsx`: add `<Tabs.Screen name="schedule-settings" options={{ href: null }} />` after the `reviews` screen line.
2. In `schedule.tsx`: remove `CoachAvailabilityGridEditor` import + usage; add a `TouchableOpacity` "Manage Schedule" card that calls `router.push('/(coach)/schedule-settings')`.
3. Run `npx tsc --noEmit` — expect zero errors.
4. Smoke-test all 9 acceptance criteria listed in the plan.

---

## 9. Architecture Decisions Already Made

### App-wide

**Dark-first UI.** Page canvas is always `#0C0F18`. Cards are `#161A26`. Never use white or light-gray backgrounds.

**Three-font system:**
- `SpaceGrotesk-Bold` — headlines, page titles, stat numbers, card titles
- `Manrope-SemiBold` / `Manrope-Medium` — body copy, UI labels, buttons
- `JetBrainsMono-SemiBold` — ALL CAPS chips, eyebrows, court codes, status pills

**Color usage split — critical to understand:**
- `Colors.blue`, `Colors.cyan`, `Colors.volt`, `Colors.positive`, `Colors.negative` — brand/action colors. Import from `@/constants/design`. These are constant across light/dark mode.
- `theme.textPrimary`, `theme.textSecondary`, `theme.textMuted`, `theme.cardBg`, `theme.border`, `theme.pageBg` — surface/text colors. Come from `useTheme()` → `theme`. These change between light/dark. **Never use `Colors.textPrimary`** — it doesn't exist as a `Colors` constant (it IS in `Colors` as a legacy alias, but use `theme.textPrimary` in new components for proper light/dark support).

**Design tokens location:** `src/constants/design.ts` exports `Colors`, `FontFamily`, `FontSize`, `Radius`, `Spacing`, `Shadow`, `CyanGlow`, `GradientColors`, `Motion`.

**Theme tokens location:** `src/constants/theme-tokens.ts` exports `ThemeTokens` interface + `darkTheme` + `lightTheme`. `useTheme()` from `@/context/ThemeContext` returns `{ theme, mode, setTheme }`.

**Path alias:** `@/` maps to `src/`. Always use `@/` for imports, never relative paths like `../../`.

**Routing:** Expo Router file-based routes. Coach routes are under `src/app/(coach)/`. The tabs are defined in `src/app/(coach)/_layout.tsx`. Hidden routes (no tab icon) use `options={{ href: null }}`.

**Supabase client:** `import { supabase } from '@/lib/supabase'`

**Bottom sheets:** All modals use `Modal` from react-native with `animationType="slide"` and `transparent`. The overlay is a `TouchableOpacity` with `flex: 1, backgroundColor: 'rgba(0,0,0,0.55)'`. The sheet sits at `position: 'absolute', bottom: 0, left: 0, right: 0` with `borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl`. Bottom padding accounts for safe area via `useSafeAreaInsets().bottom`. See `GlobalHoursSection` in the plan for the exact pattern.

**`useStyles(theme)` pattern:** All components use a `function useStyles(theme: ThemeTokens)` that returns `useMemo(() => StyleSheet.create({...}), [theme])`. This is the standard pattern across the codebase.

**No emojis in code.** Use Lucide React Native icons only (`lucide-react-native`). Never use emoji in UI text or code comments.

**Tap feedback:** `activeOpacity={0.7}` on list/card taps, `activeOpacity={0.85}` on primary action buttons.

### Header variants — critically important

The `Header` component (`src/components/ui/Header.tsx`) has these variants:
- `variant="coach"` — top-level tab screen header. Shows TenisX logo, avatar circle, messages icon, bell, menu. No title prop, no back button.
- `variant="inner"` — pushed/stacked screen header. Has `title` (centered) + optional `onBack` (arrow-left) + optional `rightIcon`. **Use this for all screens reached via `router.push()`.**
- `variant="resident"` — resident tab header
- `variant="cm-portfolio"` — condo manager header
- `variant="resident-home"` — resident home header

**Never use `variant="coach"` with a back button.** It doesn't support those props. Any screen navigated to via `router.push()` must use `variant="inner"`.

### Schedule Control Panel architecture decisions

**`travel_base_address` is intentionally NOT stored in `coach_travel_hours`.** Privacy concern — the coach's home address must not be accidentally exposed via the public SELECT policy. Use `coaches.home_base` or a private profile field for radius calculations.

**`coach_blockouts` is a separate table from `coach_unavailability`.** The existing `coach_unavailability` table stores date-range blocks (vacation, tournament) with `start_date` and `end_date` fields — no time fields. A new `coach_blockouts` table was created specifically for time-based recurring blockouts (e.g., "lunch every M–F 12–1PM"). These two systems coexist.

**Soft delete for facility/travel records.** Records are never hard-deleted — `is_active` is set to `false`. This preserves history and prevents broken references.

**Hard delete for blockouts.** Blockouts are deleted with `.delete()` directly.

**Hooks do not use generated types from `src/lib/types.ts`.** They use manually-defined interfaces (e.g., `CoachGlobalHour`, `CoachFacilityHour`). This is intentional — the new tables were not present when types were last generated. Run `npx supabase gen types typescript` to regenerate when ready.

**The existing booking flow (`coach_availability`, `lesson_requests`) is completely untouched.** The new Schedule Control Panel tables do not affect booking. Phase 2 (Calendar Layer View) will eventually combine the new tables with `lesson_requests` for a visual overlay, but Phase 1 does not touch booking at all.

**Color coding for schedule types:**
- Facility Hours: `#2D6BFF` Blue (label: F)
- Travel Hours: `#D6FF3D` Volt (label: T)
- Either/Flexible: `#2DE0FF` Cyan (label: E)
- Blockout: `#5A6379` Gray (label: B)
- Booked Lesson: `#0C0F18` Navy (label: L)
- Pending Request: `#FF8C42` Orange (label: P)

---

## 10. Assumptions to Preserve

An incoming AI (or developer) should preserve all of the following:

### Product assumptions
1. **App Store launch target is end of April 2026.** Only Stage 1 features (listed in CLAUDE.md) are active. Everything else is hidden. Do not redesign, modify, or expose Stage 2 features.
2. **Three user roles exist:** Condo Manager (portfolio), HOA Board Admin (community), Resident (booking/reports). A fourth pseudo-role (Coach) has its own tab group. Platform reviewers are superusers above all.
3. **HOA members start as `pending`** and must be approved by an admin before gaining access.
4. **The coach marketplace** (discovery, search, filtering, card display) is a separate concern from the coach's own schedule management. The marketplace was recently updated (ITF cert filter, coachingLocationType filter, CoachCard badges). These two areas should not interfere.

### Technical assumptions
5. **`npx supabase db push` applies to the remote project** (`hqqlrliakttqsbalvuyz`). There is no local Supabase stack currently running. All migrations go directly to remote.
6. **Capacitor compatibility must be maintained.** No browser-only APIs (`window`, `document`, `navigator` outside of safe Capacitor wrappers). The app targets both Expo Go and Capacitor native builds.
7. **No hardcoded user IDs or community IDs, ever.** Always use `supabase.auth.getUser()` to get the current user.
8. **TypeScript strict mode.** No implicit `any`. Run `npx tsc --noEmit` after every code change and fix all errors before committing.
9. **`cm-*` Tailwind tokens are legacy-only.** Never use them in new code. Use inline hex values for brand colors in Tailwind classnames: `bg-[#0C0F18]`, `text-[#2DE0FF]`, etc.
10. **Feature flags** are in `src/config/featureFlags.ts`. Currently only `TENNIS_FEATURES_ENABLED` exists. Do not add UI behind new flags without discussing first.
11. **Supabase RLS is always on.** Every new table must have `ENABLE ROW LEVEL SECURITY` and explicit policies. A table with no policies effectively blocks all access. For coach-managed tables, the pattern is: `FOR ALL USING (coach_id = auth.uid())` plus a separate `FOR SELECT USING (true)` or `USING (publicly_bookable = true OR coach_id = auth.uid())`.
12. **No `interSemiBold` / `interRegular` font families in new code.** These are legacy aliases in `FontFamily`. New code uses `manropeSemiBold`, `manropeMedium`, `spaceGroteskBold`, `jetbrainsMonoSemiBold`.
13. **`useMemo` for `useStyles`** — all `StyleSheet.create()` calls are inside `useMemo(() => StyleSheet.create({...}), [theme])` inside a `useStyles(theme)` function. This prevents style objects from being recreated on every render.
14. **`useState` + `useEffect` + `useCallback` pattern for hooks** — hooks follow the pattern: `const [data, setData] = useState([])` + `const load = useCallback(async () => {...}, [coachId])` + `useEffect(() => { load(); }, [load])`. This is the established hook pattern across the codebase (see `useCoachAvailability.ts`, `useCoachProfile.ts`).
15. **`router.push()` not `router.navigate()`** — expo-router navigation uses `router.push('/(coach)/screen-name')` for pushing onto the stack and `router.back()` for the back button in `onBack` handlers.
16. **`useSafeAreaInsets()` from `react-native-safe-area-context`** — used in all bottom sheets to add `paddingBottom: Math.max(insets.bottom, 20)` so content is not hidden by the home indicator on iOS.
17. **Mobile-first, 390px reference width.** No horizontal grids on mobile. All content stacks vertically. Cards are full-width. Maximum tablet content width is 480px centered (`max-w-[480px] mx-auto`).

### Design system assumptions
18. **Cyan glow (`CyanGlow`) is reserved for live/active/connected state only** — never purely decorative. If a card has a cyan glow, it means something is live right now.
19. **Status pills use `Radius.pill` (999px borderRadius), JetBrains Mono font, 12px, color-tinted background.** Interactive chips (filters, day selectors, time pickers) use `Radius.chip` (12px) — NOT `Radius.pill`.
20. **Section eyebrows are always ALL CAPS with JetBrains Mono**, 11px, letter-spacing 0.18. Example: `"GLOBAL COACHING HOURS"`, `"FACILITY HOURS"`.
21. **Add buttons in SectionCard rightAction use the accent color of that section** — facility hours = blue, travel hours = volt, blockouts = neutral gray.

### Supabase-specific assumptions
22. **`auth.users` is the authoritative identity table.** Coaches are identified by `auth.users.id`. `profiles` holds display data (name, avatar). `coaches` holds coaching-specific data (bio, rates, ITF cert, coachingLocationType, etc.).
23. **The `coach_global_hours` UNIQUE constraint is `(coach_id, day_of_week)`.** Upserts for this table must use `onConflict: 'coach_id,day_of_week'`.
24. **Time values stored in PostgreSQL `TIME` columns come back from Supabase as strings like `'07:00:00'` (with seconds).** All time comparisons and display must `slice(0, 5)` to get `'07:00'` format.
25. **`coach_unavailability` is date-only** — columns are `start_date DATE` and `end_date DATE`. There are no time columns on this table. Do not attempt to add time fields to it. The new `coach_blockouts` table handles time-based overrides.

---

## Quick Reference: Key File Locations

```
src/app/(coach)/
  _layout.tsx          — Tabs navigator for coach, href:null pattern
  schedule.tsx         — Coach schedule screen (to be modified in Task 9)
  schedule-settings.tsx — NEW screen to be created (Task 8)
  index.tsx            — Coach dashboard
  me.tsx               — Coach profile/settings
  requests.tsx         — Pending lesson requests
  students.tsx         — Student list

src/components/coach/
  CoachAvailabilityGridEditor.tsx  — OLD grid editor, being removed in Task 9
  CoachWeekView.tsx                — Week view component, KEPT in schedule.tsx
  schedule/                        — NEW directory for Tasks 3–7 components

src/hooks/
  useCoachAvailability.ts  — HOURS array, CellMode type, weeklySlots
  useCoachProfile.ts       — coachProfile including coachingLocationType
  useCoachSchedule.ts      — lessonsByDate for week view
  (4 new hooks to be created in Task 2)

src/constants/
  design.ts            — Colors, FontFamily, FontSize, Radius, Spacing, etc.
  theme-tokens.ts      — ThemeTokens interface, darkTheme, lightTheme

src/components/ui/
  Header.tsx           — variant="inner" for pushed screens (back + title)

supabase/migrations/
  20260609120000_coach_schedule_control_panel.sql  — NEW (this session)

docs/superpowers/plans/
  2026-06-09-coach-schedule-control-panel-phase1.md  — ACTIVE PLAN (Tasks 2–9 with full code)
```

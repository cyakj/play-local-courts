# Community-Mode Resident IA Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `EXPO_PUBLIC_PRODUCT_MODE=community` produce a genuine HOA resident product — Home / Reserve / Community / Schedule / Me — instead of the tennis app with tabs hidden, while leaving `PRODUCT_MODE=tennis` byte-for-byte unaffected and reusing the same data layer, booking engine, and shared components throughout.

**Architecture:** No new screens, no forked codebase. Every change is either (a) a new conditional branch inside an existing resident screen (`index.tsx`, `courts.tsx`, `calendar.tsx`, `me.tsx`, `community.tsx`, `Header.tsx`), (b) a `Tabs.Screen` config change in `(resident)/_layout.tsx` (extending the exact `href: isCommunityMode ? ... : ...` pattern already used for Match/Coaches/Community), or (c) an extension of the single existing `AuthGuard` in the root layout to add a product-mode redirect rule alongside its existing session-guard rule — not a second competing guard. The booking/reservation data layer (`courts`, `amenity_rules`, `hoa_events`, `hoa_announcements`) is already amenity-generic underneath every tennis leak found; nothing there changes.

**Tech Stack:** Expo Router (file-based routing, `Tabs`/`Stack` with `href: null` for tab visibility), existing `src/config/productMode.ts` flag, existing `useSession`/`useSegments` primitives already used by `AuthGuard`.

**Spec:** No separate spec file; the Global Constraints below are transcribed from the user's 2026-08-19 in-session request. The audit findings that inform every task were gathered via a dedicated read-only investigation of the current codebase (file:line citations throughout this plan); the two most safety-critical files (`(resident)/_layout.tsx`, `courts.tsx`) were re-verified directly, not taken on trust.

## Global Constraints

- `EXPO_PUBLIC_PRODUCT_MODE=community` must produce a genuine community/HOA resident experience — not the tennis product with features hidden.
- `PRODUCT_MODE=tennis` must preserve the full existing TenisX experience, unchanged.
- Target Community-mode tabs, in order: **Home, Reserve, Community, Schedule, Me.** Remove VS/Match, Coaches, Find Match, Find Coach, NTRP, tennis discovery/social, tennis-specific profile concepts from Community-mode navigation — without deleting any of it for Tennis mode.
- Reserve must be amenity-first: no Tennis/Amenities split, no "Play Now" language where inappropriate, no My HOA/Club-vs-Other split unless genuinely needed (audit found it is not, for V1) — driven by the community's real configured amenities, reusing the existing reservation/availability engine, not duplicating booking logic.
- Community identity (real `hoas.name`) is primary in Community mode; TenisX branding recedes to a subtle "Powered by TenisX" mark, never hardcoded per-community.
- Home answers "what's happening in my community": upcoming reservations, announcements, upcoming events, maintenance/status notices when relevant, quick Reserve, Report Issue. No tennis discovery/coaching content.
- Community screen: announcements, events, community info, maintenance/report-issue access. No invented social-network scope.
- Schedule aggregates reservations, community events, resident-visible board meetings, maintenance/closures.
- Me: identity/profile, membership, upcoming summary, reservations/schedule access, settings, help. No NTRP/match/coach/tennis-player concepts.
- Audit and correct role routing (resident/coach/admin) and direct-route/deep-link protection for tennis-only screens — tab-hiding alone is not sufficient.
- Stay on `greens-v1`. Do not touch `main`. Do not delete Tennis functionality. Do not modify Match v2 behavior for tennis mode. No blanket `supabase db push`. Prefer shared components/services with mode-specific presentation over duplicated codebases.
- **Verification adaptation** (same as the sibling amenity-redesign plan): no Jest/RTL harness exists in this repo; verification is `npx tsc --noEmit` plus a concrete manual QA action per task, matching how this codebase has actually been verified so far.

---

## Audit Summary (ground truth this plan is built on)

**A. Navigation shell today** (`src/app/(resident)/_layout.tsx`, verified directly): Home/Reserve/Me have no mode conditional at all. Match (`href: isCommunityMode ? null : undefined`, line 36) and Coaches (line 48) are hidden in Community mode. Community is hidden in Tennis mode (line 56). **There is no Schedule tab in either mode today** — `calendar.tsx` is declared `href: null` unconditionally (line 70), reachable only via in-page links.

**B. Screen-by-screen leaks** (full detail in the investigation this plan is based on):
- `index.tsx` (Home): only the Quick Actions row is mode-gated (lines 438-466). Everything else — a "tennis-first" playability verdict, Pending Challenge card (470-500), "ON THE COURT" card (503-543), Match Invitations banner (546-558), Upcoming Matches (561-607), Recent Result (609-633) — renders unconditionally and is simply data-empty in Community mode, not structurally absent. Community Pulse announcements (636-652) is already generic and fine.
- `courts.tsx` (Reserve): **zero** product-mode conditionals anywhere in the file (confirmed by direct grep). Hardcoded `ActiveTab='tennis'|'amenities'` toggle (line 105, 619-632) and `TopLevelTab='hoa'|'other'` toggle (line 106, 585-605, "Other" is a permanent "coming soon" placeholder) render identically in both modes. Card CTA says "Play Now →" for any open court regardless of type (line 771). Underneath, `loadCourts()` fetches `courts` with no `court_type` filter — the tennis/amenities split is 100% client-side (line 522-524); the booking sheet, slot computation, and insert logic are already amenity-generic.
- `community.tsx`: already the most genuinely HOA-native screen — real `hoas`/`hoa_announcements`/`hoa_documents` data, no tennis leaks found.
- `calendar.tsx` (de facto Schedule): already aggregates `bookings` + `hoa_events`, but unconditionally also merges `matches`/`lesson_requests` and shows `Match`/`Lesson` filter chips (lines 23-40, 161-214) even with zero tennis feature access; empty-state copy is literally "No tennis activity scheduled for this day." (line 551).
- `me.tsx`: mostly correctly gated already (NTRP, Next Lesson, Next Match all suppressed via `isCommunityMode` checks). One leftover leak: the Community stat tooltip copy mentions "coaches" even in Community mode (line 292).

**C. Branding**: `Header.tsx:96-101` already does a clean swap (community name text vs. TenisX logo image), no hardcoded community name — but nothing bridges the two; there's no "Powered by TenisX" trace anywhere once the swap happens.

**D. Role routing**: `src/app/index.tsx:19-34` routes purely by `user_roles` — CM roles → `/(cm)`, `coach` → `/(coach)`, else → `/(resident)`. **No file anywhere consults product mode.** A `coach`-role user under a Community-mode deployment lands fully in the unmodified `(coach)` shell today.

**E. Deep-link protection**: confirmed **none** exists. `match.tsx`, `coaches.tsx`, `match/new.tsx`, `match/[id].tsx`, `coach-profile/[id].tsx`, `my-coaching.tsx`, `coach-favorites.tsx`, and the entire `(coach)` group have zero `isCommunityMode` awareness. Root `_layout.tsx`'s `<Stack.Screen>` list (lines 135-160) carries no access-control semantics in expo-router — every file-based route is reachable via `router.push()`/deep link regardless. The only existing guard is `AuthGuard` (`_layout.tsx:29-67`), which handles session presence only, explicitly designed as "the single authoritative auth guard" to avoid competing `<Redirect>`s racing — this plan extends that same guard rather than adding a second one.

**F. Reservation engine**: confirmed fully generic underneath (`courts.tsx:310` fetches by `hoa_id` with no type filter; `TENNIS_TYPES`/`OUTDOOR_TYPES` are used only for client-side UI branching, never to restrict what's queried or bookable). **Every leak identified is presentation-layer only** — this plan never touches a query or the booking/insert logic.

---

## File Structure

**No new files.** All changes are edits to:
- `src/app/_layout.tsx` — extend `AuthGuard` with a product-mode route guard.
- `src/app/index.tsx` — coach role treated as resident in Community mode.
- `src/app/(resident)/_layout.tsx` — add a Community-mode-only Schedule tab, reorder to match target IA.
- `src/app/(resident)/courts.tsx` — remove the two toggles in Community mode, amenity-generic copy.
- `src/app/(resident)/index.tsx` — gate tennis sections, add Community sections.
- `src/app/(resident)/calendar.tsx` — gate match/lesson content in Community mode.
- `src/app/(resident)/me.tsx` — fix the one remaining copy leak.
- `src/app/(resident)/community.tsx` — confirm/add Report Issue access.
- `src/components/ui/Header.tsx` — add subtle "Powered by TenisX" mark.

---

### Task 1: Central deep-link/route guard for tennis-only screens

**Files:**
- Modify: `src/app/_layout.tsx:29-67` (`AuthGuard`)

**Why here, not per-screen:** the file's own comment (`_layout.tsx:26-28`) explains `AuthGuard` exists specifically to be the *single* authoritative guard because multiple competing layout-level `<Redirect>`s previously raced. Adding per-screen `isCommunityMode` checks to 7+ files would reintroduce that exact anti-pattern this codebase already moved away from. Extending the one existing guard is both safer and smaller.

**Interfaces:**
- Consumes: `isCommunityMode` from `@/config/productMode`, `segments` from `useSegments()` (already in scope in `AuthGuard`).
- Behavior: purely additive — when `isCommunityMode` is `false` (i.e. every Tennis-mode build), this new branch never fires, so Tennis mode's routing is provably unchanged.

- [ ] **Step 1: Add the import and the blocked-segment check**

At the top of `src/app/_layout.tsx`, add:
```ts
import { isCommunityMode } from '@/config/productMode';
```

Inside `AuthGuard`'s existing `useEffect` (`_layout.tsx:34-64`), after the existing `if (!session && !inAuth && !onResetPassword)` block (around line 63) and before the effect ends, add:

```ts
    // Community-mode deployments must never expose tennis-only screens, even
    // via direct deep link — tab-hiding in (resident)/_layout.tsx is cosmetic
    // only and does not stop router.push()/a deep link from reaching these
    // routes directly. This mirrors the guard above rather than adding a
    // second competing <Redirect> elsewhere.
    if (isCommunityMode && session && !isPasswordRecovery) {
      const top = segments[0];
      const second = segments[1];
      const isTennisOnlyRoute =
        top === '(coach)' ||
        top === 'match' ||
        top === 'coach-profile' ||
        top === 'my-coaching' ||
        top === 'coach-favorites' ||
        (top === '(resident)' && (second === 'match' || second === 'coaches'));
      if (isTennisOnlyRoute) {
        if (__DEV__) console.log(`[AUTH] Community mode blocked tennis-only route: ${segments.join('/')}`);
        router.replace('/(resident)');
      }
    }
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

With `EXPO_PUBLIC_PRODUCT_MODE=community` set, run `npm run dev`, sign in as a resident, and attempt each of: `router.push('/match/new')`, `router.push('/(resident)/coaches')`, `router.push('/coach-profile/some-id')`, `router.push('/my-coaching')` (easiest via a temporary debug button, or by typing the path in Expo web's URL bar) — confirm every one redirects to `/(resident)` instead of rendering. Then unset the env var (or set to `tennis`), repeat the same navigations, and confirm they render normally with zero behavior change.

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "fix(resident): block deep links into tennis-only routes in Community mode"
```

---

### Task 2: Coach role routes to the resident shell in Community mode

**Files:**
- Modify: `src/app/index.tsx:19-34` (`routeByRole`)

- [ ] **Step 1: Add the mode check**

```ts
import { isCommunityMode } from '@/config/productMode';
// ...
      const isCM    = roles.some((r) =>
        ['admin', 'condo_manager', 'manager', 'hoa_manager', 'board_admin'].includes(r),
      );
      const isCoach = roles.includes('coach') && !isCommunityMode;

      if (isCM)         router.replace('/(cm)');
      else if (isCoach) router.replace('/(coach)');
      else              router.replace('/(resident)');
```

Coaching is a tennis-only concept; in a Community-mode deployment a `coach`-role account (if one exists at all) now lands in the resident shell like everyone else, and Task 1's guard independently blocks any later deep link into `(coach)`.

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

With a test account that has the `coach` role and `EXPO_PUBLIC_PRODUCT_MODE=community` set, sign in and confirm landing in `/(resident)`, not `/(coach)`. Repeat with the env var unset/`tennis` and confirm landing in `/(coach)` as before — unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/app/index.tsx
git commit -m "fix(resident): route coach-role accounts to resident shell in Community mode"
```

---

### Task 3: Add the Schedule tab (Community mode only), reorder to target IA

**Files:**
- Modify: `src/app/(resident)/_layout.tsx`

- [ ] **Step 1: Import an icon and move/add the Schedule tab entry**

Add `CalendarDays` to the `lucide-react-native` import (line 3). Insert a new `Tabs.Screen` for `calendar` **between** the `community` and `me` entries (so the visible Community-mode order becomes Home → Reserve → Community → Schedule → Me, matching the target IA exactly; Match/Coaches remain declared but hidden so Tennis mode's visible order — Home → Reserve → Match → Coaches → Me — is untouched):

```tsx
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Schedule',
          href: isCommunityMode ? undefined : null,
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} strokeWidth={1.5} />,
        }}
      />
```

Remove the old `<Tabs.Screen name="calendar" options={{ href: null }} />` line from the "Legacy routes" block at the bottom (line 70) — it's now declared above instead of there.

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

With `EXPO_PUBLIC_PRODUCT_MODE=community`, run `npm run dev`: confirm the bottom nav shows exactly Home, Reserve, Community, Schedule, Me in that order, and tapping Schedule opens the calendar screen. Switch to Tennis mode: confirm the bottom nav is unchanged (Home, Reserve, Match/VS, Coaches, Me) with no Schedule tab.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(resident\)/_layout.tsx
git commit -m "feat(resident): add Community-mode Schedule tab, matching target IA order"
```

---

### Task 4: Reserve — remove the My HOA/Club vs Other toggle in Community mode

**Files:**
- Modify: `src/app/(resident)/courts.tsx`

- [ ] **Step 1: Add the import**

```ts
import { isCommunityMode, isTennisMode } from '@/config/productMode';
```

- [ ] **Step 2: Wrap the toggle and simplify the branch it feeds**

Wrap the "Top-level: My HOA / Club · Other" block (`courts.tsx:585-605`) in `{isTennisMode && (...)}`. The block immediately below it (`{topLevelTab === 'other' ? ... : (...)}`, starting line 607) needs no change — since `topLevelTab` state defaults to `'hoa'` (line 261) and Community mode never renders the toggle that could switch it to `'other'`, that branch already always takes the true-content path in Community mode with zero further edits.

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual QA**

Community mode: confirm the "My HOA / Club · Other" segmented control no longer renders and the amenity list shows directly. Tennis mode: confirm the toggle still renders and "Other" still shows its "coming soon" placeholder as before.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(resident\)/courts.tsx
git commit -m "fix(resident): remove My HOA/Club vs Other toggle in Community mode"
```

---

### Task 5: Reserve — remove the Tennis/Amenities toggle, unify the list, fix copy

**Files:**
- Modify: `src/app/(resident)/courts.tsx`

- [ ] **Step 1: Unify `visibleCourts` in Community mode**

```ts
// courts.tsx:522-524, replace:
const tennisCourts = useMemo(() => courts.filter(c => TENNIS_TYPES.has(c.court_type)), [courts]);
const amenityCourts = useMemo(() => courts.filter(c => !TENNIS_TYPES.has(c.court_type)), [courts]);
const visibleCourts = isCommunityMode ? courts : (activeTab === 'tennis' ? tennisCourts : amenityCourts);
```

- [ ] **Step 2: Hide the Tennis/Amenities segmented control in Community mode**

Wrap the "Tennis / Amenities Tab" block (`courts.tsx:619-632`) in `{isTennisMode && (...)}`.

- [ ] **Step 3: Fix the `intelligenceLine` wording for Community mode**

`courts.tsx:539-545` currently branches its noun ("court"/"facility") on `activeTab`, which no longer exists meaningfully in Community mode. Change the ternary's condition from `activeTab === 'tennis'` to `isTennisMode` in both places on line 541 — since `activeTab` still defaults to `'tennis'` in Community mode (it's just never changed by user input there), this keeps the existing tennis-mode behavior identical while making Community mode always say "facility"/"facilities".

- [ ] **Step 4: Fix `showWeatherOnMain`**

`courts.tsx:550`: `const showWeatherOnMain = isTennisMode && topLevelTab === 'hoa' && activeTab === 'tennis';` — the weather/playability hero strip is a tennis-specific concept (outdoor court conditions framed as "playability"); Community mode's amenity list already varies by type (pool, clubhouse, gym) where a single "playability" verdict doesn't generalize, so it's simplest and correct to omit it entirely in Community mode rather than try to generalize it. No visual replacement needed — nothing in the user's Reserve spec calls for weather.

- [ ] **Step 5: Add a Community-mode hero subtitle**

`courts.tsx` already imports `useCommunityName` (line 30) and presumably calls it near the top of the component — confirm the existing call site, then add beneath the hero title (`courts.tsx:567`, `<Text style={styles.heroTitle}>Reserve</Text>`):

```tsx
{isCommunityMode && communityName && (
  <Text style={styles.heroSubtitle}>Book an amenity at {communityName}</Text>
)}
```
Add a matching `heroSubtitle` style (reuse the existing `heroLabel`/`heroTitle` pattern's font tokens — `FontFamily.manropeMedium`, `FontSize.label`, `theme.textSecondary`-equivalent color, per this file's existing style conventions).

- [ ] **Step 6: Fix the "Play Now" CTA copy**

`courts.tsx:770-772`:
```tsx
<Text style={[styles.courtCta, { color: isOpen ? Colors.cyan : Colors.fg3 }]}>
  {isOpen ? (isCommunityMode ? 'Reserve →' : 'Play Now →') : (s.detailText ? `${s.detailText} →` : 'Reserve →')}
</Text>
```
Note `isCommunityMode` needs to be in scope inside this sub-component (`CourtCard` or equivalent, wherever this JSX lives — check whether it's the same top-level component or a separate function/child component in this file; if separate, import `isCommunityMode` there too or pass it as a prop from the parent, whichever matches the file's existing prop-drilling pattern for `theme`/`styles`).

- [ ] **Step 7: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Manual QA**

Community mode: confirm the Tennis/Amenities toggle is gone, all configured amenities (tennis courts, pool, clubhouse, etc.) show in one list, the hero shows "Book an amenity at {real HOA name}", no weather strip, and every open-amenity CTA says "Reserve →" never "Play Now →". Tennis mode: confirm the toggle, weather strip, and "Play Now →" copy are all exactly as before.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(resident\)/courts.tsx
git commit -m "feat(resident): make Reserve amenity-first in Community mode"
```

---

### Task 6: Home — gate tennis-only sections behind Tennis mode

**Files:**
- Modify: `src/app/(resident)/index.tsx`

- [ ] **Step 1: Add the import**

```ts
import { isCommunityMode, isTennisMode } from '@/config/productMode';
```

- [ ] **Step 2: Wrap each tennis-only section**

Wrap each of the following blocks in `{isTennisMode && (...)}`, without altering their internal content or the data hooks feeding them (leave the underlying `useState`/`useEffect`/queries as-is unless they're proven safe to skip entirely — if any of these blocks' data-fetching is expensive and clearly tennis-only, note it for a later optimization pass, but do not change fetch behavior in this task, only render gating, to keep this task's risk surface small):
- Playability verdict card (around line 88's usage site — find the actual render block, not just the comment).
- Pending Challenge card (`index.tsx:470-500`).
- "ON THE COURT" card (`index.tsx:503-543`) — **do not delete this block**; Task 7 adds a parallel Community-mode presentation of the same underlying "next reservation" concept.
- Match Invitations banner (`index.tsx:546-558`).
- Upcoming Matches card (`index.tsx:561-607`).
- Recent Result card (`index.tsx:609-633`).

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual QA**

Community mode: confirm Home no longer shows any match/challenge/coaching-flavored card, structurally (not just because there's no data — check with a test account that DOES have match history, if one exists, to confirm the section is truly absent, not just empty). Tennis mode: confirm every section renders exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(resident\)/index.tsx
git commit -m "fix(resident): remove tennis discovery/coaching content from Community Home"
```

---

### Task 7: Home — add Community-mode sections (upcoming reservation, events, maintenance notice)

**Files:**
- Modify: `src/app/(resident)/index.tsx`

**Interfaces:**
- Consumes: the `hoa_events` query pattern already established in `calendar.tsx` (lines 127-244) and `community.tsx`; the `court_maintenance` table already used by `manage-amenities.tsx` on the admin side.

- [ ] **Step 1: Add a Community-mode "Upcoming Reservation" card**

The existing "ON THE COURT" card (gated to Tennis mode in Task 6) already computes the resident's next booking from a query that is not itself tennis-specific (per the audit's finding F, the underlying `bookings`/`courts` data is generic). Locate that query, and add a parallel Community-mode render using the same fetched data but generic copy/labeling (not "ON THE COURT" — e.g. "Upcoming Reservation", amenity name, date/time), wrapped in `{isCommunityMode && ... }` placed where the Tennis version was.

- [ ] **Step 2: Add an "Upcoming Community Events" card**

New query, Community-mode only:
```ts
const { data: hoaId } = /* existing resident hoa_id resolution already used elsewhere in this file for other queries — reuse it, don't refetch */;
const { data: upcomingEvents } = await supabase
  .from('hoa_events')
  .select('id, title, event_type, date, start_time, location')
  .eq('hoa_id', hoaId)
  .gte('date', todayISO())
  .order('date', { ascending: true })
  .limit(3);
```
Render as a compact card (title, date, `event_type` badge) reusing whatever card/list primitive this file already uses for the Community Pulse announcements card, for visual consistency. Empty state: omit the card entirely if there are zero upcoming events (per spec: "when relevant").

- [ ] **Step 3: Add a maintenance/status notice, when relevant**

Query, Community-mode only:
```ts
const { data: upcomingMaintenance } = await supabase
  .from('court_maintenance')
  .select('id, court_id, date, description, courts(name)')
  .in('court_id', residentHoaCourtIds) // courts already loaded for the resident's HOA elsewhere in this file/app
  .gte('date', todayISO())
  .order('date', { ascending: true })
  .limit(3);
```
Render only if non-empty — a small banner/list ("{amenity} closed {date}: {description}"), not a full card, to avoid dominating Home per the spec's "when relevant" framing.

- [ ] **Step 4: Confirm Quick Actions already includes Reserve**

Re-check the Quick Actions row (`index.tsx:438-466`, already Community-mode-gated per the audit) — confirm a "Reserve" action exists alongside "Report Issue"; if only Report Issue is present, add a Reserve quick-action tile routing to the Reserve tab, matching this row's existing tile pattern.

- [ ] **Step 5: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual QA**

Community mode: confirm Home shows (in priority order, per spec) upcoming reservation, announcements, upcoming events, maintenance notices (when any exist), and Reserve/Report Issue quick actions — with a test account/HOA that has real `hoa_events` and at least one `court_maintenance` row scheduled, confirm both new cards actually populate with real data, not just render empty-safe. Tennis mode: confirm Home is completely unchanged (no new cards render there).

- [ ] **Step 7: Commit**

```bash
git add src/app/\(resident\)/index.tsx
git commit -m "feat(resident): add community-native Home sections (reservations, events, maintenance)"
```

---

### Task 8: Schedule — gate match/lesson content, mode-aware empty state

**Files:**
- Modify: `src/app/(resident)/calendar.tsx`

- [ ] **Step 1: Add the import**

```ts
import { isCommunityMode, isTennisMode } from '@/config/productMode';
```

- [ ] **Step 2: Gate the filter chips**

In `EVENT_TYPE_CONFIG`/`EVENT_TYPE_FILTERS` (`calendar.tsx:23-40`), exclude the `match_event`/`lesson` entries when building the filter-chip list for Community mode — since these are likely defined as static objects/arrays, change the site that *renders* the chip list to filter out `match_event`/`lesson` keys when `isCommunityMode`, rather than mutating the shared config objects themselves (keeps Tennis mode's config untouched and avoids two near-duplicate config objects).

- [ ] **Step 3: Skip match/lesson data merging in Community mode**

Around `calendar.tsx:161-214`, wrap the `matches` and `lesson_requests` fetch-and-merge logic in `if (isTennisMode) { ... }` (as a guard around the existing async logic, not a JSX wrap, since this is data-fetching code) so Community mode's calendar never queries or merges tennis data at all — not just hides it visually. Also gate the `useUpcomingMatches` hook usage (`calendar.tsx:120, 292-301`) the same way — either skip calling the hook in Community mode if it accepts a `skip`/`enabled` param, or wrap its consumption site in `isTennisMode &&`.

- [ ] **Step 4: Mode-aware empty-state copy**

`calendar.tsx:551`: change `"No tennis activity scheduled for this day."` to a conditional:
```ts
isCommunityMode ? 'Nothing scheduled for this day.' : 'No tennis activity scheduled for this day.'
```

- [ ] **Step 5: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual QA**

Community mode: confirm Schedule shows only reservations, community events, board meetings, and maintenance/closures — no Match/Lesson filter chips, no open-match listings. Tennis mode: confirm Schedule (still only reachable via in-page link, no tab — unchanged) shows exactly as before, including Match/Lesson chips and the original empty-state copy.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(resident\)/calendar.tsx
git commit -m "fix(resident): remove tennis match/lesson content from Community Schedule"
```

---

### Task 9: Me — fix the remaining tooltip copy leak

**Files:**
- Modify: `src/app/(resident)/me.tsx:292`

- [ ] **Step 1: Make the tooltip copy mode-aware**

```ts
// me.tsx:292, replace the hardcoded string with:
isCommunityMode
  ? '...connects you to your community and neighbors'
  : '...connects you to local courts, coaches, and neighbors'
```
(Match the exact surrounding phrasing already in the file — this is a copy-only change, confirm `isCommunityMode` is already imported in this file, which the audit confirmed it is.)

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

Community mode: open the Community stat tooltip on Me, confirm it no longer mentions coaches. Tennis mode: confirm the original copy is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(resident\)/me.tsx
git commit -m "fix(resident): remove coach mention from Community-mode Me tooltip"
```

---

### Task 10: Community screen — confirm/add Report Issue access

**Files:**
- Modify: `src/app/(resident)/community.tsx` (only if the check in Step 1 finds it's missing)

- [ ] **Step 1: Check current content**

Read `community.tsx` in full and confirm whether it already links to the report-issue flow (`report.tsx`, already a routable non-tab screen per `(resident)/_layout.tsx:69`). The audit found this screen already covers announcements/documents/contact info but did not explicitly confirm a Report Issue link.

- [ ] **Step 2: Add if missing**

If absent, add a row/button in the same visual style as the existing contact rows (`community.tsx:56-158` per the audit's citation range), routing to `/report`:
```tsx
<TouchableOpacity onPress={() => router.push('/report')} style={styles.actionRow}>
  <Text style={styles.actionRowText}>Report an Issue</Text>
</TouchableOpacity>
```
Match whatever row/icon pattern the file already uses for its contact/document rows.

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (skip this step entirely if Step 1 found no change was needed).

- [ ] **Step 4: Manual QA**

Confirm the Community tab provides a working path to Report Issue (either pre-existing or newly added), announcements, events/documents, and community info — all real HOA data, no invented social features.

- [ ] **Step 5: Commit** (only if Step 2 made a change)

```bash
git add src/app/\(resident\)/community.tsx
git commit -m "feat(resident): add Report Issue access from Community screen"
```

---

### Task 11: Header — subtle "Powered by TenisX" mark in Community mode

**Files:**
- Modify: `src/components/ui/Header.tsx:96-101`

- [ ] **Step 1: Add the subtle brand line**

```tsx
// Header.tsx:96-101, current binary swap — extend the Community branch only:
isCommunityMode ? (
  <View>
    <Text style={styles.communityWordmark}>{communityName ?? 'Community'}</Text>
    <Text style={styles.poweredBy}>Powered by TenisX</Text>
  </View>
) : (
  <Image source={TenisX_logo} /* ...existing props... */ />
)
```
Add a `poweredBy` style: small, low-contrast (`theme.textMuted` or equivalent per this file's existing token usage), no larger than the smallest existing metadata text size in this component — this is deliberately de-emphasized per the spec ("subtle"), never the dominant visual element. This is a generic TenisX brand line, not per-community data, so hardcoding the literal string "Powered by TenisX" here is correct and matches the spec's own example phrasing.

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

Community mode: confirm the header shows the real community name prominently with a small "Powered by TenisX" beneath/beside it, not competing for visual weight. Tennis mode: confirm the header is pixel-identical to before (still the TenisX logo image, no wordmark, no "Powered by" line).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Header.tsx
git commit -m "feat(resident): add subtle Powered-by-TenisX mark under Community header identity"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full-repo compile check**

Run: `npx tsc --noEmit`
Expected: identical error count/content to the pre-session baseline.

- [ ] **Step 2: Manual QA checklist — Community mode**

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

- [ ] **Step 3: Manual QA checklist — Tennis mode (regression check)**

- [ ] Bottom nav is exactly Home, Reserve, Match/VS, Coaches, Me — unchanged, no Schedule tab, no Community tab.
- [ ] Home shows every tennis card (playability, pending challenge, on the court, invitations, upcoming matches, recent result) exactly as before.
- [ ] Reserve shows both toggles (My HOA/Club·Other and Tennis/Amenities) and "Play Now" copy exactly as before.
- [ ] Header shows the TenisX logo image, no wordmark, no "Powered by" line.
- [ ] A `coach`-role account still lands in `/(coach)` on login.
- [ ] Every previously-working deep link (`/match/new`, `/(resident)/coaches`, etc.) still renders normally — the Task 1 guard never fires in Tennis mode.

- [ ] **Step 4: Confirm branch hygiene**

Run: `git status` and `git log --oneline main..greens-v1` — confirm all commits are on `greens-v1`, `main` untouched, Match v2 files untouched (`git diff main...greens-v1 --stat -- 'src/app/match/**' '**/match*'` should show no changes beyond what pre-existed before this plan).

- [ ] **Step 5: Final commit — checkpoint update**

Update `GREENS_V1_CHECKPOINT.md` with this redesign's summary, then:
```bash
git add GREENS_V1_CHECKPOINT.md
git commit -m "docs(greens-v1): checkpoint after Community-mode IA correction"
```

---

## Self-Review

**Spec coverage:**
- Target 5-tab IA, tennis tabs removed from Community nav without deletion → Task 3 (add), Task 1's existing Match/Coaches `href` conditionals already satisfy the removal half (confirmed unmodified — no task touches them). ✓
- Reserve amenity-first, no toggles, no "Play Now," real configured amenities, engine reused not duplicated → Tasks 4, 5; Section F confirms zero query changes. ✓
- Community identity primary, no hardcoded per-community name, subtle TenisX mark → Task 11 (uses the existing `communityName` prop, never a literal community name). ✓
- Home priorities → Tasks 6 (remove) + 7 (add). ✓
- Community screen scope → Task 10. ✓
- Schedule aggregation → Task 8. ✓
- Me scope → Task 9 (only remaining leak per audit). ✓
- Role routing audit + correction → Task 2 (coach), audit section D documents CM/admin routing is unaffected (out of scope, unchanged). ✓
- Direct route protection → Task 1. ✓
- Safety constraints → no file outside the list in "File Structure" touched; Task 5/Task 1 explicitly re-verify Tennis-mode behavior is provably unchanged (guard condition is `isCommunityMode &&`, which is `false` in every Tennis build). ✓

**Placeholder scan:** every step contains real code or a concrete, checkable QA action; no "TBD"/"handle appropriately" found. Task 7 Steps 1 and 4 and Task 10 Step 1 explicitly ask the executor to *locate* an exact current line/pattern before editing rather than assuming one, since those specific sites were not re-verified line-by-line by me this session (unlike `_layout.tsx` and `courts.tsx`, which were) — that's a deliberate, flagged exception, not a placeholder.

**Type consistency:** `isCommunityMode`/`isTennisMode` imported and used identically (boolean, no arguments) across all 9 touched files, matching `src/config/productMode.ts`'s actual exported shape confirmed in the audit.

---

## Reusable vs. Mode-Specific Summary

**Reusable, untouched by this plan:** `courts`/`amenity_rules` queries and the entire booking sheet/slot/insert pipeline in `courts.tsx`; `TimeSlotWheel`, `CalendarPicker`; `hoa_events`/`hoa_announcements` queries already used by `community.tsx`/`calendar.tsx`; `useCommunityName`; `BottomNav`'s rendering logic (only fed a different route config, never edited itself); `AuthGuard`'s session-guard logic (extended, not replaced); `routeByRole`'s CM-routing logic (untouched, only the coach branch gains one condition).

**Mode-specific presentation added by this plan:** toggle visibility and CTA copy in `courts.tsx`; section visibility and two new cards in `index.tsx`; filter-chip list and empty-state copy in `calendar.tsx`; one tooltip string in `me.tsx`; the wordmark/brand-line branch in `Header.tsx`; `Tabs.Screen` `href` config in `(resident)/_layout.tsx` (extending the exact pattern already established for Match/Coaches/Community); one additive redirect rule in the existing `AuthGuard`; one additive condition in `routeByRole`.

**No new files, no duplicated codebase, no schema change** — this plan is presentation/navigation-layer only.

## Estimated Hours

| Task | Hours |
|---|---|
| 1. Central route guard | 2 |
| 2. Coach role routing | 0.5 |
| 3. Schedule tab wiring | 1 |
| 4. Remove HOA/Other toggle | 1 |
| 5. Remove Tennis/Amenities toggle + copy | 2.5 |
| 6. Gate tennis Home sections | 1.5 |
| 7. Add Community Home sections | 3 |
| 8. Gate Schedule tennis content | 2 |
| 9. Me tooltip fix | 0.5 |
| 10. Community Report Issue check | 1 |
| 11. Header "Powered by TenisX" | 1 |
| 12. Full verification pass | 2 |
| **Total** | **~18** |

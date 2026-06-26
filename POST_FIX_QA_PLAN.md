# TenisX — Post-Fix QA Plan

**Branch:** launch-sprint  
**Commits covered:** `7b9f9d0` `25407db` `1756853` `52b4afc` `5858d77`  
**Date generated:** 2026-06-26  
**Status:** AWAITING MANUAL QA — do not mark any item DONE in LAUNCH_KANBAN.md until it passes

---

## Known Bug (not fixed yet): settings.tsx line 83

`settings.tsx:83` filters memberships by `status === 'active'` but `hoa_memberships` uses `status = 'approved'`. The "My Communities" list in Settings will always appear empty even after the table name fix. Mark this as FAIL in section 3 below and fix it before the CM sign-out test can fully pass.

---

## Test Accounts Required

| Role | Description | Notes |
|------|-------------|-------|
| Resident A | Active HOA member | `hoa_memberships` row with `status='approved'` |
| Resident B | No profile row, or network offline | For error-state sign-out test |
| Coach A | Has a `coaches` table row | For coach sign-out + availability tests |
| Coach B | `user_roles.role='coach'` but NO `coaches` row | For missing-profile sign-out test |
| CM/Admin | `user_roles.role` is `'admin'`, `'condo_manager'`, or `'manager'` | For CM sign-out + pending requests |
| Pending User | Submitted join request via `/hoa-application` | Must have both `community_join_requests.status='pending'` AND `hoa_memberships.status='pending'` |

---

## Supabase Tables to Inspect (Dashboard → Table Editor)

- `auth.users` — session state
- `profiles` — full_name, ntrp_rating
- `user_roles` — role per user
- `hoa_memberships` — id, user_id, hoa_id, role, status, updated_at
- `community_join_requests` — id, user_id, hoa_id, status, updated_at
- `coach_availability` — id, coach_id, day_of_week (int 0–6, 0=Sun), start_time, end_time, location_mode
- `bookings` — to verify approved resident can create bookings

---

## 1. Resident Sign-out

**Commit:** `7b9f9d0`  
**File:** `src/app/(resident)/me.tsx`

### Setup
Sign in as **Resident A**. Navigate to Me tab (5th tab in resident bottom nav).

### Happy Path
1. Me tab loads → profile card shows name, community, NTRP badge
2. Scroll down → "Sign Out" button visible below the settings cards
3. Tap "Sign Out" → Alert: "Sign out" / Cancel + "Sign out" buttons
4. Tap "Sign out" → app navigates to `/(auth)/login` immediately
5. Press hardware back / swipe back → must NOT return to Me tab or any authenticated screen

**Expected:** Login screen. Back press exits app or does nothing.

**Failure signs:**
- Alert does not appear → touch handling broken
- Alert appears, confirms, screen stays on Me tab → `router.replace` not firing
- Navigates to login but back returns to Me tab → `router.push` used instead of `router.replace`

### Error State (Profile Fails to Load)
1. Sign in as **Resident B** (no profile row, or turn on airplane mode)
2. Navigate to Me tab → red error card shows + "Try again"
3. **Sign Out button MUST be visible** even in error state
4. Tap Sign Out → Alert → confirm → login

**Failure sign:** Sign Out button not visible in error state → button is still inside the `{profile && ...}` block (regression).

**Supabase check:** `profiles` table for Resident B's `user_id` — if no row, error state triggers.

---

## 2. Coach Sign-out

**Commit:** `7b9f9d0`  
**File:** `src/app/(coach)/me.tsx`

### Setup
Sign in as **Coach A**. Navigate to Me tab in coach nav.

### Happy Path
1. Me tab loads → profile form visible
2. Scroll down → "Sign Out" button visible (red border, below Save)
3. Tap → Alert: "Sign Out" / Cancel + "Sign Out"
4. Confirm → navigates to `/(auth)/login`
5. Back press → must not re-enter coach screens

### Missing Coach Profile (Coach B)
1. Sign in as **Coach B** (`user_roles='coach'` but no `coaches` row)
2. Me tab shows: "Coach profile not found." text + Sign Out button
3. Tap Sign Out → Alert → confirm → login

**Failure sign:** Coach B sees "Loading…" forever with no Sign Out button → `if (loading || !profile)` guard still combined (regression; should be split into two separate guards).

**Supabase check:** `coaches` table filtered by `user_id = Coach B's uid` → should return 0 rows.

---

## 3. CM Sign-out via Settings

**Commits:** `52b4afc` (table name fix in `settings.tsx`)  
**File:** `src/app/settings.tsx`

### Known Defect
`settings.tsx:83` filters by `status === 'active'` but the DB value is `'approved'`. The "My Communities" list will be empty regardless of the table fix. This must be patched before this section can pass.

**Patch required:** Change line 83 from:
```tsx
const activeMemberships = memberships.filter((m) => m.status === 'active');
```
to:
```tsx
const activeMemberships = memberships.filter((m) => m.status === 'approved');
```

### QA Steps (after patch)
1. Sign in as **CM/Admin** → Portfolio screen loads
2. Tap menu icon (☰) in top-right of Portfolio header → Settings screen opens
3. Profile card shows: name + HOA community name in "My Communities" section (now reads `hoa_memberships`)
4. Scroll to bottom → "Sign Out" card visible (red)
5. Tap Sign Out → Alert → confirm → navigates to login

**Failure signs without patch:**
- "My Communities" section is empty → `status === 'active'` filter never matches `'approved'` rows
- Profile card shows "Unknown" for HOA name → query hitting wrong table (should be fixed by `52b4afc`)

**Failure signs after patch:**
- Sign Out Alert appears but does not navigate → `router.replace` broken in settings.tsx
- Members count in Portfolio is 0 when members exist → `(cm)/index.tsx` still using wrong table or status (check `hoa_memberships` query + `.eq('status', 'approved')`)

**Supabase check:** `hoa_memberships` where `user_id = CM uid` → at least one row with `status='approved'`.

---

## 4. Coach Availability — Add / Edit / Copy / Delete

**Commit:** `1756853`  
**Files:** `src/app/(coach)/schedule.tsx`, `src/components/coach/CoachAvailabilityEditor.tsx`, `src/hooks/useCoachAvailability.ts`

### Setup
Sign in as **Coach A**. Navigate to Schedule tab (3rd tab in coach nav).

### Loading State
On first load → availability section shows spinner + "Loading availability…" text briefly.

### Empty State
If no slots exist: card showing "No availability slots yet." title + "Tap 'Add Slot' to set your weekly availability." — must NOT show the old 7×16 grid.

### Add Slot
1. Tap "+ Add Slot" → bottom sheet slides up
2. Modal shows: "Add Availability Slot" title, DAY chips (SUN–SAT), START TIME chips, END TIME chips, LOCATION chips (My Facility / Traveling / Either), "Add Slot" button
3. Select: Wednesday, 9:00 AM, 12:00 PM, My Facility
4. Tap "Add Slot" → modal closes → slot appears: "9am – 12pm" / "My Facility" / Copy + Edit + Delete icons

**Supabase verify after add:**  
`coach_availability` → new row: `coach_id=Coach A uid, day_of_week=3, start_time='09:00:00', end_time='12:00:00', location_mode='coach_facility'`

**Failure signs:**
- "Add Slot" button stays disabled → `saving=true` stuck
- Slot does not appear after add → `onRefresh` not calling `refreshSlots`
- END TIME chips include times before/equal to START TIME → filter logic broken

### Edit Slot
1. Tap pencil (✏) icon on the Wednesday 9am slot
2. Modal opens: title "Edit Availability Slot", pre-filled with Wed / 9am / 12pm / My Facility
3. Change location to "Traveling" → tap "Save Changes"
4. Slot now shows "Traveling"

**Supabase verify after edit:**
- Old row for `day_of_week=3, start_time='09:00:00'` is DELETED
- New row exists for `day_of_week=3, start_time='09:00:00', location_mode='traveling'`

**Failure sign:** Both old and new row exist → delete-before-upsert not executing.

### Copy Slot
1. Tap copy icon on the Wednesday 9am slot
2. Modal opens: "Add Availability Slot" (NOT edit), pre-filled with Wed / 9am / 12pm / Traveling
3. Change day to Friday → tap "Add Slot"
4. Two slots now exist: Wednesday and Friday, both 9am–12pm Traveling

**Supabase verify after copy:**  
Two `coach_availability` rows: `day_of_week=3` and `day_of_week=5`, same times.

**Failure sign:** Only one slot exists → copy used the edit path and deleted the original.

### Delete Slot
1. Tap trash icon on Friday slot
2. Alert: "Remove Slot" / Cancel + "Remove" (destructive)
3. Confirm → Friday slot disappears; Wednesday slot still present

**Supabase verify after delete:**  
Friday row (`day_of_week=5`) is gone. Wednesday row (`day_of_week=3`) still exists.

**Failure signs:**
- Alert confirms but slot still shows → `onRefresh` not firing
- Both slots deleted → wrong slot ID passed to delete call

### Error State
1. Disable network → navigate to Schedule tab
2. Red error card: "Could not load availability." + error detail + "Try again" button
3. Re-enable network → tap "Try again" → slots load

**Failure sign:** Error state not shown, just empty list → error state not wired in `schedule.tsx`.

---

## 5. HOA Pending Request — Approve / Reject

**Commit:** `52b4afc`  
**File:** `src/app/(admin)/pending-requests.tsx`

### Setup
**Pending User** must have submitted a join request. This creates:
- `hoa_memberships` row: `status='pending'`, `role='resident'`
- `community_join_requests` row: `status='pending'`

Sign in as **CM/Admin**.

### Viewing Requests
1. Portfolio → tap Pending stat card → Pending Requests screen
2. Pending User's card shows: name, email, applied date, "Pending" pill
3. "X Awaiting" badge visible at top

### Approve
1. Tap "Approve" on Pending User's card
2. Button shows "Processing…"
3. Card disappears; if last request, "All Clear" empty state shows

**Supabase verify IMMEDIATELY after approve:**
- `community_join_requests` row: `status='approved'`
- `hoa_memberships` row: `status='approved'` ← **critical check** (was broken before fix)
- `hoa_memberships.updated_at` is recent

**Failure signs:**
- Card disappears but `hoa_memberships.status` is still `'pending'` → RPC not called and fallback also failed → user won't get court access
- Red error banner appears at top → RPC permission error AND direct update also blocked → CM not in `hoa_memberships` with role admin, and RLS blocks fallback
- Button stays "Processing…" → async deadlock (unlikely)

### Reject
1. Tap "Reject" on a second pending request → card disappears

**Supabase verify after reject:**
- `community_join_requests` row: `status='rejected'`
- `hoa_memberships` row: `status='rejected'`

### Error Banner
1. If approve/reject fails → red banner appears between hero and scroll list
2. Shows error message from Supabase
3. Tap ✕ → banner dismisses

**Failure sign:** Action fails but no banner → `actionError` state not being set.

---

## 6. Approved Resident Gaining Court Booking Access

**Depends on:** Section 5 (approve a pending user first)

### QA Steps
1. After approving **Pending User** in section 5, sign out of CM account
2. Sign in as **Pending User**
3. Navigate to Reserve tab → should see list of courts
4. Tap a court → select date → confirm booking
5. Navigate to My Reservations → new booking appears

**Supabase verify:**  
`bookings` table → new row with `user_id = Pending User, status = 'confirmed'` (or `'pending'` depending on court policy)

**Failure signs:**
- Courts tab is empty or shows error → RLS blocking → `hoa_memberships.status` is not `'approved'` → re-check section 5 DB rows
- Courts visible but booking fails → separate RLS issue on `bookings` table
- "No courts available" → no `courts` rows for this HOA

**Root cause if failing:** RLS in migration `20260109223632` checks `hoa_memberships.status = 'approved'` (exact lowercase). If status is `'active'` or anything else, courts won't show.

---

## Rollback Plan

| Commit | What it fixed | Rollback command |
|--------|--------------|-----------------|
| `7b9f9d0` | Sign-out redirect + button visibility | `git revert 7b9f9d0` |
| `1756853` | Coach availability block editor | `git revert 1756853` — restores old grid editor |
| `52b4afc` | hoa_memberships table names + approve/reject RPC | `git revert 52b4afc` — WARNING: reverts 5-file change |

**Before reverting `52b4afc`:** The pre-revert state queries `hoa_members` (a table that does not exist), so reverting silently breaks members count and CM settings. It is not a safe fallback. If `pending-requests.tsx` RPC logic fails QA, cherry-pick individual file fixes rather than doing a full revert of `52b4afc`.

---

## Sign-off Checklist

All rows must be **PASS** before marking any item DONE in LAUNCH_KANBAN.md.

| # | Workflow | Tester | Date | Pass/Fail | Notes |
|---|----------|--------|------|-----------|-------|
| 1 | Resident sign-out — happy path | | | | |
| 2 | Resident sign-out — error state (button visible) | | | | |
| 3 | Coach sign-out — happy path | | | | |
| 4 | Coach sign-out — !profile state | | | | |
| 5 | CM sign-out via Settings (after settings.tsx:83 patch) | | | | |
| 6 | CM Settings — My Communities shows HOA name | | | | |
| 7 | Availability — add slot | | | | |
| 8 | Availability — edit slot | | | | |
| 9 | Availability — copy slot | | | | |
| 10 | Availability — delete slot | | | | |
| 11 | Availability — error state + retry | | | | |
| 12 | Pending request — approve | | | | |
| 13 | Pending request — reject | | | | |
| 14 | Pending request — DB verify `hoa_memberships.status='approved'` | | | | |
| 15 | Approved resident — courts visible | | | | |
| 16 | Approved resident — can create booking | | | | |

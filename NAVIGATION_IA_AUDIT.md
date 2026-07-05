# Navigation IA Audit — TenisX

**Date:** 2026-07-01  
**Scope:** All Stage 1 screens — Resident, Coach, CM/Admin  
**Mode:** Read-only analysis, no code changes

---

## Locked Decisions (from goal directive)

| Decision | Status |
|----------|--------|
| Keep avatar in header | Confirmed |
| Remove hamburger from resident header | Confirmed |
| Resident header layout: Logo (left) · Messages · Notifications · Avatar (right) | Confirmed |
| Avatar opens account menu / profile | Confirmed |
| Settings lives under Me/Profile, not hamburger | Confirmed |

---

## Architecture Overview

```
Root Stack (_layout.tsx)
├── (auth)         — login, signup
├── (cm)           — Condo Manager tab group
├── (admin)        — HOA Admin tab group
├── (resident)     — Resident tab group
│   ├── index      ← Home tab
│   ├── courts     ← Reserve tab
│   ├── match      ← VS tab
│   ├── coaches    ← Coaches tab
│   ├── me         ← Me tab
│   └── (hidden)  calendar, book, report, docs
├── (coach)        — Coach tab group
│   ├── index      ← Dashboard tab
│   ├── students   ← Students tab
│   ├── schedule   ← Schedule tab
│   ├── requests   ← Requests tab (with live badge)
│   ├── me         ← Me tab
│   └── (hidden)  reviews, clinics
├── notifications  — root stack overlay
├── settings       — root stack overlay
├── messages       — root stack overlay
├── my-reservations
├── my-reports
├── hoa-application
├── amenity-book
├── coach-profile/[id]
├── my-coaching
├── coach-favorites
├── report-detail/[id]
├── announcements
└── survey-results/[id]
```

---

## Screen-by-Screen Audit

---

### RESIDENT ROLE

---

#### R1 — Resident Home (`/(resident)/index`)

**Purpose:** Arrival dashboard. Weather, quick actions, next booking, match status, announcements.

**Entry points:**
- Home tab (primary)

**Navigation out:**
| Touch target | Destination | Status |
|---|---|---|
| "Book Court" quick action | `/(resident)/courts` | ✓ OK |
| "Find Match" quick action | `/(resident)/match` | ✓ OK |
| "Find Coach" quick action | `/(resident)/coaches` | ✓ OK |
| "View All →" on ON THE COURT | `/my-reservations` | ✓ OK |
| Tap next booking row | `/my-reservations` | ✓ OK |
| Challenge Accept/Decline | `/(resident)/match` | ✓ OK (should deep-link to challenge) |
| Upcoming match rows | `/(resident)/match` | ✓ OK |
| Cancel banner "Book Again →" | `/(resident)/courts` | ✓ OK |
| Community Pulse items | `/announcements` | ✓ OK |
| "View full schedule" link | `/(resident)/calendar` | ❌ **DEAD LINK** |

**Bug:** `router.push('/(resident)/calendar')` at the bottom of Home. The `calendar` route is a **hidden tab route inside the resident group** — it is not registered in the root Stack, so pushing to it from Home behaves unpredictably (likely no-ops or crashes in certain nav states). Either:
- Register `calendar` as a root stack screen, OR
- Remove the link until calendar is part of Stage 1

**Missing:** No link to `/my-coaching` (lesson bookings). Residents have no home-screen entry point to their coaching history.

**Verdict:** KEEP — content is correct. Fix dead calendar link. Add `/my-coaching` entry.

---

#### R2 — Reserve (`/(resident)/courts`)

**Purpose:** Court availability grid, time slot picker, booking flow.

**Entry points:**
- Reserve tab
- Home "Book Court" quick action
- Home empty-state "Book a Court" CTA
- Home admin-cancellation banner "Book Again →"

**Navigation out:** Self-contained modal booking flow; no push navigation.

**Verdict:** KEEP — well-wired. No issues.

---

#### R3 — Match/VS (`/(resident)/match`)

**Purpose:** Match discovery, incoming challenges, upcoming scheduled matches, history.

**Entry points:**
- VS tab
- Home "Find Match" quick action
- Home challenge card Accept/Decline
- Home upcoming match rows

**Issues:**
- Imports `Bell, Menu, MessageCircle` from lucide — screen contains inline header-level icons. If it also uses `<Header variant="resident">`, these create **duplicate navigation chrome** (double bell/menu). This needs a code inspection to confirm, but the import pattern is a strong signal.
- Challenge Accept/Decline on Home both push to `/(resident)/match` without a filter param — user lands at top of list, not the specific challenge. Acceptable for now but worth improving.

**Verdict:** KEEP — investigate and remove any inline Bell/Menu/MessageCircle icons if Header component is already rendered.

---

#### R4 — Coaches (`/(resident)/coaches`)

**Purpose:** Coach discovery — search, filters, sort, favorites shortcut, coach list.

**Entry points:**
- Coaches tab
- Home "Find Coach" quick action

**Navigation out:**
| Touch target | Destination | Status |
|---|---|---|
| "My Favourite Coaches" row | `/coach-favorites` | ✓ OK |
| Coach card "View" | `/coach-profile/[id]` | ✓ OK |

**Verdict:** KEEP — clean. No issues.

---

#### R5 — Me (`/(resident)/me`)

**Purpose:** Profile display, activity shortcuts, account settings, sign-out.

**Entry points:**
- Me tab

**Navigation out (current):**
| Touch target | Destination | Status |
|---|---|---|
| My Reservations | `/my-reservations` | ✓ OK |
| My Reports | `/my-reports` | ✓ OK |
| Settings | `/settings` | ✓ OK |
| Sign Out | Auth sign-out | ✓ OK |

**Missing — critical:**
- **No "My Coaching" link.** After a resident books a coach, there is **no entry point** to `/my-coaching` in the entire resident flow (see issue R-DEAD below). This must be added here.

**Verdict:** KEEP — add "My Coaching" nav card under ACTIVITY section.

---

#### R6 — Resident Header (current vs. target)

**Current:** Logo (left) | Bell → `/notifications` | Menu → `/settings`

**Target (locked):** Logo (left) | MessageCircle → `/messages` | Bell → `/notifications` | Avatar → Me/account

**Changes needed:**
1. Remove `Menu` (`hamburger`) icon from resident header
2. Add `MessageCircle` icon → `/messages`
3. Add Avatar circle (initials, same as coach implementation) → `/(resident)/me`
4. Bell stays, navigates to `/notifications`

**Header.tsx impact:** The `ResidentHeaderProps` interface and the `resident` branch of `Header` need to match this layout. The `onMenu` prop should be replaced with `onMessages` and `onAvatar`.

---

### RESIDENT SUPPORT SCREENS (root stack)

---

#### RS1 — Messages (`/messages`)

**Purpose:** Conversations list + threaded chat between users.

**Entry points (current):**
- Coach header MessageCircle icon
- ❌ No entry from resident header (gap filled by locked decision)

**Entry points (after header change):**
- Resident header MessageCircle → `/messages` ✓
- Coach header MessageCircle → `/messages` ✓

**Notes:**
- Accepts `partnerId` param (via `useLocalSearchParams`) — enabling deep-link to specific conversation.
- Not a tab — correct, messaging is secondary.

**Verdict:** KEEP — ensure both roles have the header entry point.

---

#### RS2 — Notifications (`/notifications`)

**Purpose:** Notification feed.

**Entry points:**
- Bell in both resident and coach headers

**Critical issue:** Screen only surfaces **message notifications** — the `NotificationItem` type is hardcoded to `type: 'message'` and only queries the `messages` table. Booking confirmations, match challenges, HOA announcements, coach request updates — none appear here.

**Verdict:** KEEP but flag for Stage 1 scope review. For launch, it shows received messages which is the highest-value signal. Post-launch: expand to a proper notifications table.

---

#### RS3 — My Reservations (`/my-reservations`)

**Purpose:** Full list of court bookings.

**Entry points:**
- Home "View All →" and tap on booking row ✓
- Resident Me "My Reservations" card ✓

**Verdict:** KEEP — well-connected.

---

#### RS4 — My Reports (`/my-reports`)

**Purpose:** Maintenance issue reports submitted by resident.

**Entry points:**
- Resident Me "My Reports" card ✓

**Verdict:** KEEP.

---

#### RS5 — My Coaching (`/my-coaching`) — CRITICAL GAP

**Purpose:** Resident's lesson management — Upcoming, Pending, History, Reviews tabs.

**Entry points:** **NONE currently exist in the app.**

- Not linked from Resident Home
- Not linked from Resident Me
- Not linked from Coaches screen
- Not linked from Coach Profile

**After a resident books a coach via `BookLessonSheet`, their request disappears into a void.** There is no way for a resident to find, manage, or review their lesson requests.

**Fix:** Add to Resident Me screen under ACTIVITY section:
```
My Reservations       ← already there
My Coaching           ← ADD this (navigates to /my-coaching)
My Reports            ← already there
```

**Verdict:** KEEP the screen — it's complete. Just missing its entry point. Add to Me screen.

---

#### RS6 — Coach Profile (`/coach-profile/[id]`)

**Purpose:** Coach bio, stats, availability grid, packages, book lesson CTA.

**Entry points:**
- Coaches list → coach card ✓
- Coach Favorites → coach card ✓

**Navigation out:**
- `BookLessonSheet` — submits lesson request, no redirect to `/my-coaching` after success.

**Recommendation:** After successful lesson request submission in `BookLessonSheet`, offer: "View My Coaching →" deep-link to `/my-coaching` with Pending tab active.

**Verdict:** KEEP — add post-booking navigation suggestion.

---

#### RS7 — Coach Favorites (`/coach-favorites`)

**Purpose:** Resident's saved coaches.

**Entry points:**
- Coaches screen "My Favourite Coaches" shortcut row ✓

**Navigation out:**
- Coach card → `/coach-profile/[id]` (via `CoachCard` component)

**Verdict:** KEEP — well-wired.

---

#### RS8 — Settings (`/settings`)

**Purpose:** App preferences, community info, account management.

**Entry points:**
- Resident Me → Settings card ✓
- Resident header Menu (current) → Settings ✓ (Menu removed in new layout)
- Coach header Menu → Settings ✓
- Coach Me → needs verification

**Verdict:** KEEP — after resident header change, Settings only reachable via Me → Settings. This is correct per the locked decision ("Settings lives under Me/Profile").

---

### COACH ROLE

---

#### C1 — Coach Dashboard (`/(coach)/index`)

**Purpose:** Business KPI summary (revenue, lessons, students, rating, attendance, reviews).

**Entry points:**
- Dashboard tab (primary)

**Navigation out:**
- `CoachTodayCard` component likely has "View →" links to schedule/requests (component-level, not audited here)
- KPI cards display counts but currently don't navigate

**Issues:**
- "Pending: N" KPI does not appear to navigate to Requests tab when tapped. This is a quality-of-life gap.

**Verdict:** KEEP.

---

#### C2 — Coach Students (`/(coach)/students`)

**Purpose:** Student roster with search + notes.

**Entry points:**
- Students tab

**Navigation out:**
- Student row tap → `CoachStudentDetail` bottom sheet (within-screen) ✓

**Verdict:** KEEP — self-contained.

---

#### C3 — Coach Schedule (`/(coach)/schedule`)

**Purpose:** Weekly availability editor + day-by-day lesson viewer.

**Entry points:**
- Schedule tab

**Verdict:** KEEP — audited in Session 1.

---

#### C4 — Coach Requests (`/(coach)/requests`)

**Purpose:** Manage pending/upcoming/past lesson requests.

**Entry points:**
- Requests tab (with live pending count badge) ✓

**Navigation out:**
- CoachRequestCard: Accept/Decline inline
- CoachLessonCard: Mark Complete / No Show / Cancel inline
- Tabs: Pending | Upcoming | Past (all within screen)

**Verdict:** KEEP — well-designed.

---

#### C5 — Coach Me (`/(coach)/me`)

**Purpose:** Coach profile editor — bio, rate, location, certifications, lesson types, packages.

**Entry points:**
- Me tab
- Coach header Avatar → `/(coach)/me`

**Issues:**
- **No Sign Out button** — unlike Resident Me which has a sign-out. Coaches have no way to sign out of the app. Must add.
- Very dense single-scroll form. No section anchors. Acceptable for launch.
- `LessonPackagesManager` is embedded — good (single destination for all coach config).

**Verdict:** KEEP — add Sign Out button at bottom.

---

#### C6 — Coach Header (current state)

**Current:** Logo (left) | Avatar → `/(coach)/me` | MessageCircle → `/messages` | Bell → `/notifications` | Menu → `/settings`

**Target (locked):** Logo (left) | MessageCircle | Bell | Avatar (right)

**Difference:** Coach header currently has Avatar **first** (left of messages), then Messages, Bell, Menu. Target layout removes Menu and moves Avatar to rightmost.

**Changes needed:**
1. Remove `Menu` icon
2. Move Avatar to rightmost position: Logo | Messages | Bell | Avatar
3. Avatar still navigates to `/(coach)/me`

---

### CM / ADMIN ROLE

---

#### A1 — CM Hub (`/(cm)/index`)

**Purpose:** Condo Manager portfolio — all managed HOAs with health scores, stats, alerts.

**Entry points:**
- CM tab group root

**Navigation out:**
- Community cards → deeper HOA management screens (maintenance, calendar, etc.)
- Alert items → `/(cm)/alerts`
- Uses `cm-portfolio` Header variant (different layout from resident/coach)

**Verdict:** KEEP — Stage 1 active. No issues found.

---

#### A2 — Admin Screens (`/(admin)/`)

**Stage 1 active:**
- `manage-amenities` — amenity CRUD
- `manage-courts` — court CRUD
- `pending-requests` — HOA join request approvals

**Entry points:**
- Admin tab group (Stack navigator)

**Verdict:** KEEP — within scope, no audit issues identified.

---

## Issue Registry

| # | Severity | Screen | Issue | Fix |
|---|---|---|---|---|
| I-01 | P0 | Resident Home | "View full schedule" → dead link to hidden tab route `/(resident)/calendar` | Remove link OR register `calendar` in root stack |
| I-02 | P0 | Resident Me | `/my-coaching` has zero entry points — residents cannot find lesson bookings | Add "My Coaching" NavCard to Me screen ACTIVITY section |
| I-03 | P1 | Resident Header | No Messages icon — residents can't reach `/messages` | Add `MessageCircle` to header per locked decision |
| I-04 | P1 | Resident Header | Hamburger removed per locked decision — need to verify Settings is still reachable | Settings already in Me screen → Settings card ✓ |
| I-05 | P1 | Coach Me | No Sign Out button | Add sign-out at bottom of Coach Me screen |
| I-06 | P1 | Match screen | Imports `Bell, Menu, MessageCircle` — possible duplicate nav chrome if `<Header>` also rendered | Inspect and remove if Header already provides them |
| I-07 | P2 | Notifications | Only shows message notifications — no booking/match/HOA events | Flag for post-launch expansion |
| I-08 | P2 | Coach Profile | After `BookLessonSheet` success, no navigation to `/my-coaching` | Offer "View My Coaching →" in success state |
| I-09 | P3 | Coach Dashboard | Pending KPI count not tappable | Add `onPress={() => router.push('/(coach)/requests')}` |
| I-10 | P3 | Coach Header | Avatar left-of-messages vs. target right-of-messages | Reorder: Logo | Messages | Bell | Avatar |

---

## Recommended Final IA

### Resident

```
Tab bar (unchanged):
  Home | Reserve | VS | Coaches | Me

Header:
  [Logo]                [Messages] [Bell] [Avatar → Me]

Home screen additions:
  - Remove "View full schedule" link (or fix to root stack route)
  - Add coaching card: "My Coaching →" when resident has pending/upcoming lessons

Me screen:
  ACTIVITY
  ├── My Reservations       (/my-reservations)
  ├── My Coaching           (/my-coaching)   ← ADD
  └── My Reports            (/my-reports)

  ACCOUNT
  └── Settings              (/settings)

  [Sign Out]
```

### Coach

```
Tab bar (unchanged):
  Dashboard | Students | Schedule | Requests[N] | Me

Header:
  [Logo]                [Messages] [Bell] [Avatar → Me]

Me screen (bottom):
  ... existing form fields ...
  [Sign Out]    ← ADD
```

---

## Implementation Steps (ordered by priority)

### Step 1 — Fix dead calendar link (I-01)
**File:** `src/app/(resident)/index.tsx:614`
```tsx
// Remove this:
onPress={() => router.push('/(resident)/calendar')}
// Either delete the "View full schedule" row, or defer until calendar is Stage 1
```

### Step 2 — Add My Coaching to Resident Me (I-02)
**File:** `src/app/(resident)/me.tsx`
Add a NavCard after "My Reservations":
```tsx
<NavCard
  icon={<BookOpen size={20} color={Colors.cyan} strokeWidth={1.5} />}
  label="My Coaching"
  onPress={() => router.push('/my-coaching')}
  styles={styles}
/>
```

### Step 3 — Resident header rework (I-03, I-04)
**File:** `src/components/ui/Header.tsx`

In the `resident` branch of the `if (props.variant === 'resident' || props.variant === 'coach')` block:

For `!isCoach` (resident):
```tsx
// Current topBarRight for resident:
<Bell ... />
<Menu ... />   // remove this

// New topBarRight for resident:
<TouchableOpacity onPress={...messages handler...}>
  <MessageCircle color="#FFFFFF" size={22} strokeWidth={1.5} />
</TouchableOpacity>
<TouchableOpacity onPress={...bell handler...}>
  <Bell color="#FFFFFF" size={22} strokeWidth={1.5} />
</TouchableOpacity>
<TouchableOpacity onPress={() => router.push('/(resident)/me')}>
  <View style={styles.avatarCircle}>
    <Text style={styles.avatarCircleText}>{residentInitials || '?'}</Text>
  </View>
</TouchableOpacity>
```

Add `useResidentInitials()` hook (mirrors `useCoachInitials()`).
Update `ResidentHeaderProps` interface: replace `onMenu` with `onMessages`.

### Step 4 — Add Sign Out to Coach Me (I-05)
**File:** `src/app/(coach)/me.tsx`
At bottom of ScrollView (after all form sections):
```tsx
<TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
  <LogOut size={18} color={Colors.negative} strokeWidth={1.5} />
  <Text style={styles.signOutText}>Sign Out</Text>
</TouchableOpacity>
```
With Alert confirm pattern matching Resident Me.

### Step 5 — Coach header reorder (I-10)
**File:** `src/components/ui/Header.tsx`
In the `isCoach` branch, change topBarRight order:
```tsx
// Current: Avatar | Messages | Bell | Menu
// Target:  Messages | Bell | Avatar
```
Remove Menu. Move Avatar to last (rightmost).

### Step 6 — Investigate match.tsx inline icons (I-06)
**File:** `src/app/(resident)/match.tsx`
Grep for `<Bell`, `<Menu`, `<MessageCircle` in render — if found outside the Header component, remove them.

### Step 7 — Coach dashboard KPI tap (I-09, optional)
**File:** `src/components/coach/CoachDashboardKPI.tsx`
Add `onPress` prop; in Dashboard pass `onPress={() => router.push('/(coach)/requests')}` to Pending KPI.

---

## What NOT to change

- Bottom tab configurations for both roles — no changes needed
- CM/Admin screens — outside this audit scope and look correct
- Auth flows — not audited
- Stage 2 hidden routes — do not touch
- `(resident)/calendar`, `amenity-book`, `hoa-application` — out of scope for Stage 1

---

*Audit complete. All items above are analysis only — no code has been modified.*

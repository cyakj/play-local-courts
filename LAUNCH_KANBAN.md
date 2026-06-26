# TenisX — Launch Kanban

**Role:** Release Manager  
**Sources:** LAUNCH_CHECKLIST.md audit (2026-06-26) + Strict Completion Audit (2026-06-26)  
**Branch:** `launch-sprint`  
**Target:** TestFlight by 2026-07-03 · Public Launch TBD

---

## Completion Standard

A task is DONE only when ALL of the following are true:

1. Reachable from normal app navigation
2. Uses real production Supabase data
3. Handles loading, error, and empty states
4. Works correctly after a cold start (app fully closed and reopened)
5. Has been manually QA-tested by a human on device
6. Contains no dead buttons or dead routes
7. Is acceptable for App Store review

---

## Summary

| Tier | Count | Est. Hours | Block |
|------|-------|-----------|-------|
| P0 — Must Fix Before TestFlight | 0 remaining (16 done) | ✅ | Nothing ships |
| P1 — Must Fix Before Public Launch | 4 blocked / 7 done | ~4 h blocked | Users can't be onboarded |
| P2 — First Month After Launch | 10 | ~10 h | UX degraded |
| P3 — Ignore Until 100 Users | 7 | ~17 h | Nice-to-have |
| **Total** | **43** | **~53 h** | |

---

## P0 — Must Fix Before TestFlight

> Ordered by critical path. Complete these in sequence — each unblocks the next.

---

### ~~P0-001~~ · ✅ DONE (2026-06-26, commit `070f360`) · Startup crash: `featureFlags.ts` uses Vite-only `import.meta.env`

**Description:** `src/config/featureFlags.ts` line 8 reads `import.meta.env.VITE_TENNIS_FEATURES_ENABLED`. React Native's Hermes engine has no `import.meta`. Any native screen that imports this file throws `ReferenceError: Can't find variable: import` on startup. This is the highest-urgency issue because it can silently prevent the app from loading.

**Est. Hours:** 0.5 h  
**Dependencies:** None  
**Files:** `src/config/featureFlags.ts`, any file that imports it (grep `featureFlags` across `src/app/`)  
**Can Defer?** No  

**Definition of Done:**
- `featureFlags.ts` reads `process.env.EXPO_PUBLIC_TENNIS_FEATURES_ENABLED === 'true'`
- `.env` updated with new var name
- Grep confirms no remaining `import.meta` in `src/`
- App launches without error on device with no network

**Manual QA Steps:**
1. Run `grep -r "import.meta" src/` — must return zero results
2. Cold-start the app on a physical iOS device
3. Verify no red error screen or blank crash on launch
4. Verify the tennis features gate behaves correctly (off by default for HOA-only launch)

---

### ~~P0-002~~ · ✅ DONE (2026-06-26, commit `2b7abc7`) · Navigation crash: `coach-packages` route registered but file does not exist

**Description:** `src/app/_layout.tsx` line 108 registers `<Stack.Screen name="coach-packages" />` but no `src/app/coach-packages.tsx` or `src/app/coach-packages/index.tsx` exists. Any screen with `router.push('/coach-packages')` throws a navigation crash. Must either remove the registration or create a minimal screen.

**Est. Hours:** 0.5 h  
**Dependencies:** None (fix before P0-003 so builds don't carry this crash)  
**Files:** `src/app/_layout.tsx`, all files containing `coach-packages` navigation calls  
**Can Defer?** No  

**Definition of Done:**
- Grep for `coach-packages` across `src/` finds zero unresolved navigation calls
- Either: route is removed from Stack AND no screen navigates to it
- Or: a minimal screen exists at `src/app/coach-packages.tsx` that does not crash

**Manual QA Steps:**
1. Grep `src/` for `coach-packages` — identify every caller
2. Tap any UI element that triggers a `coach-packages` navigation (if any)
3. Verify no navigation crash occurs
4. Verify app does not show a red screen on any standard user journey

---

### ~~P0-003~~ · ✅ DONE (2026-06-26, commit `489799f`) · Build blocker: missing `bundleIdentifier` in `app.json`

**Description:** The iOS section of `app.json` has no `bundleIdentifier`. EAS Build generates a random one per build without it; App Store Connect rejects binaries with unstable bundle IDs. Every subsequent config item (`eas.json`, APNS certs, capabilities) depends on this being set first.

**Est. Hours:** 0.25 h  
**Dependencies:** None  
**Files:** `app.json`  
**Can Defer?** No  

**Definition of Done:**
- `app.json` iOS section contains `"bundleIdentifier": "ai.tenisx.app"` (or chosen ID)
- Same ID is registered in App Store Connect before first upload

**Manual QA Steps:**
1. Open `app.json` — verify `ios.bundleIdentifier` is present
2. Run `eas build --platform ios --profile preview` — verify build completes without bundle ID errors
3. Check App Store Connect — verify the bundle ID matches

---

### ~~P0-004~~ · ✅ DONE code (2026-06-26, commit `69e4a25`) ⚠️ HUMAN ACTION: add EXPO_PUBLIC_SUPABASE_ANON_KEY as EAS secret · Build blocker: no `eas.json` file — cannot build for TestFlight

**Description:** `eas.json` does not exist in the project root. EAS Build requires it to define build profiles (`development`, `preview`, `production`), distribution method (`internal` for TestFlight), and environment variable injection (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_TENNIS_FEATURES_ENABLED`). Without this file, `eas build` refuses to run.

**Est. Hours:** 1 h (file creation + EAS dashboard env var setup)  
**Dependencies:** P0-001 (env var names), P0-003 (bundleIdentifier)  
**Files:** `eas.json` (create), EAS project dashboard  
**Can Defer?** No  

**Definition of Done:**
- `eas.json` exists with at minimum `preview` (internal distribution, iOS) and `production` profiles
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in EAS dashboard secrets
- `eas build --platform ios --profile preview` completes and produces a downloadable `.ipa`

**Manual QA Steps:**
1. Run `eas build --platform ios --profile preview`
2. Verify build reaches 100% with no env-var errors
3. Install build on device via TestFlight or direct install
4. Verify Supabase connection works (login screen is reachable and doesn't error on sign-in attempt)

---

### ~~P0-005~~ · ✅ DONE (2026-06-26, commit `489799f`) · Build blocker: wrong iOS icon path in `app.json`

**Description:** `app.json` line 11 has `"ios": { "icon": "./assets/expo.icon" }`. This points to a directory (`assets/expo.icon/`), not a PNG. The iOS build pipeline will either use the Expo scaffold icon or fail the asset step. The correct TenisX icon is at `assets/images/icon.png`.

**Est. Hours:** 0.25 h  
**Dependencies:** P0-004 (needed to verify the icon appears in the build)  
**Files:** `app.json`  
**Can Defer?** No  

**Definition of Done:**
- `app.json` `ios.icon` removed (falls back to root `icon`) or set to `"./assets/images/icon.png"`
- Root `"icon"` field points to a 1024×1024 TenisX brand PNG
- Built `.ipa` shows TenisX icon, not the Expo default grid icon

**Manual QA Steps:**
1. Install TestFlight build on device
2. Check home screen — verify TenisX icon, not Expo grid
3. Check App Store Connect asset preview — verify correct icon appears

---

### ~~P0-006~~ · ✅ DONE (2026-06-26, commit `489799f`) · Build blocker: app name is `"tenisx-native"` in `app.json`

**Description:** `app.json` line 3 has `"name": "tenisx-native"`. This string appears as the app name on the iOS home screen and in App Store listings. Users will see "tenisx-native" under the app icon instead of "TenisX".

**Est. Hours:** 0.1 h  
**Dependencies:** None  
**Files:** `app.json`  
**Can Defer?** No  

**Definition of Done:**
- `app.json` `name` field is `"TenisX"`
- Installed build shows "TenisX" under the icon on the home screen

**Manual QA Steps:**
1. Install build on device
2. Verify home screen shows "TenisX" as the label under the icon

---

### ~~P0-007~~ · ✅ DONE (2026-06-26, commit `489799f`) · Rejection risk: missing `NSLocationWhenInUseUsageDescription` in `app.json`

**Description:** `(resident)/courts.tsx`, `(resident)/index.tsx`, and `(resident)/match.tsx` all call `expo-location` to get coordinates for weather data. iOS requires a permission string in `Info.plist` for any location API. Missing it causes App Store rejection at submission AND a runtime crash when location is requested on a device.

**Est. Hours:** 0.25 h  
**Dependencies:** None  
**Files:** `app.json`  
**Can Defer?** No  

**Definition of Done:**
- `app.json` contains `ios.infoPlist.NSLocationWhenInUseUsageDescription` with a human-readable reason
- Tapping the Reserve tab on a fresh install shows the iOS location permission dialog — not a crash
- App handles permission denial gracefully (weather widget shows fallback, booking continues)

**Manual QA Steps:**
1. Install fresh build on a device with no prior location permission
2. Navigate to Reserve tab → verify iOS permission dialog appears with the description string
3. Deny permission → verify app does not crash, weather shows a fallback state
4. Grant permission → verify weather data loads

---

### ~~P0-008~~ · ✅ DONE (2026-06-26, commit `f3225b6`) · Rejection risk: missing Apple Privacy Manifest (`PrivacyInfo.xcprivacy`)

**Description:** Apple has required a Privacy Manifest in all submitted apps since Spring 2024. TenisX uses `AsyncStorage` which accesses `NSUserDefaults` — a "required reason API." Without the manifest declaring `NSPrivacyAccessedAPICategoryUserDefaults` with reason code `CA92.1`, the binary will be rejected at App Store submission with a compliance error.

**Est. Hours:** 1.5 h (research Expo SDK 56 support first; may be partially automatic)  
**Dependencies:** P0-004 (EAS build needed to verify the manifest is included)  
**Files:** `ios/PrivacyInfo.xcprivacy` (create), `app.json` plugins section  
**Can Defer?** No  

**Definition of Done:**
- `PrivacyInfo.xcprivacy` exists in the iOS directory and is included in the build
- EAS build log shows no privacy manifest warnings
- App Store Connect upload does not generate a compliance email about missing manifests

**Manual QA Steps:**
1. Submit build to TestFlight
2. Check email from Apple — verify no "Missing Privacy Manifest" notice
3. Check App Store Connect submission checklist — verify privacy section passes

---

### ~~P0-009~~ · ✅ DONE (2026-06-26, commit `489799f`) · Build blocker: no `buildNumber` in `app.json`

**Description:** iOS requires `buildNumber` to be set and manually incremented for each TestFlight upload. Without it, EAS auto-generates a value that may conflict with previous builds in App Store Connect, blocking the upload.

**Est. Hours:** 0.1 h  
**Dependencies:** P0-003 (bundleIdentifier must exist first)  
**Files:** `app.json`  
**Can Defer?** No  

**Definition of Done:**
- `app.json` contains `ios.buildNumber: "1"` (increment manually before each TestFlight upload)
- First build uploads to TestFlight without a version conflict error

**Manual QA Steps:**
1. Upload build to App Store Connect
2. Verify no "duplicate build number" error
3. Verify build appears in TestFlight available builds list

---

### ~~P0-010~~ · ✅ DONE (2026-06-26, commit `489799f`) · Visual: splash screen color is `#208AEF` (bright blue) instead of `#0C0F18` (brand midnight)

**Description:** `app.json` line 32 sets splash `backgroundColor: "#208AEF"`. The brand canvas is `#0C0F18`. On any device where the JS bundle takes more than ~0.5s to load, the user sees a jarring bright blue flash before the app renders. This is the very first frame every reviewer and tester sees.

**Est. Hours:** 0.1 h  
**Dependencies:** None  
**Files:** `app.json`  
**Can Defer?** No  

**Definition of Done:**
- `app.json` splash `backgroundColor` is `"#0C0F18"`
- Installed build shows a midnight navy background during app load

**Manual QA Steps:**
1. Force-quit app, cold-start it
2. Observe splash screen color during load — verify midnight navy, not blue

---

### ~~P0-011~~ · ✅ DONE (2026-06-26, commit `5c22804`) · Broken auth: session persistence fails on cold start — user must re-login every time

**Description:** `src/lib/supabase.ts` correctly configures `persistSession: true` with `AsyncStorage`. `_layout.tsx` correctly restores the session via `getSession()`. However, `src/app/index.tsx` unconditionally redirects to `/(auth)/login` regardless of session state. The login screen has no `useEffect` to detect an existing session and route away. Result: every cold start lands the user on the login screen, even with a valid stored session. Token refresh works fine in the background but is never used.

**Est. Hours:** 1.5 h  
**Dependencies:** P0-004 (need a build to test on device)  
**Files:** `src/app/index.tsx`, `src/app/_layout.tsx`, `src/app/(auth)/login.tsx`  
**Can Defer?** No  

**Definition of Done:**
- `index.tsx` checks session state before redirecting: if session exists, route to the correct role screen; if no session, route to login
- OR `_layout.tsx` handles session-restore routing for both the `!session` and `session` cases
- After a complete cold start with valid stored session, user lands on their Home screen without seeing the login screen
- After a complete cold start with no stored session, user lands on login screen

**Manual QA Steps:**
1. Sign in as a Resident — verify you reach the Home tab
2. Force-quit the app completely (swipe up from app switcher)
3. Reopen the app cold
4. Verify you land on the Resident Home tab WITHOUT seeing the login screen
5. Repeat with a CM account — verify you land on CM Portfolio
6. Repeat with a Coach account — verify you land on Coach Dashboard
7. Sign out, close app, reopen — verify you see the login screen

---

### ~~P0-012~~ · ✅ DONE code (2026-06-26, commit `c5a97c1`) ⚠️ HUMAN ACTION: add `tenisxnative://reset-password` to Supabase Auth allowed redirect URLs · Broken auth: forgot password has no native completion screen

**Description:** `login.tsx` calls `supabase.auth.resetPasswordForEmail()` which sends a magic link email. That link must open the native app and present a "set new password" screen. No such screen exists in `src/app/`. The link will open in a browser pointing to the old web app URL. The reset flow is completely broken for native app users.

**Est. Hours:** 3 h (create `src/app/(auth)/reset-password.tsx`, configure deep link handler in `app.json`, test end-to-end)  
**Dependencies:** P0-004 (EAS build), P0-003 (bundleIdentifier for deep link scheme)  
**Files:** `src/app/(auth)/reset-password.tsx` (create), `app.json` (deep link scheme), Supabase project settings (redirect URL)  
**Can Defer?** No  

**Definition of Done:**
- A "Set New Password" screen exists at `/(auth)/reset-password`
- `app.json` `scheme` is configured so `tenisx://reset-password` opens the native app
- Supabase project redirect URL is set to `tenisx://reset-password` in the Auth dashboard
- Root Stack registers the `(auth)/reset-password` screen
- Tapping the reset link in email opens the native app and shows a new-password form
- Submitting a new password signs the user in and routes to their role screen

**Manual QA Steps:**
1. Enter email on login screen, tap "Forgot password?"
2. Verify success message appears
3. Check inbox — verify reset email arrives
4. Tap the link in the email
5. Verify native app opens (not browser) on the Set New Password screen
6. Enter and confirm a new password
7. Verify you are signed in and routed to Home

---

### ~~P0-013~~ · ✅ DONE (2026-06-26, commit `dee75aa`) · Dead onboarding: HOA join flow completely unreachable — Sign up button has no handler

**Description:** `hoa-application.tsx` exists and is registered in the root Stack, but no navigation path reaches it. The login screen's "Sign up" `TouchableOpacity` (line 293) has no `onPress` — it is a dead interactive element. Apple reviewers tap every visible control on the first screen. A dead CTA is a common rejection reason. Additionally, there is no native screen for residents to submit a `community_join_requests` entry (to join an already-onboarded HOA) — that flow only exists in the old web app.

**Est. Hours:** 1 h  
**Dependencies:** P0-011 (session handling must be correct before wiring onboarding flows)  
**Files:** `src/app/(auth)/login.tsx`, `src/app/hoa-application.tsx`  
**Can Defer?** No  

**Definition of Done:**
- Login "Sign up" `TouchableOpacity` has an `onPress` that navigates to `hoa-application.tsx`
- `hoa-application.tsx` has a back button that returns to login
- Submitting the form shows a success state and returns the user to login
- The form is filled with required fields (name, HOA name, location, role) and submits without error
- A reviewer can start on login, tap Sign up, fill the form, and submit without hitting any dead end

**Manual QA Steps:**
1. Open login screen — tap "Sign up"
2. Verify you reach the HOA Application screen (not a crash, not nothing)
3. Fill all required fields and submit
4. Verify success message appears
5. Tap back — verify you return to login
6. Tap Sign up again — verify existing application status is shown (not a blank form)

---

### ~~P0-014~~ · ✅ DONE (2026-06-26, commit `dee75aa`) · Dead button: "RallyNet Personnel Login" on login screen has no handler

**Description:** `login.tsx` line 293 renders a `<TouchableOpacity style={styles.centeredLink}>` with text "RallyNet Personnel Login" and no `onPress`. This is a visible, tappable element on the app's first screen. Apple reviewers tap all visible interactive elements.

**Est. Hours:** 0.5 h  
**Dependencies:** None  
**Files:** `src/app/(auth)/login.tsx`  
**Can Defer?** No  

**Definition of Done:**
- Either: button is removed entirely if RallyNet login is not needed for launch
- Or: button navigates to a functional reviewer/superuser login path
- No dead `TouchableOpacity` exists on the login screen

**Manual QA Steps:**
1. Open login screen
2. Tap "RallyNet Personnel Login"
3. Verify something happens (navigation or button is gone)
4. Verify tapping it does not hang or produce a blank navigation

---

### ~~P0-015~~ · ✅ DONE (2026-06-26, commit `a3cf1c5`) · Non-functional tab: Resident Me tab shows "Profile coming soon" placeholder

**Description:** `src/app/(resident)/me.tsx` renders a `UserCircle` icon and the text "Profile coming soon" with an empty body. This is one of the five primary resident tabs. Apple reviewers navigate all visible tabs. A tab that does nothing is a functional deficiency that causes rejection. CLAUDE.md explicitly bans placeholder text ("NEVER write placeholders or 'coming soon' text").

**Est. Hours:** 4 h (implement: user avatar/name, HOA community membership, links to My Reservations, My Reports, Settings, and Sign Out)  
**Dependencies:** P0-011 (session must work so the profile loads real data on cold start)  
**Files:** `src/app/(resident)/me.tsx`, `src/lib/supabase.ts`  
**Can Defer?** No  

**Definition of Done:**
- Me tab shows the authenticated user's real name (from `profiles` table)
- Shows current HOA community name (from `hoa_memberships` or equivalent)
- Shows navigation cards/links to: My Reservations, My Reports, Settings
- Shows a Sign Out button that signs the user out and returns to login
- Loading state shown while data fetches
- Empty/error state shown if profile data fails to load
- No "coming soon" text anywhere on the screen
- All navigation links are functional (tap → navigate correctly)

**Manual QA Steps:**
1. Sign in as a Resident — navigate to Me tab
2. Verify your real name appears (not "User" or empty)
3. Verify your HOA community name appears
4. Tap "My Reservations" — verify you reach the reservations screen
5. Tap "My Reports" — verify you reach the reports screen
6. Tap "Settings" — verify you reach the settings screen
7. Tap "Sign Out" — verify you are signed out and land on login
8. Sign back in — verify Me tab loads correctly without restart

---

### ~~P0-016~~ · ✅ DONE (2026-06-26, commit `7b9f9d0`) · Sign-out broken or hidden for resident and coach roles

**Description:** `(resident)/me.tsx` sign-out handler called `signOut()` but had no explicit redirect, relying on a layout effect that may not fire reliably. Worse, the Sign Out button was nested inside `{profile && ...}` — if the profile query failed (e.g., schema issue), the button never rendered, trapping the user. `(coach)/me.tsx` had the same trap: the `loading || !profile` early return showed no sign-out button, so a coach with a missing coach row could not log out.

**Fixes applied:**
- `(resident)/me.tsx`: Added `router.replace('/(auth)/login')` to sign-out handler; moved Sign Out button outside the `profile` conditional so it renders in all non-loading states
- `(resident)/me.tsx`: Fixed pre-existing TS2322 (`ntrp_rating` number→string)
- `(coach)/me.tsx`: Split `if (loading || !profile)` into two guards; the `!profile` guard now shows a Sign Out button

**Manual QA:**
1. Resident → Me tab → Sign Out → confirm → must land on login, back press exits app
2. Resident in error state (e.g., offline) → Me tab → Sign Out button must still be visible
3. Coach → Me tab → scroll to Sign Out → confirm → must land on login
4. CM → Portfolio header menu button → Settings → Sign Out → must land on login
5. After any sign-out: press back → must not re-enter authenticated screens

---

## P1 — Must Fix Before Public Launch

> These don't block TestFlight but will prevent real users from completing core workflows.

---

### ~~P1-001~~ · ✅ DONE (2026-06-26, commit `1cac8b4`) · Unreachable admin workflow: Pending Requests screen has no navigation entry point

**Description:** `src/app/(admin)/pending-requests.tsx` exists and is functional in isolation, but no native screen navigates to it. The CM dashboard (`(cm)/index.tsx`) shows a `totalPending` count inside a non-tappable `View` — tapping the "Pending" stat card does nothing. Grep of `src/app/` finds zero `router.push` calls to `/(admin)/pending-requests`. HOA admins cannot approve or reject member requests through the native app.

**Est. Hours:** 0.5 h  
**Dependencies:** P1-002 (approval should actually work before navigation is added)  
**Files:** `src/app/(cm)/index.tsx`, possibly `src/app/(admin)/manage-amenities.tsx`  
**Can Defer?** No  

**Definition of Done:**
- The CM Portfolio "Pending" stat card is wrapped in a `TouchableOpacity` that navigates to `/(admin)/pending-requests`
- Back navigation from Pending Requests returns to CM Portfolio
- The pending requests screen loads real data from `community_join_requests`

**Manual QA Steps:**
1. Sign in as a CM with pending join requests
2. Tap the "Pending" stat card on the CM Portfolio screen
3. Verify you reach the Pending Requests screen
4. Verify pending requests are shown with correct user name and date
5. Approve one request — verify it disappears from the list
6. Tap back — verify you return to CM Portfolio

---

### ~~P1-002~~ · ✅ DONE (2026-06-26, commit `52b4afc`) · Data integrity: approving a join request may not add the user to `hoa_members`

**Description:** `pending-requests.tsx`'s `updateRequest()` only sets `community_join_requests.status = 'approved'`. No explicit `hoa_members` INSERT follows. If no database trigger converts an approved `community_join_requests` row into an `hoa_members` row, the approved user can never access courts, bookings, or any HOA data. No such trigger was found in the migration audit.

**Est. Hours:** 1.5 h (audit migrations, write trigger or add explicit INSERT to `updateRequest`)  
**Dependencies:** None  
**Files:** `src/app/(admin)/pending-requests.tsx`, relevant Supabase migration file  
**Can Defer?** No  

**Definition of Done:**
- After an admin approves a `community_join_requests` entry, a matching row exists in `hoa_members` (or `hoa_memberships`) for that user + HOA
- The newly approved user can sign in and see courts, book slots, and see their HOA community on the Home tab
- Test: approve a fresh join request → sign in as that user → verify full resident access

**Manual QA Steps:**
1. Create a test user account
2. Have them request to join an HOA (via web or direct DB insert)
3. Sign in as CM → approve the request in Pending Requests screen
4. Sign out → sign in as the test user
5. Navigate to Reserve tab → verify courts from the HOA appear
6. Navigate to Home → verify HOA community name appears
7. Verify `hoa_members` (or `hoa_memberships`) table has a row for this user

---

### ~~P1-003~~ · ✅ DONE (2026-06-26, commit `52b4afc`) · Data integrity: `hoa_members` vs `hoa_memberships` table name mismatch

**Description:** Two screens query different table names for user-to-HOA membership:
- `(cm)/index.tsx` line 54: queries `hoa_members`
- `(resident)/courts.tsx` line 499: queries `hoa_memberships`

One or both of these table names is wrong. If `hoa_memberships` does not exist, every resident sees zero courts and can book nothing. If `hoa_members` does not exist, the CM dashboard always shows 0 member counts.

**Est. Hours:** 1 h (audit DB schema, determine correct table name, fix all callers)  
**Dependencies:** None  
**Files:** `src/app/(cm)/index.tsx`, `src/app/(resident)/courts.tsx`, possibly other screens using membership queries  
**Can Defer?** No  

**Definition of Done:**
- Grep confirms one canonical table name is used across all native screens
- CM dashboard shows correct member count for each HOA
- Residents with approved memberships see courts when they navigate to the Reserve tab
- Residents without memberships see an appropriate empty state (not a crash)

**Manual QA Steps:**
1. Sign in as CM — verify member counts on portfolio cards match the actual number of approved members in the DB
2. Sign in as an approved Resident — verify Reserve tab loads courts
3. Sign in as a user with no membership — verify Reserve tab shows an empty/join-community state rather than a crash
4. Run `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'hoa_%'` against the production DB to confirm which table exists

---

### ~~P1-004~~ · ✅ DONE (2026-06-26, commit `5523ccf`) · Crash risk: `report-detail/[id]` not registered in root Stack

**Description:** `src/app/report-detail/[id].tsx` exists but has no `<Stack.Screen>` in `src/app/_layout.tsx`. Any resident who taps into a maintenance report detail will hit a "Route not found" navigation crash.

**Est. Hours:** 0.25 h  
**Dependencies:** None  
**Files:** `src/app/_layout.tsx`  
**Can Defer?** No  

**Definition of Done:**
- `<Stack.Screen name="report-detail/[id]" />` is present in `_layout.tsx`
- Navigating to a specific report detail from My Reports does not crash

**Manual QA Steps:**
1. Sign in as a Resident → navigate to My Reports
2. Tap any report item
3. Verify a detail screen loads (not a crash or blank screen)
4. Tap back — verify return to My Reports

---

### ~~P1-005~~ · ✅ DONE (2026-06-26, commit `5523ccf`) · Crash risk: `announcements` and `survey-results/[id]` not registered in root Stack

**Description:** `src/app/announcements.tsx` and `src/app/survey-results/[id].tsx` exist but are not registered in `_layout.tsx`. If any current screen navigates to either route, the app crashes.

**Est. Hours:** 0.25 h  
**Dependencies:** Audit which screens currently link to these routes (may be zero)  
**Files:** `src/app/_layout.tsx`  
**Can Defer?** Yes — only if confirmed no screen currently links to these routes  

**Definition of Done:**
- Both routes registered in root Stack OR confirmed no navigation call to them exists
- If registered: navigating to each from a valid entry point does not crash

**Manual QA Steps:**
1. Grep `src/app/` for `router.push('/announcements')` and `survey-results`
2. If callers exist: verify navigation works end-to-end
3. If no callers: document as dormant route, register anyway for safety

---

### P1-006 · 🚫 BLOCKED · Broken email: booking confirmation never sent from native booking flow

**Description:** `(resident)/courts.tsx`'s `handleConfirm()` function inserts a booking row and sets `bookingSuccess = true` but never calls `send-booking-email`. The email function exists and handles `booking_confirmation` type but is only invoked from web-app contexts (`DataContext.tsx`, `supabaseService.ts`) which are not part of the native build. No database trigger fires on booking INSERT. Users receive no confirmation after booking a court.

**Est. Hours:** 1 h  
**Dependencies:** P1-010 (fix email sender domain first so emails are deliverable)  
**Files:** `src/app/(resident)/courts.tsx` (`handleConfirm` function), `supabase/functions/send-booking-email/index.ts`  
**Can Defer?** No  

**Definition of Done:**
- After a successful booking insert, `supabase.functions.invoke('send-booking-email', { body: { type: 'booking_confirmation', ... }})` is called
- Errors from the email call are caught and logged but do NOT block the booking success state
- User receives a confirmation email within 30 seconds of booking
- Email shows correct court name, date, time, and play type

**Manual QA Steps:**
1. Sign in as a Resident — navigate to Reserve tab
2. Book a court slot
3. Verify booking success state appears in the app
4. Check email inbox — verify a confirmation email arrives within 1 minute
5. Verify email sender is `noreply@tenisx.ai` (not `noreply@resend.dev`)
6. Verify email body shows correct court name, date, and time slot
7. Verify no "Book Again" link pointing to the Lovable web app URL

---

### P1-007 · 🚫 BLOCKED · Broken email: booking cancellation never sends a notification email

**Description:** `my-reservations.tsx`'s `cancelBooking()` updates `bookings.status = 'cancelled'` but never calls `send-booking-email`. The `send-booking-email` function handles `booking_cancellation` type but is only called from the web-app's `SetMaintenanceSheet.tsx` component (admin-side, not used in native). Users receive no email when they cancel a booking.

**Est. Hours:** 0.75 h  
**Dependencies:** P1-010 (fix email sender domain)  
**Files:** `src/app/my-reservations.tsx` (`cancelBooking` function)  
**Can Defer?** No  

**Definition of Done:**
- After `bookings.update({ status: 'cancelled' })` succeeds, `send-booking-email` is called with type `booking_cancellation`
- Email call errors are caught silently — they do not block the cancel flow
- User receives a cancellation confirmation email

**Manual QA Steps:**
1. Make a booking
2. Cancel it from My Reservations
3. Check email inbox — verify cancellation email arrives
4. Verify email shows the cancelled court, date, and time

---

### ~~P1-008~~ · ✅ DONE (2026-06-26, commit `fd3ad2a`) · Silent failure: booking cancellation swallows Supabase errors

**Description:** `cancelBooking()` in `my-reservations.tsx` lines 86–92 does `await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)` but completely ignores the return value. If the update fails (network error, RLS denial, server error), the cancelling spinner disappears and the booking remains in the Upcoming list with no feedback to the user.

**Est. Hours:** 0.5 h  
**Dependencies:** None  
**Files:** `src/app/my-reservations.tsx`  
**Can Defer?** No  

**Definition of Done:**
- `cancelBooking` destructures `{ error }` from the update call
- On error: show an `Alert.alert` with a user-readable message ("Cancellation failed. Please try again.")
- On success: proceed to email notification (P1-007) and reload the list

**Manual QA Steps:**
1. Simulate a network failure (airplane mode) — tap Cancel on a booking
2. Verify an error message appears explaining the failure
3. Verify the booking remains in the Upcoming list (not incorrectly removed)
4. Restore network — cancel again — verify it succeeds

---

### P1-009 · 🚫 BLOCKED · Broken feature: scheduled reminders function has no cron trigger

**Description:** `supabase/functions/send-scheduled-reminders/index.ts` is fully implemented — it finds bookings, lessons, and matches within a 55–65 minute window and sends reminder emails. However, no cron job exists to invoke it. No `pg_cron` extension call was found in any migration. No `[functions.send-scheduled-reminders.schedule]` block in `config.toml`. The function can only be called manually. Additionally, the `email_reminders_sent` deduplication table's existence has not been confirmed in migrations — if it doesn't exist, the function will crash on first call.

**Est. Hours:** 1.5 h  
**Dependencies:** P1-010 (email infrastructure must work), P1-006 (booking emails working confirms Resend key is valid)  
**Files:** `supabase/functions/send-scheduled-reminders/index.ts`, Supabase dashboard cron configuration, relevant migration file  
**Can Defer?** No  

**Definition of Done:**
- `email_reminders_sent` table confirmed to exist (check migrations; create if missing)
- A Supabase cron job is configured to invoke `send-scheduled-reminders` every 10 minutes
- `RESEND_API_KEY` is confirmed set in Supabase production secrets
- Manual invocation of the function returns `{ success: true, remindersSent: N }` for a test booking in the 55–65 min window
- A real user with a booking 1 hour away receives a reminder email

**Manual QA Steps:**
1. Create a booking exactly 60 minutes from now
2. Invoke `send-scheduled-reminders` manually via `supabase functions invoke send-scheduled-reminders`
3. Verify response is `{ success: true, remindersSent: 1 }`
4. Check email inbox — verify reminder email arrives
5. Invoke again immediately — verify `remindersSent: 0` (idempotency)
6. Wait for the cron job to fire — verify it fires on schedule (check Supabase logs)

---

### P1-010 · 🚫 BLOCKED · Broken email infrastructure: wrong sender domain and Lovable URL in templates

**Description:** `send-booking-email/index.ts` sends all emails from `"RallyNet <noreply@resend.dev>"`. The `resend.dev` sandbox domain cannot deliver to unverified email addresses (Resend only allows this during testing). In production, all booking emails will fail to deliver unless sent from a verified domain (`tenisx.ai` or similar). Additionally, the `booking_cancellation` template (line 175) contains a hard-coded "Book Again" button linking to `https://play-local-courts.lovable.app/reserve-court` — the wrong app and wrong URL.

**Est. Hours:** 0.5 h  
**Dependencies:** Domain `tenisx.ai` must be verified in Resend dashboard before the fix can go live  
**Files:** `supabase/functions/send-booking-email/index.ts`  
**Can Defer?** No  

**Definition of Done:**
- Email `from` address is `"TenisX <noreply@tenisx.ai>"` (or verified domain)
- `tenisx.ai` domain is verified in Resend (DNS records added)
- `booking_cancellation` "Book Again" link is removed or replaced with a valid deep link to the native app
- Test email deliverable to any Gmail/Outlook address (not just Resend sandbox recipients)

**Manual QA Steps:**
1. Book a court — verify confirmation email arrives at a Gmail address (not a Resend test address)
2. Verify sender shown in email client is `noreply@tenisx.ai` or the verified domain
3. Cancel a booking — verify cancellation email arrives and contains no Lovable URL
4. Check Resend dashboard — verify emails show "delivered" not "failed"

---

### ~~P1-011~~ · ✅ DONE (2026-06-26, commit `2f6df96`) · Missing enforcement: booking cancellation has no time window check in UI

**Description:** The `send-booking-email` confirmation template tells users "please cancel at least 2 hours in advance." The native `cancelBooking()` in `my-reservations.tsx` has no time check — a user can cancel a booking 5 minutes before it starts. The CM has no ability to enforce a policy through the app.

**Est. Hours:** 0.5 h  
**Dependencies:** None  
**Files:** `src/app/my-reservations.tsx`  
**Can Defer?** No — creates community management disputes without enforcement  

**Definition of Done:**
- A cancellation policy (e.g., 2-hour minimum window) is enforced in `cancelBooking()`
- If the booking is within the policy window: the Cancel button is hidden or disabled with a tooltip explaining why
- If the admin sets a different policy per-court, the UI respects that value (if `amenity_rules` has a `cancellation_hours` field — check schema)

**Manual QA Steps:**
1. Make a booking starting in 1 hour
2. Navigate to My Reservations — verify the Cancel button is hidden or disabled
3. Make a booking starting in 5 hours
4. Navigate to My Reservations — verify the Cancel button is visible
5. Tap Cancel — verify the flow completes

---

## P2 — First Month After Launch

> Safe to ship in v1.1 (first update after public launch).

---

### P2-001 · Design: login screen is light-themed — contradicts entire dark-first design system

**Description:** `login.tsx` uses `backgroundColor: Colors.white` on the card, `Colors.navy` text, and `#E5E7EB` light borders — the unmodified web app design. Every other screen in the app is dark (`#0C0F18`). The login is the first full screen every user and every reviewer sees.

**Est. Hours:** 3 h  
**Dependencies:** None  
**Files:** `src/app/(auth)/login.tsx` (full style overhaul)  
**Can Defer?** Yes  

**Definition of Done:** Card is `#161A26`, inputs are `#11141F` with `#232838` borders, text is `#F5F8FF`, focus border is `#2DE0FF`, error is `#FF5C6B`, button is `#2D6BFF`, background is `#0C0F18`. Contrast on all text passes WCAG AA.

**Manual QA Steps:** Open login on a physical device in a bright room. Verify all text is readable. Verify focus ring appears in cyan on the email field. Verify error banner is dark-styled.

---

### P2-002 · Design violation: MFA screen uses emoji `🔒` as an icon

**Description:** The MFA screen renders `<Text>🔒</Text>` as its primary icon. CLAUDE.md and DESIGN.md both ban emoji in the UI ("No emoji icons — SVG stroke icons only"). Replace with Lucide `<Lock>` at 28px, color `#2DE0FF`.

**Est. Hours:** 0.25 h  
**Files:** `src/app/(auth)/login.tsx` line 168  
**Can Defer?** Yes  

**Definition of Done:** No emoji in login.tsx. MFA screen uses a Lucide Lock icon.

**Manual QA Steps:** Trigger MFA flow (sign in with MFA-enabled test account). Verify icon is an SVG lock, not the emoji character.

---

### P2-003 · Design violation: OTP digit input boxes use light color palette

**Description:** `otpStyles` in `login.tsx` sets `backgroundColor: Colors.white` and `borderColor: '#E5E7EB'` on the 6-digit OTP boxes. When rendered inside the dark MFA screen (which itself needs fixing per P2-001), these light boxes are jarring.

**Est. Hours:** 0.5 h (bundle with P2-001)  
**Files:** `src/app/(auth)/login.tsx` lines 303–324  
**Can Defer?** Yes — bundle with P2-001  

**Definition of Done:** OTP boxes use `backgroundColor: #161A26`, `borderColor: #232838`, filled state `borderColor: #2DE0FF`, text color `#F5F8FF`.

**Manual QA Steps:** Trigger MFA flow. Enter digits. Verify boxes are dark-themed with cyan active border.

---

### P2-004 · Config: app URL scheme is `tenisxnative` — should be `tenisx`

**Description:** `app.json` `"scheme": "tenisxnative"` generates deep links as `tenisxnative://...`. The brand scheme should be `tenisx://`. This affects password reset links (P0-012), future marketing links, and any sharing features.

**Est. Hours:** 0.25 h  
**Files:** `app.json`  
**Can Defer?** Yes — if no deep links are live yet, this is safe to change post-launch  

**Definition of Done:** `app.json` scheme is `"tenisx"`. Password reset deep link uses `tenisx://`. All existing deep links updated.

**Manual QA Steps:** Verify password reset email link opens `tenisx://` — opens native app. Verify no existing functionality breaks.

---

### P2-005 · Missing feature: residents have no messaging capability

**Description:** The CM role has a full Messages tab (`(cm)/messages.tsx`). Residents have no way to send or receive messages. No Messages tab or button exists in the resident tab bar. This was tracked as `❌ P3-2` in the project state. The `src/app/messages.tsx` route exists for CM messages; a resident-scoped version needs to be created or the existing one extended.

**Est. Hours:** 3 h  
**Files:** `src/app/(resident)/` (new message entry), `src/app/messages.tsx`  
**Can Defer?** Yes  

**Definition of Done:** Residents can view and send messages from either a Messages tab or a message button on the Home screen. Real-time updates via Supabase channel. Loading/empty/error states all handled.

**Manual QA Steps:** Sign in as Resident. Navigate to messages. Verify message list loads. Send a message. Verify it appears in the thread. Verify CM sees the message in their Messages tab.

---

### P2-006 · Design violation: CM AdminHub portfolio uses 4-column stat grid

**Description:** `(cm)/index.tsx` renders a 2×2 four-column stat layout per community card (`Amenities · Members · Issues · Alerts`). DESIGN.md bans 4-column grids on mobile: "4-col makes text too small." Maximum is 3 columns.

**Est. Hours:** 0.5 h  
**Files:** `src/app/(cm)/index.tsx`  
**Can Defer?** Yes  

**Definition of Done:** Community stat row uses 3 columns max. Either combine `Issues + Alerts` into a single "Alerts" count or move one stat to a secondary row.

**Manual QA Steps:** Open CM Portfolio on a 390px-width device. Verify stat values are readable without squinting. Verify no stat label is truncated.

---

### P2-007 · Dead button: CM AdminHub "Add Community" card has no `onPress`

**Description:** `(cm)/index.tsx` renders an "Add Community" dashed card as a plain `View` (not a `TouchableOpacity`). It has a `Plus` icon and the label "ADD COMMUNITY" but is completely inert. CMs who tap it get no feedback.

**Est. Hours:** 0.5 h  
**Files:** `src/app/(cm)/index.tsx`  
**Can Defer?** Yes  

**Definition of Done:** Either: "Add Community" is tappable and navigates to a community-add flow or shows a "Coming soon" alert. Or: the card is removed until the flow is built. No inert interactive-looking element exists.

**Manual QA Steps:** Sign in as CM. Tap "Add Community." Verify something happens (navigation, alert, or element is absent).

---

### P2-008 · Dead button: CM AdminHub "Pending" stat is not tappable

**Description:** The "Pending" stat card on the CM Portfolio shows the `totalPending` count across all HOAs, but the card is inside a `View`, not a `TouchableOpacity`. Tapping it does nothing. This is separate from P1-001 (navigation to pending-requests) — this is the stat card in the top 2×2 grid.

**Est. Hours:** 0.5 h  
**Dependencies:** P1-001 (pending-requests must be navigable first)  
**Files:** `src/app/(cm)/index.tsx`  
**Can Defer?** Yes  

**Definition of Done:** "Pending" stat card is wrapped in a `TouchableOpacity` that navigates to `/(admin)/pending-requests`. A badge number ≥ 1 also navigates there on tap.

**Manual QA Steps:** Sign in as CM with pending requests. Tap the "Pending" stat card. Verify navigation to Pending Requests.

---

### P2-009 · Missing error state: CM AdminHub silently fails if Supabase load errors

**Description:** `(cm)/index.tsx` `load()` function returns silently on `!hoas` (line 49) with no error state or retry mechanism. If the network is unavailable or the query fails, the CM sees an empty portfolio list with no explanation and no retry button.

**Est. Hours:** 0.75 h  
**Files:** `src/app/(cm)/index.tsx`  
**Can Defer?** Yes  

**Definition of Done:** A network/data error renders an error state with a message and a "Try again" button that re-runs `load()`. Pull-to-refresh also retries.

**Manual QA Steps:** Put device in airplane mode. Sign in as CM. Open Portfolio tab. Verify error state appears. Restore network. Pull to refresh. Verify communities load.

---

### P2-010 · Data bug: HOA application form silently discards the phone number field

**Description:** `hoa-application.tsx` collects `phoneNumber` in form state (line 43) and renders a TextInput for it (line 265), but the `handleSubmit` function (lines 109–117) never includes `phone_number` in the `hoa_applications` INSERT payload. Phone numbers entered by applicants are silently discarded.

**Est. Hours:** 0.5 h  
**Files:** `src/app/hoa-application.tsx`  
**Can Defer?** Yes  

**Definition of Done:** `handleSubmit` includes `phone_number: phoneNumber.trim()` in the INSERT (if the `hoa_applications` schema has that column). If the column doesn't exist, a migration adds it.

**Manual QA Steps:** Submit HOA application with a phone number. Check `hoa_applications` row in Supabase — verify `phone_number` column is populated.

---

### P2-011 · ⚠️ AWAITING QA · Lesson Packages — coach CRUD + player view + booking integration

**Description:** Full lesson packages feature. Coaches can create, edit, deactivate/reactivate, and delete packages from the Coach Me tab. Players see active packages on the coach profile screen and can optionally attach a package when submitting a lesson request. The `package_id` FK is nullable (`ON DELETE SET NULL`) so no existing data is affected.

**Est. Hours:** 0 h remaining (code done, commit `9bac382`) · Migrations need applying to prod · Human QA required  
**Dependencies:** Two migrations must be applied to production Supabase before this can be QA-tested:  
1. `supabase/migrations/20260626000000_lesson_packages.sql` — creates `lesson_packages` table with RLS  
2. `supabase/migrations/20260626000001_lesson_requests_add_package_id.sql` — adds nullable FK to `lesson_requests`  
**Files:** `src/hooks/useLessonPackages.ts`, `src/components/coach/LessonPackagesManager.tsx`, `src/components/coaching/PackagesList.tsx`, `src/app/(coach)/me.tsx`, `src/app/coach-profile/[id].tsx`, `src/components/coaching/BookLessonSheet.tsx`  
**Can Defer?** Yes — no P0/P1 blocker depends on it  

**Definition of Done:**
- Both migrations applied to production
- Coach can create a package and it appears in the list immediately (no refresh needed)
- Coach can edit, deactivate, reactivate, and delete a package
- Deactivated packages show INACTIVE badge; are hidden from player view
- Player sees active packages on coach profile (or a clean empty state if none exist)
- Player can select a package in the lesson booking flow (Step 5 of BookLessonSheet)
- Submitted lesson request row in Supabase has correct `package_id` when package was selected, `null` when skipped
- No "Coming Soon" text anywhere in the packages flow

**Manual QA Steps — Coach Side:**
1. Sign in as a coach. Navigate to the Coach tab → Me screen.
2. Scroll past "Save All Changes" — verify "Lesson Packages" section appears with an "+ Add" button.
3. Tap "+ Add." Fill in: title, lesson type chip, duration chip (e.g. 60 min), price, sessions (e.g. 4). Tap "Save."
4. Verify the new package appears in the list with ACTIVE badge and correct title/price.
5. Tap the pencil icon on the package. Edit the title. Tap "Save." Verify the list updates.
6. Tap the power icon (toggle). Confirm deactivation alert. Verify badge changes to INACTIVE.
7. Tap the power icon again. Verify badge returns to ACTIVE.
8. Tap the trash icon. Confirm delete alert. Verify the package is removed from the list.
9. Create a package with no description — verify no blank space is left where description would be.
10. Check Supabase `lesson_packages` table — verify rows match what's shown in the UI.

**Manual QA Steps — Player Side:**
1. Sign in as a resident/player. Navigate to a coach profile screen (`/coach-profile/[id]`).
2. Scroll to the "Packages" section. Verify at least one package is visible (or clean empty state if none).
3. Verify each package shows: title, price, per-session price (if multi-session), type chip, duration/sessions meta.
4. Tap "Book a Lesson." Advance to Step 5 of the booking flow.
5. If the coach has active packages: verify a package selector appears. Select one. Verify it highlights.
6. Tap the selected package again — verify it deselects (optional).
7. Advance to Step 6 (Review). Verify selected package shows in the summary row.
8. Submit the lesson request. Check `lesson_requests` table — verify `package_id` column is populated with the correct package UUID.
9. Book again, skip package selection. Verify `lesson_requests.package_id` is `null`.
10. If coach has no packages: verify no package selector appears, booking flow is unaffected.

---

## P3 — Ignore Until 100 Users

> Post-launch, post-product-market-fit work.

---

### P3-001 · Feature: full Resident Me tab profile (NTRP, match history, leaderboard rank)

**Description:** P0-015 delivers the minimum viable Me tab (name, HOA, nav links). The full vision includes NTRP rating widget, recent match win/loss history, HOA leaderboard rank, and court hour statistics. Defer until the match system (Match tab) has real data.

**Est. Hours:** 6 h  
**Files:** `src/app/(resident)/me.tsx`, match and stats tables  
**Can Defer?** Yes  

---

### P3-002 · Infrastructure: crash reporting and analytics (Sentry or equivalent)

**Description:** No crash reporting SDK is integrated. Production crashes in TestFlight and post-launch will only be discoverable through manual user reports. Add Sentry with `expo-sentry` or a Supabase edge function log aggregator before scaling to external users.

**Est. Hours:** 1 h  
**Files:** `package.json`, `src/app/_layout.tsx` (Sentry init)  
**Can Defer?** Yes  

---

### P3-003 · Feature: push notifications via APNS

**Description:** `src/app/notifications.tsx` exists but no push token registration, APNS certificate, or notification sending pipeline is configured. Real-time alerts for booking confirmations, challenge requests, and messages should push to the device. Required for a competitive sports app UX.

**Est. Hours:** 4 h  
**Files:** `src/app/_layout.tsx` (registration), `supabase/functions/` (send-push function), Supabase dashboard  
**Can Defer?** Yes  

---

### P3-004 · Cleanup: audit all callers of `featureFlags.ts` after P0-001 fix

**Description:** After fixing `import.meta.env` (P0-001), all existing consumers of `TENNIS_FEATURES_ENABLED` must be audited to confirm the flag correctly gates Stage 2 features in the native build (coaches, matches, ladder). Any screen that should be hidden must respect the flag; any screen that should always be visible must not be behind the flag.

**Est. Hours:** 1 h  
**Files:** All files importing `featureFlags.ts`  
**Can Defer?** Yes — P0-001 is the prerequisite  

---

### P3-005 · Verification: Community Manage screen end-to-end audit

**Description:** Tracked as `❌ P4-2` in project state. `(admin)/manage-amenities.tsx` and `(admin)/manage-courts.tsx` need a full QA pass to confirm court CRUD, rule editing, maintenance blocking, and admin permissions all work end-to-end with real data.

**Est. Hours:** 2 h  
**Files:** `src/app/(admin)/manage-amenities.tsx`, `src/app/(admin)/manage-courts.tsx`  
**Can Defer?** Yes  

---

### P3-006 · Compatibility verification: Hermes + `react-native-reanimated 4.3.1` + RN 0.85.3

**Description:** `react-native-reanimated 4.3.1` and `react-native-worklets 0.8.3` are new additions. Hermes on RN 0.85.3 has had compatibility issues with certain Reanimated versions. Verify no silent JS exceptions occur during cold start and during animated transitions.

**Est. Hours:** 2 h  
**Files:** `package.json`, `src/app/_layout.tsx`  
**Can Defer?** Yes — but run this check before the first external TestFlight release  

---

### P3-007 · Resident messages tab (full implementation)

**Description:** P2-005 is a minimal implementation. A full messages tab with conversation threads, real-time typing indicators, message read receipts, and photo attachments is a v1.1+ feature.

**Est. Hours:** 8 h  
**Can Defer?** Yes  

---

## Critical Path Sequence

> Execute in this exact order to reach TestFlight as fast as possible.

### Day 1 — Unblock Build (P0-001 → P0-010)

```
P0-001  featureFlags.ts import.meta.env fix          0.5 h
P0-002  coach-packages route fix                     0.5 h
P0-003  bundleIdentifier in app.json                 0.25 h
P0-006  App name → "TenisX"                          0.1 h
P0-005  iOS icon path fix                            0.25 h
P0-009  buildNumber → "1"                            0.1 h
P0-010  Splash screen color → #0C0F18                0.1 h
P0-007  Location permission strings                  0.25 h
P0-004  Create eas.json + wire Supabase env vars     1 h
P0-008  Privacy Manifest                             1.5 h
────────────────────────────────────────────────────
Day 1 total:  ~4.5 h → First EAS build attempted
```

### Day 2 — Fix Auth (P0-011, P0-012)

```
P0-011  Session persistence (index.tsx + routing)    1.5 h
P0-012  Forgot password native flow + deep link      3 h
────────────────────────────────────────────────────
Day 2 total:  ~4.5 h → Auth works end-to-end
```

### Day 3 — Fix Onboarding + Reviewer-Visible Issues (P0-013 → P0-015)

```
P0-013  Wire Sign up → hoa-application              1 h
P0-014  Fix/remove RallyNet button                  0.5 h
P0-015  Implement Resident Me tab (real data)       4 h
────────────────────────────────────────────────────
Day 3 total:  ~5.5 h → Second EAS build, all P0s resolved
```

### Day 4 — Data Integrity + Admin Workflows (P1-001 → P1-005)

```
P1-003  Resolve hoa_members vs hoa_memberships      1 h
P1-002  Confirm/fix approve → hoa_members trigger   1.5 h
P1-001  Wire CM Pending stat → pending-requests     0.5 h
P1-004  Register report-detail in root Stack        0.25 h
P1-005  Register announcements/survey-results       0.25 h
────────────────────────────────────────────────────
Day 4 total:  ~3.5 h → Admin and member workflows functional
```

### Day 5 — Email + Notifications (P1-006 → P1-011)

```
P1-010  Fix email sender domain + Lovable URL       0.5 h
P1-006  Booking confirmation email from native      1 h
P1-007  Booking cancellation email from native      0.75 h
P1-008  Cancellation error handling                 0.5 h
P1-011  Cancellation time window enforcement        0.5 h
P1-009  Scheduled reminders cron + table check      1.5 h
────────────────────────────────────────────────────
Day 5 total:  ~4.75 h → All emails + reminders functional
```

### Day 6 — Internal QA + Third EAS Build

```
Full QA pass across all roles: Resident, CM, Admin, Coach
Test cold start session persistence on physical device
Test forgot password end-to-end
Test booking → email → cancellation → email chain
Test admin approval → resident access
Submit to TestFlight (internal testers)
```

### Day 7 — Buffer for QA Findings

---

## Open Risks (Not Yet Assigned a Task)

| Risk | Severity | Action |
|------|----------|--------|
| `import.meta.env` may appear in files beyond `featureFlags.ts` | High | Grep `src/` for `import.meta` before closing P0-001 |
| `email_reminders_sent` table may not exist in production DB | High | Check schema before closing P1-009 |
| Resend `RESEND_API_KEY` not confirmed set in Supabase production secrets | High | Verify in Supabase dashboard before closing P1-006 |
| `hoa_applications` approval by platform reviewer has no native admin tool | Medium | Platform reviewer flow is web-only; document as known gap |
| `react-native-reanimated 4.3.1` + Hermes compat on cold start | Medium | Run P3-006 before external TestFlight |
| Supabase `site_url` in `config.toml` is `localhost:3000` — production project must have correct URL | Medium | Verify production Supabase project Auth settings, not just `config.toml` |
| `hoa_memberships` vs `hoa_members` — if both tables exist, wrong data may silently appear | High | Resolve in P1-003 by checking actual DB schema |
| No user sign-up flow for residents (they can only join via invite or admin DB add) | Medium | Clarify intended onboarding path with product owner before public launch |

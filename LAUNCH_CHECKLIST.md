# TenisX — TestFlight Launch Checklist

**Target:** TestFlight build within 7 days (by 2026-07-03)  
**Current branch:** `launch-sprint`  
**Last audited:** 2026-06-26

---

## Legend

- **Postpone?** ✅ = Safe to do after launch · ❌ = Must ship · ⚠️ = Risk if postponed
- **Deps** = must complete this first

---

## P0 — App Store Rejection Risk

These will prevent submission or cause immediate rejection.

---

### P0-1 · Missing `bundleIdentifier` in `app.json`

**File:** `app.json`  
**Problem:** The iOS section has no `bundleIdentifier`. Without this, `eas build` generates a random one that changes per build, and App Store Connect won't accept the binary.  
**Time:** 15 min  
**Dependencies:** None — decide on `ai.tenisx.app` or similar  
**Postpone?** ❌ Blocks every TestFlight build

---

### P0-2 · Wrong iOS icon path in `app.json`

**File:** `app.json` line 11  
**Problem:** `"ios": { "icon": "./assets/expo.icon" }` — this points to a **directory** (`assets/expo.icon/`) containing Expo's scaffold icon, not the TenisX brand icon PNG. The iOS build will use a generic icon or crash the asset pipeline.  
**Fix:** Change to `"./assets/images/icon.png"` (the TenisX logo already exists there) or remove the iOS override entirely so the root icon applies.  
**Time:** 10 min  
**Dependencies:** Confirm `assets/images/icon.png` is the correct 1024×1024 PNG  
**Postpone?** ❌ Causes wrong app icon on the App Store

---

### P0-3 · No `eas.json` — can't build for TestFlight

**File:** Missing entirely  
**Problem:** There is no `eas.json` in the project root. EAS Build requires this to know build profiles, environment variable injection, and distribution settings. Without it, `eas build --platform ios` won't work.  
**Required content:** At minimum, `development`, `preview`, and `production` profiles, plus `env` block for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.  
**Time:** 45 min (create file, configure profiles, wire env vars in EAS dashboard)  
**Dependencies:** P0-1 (bundleIdentifier needed first)  
**Postpone?** ❌ Nothing ships without this

---

### P0-4 · Missing iOS permission descriptions for Location

**File:** `app.json`  
**Problem:** Multiple screens (`(resident)/courts.tsx`, `(resident)/index.tsx`, `(resident)/match.tsx`) call `expo-location`. Apple requires `NSLocationWhenInUseUsageDescription` in Info.plist. Missing this causes App Store rejection AND a runtime crash on iOS 14+ when requesting location.  
**Fix:** Add to `app.json`:
```json
"ios": {
  "infoPlist": {
    "NSLocationWhenInUseUsageDescription": "TenisX uses your location to show weather conditions at your local courts."
  }
}
```
**Time:** 15 min  
**Dependencies:** None  
**Postpone?** ❌ Rejection guaranteed

---

### P0-5 · Missing Apple Privacy Manifest (`PrivacyInfo.xcprivacy`)

**File:** `ios/TenisX/PrivacyInfo.xcprivacy` (needs to be created)  
**Problem:** Apple requires a Privacy Manifest for all apps since Spring 2024. The app uses `AsyncStorage` (which accesses `NSUserDefaults`, an "required reason" API). Without the manifest, the App Store will reject the binary with a compliance error.  
**Fix:** Create a Privacy Manifest declaring `NSPrivacyAccessedAPICategoryUserDefaults` with reason code `CA92.1` (app functionality). Add as a plugin via `expo-build-properties` or manually in the iOS native directory after first bare workflow ejection.  
**Time:** 1 hr  
**Dependencies:** Expo SDK 56 — check if `expo-privacy-manifest` or `expo-build-properties` covers this automatically  
**Postpone?** ❌ Apple enforces this on submission

---

### P0-6 · App name is `"tenisx-native"` — will appear on App Store

**File:** `app.json` line 3  
**Problem:** `"name": "tenisx-native"` is the internal dev name and will appear as the app name on the home screen and App Store listing. It should be `"TenisX"`.  
**Time:** 5 min  
**Dependencies:** None  
**Postpone?** ❌ Cosmetic but will fail App Store guidelines for name accuracy

---

### P0-7 · `coach-packages` registered in root Stack but file doesn't exist

**File:** `src/app/_layout.tsx` line 108  
**Problem:** `<Stack.Screen name="coach-packages" />` is registered but `src/app/coach-packages/` (or `coach-packages.tsx`) doesn't exist. Expo Router will throw a navigation error the moment any screen tries to navigate to this route.  
**Fix:** Either create a stub `src/app/coach-packages.tsx` or remove the Stack.Screen registration.  
**Time:** 15 min  
**Dependencies:** None  
**Postpone?** ❌ Navigation crash on any screen that links to packages

---

### P0-8 · `featureFlags.ts` uses Vite API (`import.meta.env`) — crashes native

**File:** `src/config/featureFlags.ts` line 8  
**Problem:** `import.meta.env.VITE_TENNIS_FEATURES_ENABLED` is Vite-only syntax. React Native (Hermes) does not have `import.meta`. Any file that imports `featureFlags.ts` will throw a `ReferenceError: Can't find variable: import` at startup.  
**Fix:** Migrate to `process.env.EXPO_PUBLIC_TENNIS_FEATURES_ENABLED === 'true'` and rename the env var accordingly.  
**Time:** 30 min (update file + all callers + `.env` + EAS env vars)  
**Dependencies:** P0-3 (EAS env var config)  
**Postpone?** ❌ Startup crash if this file is imported anywhere in the native bundle

---

## P1 — Production Failure Risk

These will break core flows for real users.

---

### P1-1 · `report-detail/[id].tsx` not registered in root Stack

**File:** `src/app/_layout.tsx`  
**Problem:** `src/app/report-detail/[id].tsx` exists but has no `<Stack.Screen name="report-detail/[id]" />` in the root layout. Navigation to a report detail will crash with "Route not found."  
**Time:** 15 min  
**Dependencies:** None  
**Postpone?** ❌ Any resident tapping a report detail crashes

---

### P1-2 · `announcements.tsx` and `survey-results/[id].tsx` not registered in root Stack

**File:** `src/app/_layout.tsx`  
**Problem:** `src/app/announcements.tsx` and `src/app/survey-results/[id].tsx` exist but are not in the root Stack. If any screen navigates to them, it crashes.  
**Time:** 15 min  
**Dependencies:** None  
**Postpone?** ⚠️ Only matters if any current screen links to these routes — audit first

---

### P1-3 · Login "Sign up" link is a dead `TouchableOpacity` — no handler

**File:** `src/app/(auth)/login.tsx` line 293  
**Problem:** `<TouchableOpacity style={styles.centeredLink}>` with no `onPress`. Apple reviewers tap everything. A dead CTA on the first screen is an automatic rejection trigger.  
**Fix:** Wire it to `router.push('/hoa-application')` or remove it.  
**Time:** 30 min  
**Dependencies:** HOA Application screen (`hoa-application.tsx` exists — just needs wiring)  
**Postpone?** ❌ Apple reviewers flag dead interactive elements

---

### P1-4 · No new-user registration path is reachable in the app

**File:** `src/app/(auth)/login.tsx`  
**Problem:** Related to P1-3 — if users are expected to self-register or apply to join their HOA, there is currently no way to initiate that flow from the app. `hoa-application.tsx` exists but is unreachable from login.  
**Time:** 45 min (wire login → HOA application + add back-button from HOA form to login)  
**Dependencies:** None  
**Postpone?** ❌ Apple reviewers will test the "new user" path and find nothing

---

### P1-5 · Resident "Me" tab is a placeholder — violates no-stub rule

**File:** `src/app/(resident)/me.tsx`  
**Problem:** The Me tab shows "Profile coming soon" with an empty icon. This is an explicit violation of the project rule "NEVER write placeholders." For App Store review, a tab that does nothing is a functional deficiency that reviewers flag.  
**Time:** 3–4 hrs (implement: profile card with avatar, display name, NTRP rating, HOA membership info, links to My Reservations / My Reports / Settings)  
**Dependencies:** `settings.tsx`, `my-reservations.tsx`, `my-reports.tsx` (all exist)  
**Postpone?** ⚠️ Risk — reviewers may reject for non-functional tab. Minimum: show real user data (name, email, community) with links.

---

### P1-6 · Splash screen `backgroundColor` is `#208AEF` — wrong brand color

**File:** `app.json` line 32  
**Problem:** The splash screen background is a bright blue (`#208AEF`), but the app's brand canvas is midnight navy (`#0C0F18`). On slow devices the splash is visible for 1–2 seconds before the app loads, creating a jarring color flash.  
**Time:** 5 min  
**Dependencies:** None  
**Postpone?** ⚠️ Not a rejection risk but very visible to reviewers and beta testers

---

## P2 — User Experience Issues

These will frustrate users but won't prevent launch.

---

### P2-1 · Login screen is light-themed — contradicts dark-first design

**File:** `src/app/(auth)/login.tsx`  
**Problem:** The login card has `backgroundColor: Colors.white`, navy text, and light border colors — it's the old web app's login, never migrated to dark. The app opens to a white screen while everything else is `#0C0F18`. This is the first impression for every user.  
**Time:** 2–3 hrs (full dark-mode redesign: surface card `#161A26`, text `#F5F8FF`, cyan focus borders, dark input fields)  
**Dependencies:** None  
**Postpone?** ⚠️ Strong recommendation to fix before TestFlight — beta testers and reviewers will notice immediately

---

### P2-2 · MFA screen uses emoji (🔒) — violates design rules

**File:** `src/app/(auth)/login.tsx` line 168  
**Problem:** The MFA unlock screen renders `<Text style={styles.mfaIconText}>🔒</Text>` as an icon. The design system explicitly bans emoji in the UI (CLAUDE.md, DESIGN.md).  
**Fix:** Replace with a Lucide `<Lock>` icon.  
**Time:** 15 min  
**Dependencies:** None  
**Postpone?** ✅ Safe to fix post-launch but quick win

---

### P2-3 · OTP input uses light color palette

**File:** `src/app/(auth)/login.tsx` lines 303–324 (`otpStyles`)  
**Problem:** OTP digit boxes use `backgroundColor: Colors.white` and `borderColor: '#E5E7EB'` — light theme colors on the dark login screen.  
**Time:** 30 min  
**Dependencies:** P2-1 (bundle with login redesign)  
**Postpone?** ✅ Bundle with login redesign

---

### P2-4 · App scheme is "tenisxnative" — messy deep links

**File:** `app.json` line 7  
**Problem:** `"scheme": "tenisxnative"` generates deep links like `tenisxnative://...`. Should be `"tenisx"` for clean URLs and future marketing links.  
**Time:** 5 min  
**Dependencies:** Verify no existing deep link integrations use the current scheme  
**Postpone?** ✅ Safe post-launch if no deep links are live yet

---

### P2-5 · Resident Messages not implemented (residents can't message)

**File:** Missing — no resident messages tab or screen  
**Problem:** Residents have no way to view or send messages. The CM side has a full messages tab; residents don't. This was tracked as ❌ P3-2 in project state.  
**Time:** 2–3 hrs (add messages route, wire to existing `messages.tsx` stack screen with resident context)  
**Dependencies:** `src/app/messages.tsx` exists (CM version) — may need a resident-scoped variant  
**Postpone?** ✅ Acceptable for v1 TestFlight if messaging is not a core advertised feature; document as known limitation

---

### P2-6 · `(resident)/me.tsx` — no real profile data shown (see P1-5)

Already captured in P1-5. Promoted due to UX impact.

---

### P2-7 · No iOS build number (`buildNumber`) in `app.json`

**File:** `app.json`  
**Problem:** `buildNumber` must be set and incremented for each TestFlight upload. Without it, EAS will auto-generate but you'll lose control of the version sequence.  
**Time:** 5 min  
**Dependencies:** P0-1  
**Postpone?** ❌ Can block TestFlight upload if App Store Connect expects a specific build number

---

## P3 — Post-Launch Improvements

Safe to defer until after TestFlight or v1.1.

---

### P3-1 · HOA Application flow UX polish

**File:** `src/app/hoa-application.tsx`  
**Problem:** Screen exists but entry point from login is missing (fixed in P1-3/P1-4). Full flow — form validation, success state, admin approval notification — needs verification.  
**Time:** 2–3 hrs  
**Postpone?** ✅ Wire the entry point now; polish post-launch

---

### P3-2 · Resident Me tab — full profile (NTRP, match history, leaderboard rank)

**Problem:** P1-5 covers the minimum viable version. A full profile with NTRP rating widget, match win/loss history, and HOA leaderboard rank belongs in a v1.1 update.  
**Time:** 4–6 hrs  
**Postpone?** ✅ Post-launch

---

### P3-3 · Crash reporting / analytics (Sentry or similar)

**Problem:** No crash reporting is configured. Flying blind in TestFlight means bugs that users hit won't surface until they manually report.  
**Time:** 1 hr  
**Postpone?** ✅ Worth adding before public launch; acceptable for closed TestFlight

---

### P3-4 · Push notifications (APNS setup)

**Problem:** The `notifications.tsx` screen exists but there's no push notification registration or APNS certificate configured. Real-time alerts for bookings, challenges, messages won't reach users.  
**Time:** 3–4 hrs  
**Postpone?** ✅ Not required for TestFlight, strongly recommended for public launch

---

### P3-5 · Login screen dark redesign (if not done in P2-1)

Already captured in P2-1. Postpone only if P2-1 is deferred.

---

### P3-6 · Community Manage screen verification (P4-2 from project state)

**Problem:** Tracked as incomplete in project state. Low priority for HOA-only launch scope.  
**Time:** 2 hrs  
**Postpone?** ✅ Post-launch

---

### P3-7 · `featureFlags.ts` — migrate all callers to Expo env pattern

After P0-8 fixes the crash, audit all usages of `TENNIS_FEATURES_ENABLED` to ensure the flag correctly gates Stage 2 features in the native build.  
**Time:** 1 hr  
**Postpone?** ✅ Do P0-8 first; this is cleanup

---

## Sprint Order Recommendation

Work this sequence to unblock the TestFlight build as fast as possible:

**Day 1 — Unblock the build (P0s)**
1. P0-1: Add `bundleIdentifier`
2. P0-6: Fix app name to `"TenisX"`
3. P0-2: Fix iOS icon path
4. P0-7: Remove or stub `coach-packages`
5. P0-8: Fix `featureFlags.ts` (`import.meta.env` → `process.env.EXPO_PUBLIC_*`)
6. P0-4: Add location permission strings
7. P1-6: Fix splash screen color
8. P2-7: Set `buildNumber`
9. P0-3: Create `eas.json` and push first build

**Day 2 — Fix critical flows (P0s + P1s)**
10. P1-1: Register `report-detail/[id]` in root Stack
11. P1-2: Register `announcements` and `survey-results/[id]` in root Stack
12. P1-3 + P1-4: Wire "Sign up" → `hoa-application` + back button

**Day 3 — Reviewer-visible UX (P1 + P2)**
13. P1-5: Implement real Resident Me tab (minimum: profile card + nav links)
14. P0-5: Add Privacy Manifest (research Expo SDK 56 support first)
15. P2-1 + P2-2 + P2-3: Login dark theme + emoji fix + OTP fix

**Day 4–5 — Polish + second build**
16. Submit second TestFlight build
17. Internal testing across roles (Resident, CM, Admin, Coach)
18. P3-3: Add Sentry

**Day 6–7 — Buffer for fixes found in testing**

---

## Known Risks Not Yet Categorized

| Risk | Severity | Notes |
|------|----------|-------|
| Hermes engine compat with `react-native-reanimated 4.3.1` + SDK 56 | Medium | Verify no JS exceptions on cold start |
| `expo-location` foreground permission prompt timing | Low | Must request before first use, not on app open |
| `coach-packages` crash scope | High | Check all screens for `router.push('/coach-packages')` calls |
| `import.meta.env` usage in other files besides `featureFlags.ts` | High | Grep for `import.meta` across all `src/` |
| `TypeScript strict` — pre-existing TS1149 casing errors | Low | Not runtime but blocks `tsc --noEmit` CI check |
| `react-native-worklets 0.8.3` compatibility with RN 0.85.3 | Medium | New dependency — verify no startup warnings |

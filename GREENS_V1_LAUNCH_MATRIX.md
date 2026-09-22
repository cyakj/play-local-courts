# The Greens V1 — Launch Readiness Matrix

Branch: `greens-v1` @ `ebe8d4b` (post-`/verify` remediation → follow-up `profiles` fix → independent code
review → this post-review remediation pass — see §9, §10, §11 respectively).
`main` untouched, unchanged at `c05b94131bf3896f9d94d4dc97057d2b85b56ea2`.

Product mode: `EXPO_PUBLIC_PRODUCT_MODE=community` (the launch target). Tennis mode is the code default and
is not touched by any Greens V1 work.

Compiled against the Greens V1 "Turbo Release" pass (Tracks A / B / C). This matrix is the single-page
status view; the narrative and per-bug detail are in `GREENS_V1_TURBO_REPORT.md` and
`GREENS_V1_CHECKPOINT.md`.

Legend: **GREEN** = verified this pass (automated + live DB + source) · **AMBER** = built and
source-verified, needs a real-device / human eyes pass · **RED** = known gap / blocker.

---

## 1. Resident workflows

| # | Workflow / screen | Status | How verified |
|---|---|---|---|
| R1 | **Reserve** — court/amenity list, booking sheet, date picker, duration, slot grid, confirm, dismiss | GREEN | `courts.spec.ts` 35/35; live `courts` + `amenity_rules` data for The Greens |
| R2 | **Double-booking race** — second overlapping confirmed booking is rejected with a friendly "That time slot was just taken — please pick another." and the sheet refreshes | GREEN | DB constraint `bookings_no_overlapping_confirmed` (EXCLUDE USING gist, `WHERE status='confirmed'`) live and verified; `courts.tsx` `handleConfirm` catches SQLSTATE `23P01` (commit `9c746c9`); no test seam for the race itself (documented, acceptable) |
| R3 | **Admin maintenance blockout vs. new booking** — resident cannot book a slot an admin has blocked out, incl. multi-day ranges | GREEN | commit `bc32f5b`; `court_maintenance.end_date` migration live; `courts.spec.ts` schedule-sheet legend tests |
| R4 | **Report an Issue** — 2-step form (category → severity → description → photo), general categories + facility-specific (tennis/pool/gym/general), submit, appears in list, detail view, back-nav | GREEN | `reports.spec.ts` 42/42 incl. end-to-end submit + list refresh + detail; category keys now match the `maintenance_reports_category_check` constraint exactly (commit `18d6036`) — `grounds` → `grounds_landscaping` |
| R5 | **Report category ↔ DB constraint** — every New Report tile writes a `category` the CHECK constraint accepts | GREEN | live constraint = `plumbing, electrical, structural, grounds_landscaping, equipment, safety, other`; `report.tsx` `CATEGORIES` keys identical; `reports.spec.ts:383` ("submit-error … before migration") + `:189` ("Grounds & Landscaping tile present") pass |
| R6 | **Community tab** — HOA name/description hero, announcements (5 latest + "view all"), documents count, contact rows (address/phone/email), "Report an Issue" entry | GREEN | source + live `hoas` / `hoa_announcements` / `hoa_documents` data for The Greens (name, address, phone, email all populated; 1 announcement; 2 resident-visible docs) |
| R7 | **Announcements screen** — list, empty state, survey-results card + "View Results →" | GREEN | `announcements.spec.ts` 6/6; live data (1 announcement + 1 closed community survey) |
| R8 | **Documents** — Supabase-backed list, categories, search, layout | GREEN | `docs.spec.ts` 16/16 (community-mode header selectors fixed in `f4ce454`) |
| R9 | **Me / Settings** — profile hub, Notifications, Privacy, Account (Change Password, Sign Out), Help & Support, Edit Profile (tennis-player fields correctly hidden in Community mode) | GREEN | `profile-settings.spec.ts` 57/57 (stale Tennis-mode assertions flipped to assert absence — commit `931eb50`) |
| R10 | **Home** — greeting, Community-mode quick actions (Reserve / Report Issue), upcoming-reservation card, Community Pulse, upcoming events, maintenance notices | AMBER | screen source is fully `isCommunityMode`-branched and correct; **`home.spec.ts` is stale** (written for Tennis-mode Home — see §5). No Community-mode automated coverage yet; needs device/eyes pass |
| R11 | **Schedule** (resident calendar) — month/week grid, event-type legend + filter chips, Community-mode labels ("Amenity Reservation"), merges `hoa_events` + bookings + blockouts | AMBER | screen source is `isCommunityMode`-aware and correct; **`calendar.spec.ts` is stale** (pre-Community-mode labels/testIDs — see §5). Needs device/eyes pass |
| R12 | **Auth** — email/password login, session gate/redirect | AMBER | login exercised every run via `auth.setup.ts` (real Supabase auth against the test resident account). No standalone spec |
| R13 | **Password reset / change password** — `reset-password/index.tsx` + `confirm.tsx`, `settings-change-password.tsx` | AMBER | unchanged since 2026-07-17 (`0f762de` scanner-safe recovery flow); not touched by any Greens V1 work, no automated coverage, not independently re-verified this pass |

## 2. Admin workflows (Track B — completed & merged before this pass)

| # | Workflow / screen | Status | How verified |
|---|---|---|---|
| A1 | Manage Amenities — full CRUD, enable/disable, `amenity_rules` (hours/duration/window/cancellation/max-per-day/approval), multi-day blockouts, upcoming-reservations, utilization | AMBER | source-verified in prior sessions; `platformAlert` web-dialog fix (`b0ed7eb`); no admin-side automated coverage |
| A2 | Community Detail (Overview / Reports / Amenities / Members) — members search, resend-invite (`invite_reminder` notification), deactivate, report status/notes, message-resident | AMBER | source-verified; `hoa_notifications.type` CHECK now includes `invite_reminder` (migration live) and `report`-cancellation type corrected (`39c897d`) |
| A3 | Portfolio — real Add Community flow (creates `hoas` row + founding-admin membership), admin calendar merges events + bookings + blockouts | GREEN (RLS) / AMBER (UI) | `allow_self_admin_membership_on_community_create` migration live and required for the create flow to succeed under RLS |
| A4 | Multi-HOA admin visibility — an admin approved for 2+ HOAs sees bookings / maintenance / court_maintenance for all of them | GREEN | migrations `fix_multi_hoa_admin_visibility` + `fix_court_maintenance_multi_hoa_admin` (`c190792`) live; verified via rolled-back RLS simulation in prior + this pass |

## 3. Data / security (Track C — completed & merged, all migrations live)

| Migration (live version) | Effect | State |
|---|---|---|
| `20260909012022 greens_v1_enable_btree_gist` | enables `btree_gist` for the exclusion constraint | APPLIED |
| `20260909012026 greens_v1_prevent_double_booking` | `bookings_no_overlapping_confirmed` EXCLUDE constraint | APPLIED |
| `20260909012301 greens_v1_fix_court_maintenance_multi_hoa_admin` | `court_maintenance` admin/resident access via `check_hoa_admin` | APPLIED |
| `20260909014037 greens_v1_allow_self_admin_membership_on_community_create` | lets a community creator insert their own founding-admin membership | APPLIED |
| `20260909014040 greens_v1_add_invite_reminder_notification_type` | adds `invite_reminder` to `hoa_notifications.type` CHECK | APPLIED |
| (prior) `fix_multi_hoa_admin_visibility`, `fix_notification_insert_spoofing`, `amenities_admin_fields`, `membership_removed_status`, `blockout_type` | see `GREENS_V1_CHECKPOINT.md` | APPLIED |

No `supabase db push`; every migration applied individually via `apply_migration` and re-verified against
`pg_constraint` / `information_schema`. No Match v2 migration touched.

**Security advisors (unchanged, pre-existing, out of Greens V1 scope):**
- 1× ERROR `security_definer_view` (×3: `referral_leaderboard`, `public_profiles`, `public_hoa_directory`) — tennis-era legacy views.
- WARN: `auth_leaked_password_protection` disabled, `vulnerable_postgres_version` (15.8.1.106), plus GraphQL table-exposure and mutable-search-path warnings. None introduced by this pass.

## 4. Compile / regression

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 1684 issues on `greens-v1` @ `9c746c9` — **identical** count to `f4ce454` (pre-Track-A). Zero new type errors. (The 1684 is a pre-existing baseline dominated by Deno edge-function globals, `vite.config.ts`, and `@playwright/test` type-resolution noise — not app code.) |
| `courts.tsx` / `report.tsx` (the only source files Track A changed) | compile clean, 0 errors |
| Playwright — resident core (`announcements`, `courts`, `docs`, `reports`, `profile-settings`) | **153 passed / 0 failed** (4.6m) |
| `npm run lint` | not runnable in this environment — `eslint` absent from `node_modules` despite the `package.json` script (pre-existing, flagged in every prior checkpoint) |

## 5. Stale test registry — DO NOT treat these failures as app bugs

| Spec | Classification | Reason |
|---|---|---|
| `home.spec.ts` | **STALE** (not fixed — out of Turbo Track A scope) | Written for Tennis-mode Home: waits on `data-testid="tenisx-logo"` (Community mode renders `community-wordmark`), asserts `menu-icon` (exists nowhere), and asserts Tennis-first content is *absent* — inverted for Community mode. The Home screen itself is fully `isCommunityMode`-branched and healthy. |
| `calendar.spec.ts` | **STALE** (not fixed — out of scope) | Pre-Community-mode event labels ("Amenity Booking", "Board Meeting") and testIDs; the Schedule screen now renders "Amenity Reservation" etc. via `eventTypeLabel()`. Screen is healthy. |
| `navigation.spec.ts` | **STALE / DEAD** | Asserts Tennis-mode tabs (`tab-match`, `tab-coaches`) that are `href:null` in Community mode. |
| `book.spec.ts` | **DEAD ROUTE** | Targets `/(resident)/book`, unreachable legacy code. The live Reserve flow is `courts.tsx`'s inline sheet, covered by `courts.spec.ts`. |
| `me-dashboard.spec.ts` | **STALE** | Gates on `tenisx-logo` + asserts Tennis-mode header (`messages-icon`) / Tennis-content absence. "Me" is covered in Community mode by `profile-settings.spec.ts` (57/57). |
| `global.spec.ts` | **STALE + DEAD ROUTE** | Iterates resident routes incl. `/(resident)/book`, gates each on `tenisx-logo`. |
| `design.spec.ts`, `theme.spec.ts` | **PARTIALLY STALE** | Both still gate some assertions on `tenisx-logo`; not run to completion this pass. |
| `announcements.spec.ts:17` "back button" | weak (passing) | `expect(locator).toBeTruthy()` always passes — asserts nothing. Left as-is (green, non-blocking). |

Repo-wide, the specs still gating on `tenisx-logo` / Tennis-mode tab testIDs are: `book`, `calendar`,
`design`, `global`, `home`, `me-dashboard`, `navigation`, `theme` — the pre-Community-mode generation.
Their failures are selector staleness, **not** app faults (screens were source-verified).

Fixed this pass (were stale, now Community-mode-correct and green): `courts.spec.ts` (`6a257b8`),
`docs.spec.ts` (`f4ce454`), `reports.spec.ts` (`18d6036`), `profile-settings.spec.ts` (`931eb50`).

## 6. Git / release state

- `greens-v1` fast-forwarded to include Track A's 3 commits (`18d6036`, `931eb50`, `9c746c9`) — clean FF, no merge commit, no conflicts.
- All 10 commits ahead of the old `origin/greens-v1` are in-scope Greens V1 work (admin screens, resident `courts.tsx`/`report.tsx`, 5 migrations, 3 test files). **`playwright.config.ts` is not among them** — the worktree-only 8081→8082 port workaround was never committed and is not on the branch.
- `main` = `origin/main` = `c05b941`, 0 ahead / 0 behind. Untouched.
- Worktree `.claude/worktrees/agent-a5ebef6715120d452` (branch `track-a-resident-audit-retry`) is fully merged; safe to remove.

## 7. Launch blockers & risks (ranked)

1. **No real-device / human-eyes QA.** Everything above is "compiles + types + automated web (react-native-web) + live DB + source reads correctly against spec." Nothing has been seen rendered on iOS/Android. Native-only surfaces entirely unverified: push notifications, camera / photo-library picker in Report Issue, haptics, safe-area on notched devices.
2. **Home & Schedule have no Community-mode automated coverage** (their specs are stale — §5). Source is correct; they are the two most likely places for a Community-mode rendering surprise.
3. **Password reset / change-password flow not re-verified** (R13) — unchanged code, but no coverage and security-sensitive.
4. **Real email delivery** (`sendNotificationEmail`: booking confirmations, invite reminders, cancellations) — code paths verified, actual receipt not.
5. **`npm run lint` cannot run** — install `eslint` + peer deps so CI/pre-commit checks are meaningful.
6. Pre-existing security advisors (§3) — decide whether the 3 `SECURITY DEFINER` views and leaked-password protection are in scope for launch or explicitly deferred.

## 8. Recommended next steps (not started — out of this pass's scope)

- Real-device QA pass using the manual sequence in `GREENS_V1_CHECKPOINT.md` §"Exact manual QA sequence".
- Decide: rewrite `home.spec.ts` + `calendar.spec.ts` for Community mode, or delete `book.spec.ts` + `navigation.spec.ts`.
- Code review, UI/design pass, SDK 57 upgrade — still explicitly deferred (the independent `/verify` pass referenced in §9 has now run once).

## 9. Post-`/verify` remediation pass (2026-09-21)

An independent `/verify` session (separate Claude Code session, report not committed) exercised
`greens-v1` @ `0817e53` live in the browser against the real Supabase project and reported 2 P0
security/authorization defects, 2 P1 functional defects, and 3 small verified issues. This pass
reproduced, root-caused, fixed, and live-proved each one. No new Turbo-style feature work; no code
review, redesign, or second `/verify` pass was started, per scope.

### /verify VERIFIED (re-confirms §1 items, no changes needed)
Amenity lifecycle, reservation lifecycle, single-day/all-day blockout, the `bookings_no_overlapping_confirmed`
double-booking constraint (23P01 + `courts.tsx` handler), Report Issue round-trip, resident core screens
with zero Tennis leakage, cross-HOA RLS on `courts`/`bookings`/`court_maintenance`/`hoa_events`, and login/logout
were all independently re-verified live and needed no code change. Multi-day/hourly blockout conflict handling,
membership approval/deactivation, password-reset completion, and native/real-device behavior remain HUMAN QA —
unchanged from §7.

### Fixed and live-proved this pass

| # | Defect | Severity | Root cause | Fix | Proof |
|---|---|---|---|---|---|
| A | `GET /rest/v1/hoas` returned all HOA rows to any authenticated user | P0 security | Stale `"Allow public read access to hoas"` RLS policy (`USING true`, role `public`) OR'd with the two legitimate scoped policies. The sanctioned pre-auth directory already goes through the SECURITY DEFINER `public_hoa_directory` view (bypasses RLS), so this policy had no legitimate caller. | Migration `20260921230632_greens_v1_remove_public_hoas_enumeration` drops the policy. | Live REST proof with the resident test token: 3 rows → 1 row (own HOA only); anon key → 0 rows; legitimate multi-HOA admin (approved admin of 2 HOAs + resident of a 3rd, live-confirmed via `hoa_memberships`) unaffected (still 3 rows). |
| B | Cold load / refresh of `/calendar` (and any `(cm)`/`(admin)` URL) put a plain resident into the Condo Manager / Admin shell | P0 authorization | `(cm)/_layout.tsx` and `(admin)/_layout.tsx` only checked session presence, never role. Role-based routing exists solely in `src/app/index.tsx`'s one-time redirect from the literal `/` route, which a direct deep link or refresh never passes through. | Added a role check (reusing `isCMRoutable()` from `src/lib/roleRouting.ts`, same helper `index.tsx`/`login.tsx` already use) to both `(cm)/_layout.tsx` and `(admin)/_layout.tsx`; unauthorized sessions redirect to `/(resident)`. | Playwright cold-load and hard-refresh of `/calendar` as the resident test account: redirected to resident Home, zero admin chrome (`Portfolio` tab count 0). Admin test account: `/calendar` still renders the CM calendar correctly (regression-safe). Resident's own Schedule tab still reaches `/calendar` with correct resident content (regression-safe). |
| C | Add Amenity wizard (and the existing-amenity edit form) accepted Close ≤ Open, e.g. open 6:00 PM / close 5:00 PM, creating a permanently unbookable amenity | P1 functional | `canAdvance()`/`handleCreate()` in `AddAmenityWizard.tsx` and `saveDetail()` in `manage-amenities.tsx` only checked that both times were *set*, never their order. | Both call sites now require `closeTime > openTime` (safe string comparison — `TimePicker` values are zero-padded `HH:MM`); wizard shows an inline error and disables Next. | Live: Open 6:00 PM / Close 5:00 PM shows "Close time must be after open time," Next stays disabled (screenshotted); correcting Close to 7:00 PM clears the error and re-enables Next. |
| D | Sign In sometimes required two clicks, first producing no auth event | P1 functional | Investigated; one plausible hypothesis (browser-autofill DOM value desyncing from React's controlled `TextInput` state, hitting the silent `if (!email.trim() \|\| !password.trim()) return;` guard in `signIn()`) was built and tested with a Playwright reproduction that mimics that exact desync. It did **not** reproduce. | **No code change** — left as HUMAN QA per the pass instructions ("if not reproducible, leave HUMAN QA"). | N/A — documented as investigated-not-reproduced. |
| E | Admin report-detail note field placeholder said "Internal notes…" though its value (`admin_notes`) is rendered directly to the resident | Small | Stale placeholder text in `(cm)/community/[hoaId].tsx`, predates `admin_notes` becoming resident-visible. | Reworded placeholder to state it's resident-visible. | Live screenshot of the field showing the corrected placeholder. |
| F | Admin Reports (Community Detail) showed the raw category enum (e.g. `equipment`) instead of a friendly label whenever a report had no linked amenity | Small | `(cm)/community/[hoaId].tsx` fell back to raw `r.category`; unlike `(cm)/maintenance.tsx`, it never imported/reimplemented `getCategoryLabel()`. | Added the same `getCategoryLabel()` mapping used in `(cm)/maintenance.tsx` (kept in sync manually — it matches the *live* `maintenance_reports_category_check` values; the shared `src/lib/maintenanceUtils.ts` version uses stale pre-migration keys and would not have fixed this). | Live screenshot: report category now reads "Water & Plumbing" instead of the raw key. |
| G | ~1.1:1 text contrast on Portfolio "My Communities" card titles and Report Detail description | Small | `communityName` (`(cm)/index.tsx`) and `descText` (`(cm)/community/[hoaId].tsx`) both hardcoded `Colors.navy` (`#0F1F3D`, the pre-dark-theme text color) on top of dark surfaces (`Colors.cardBg`/`Colors.pageBg`) — leftover from before this app's dark-first conversion. | Switched both to `Colors.textPrimary` (`#F5F8FF`). Deliberately scoped to only these 2 confirmed spots — other same-class `Colors.navy`-on-dark instances noticed in the same file (`sectionTitle`, `activityText`) were **not** touched; see below. | Live `getComputedStyle` measurement: card title contrast 1.1:1 → 16.33:1. Description block confirmed visually (light text clearly legible on its dark inset box) in the same screenshot that also shows fixes E and F live together. |

### Test artifacts the `/verify` pass left in the live DB — removed

Deleted after confirming each row was self-labeled as test data (e.g. `court_maintenance.description = "/verify QA blockout test — pump repair, safe to delete."`) and scoped to The Greens: the `courts` row "Verify QA Pickleball Court" (`02256ad7…`), its `amenity_rules` row, its `court_maintenance` blockout, its one `bookings` row (already `cancelled`), and one `maintenance_reports` row with description prefixed `VERIFY QA TEST —`. Confirmed zero matching rows remain post-cleanup.

### Regression evidence for this pass

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 1681 error lines before and after C–G's edits (0 new); zero errors attributable to any of the 6 files this pass touched beyond the pre-existing Windows `Card.tsx`/`card.tsx`, `Button.tsx`/`button.tsx`, `Skeleton.tsx`/`skeleton.tsx` casing-collision noise already documented in §4/§6 of `GREENS_V1_CHECKPOINT.md`. |
| Playwright — resident core (`announcements`, `courts`, `docs`, `reports`, `profile-settings`) | **153 passed / 0 failed** (3.8m) — identical to the Turbo Release baseline in §4, confirming no regression from the `(cm)`/`(admin)` layout and Community Detail changes. |
| `main` | untouched, unchanged at `c05b941` — reconfirmed before and after this pass. |

### Noticed but explicitly not fixed this pass (out of scope, flagged for the user)

- `profiles` table: a direct `select id, hoa_id, full_name` as the resident test account returned **every** profile row platform-wide, not just the caller's own. Same *class* of bug as A (an overly-permissive RLS policy), found incidentally while proving A, but **not** one of the `/verify` pass's confirmed defects — not fixed here, per the narrow remediation scope. Flagging for a dedicated look.
- `(cm)/community/[hoaId].tsx`: `sectionTitle` ("Recent Activity" heading) and `activityText` visually exhibit the same `Colors.navy`-on-dark-surface contrast bug as G, but were not in the `/verify` pass's confirmed findings. Left untouched per "minimal token correction, no redesign" / the explicit DEFER list.

### Commits this pass (`0817e53..2728ddf`, 3 commits, pushed)

1. `9d7ed88` fix(security): close hoas RLS enumeration and admin-shell role bypass (A + B)
2. `87243bb` fix(admin): prevent close-before-open amenity hours (C)
3. `2728ddf` fix(admin): correct mislabeled note field, raw category text, and low-contrast text in Community Detail (E + F + G)

## 10. Follow-up: `profiles` cross-HOA enumeration (2026-09-22) — confirmed P0, fixed

The `profiles` leak flagged as "noticed but not fixed" in §9 was investigated as its own scoped
follow-up and **confirmed live**, then fixed. No code review, redesign, SDK 57, or another `/verify`
pass was started.

### Reproduction (before fix)

Authenticated REST query as the resident test account (`28-027@sanignacio.pr`, sole approved
membership: The Greens):

```
GET /rest/v1/profiles?select=id,full_name,hoa_id,phone_number,date_of_birth,gender,zip_code,unit_number
```

Returned **all 7 profile rows in the project**, including `Ramon Dominguez` — admin of a completely
different HOA ("The Fairways") — with his `phone_number`. Anonymous (no token) access returned `[]`
(anon was never the vector). Root cause confirmed via `pg_policy`: `"Discoverable profiles visible to
authenticated users"` (`USING (location_visible = true)`, role `authenticated`, no HOA scoping)
OR'd with the correctly-scoped `"Members can view profiles in same HOA"` policy — and every profile
row in the project has `location_visible = true` (the column's default), so this one permissive
policy alone exposed the whole table to any signed-in user, regardless of HOA. Traced to migration
`20260605235104_profiles_location_visible_select_policy` — a real, intentional feature for Tennis
mode's cross-community "Find a Partner / Find a Coach" discovery (`src/components/locker/
FindPartner.tsx` et al.), which has no HOA concept and was never scoped for one.

### Root cause and fix

A profile should only be reachable through the discovery policy if its owner has **no approved HOA
membership anywhere** — HOA-affiliated users fall back to the existing, already-correctly-scoped
`"Members can view profiles in same HOA"` policy (own profile / same-HOA member / admin of a shared
HOA via `is_in_same_hoa()` / `is_admin_in_same_hoa()`, both pre-existing and untouched). Added
`is_hoa_affiliated(_user_id)` — `SECURITY DEFINER`, matching the existing `check_hoa_admin` /
`is_in_same_hoa` / `is_admin_in_same_hoa` pattern exactly, and for the same reason: `hoa_memberships`'
own RLS (`user_id = auth.uid()` / admin-only) would make a plain inline subquery here invisible for
every user except the caller, silently defeating the check for anyone else's membership — confirmed
this by reading `hoa_memberships`' policies before writing the fix, not assumed. Migration
`20260922000420_greens_v1_scope_discoverable_profiles_to_non_hoa_users` adds the function and
`ALTER POLICY`s the existing policy's `USING` clause to `location_visible = true AND NOT
is_hoa_affiliated(id)`. No recursive RLS (the function queries a different table); no UI-side
filtering involved.

Before applying, inspected every Stage-1 admin/resident screen that queries `profiles` directly
(`(cm)/community/[hoaId].tsx` Members/reporters, `(admin)/pending-requests.tsx`, `(cm)/index.tsx`,
`(resident)/*` own-profile reads) — all are same-HOA or own-profile lookups already covered by
`"Members can view profiles in same HOA"`, independent of the Discoverable policy. One workflow
needed care: `pending-requests.tsx` looks up applicant profiles by `user_id` from
`community_join_requests`, and a pending applicant's `hoa_memberships` row is `status='pending'`, not
`'approved'` — so `is_admin_in_same_hoa()` doesn't cover them either. Confirmed this remains safe: a
pending applicant has no *approved* membership yet, so `is_hoa_affiliated()` is `false` for them and
they stay visible through the (now-scoped) discovery policy exactly as before — this pass didn't
introduce a new dependency here, it just didn't break the pre-existing one.

### Post-fix live proof

Same REST query, resident token, after the migration: **6 rows** — own profile, the one same-HOA
member (`Ron Glickman`, The Greens), and 4 genuinely unaffiliated profiles (no `hoa_memberships` row
at all — confirmed via SQL join before concluding this). `Ramon Dominguez` (Fairways admin) no longer
returned. Anonymous: still `[]`. The legitimate multi-HOA admin test account (`thegreens.tennis@gmail.com`
— approved admin of DBE + The Greens, approved resident of The Fairways, confirmed via
`hoa_memberships`) still sees all 7 rows, unchanged — every one of them is a real membership/admin
relationship for that account, none of it routed through the now-restricted Discoverable policy.
Admin's Community Detail → Members tab for The Greens re-checked live: still renders both members by
name (`Cyrus Josephs`, `Ron Glickman`) correctly. Pending Requests screen still loads with no errors
(no live pending applicant existed to exercise the edge case above, but the query path is unaffected).

### Regression

No application code changed (DB migration only). `npx tsc --noEmit`: 1681 error lines, unchanged.
Playwright `profile-settings` + resident core (`announcements`, `courts`, `docs`, `reports`):
**153 passed / 0 failed**, identical to §9's baseline. `main` reconfirmed untouched at `c05b941`.

### Remaining risk

This is now the platform-wide behavior: any user with **zero** approved HOA memberships anywhere
(a pure Tennis-mode player) is still discoverable to any other authenticated user via
`location_visible`, unchanged from before — that is the intended, unmodified Tennis-mode feature, not
a Greens V1 concern. Whether the discovery feature's *columns* (it still exposes `zip_code`, `gender`,
etc. for non-HOA users, by original design) are appropriate for that audience was not evaluated here —
out of scope for this HOA-tenant-isolation fix.

### Commit

`4498584` `fix(security): scope profiles discovery to non-HOA users, close cross-HOA profile leak` —
pushed to `origin/greens-v1`.

## 11. Post-code-review remediation (2026-09-22)

An independent code review of the full `greens-v1` diff against `main` (73 commits, ~8200 lines,
in-session `general-purpose` reviewer with read-only git + live-Supabase access) found 2 Critical and 5
Important findings plus one security-adjacent Minor. This section fixes all of them. No code review,
SDK 57, redesign, or another `/verify` pass was started; remaining Minor findings from the review were
left untouched per scope.

### C1 — `hoa_memberships` self-escalation to admin — confirmed, fixed

**Reproduced:** as the resident test account, inserted a `pending` membership for an HOA they don't
belong to (DBE), then `UPDATE ... SET role='admin', status='approved'` on it directly via REST —
succeeded. `check_hoa_admin()` for that account against DBE then returned `true`: full admin rights
over courts, bookings, reports, member management, notifications, and (via `is_admin_in_same_hoa()`)
every member's PII. Test row deleted in the same session.

**Root cause:** `hoa_memberships_update_own` (`FOR UPDATE`, `USING (user_id = auth.uid())`, no
`WITH CHECK`) reuses `USING` as the post-update check per Postgres RLS semantics — only `user_id` was
ever protected. A full codebase search found zero legitimate self-update use case for this table (the
only `UPDATE` call site is the admin-gated approve/reject in `pending-requests.tsx`, covered by the
separate, untouched `hoa_memberships_update_admin` policy).

**Fix:** migration `20260922004621` drops `hoa_memberships_update_own` entirely. Self-withdrawal
remains covered by the existing "Users can cancel their own pending requests" `DELETE` policy.

**Proof:** same exploit re-run post-fix → silent no-op (0 rows). Legitimate self-withdrawal (delete own
pending) still works. Legitimate admin approval of a real join request in their own HOA still works.

### C2 — `public_profiles` SECURITY DEFINER view bypass — confirmed, fixed

**Reproduced:** a completely unauthenticated request (no token) to
`GET /rest/v1/public_profiles?select=id,full_name,hoa_id,hoa_role,hoa_status,zip_code,gender` returned
all 7 profiles, including cross-HOA `hoa_id`/`hoa_role`/`hoa_status` and PII — pre-auth.

**Root cause:** `public_profiles` selects from `profiles` with zero row filtering and is `SECURITY
DEFINER`, so RLS on the base table (including §10's `is_hoa_affiliated()` fix) never applied to it;
`SELECT` was granted to both `anon` and `authenticated`.

**Determined unused:** a full codebase search found zero `from('public_profiles')` call sites — the
only hits were generated FK-reference annotations in `src/lib/types.ts`, a type-generator artifact
(Postgres FKs can't target a plain view), not an actual query path. No other view/function depends on
it (checked `pg_depend`).

**Fix:** migration `20260922004730` drops the view outright rather than trying to scope dead surface.

**Proof:** both anonymous and authenticated queries against `public_profiles` now `404` (relation does
not exist). Base `profiles` table's existing HOA scoping unaffected. Supabase security advisor no
longer lists `public_profiles` under `security_definer_view` (count 3 → 2; the 2 remaining —
`public_hoa_directory`, `referral_leaderboard` — are the same pre-existing, out-of-scope findings
already documented in §3).

### I1 — `amenity-book.tsx` wrong double-booking error code — confirmed, fixed

**Reproduced (by code inspection):** `error.code === '23505'` (unique_violation) checked for the
double-booking race, but `bookings` has no unique constraint — only the `bookings_no_overlapping_confirmed`
EXCLUDE constraint, which raises `23P01`. `courts.tsx` was fixed for this in `9c746c9`; this sibling
screen (still routable via `(resident)/book.tsx`, confirmed a live caller — not retired) was never
updated and showed raw constraint text with no slot refresh.

**Fix:** corrected to `'23P01'`, matching `courts.tsx`'s handling exactly (commit `7ac4ec1`, bundled
with I2 — see below).

### I2 — amenity business rules enforced client-side only — confirmed, fixed

**Inventory:** the only `amenity_rules` actually configured by any Greens V1 admin screen
(`AddAmenityWizard.tsx` / `manage-amenities.tsx`) are `booking_start_time`/`end_time`,
`max_duration_minutes`, `advance_booking_days`, `max_reservations_per_day`, `requires_admin_approval`.
`max_reservations_per_week` and the remaining legacy Tennis-mode columns (peak hours, security deposit,
singles/doubles-only, ball machine, lifeguard ack) are schema-present but unconfigured by any Greens V1
UI — **not enforced**, documented rather than invented.

**Reproduced (by code inspection):** neither `courts.tsx` nor `amenity-book.tsx` checked
`requires_admin_approval` or `max_reservations_per_day` at all before inserting; both hardcode
`status: 'confirmed'`. `advance_booking_days` only bounded the date picker UI.

**Fix:** migration `20260922005137` adds a `BEFORE INSERT` trigger (`enforce_amenity_booking_rules`,
`SECURITY DEFINER`) validating all four server-side, forcing `status='pending'` when
`requires_admin_approval` is set. `bookings_status_check` widened to allow `'pending'`
(`my-reservations.tsx`'s `bookingStatus()` already had a display case for it — not a new concept to the
client). Slot-reservation semantics documented and deliberately unchanged: `bookings_no_overlapping_confirmed`
stays scoped to `status='confirmed'` only, so a pending booking does not hold the slot; the first admin
approval (a normal `UPDATE ... status='confirmed'`) wins if two pending requests turn out to overlap,
and the second is rejected by the same constraint at that point. No admin approve/reject UI exists yet
for pending bookings — out of scope, flagged below.

**Caught by testing the positive path, not just the exploit:** the first trigger version used one
blanket `max_duration_minutes` cap and broke every real tennis booking — live data shows "The Greens
Court" has `singles_duration_minutes=90`/`doubles_duration_minutes=90` but `max_duration_minutes=60`,
three different values. Corrected (migration `20260922005928`) to mirror `courts.tsx`'s own
`court_type`-based duration logic exactly.

`courts.tsx`/`amenity-book.tsx` now read back the actual persisted `status` after insert and show a
distinct "pending approval" state instead of claiming "Booked!" when the trigger overrode the request.

**Proof:** live REST + live UI — a `requires_admin_approval` booking persists as `pending` (proven both
via direct REST and by completing the real booking flow through the Reserve sheet, screenshotted).
Advance-window, operating-hours, duration-cap (tennis and non-tennis), and max-reservations/day bypass
attempts all rejected with friendly messages via direct API. Legitimate bookings within all rules still
succeed as `confirmed`. `bookings_no_overlapping_confirmed` (23P01) re-verified firing correctly,
unaffected by the new trigger.

### I3 — `BlockoutSheet` swallowed cancellation failures — confirmed, fixed

**Reproduced (by code inspection):** `handleCancelAndContinue()`'s per-row loop did `if (error) continue;`
with no accumulation, then unconditionally created the blockout and reported success regardless.

**Fix:** commit `ebe8d4b` tracks cancellation and notification failures separately; also checks the
update's returned row count (not just `error`) since an RLS-scoped update matching zero rows returns no
error — the same failure class already fixed elsewhere in this codebase. If any conflicting booking
fails to cancel, the blockout is **not** created (fail-closed — not a single atomic transaction, since
rows already cancelled earlier in the loop stay cancelled, but the blockout itself is never saved over
a still-confirmed reservation), the failed rows are put back in the conflict panel, and the admin sees
an exact failure count. A separate alert covers the blockout-succeeded-but-some-notifications-failed
case.

**Proof:** live, through the actual admin UI — created a real conflicting reservation on Greens Pool,
opened Add Blockout, resolved via Cancel & Continue, and confirmed (via DB) the booking was cancelled
with the correct reason/`cancelled_by`, the notification was created with correct content, and the
blockout was saved with no false-failure or false-success alert. Test artifacts cleaned up after.

### I4 — `hoas` INSERT ownership spoofing — confirmed, fixed

**Reproduced:** the resident test account inserted `{name, admin_id: <admin test account's uid>}` with
`Prefer: return=minimal` — `HTTP 201`, row persisted with `admin_id` set to a different user than the
inserter. (`Prefer: return=representation` was avoided for this reproduction — Postgres applies a
table's `SELECT` RLS policies to an `INSERT ... RETURNING`, and a brand-new `hoas` row isn't
SELECT-visible to *anyone* yet regardless of `admin_id`, which would have produced a generic RLS error
for both the exploit and a legitimate insert alike and masked the actual finding.)

**Root cause:** `"Authenticated users can create communities"` — `WITH CHECK (auth.uid() IS NOT NULL)`
only, no ownership check.

**Fix:** migration `20260922010455` — `WITH CHECK (auth.uid() = admin_id)`.

**Proof:** spoofed insert → `403`. Legitimate self-owned insert (matching `AddCommunityModal.tsx`'s
exact pattern) → `201`, unaffected. Anonymous insert → `401`.

**Discovered, not fixed (separate, pre-existing, out of scope):** the live "Add Community" flow's own
`hoas` insert (`AddCommunityModal.tsx`) uses `.select('id').single()`, which fails for **every** user
today, admin_id spoofed or not — the exact `SELECT`-RLS-on-`RETURNING` behavior above. This is
unrelated to I4 and was present before this fix; flagging for a dedicated look, not addressed here.

### I5 — booking cancellation window bypass — confirmed, fixed

**Reproduced (by code inspection):** `canCancelBooking()` in `my-reservations.tsx` only gates the
Cancel button's visibility; the actual `UPDATE ... status='cancelled' WHERE id=... AND user_id=...` is
permitted by `"Users can cancel their own bookings"` (`USING auth.uid()=user_id`, no time-window
check).

**Fix:** migration `20260922010715` adds a `BEFORE UPDATE` trigger (`enforce_booking_cancellation_window`,
`SECURITY DEFINER`) rather than a tightened RLS policy, so a rejection is a clear, catchable error
instead of a silent zero-rows no-op. Only restricts the *owning* user cancelling their own booking; an
HOA admin cancelling any booking in their own HOA (e.g. `BlockoutSheet`'s conflict resolution) is
explicitly exempted — `"Admins can update bookings in their HOA"` already grants that unrestricted, and
this preserves it exactly rather than inventing a new override. `my-reservations.tsx` now surfaces the
trigger's specific message instead of a generic failure string.

**Proof:** cancelling a real booking ~2 hours before start (24h configured window) → rejected with a
friendly message. Cancelling one ~48 hours out → succeeds. Admin cancelling the same within-window
booking (the override path, exercised the same way `BlockoutSheet` uses it) → still succeeds
unrestricted.

### Security-adjacent Minor — `hoa_notifications` "mark as read" content rewrite — confirmed, fixed

**Reproduced:** against a real notification row for the resident test account,
`PATCH {"title":"SPOOFED TITLE..."}` succeeded pre-fix (title actually changed).

**Root cause:** `"Users can mark own as read"` — same reused-`USING`-as-check gap as C1/I5, on
`hoa_notifications` this time. No separate admin `UPDATE` policy exists on this table to preserve.

**Fix:** migration `20260922010908` adds a `BEFORE UPDATE` trigger
(`prevent_notification_content_changes`) mirroring the existing `prevent_profile_sensitive_changes`
pattern — blocks the mutation outright if `user_id`/`hoa_id`/`type`/`title`/`body`/`metadata`/`created_at`
would change.

**Proof:** title-rewrite attempt on the same real row → rejected (23514, content unchanged).
Legitimate `{"read": true}` → still succeeds. Row's `read` state restored to its original value after.

### Regression / release evidence

| Check | Result |
|---|---|
| Supabase security advisor | `security_definer_view`: 2 (down from 3 pre-§10; `public_profiles` gone, only the pre-existing `public_hoa_directory`/`referral_leaderboard` remain). `function_search_path_mutable`: 10, none of this pass's 4 new functions among them (all correctly set `SET search_path`). New functions (`is_hoa_affiliated`, `enforce_amenity_booking_rules`, `enforce_booking_cancellation_window`, `prevent_notification_content_changes`) join the same pre-existing, already-accepted `SECURITY DEFINER`-executable-by-`anon`/`authenticated` pattern as ~50 existing functions — not a new class of finding. |
| Cross-HOA resident isolation (final re-check) | Resident: `hoas` → 1 row (own only); `profiles` → 6 rows (own + same-HOA + unaffiliated, no cross-HOA). |
| Legitimate multi-HOA admin (final re-check) | Admin (approved admin of 2 HOAs + resident of a 3rd): `hoas` → all 3; `profiles` → all 7 — every row backed by a real membership, none via a leak. |
| Reservation lifecycle, double-booking, requires-admin-approval, booking-limit/advance-window bypass, cancellation cutoff, blockout conflict handling, Add Community | All re-tested live per-finding above (see each section). |
| `npx tsc --noEmit` | 1681, unchanged from §9/§10's baseline. Zero errors in any of this pass's 4 edited files beyond the pre-existing Windows `Card`/`Button`/`Skeleton` casing-collision noise already documented. |
| Playwright — resident core (`announcements`, `courts`, `docs`, `reports`, `profile-settings`) | **153 passed / 0 failed**, identical to every prior baseline in this file — including `courts.spec.ts`'s own live booking-flow test, an incidental additional regression check on I1/I2. |
| `main` | untouched, unchanged at `c05b941` — reconfirmed before and after this pass. |

### Remaining findings from the code review (not addressed — out of this pass's scope)

- **Minor** — `sendMessage()` in Community Detail swallows insert errors with no admin feedback.
- **Minor** — redundant/dead-code-adjacent `hoas` "Users can view their HOA" policy (legacy `profiles.hoa_id`-keyed).
- **Minor** — one migration drops a constraint without `IF EXISTS`, inconsistent with siblings.
- **Minor** — `(resident)/book.tsx` → `/amenity-book` orphaned from the active UI but still routable (I1 fixed its bug; whether to re-wire or retire the screen itself is a separate decision).
- **New, discovered during I4** — the live "Add Community" flow's `hoas` insert fails for every user due to `SELECT`-RLS-on-`RETURNING` — see I4 above.

### Commits this pass (`bb12776..ebe8d4b` on top of §10's `82705a8`, 7 commits, pushed)

1. `bb12776` fix(security): close hoa_memberships self-escalation to admin (C1)
2. `77784f4` fix(security): drop unused public_profiles SECURITY DEFINER view (C2)
3. `7ac4ec1` fix(booking): correct double-booking error code and enforce amenity rules server-side (I1+I2)
4. `9911fd4` fix(security): enforce hoas.admin_id = auth.uid() on create (I4)
5. `d725199` fix(security): enforce booking cancellation window server-side (I5)
6. `0832fdb` fix(security): prevent notification content rewriting via mark-as-read
7. `ebe8d4b` fix(admin): detect and report partial blockout-cancellation failures (I3)

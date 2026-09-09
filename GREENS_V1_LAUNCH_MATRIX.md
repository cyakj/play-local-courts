# The Greens V1 — Launch Readiness Matrix

Branch: `greens-v1` @ `9c746c9` (10 commits ahead of the previous `origin/greens-v1` @ `f4ce454` at the
start of this pass; pushed at the end of it — see §6).
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
- `/verify`, code review, UI/design pass, SDK 57 upgrade — all explicitly deferred.

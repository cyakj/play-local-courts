# TenisX Admin — Next Session Handoff

Checkpoint written at the end of the first Admin-redesign session. Read `ADMIN_REDESIGN_REPORT.md` for the findings and per-requirement status; this file is the "how to resume" guide.

## 0. Where things are

- Repo / worktree: `C:\Users\info\tenisx-admin` (git worktree of `C:\Users\info\tenisx-native`)
- Branch: `admin-redesign`, branched from `greens-iphone-v1-fixes` @ `6b049d6`
- Nothing has been pushed, merged, or deployed. **No migration has been applied to any Supabase project. No database rows were created, changed, or deleted** (all live access was read-only: schema/policy inspection and test-account sign-in for screenshots).
- The main checkout (`C:\Users\info\tenisx-native`, branch `greens-iphone-v1-fixes`) was not modified by this work.
- `node_modules` in the worktree is a junction to the main checkout's; `.env` was copied in (git-ignored). If the junction is missing: `cmd /c mklink /J node_modules C:\Users\info\tenisx-native\node_modules`.
- Uncommitted on purpose: Playwright artifacts (`.playwright/storageState.json` holds a signed-in session token, `test-results/*`). Never commit these.

## 1. Completed and verified

Verified = checked in a real browser at 390px/320px against live data, read-only, and/or by automated tests.

- Admin design system (`src/constants/adminTheme.ts`), shared kit (`src/components/admin/kit.tsx`), forced-light admin shells, compact navy header. Contrast audited programmatically on every redesigned screen.
- Portfolio (counts replace the unreliable health score), community Overview / Reports / Amenities / Members, global Issues (status/category/priority/community filters combine), report detail sheet, Alerts (explicit urgency rules, live-derived so no duplicates), Calendar (month + week, filters, selected-day list, event detail, permission-gated Add Event), Approvals (members + reservation requests), amenity management restyle, accessible approval toggle that persists immediately and rolls back on failure, Add Amenity wizard hardening (no duplicate/orphan amenity, real toggles).
- Native Notifications screen now lists `hoa_notifications` (unread state, allowlisted deep links, mark-all-read). Resident My Reservations / Reservation detail show admin cancellation or decline reasons. Resident screens no longer render `admin_notes`.
- Tests: 31 new Node logic tests; 10 new admin UI tests; full existing suite on this branch: 511 passed, 20 skipped (pre-existing), 0 pre-existing failures.

## 2. Written but NOT verifiable until migrations are applied

These exist as code + SQL only. Treat them as unproven.

- Atomic `admin_create_blockout()` / `admin_blockout_conflicts()` and the "Cancel Reservation & Block Slot" flow in `AmenityScheduleSheet`.
- Server-side reservation notifications (pending / approved / declined / cancelled-by-admin), idempotent via `hoa_notifications.dedupe_key`.
- Report status history, internal vs resident-visible `report_notes`, resident status-change notification with deep link.
- Booking insert isolation (resident must be an approved member of the amenity's community), blockout guard trigger, last-admin / owner-only admin protection, blockout audit trail.
- `supabase/tests/admin_blockouts.sql` (rollback-only verification) has never been run.

## 3. Unfinished from the original Admin redesign

- Recurring blockouts (one-time only today).
- Member role-change UI; invitations beyond the "Remind" notification; no participants on reservations (no table).
- Push notifications (section 6).
- Distinguishing platform-level admin from community-level admin (section 5) — including who may create communities.
- Hidden legacy `src/app/(cm)/messages.tsx` still uses old dark styling (tab is hidden).
- Resident Notifications screen follows the user's saved theme; admin tabs force light. Admin-reached shared screens (Notifications, Settings) are not forced light.
- iPhone verification of everything (checklist in `ADMIN_REDESIGN_REPORT.md`). Not performed.
- Stepper copy "1 days" in amenity rules (pre-existing pluralisation).

## 4. Pending Supabase migrations — NOT APPLIED

Live project in use: **TENISX REAL** (`hqqlrliakttqsbalvuyz`). Live migrations end at `greens_v1_enforce_blockout_conflicts` (20260922024947). Apply with the Supabase MCP `apply_migration`, never `db push`, **in this order**, only with explicit approval:

| # | File | Depends on | Notes |
|---|---|---|---|
| 1 | `20261012190000_greens_v1_booking_approval_workflow.sql` | live schema | Pre-existing from an earlier session; also unapplied. Adds `rejected` status + status-transition trigger. Admin approve/decline UI needs it. Has its own test: `supabase/tests/booking_approval.sql`. |
| 2 | `20261013100000_admin_reports_internal_notes_and_notifications.sql` | #1 (notification type list) | After applying, the *old* admin app can no longer write `admin_notes` (intended). |
| 3 | `20261013110000_admin_blockouts_and_reservation_workflow.sql` | #1 and #2 (`dedupe_key`, `rejected`) | Direct blockout inserts over live reservations will now fail (use the RPC). Re-check `tests/blockout-enforcement.spec.ts`. |
| 4 | `20261013100100_admin_reports_scrub_legacy_admin_notes.sql` | #2 | **Optional / opt-in.** See section 7. |

Validation options (needs your decision; a Supabase branch is a paid resource): (a) Supabase branch, or (b) a rolled-back dry run on live. Then run `supabase/tests/booking_approval.sql` and `supabase/tests/admin_blockouts.sql` (both end in an exception/ROLLBACK by design).

After applying: regenerate `src/lib/types.ts`; replace `@/lib/untypedDb` imports (`AmenityScheduleSheet.tsx`, `ReportsPanel.tsx`) with `supabase`; delete `src/lib/untypedDb.ts`.

## 5. TenisX Platform Admin login & community approval — needs investigation

Not investigated this session beyond reading policies. What is known:

- There is no dedicated "TenisX Platform Admin" UI. `app_role` enum has `admin, resident, coach, platform_reviewer, maintenance_worker, condo_manager`. `src/lib/roleRouting.ts` routes `admin, condo_manager, manager, hoa_manager, board_admin` to the CM/admin shell; `platform_reviewer` is described in `CLAUDE.md` as a superuser above HOAs, with an unreviewed `ReviewerLayout` in `src/components/layouts/`.
- `hoas` INSERT policy is `auth.uid() = admin_id`: **any signed-in user, including a resident, can create a community they administer**; there is no "pending platform approval" state on `hoas` (columns: name, address, admin_id, community_type, logo_url, invite_*). A prior migration (`allow_self_admin_membership_on_community_create`) deliberately allows self-service creation.
- Questions to answer: Who is a Platform Admin and how do they sign in? Should new communities start `pending` and require Platform Admin approval? Which role may see/approve them, across all communities? How is that isolated from community admins? Do existing communities (The Greens, The Fairways, DBE) need a backfilled `approved` status?
- Investigate: `user_roles` rows for the test accounts, `src/components/layouts/ReviewerLayout.tsx`, `src/components/reviewer/`, `src/components/community/AddCommunityFlow.tsx`, `src/components/condo-manager/AddCommunityModal.tsx`, `CommunityCreationForm.tsx`, and `(cm)/index.tsx` Add Community (currently inserts `hoas` + own admin membership, no approval).
- Do not hide or change community creation until this is decided.

## 6. Push notifications — outstanding

In-app records work (once migrations are applied); **push is not implemented**. Needs: `expo-notifications` + `expo-device`, permission + Expo push token registration after sign-in, `device_push_tokens` table with own-rows RLS, an edge function (service role) triggered by a database webhook on `hoa_notifications` INSERT that sends via the Expo Push API and logs receipts (the `dedupe_key` unique index already makes one row = one push), respect notification preferences, EAS `projectId`, APNs key in EAS credentials, and a development/production **build** on a physical iPhone (Expo Go cannot receive production push). Never report push as working from an inserted row alone.

## 7. Admin-notes privacy issue & test-data cleanup

- Root cause: `maintenance_reports.admin_notes` is readable by the reporting resident (RLS is row-level, not column-level) and the resident app used to render it. Fixed in the client (admin UI stopped writing it; resident screens stopped showing it). Server fix is in migration #2 (freezes end-user writes; internal notes live in `report_notes.is_internal = true`, resident-visible updates in `is_internal = false`, which residents can now read).
- Read-only check at end of session: **0 of 81** live reports currently have a non-empty `admin_notes`, so no sensitive text is exposed today; the scrub migration (#4) would currently be a no-op. 77 of 81 reports look like disposable Playwright/test data (descriptions containing "Playwright", "please ignore", "Error state test"; reporter is the test resident).
- Planned cleanup (NOT done, needs explicit approval, never as part of a migration): after migrations are applied and a fresh backup/branch exists, remove only rows created by test accounts whose description matches the test patterns, along with their `report_notes`. List them first (`select id, description, created_at from maintenance_reports where description ilike any (array['%playwright%','%please ignore%','%error state test%'])`) and review. Real reports and reservation history must be preserved.
- The resident-facing notifications and the "Open issues: 75" figure on Portfolio are inflated by this test data.

## 8. Next implementation steps, in priority order

1. Decide the migration validation route; apply #1→#3 on a branch/dry run; run both SQL verification scripts; fix failures.
2. Regenerate types; remove `untypedDb`; re-run full Playwright suite (especially `blockout-enforcement`, reservations, reports, notifications) against the migrated DB.
3. Platform Admin investigation (section 5) and decision on community creation/approval.
4. iPhone verification via Expo Go of all admin screens + resident cancellation/notification flows (checklist in the report).
5. Test-data cleanup (section 7) with approval; decide on migration #4.
6. Push notification implementation and a development build.
7. Member role-change UI, recurring blockouts, retire/restyle the hidden `(cm)/messages.tsx`.

## 9. Commands to resume

```powershell
cd C:\Users\info\tenisx-admin
git status; git log --oneline 6b049d6..HEAD     # expect branch admin-redesign

# Run the app (use a fresh port; do NOT set CI=1, it disables file watching)
npx expo start --port 8082                       # press w for web, or scan the QR in Expo Go

# Type-check (expect ~2,960 pre-existing error lines; only compare changed files)
npx tsc --noEmit -p tsconfig.json

# Node-only logic tests (seconds)
npx playwright test -c playwright.logic.config.ts

# Admin UI tests (read-only; app must be running on 8082)
$env:PLAYWRIGHT_BASE_URL="http://localhost:8082"; npx playwright test -c playwright.admin.config.ts

# Full existing suite (~9 min; uses the live test accounts and writes/cleans its own test rows)
$env:PLAYWRIGHT_BASE_URL="http://localhost:8082"; npx playwright test

# Read-only live inspection (via the Supabase MCP, project hqqlrliakttqsbalvuyz)
#   list_migrations, execute_sql with SELECTs only
```
Sign in for manual checks with the admin test account in `.env` (`TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`) — never print or commit those values.

## 10. Gotchas learned

- The worktree is CRLF-normalised by git; `git add -A` will sweep up `test-results/` and `.playwright/` — add paths explicitly.
- The old `ui/Button` has no `testID`; wrap it in a `View testID` or use `components/admin/kit` `Button`.
- Supabase errors are plain objects: use `errorMessage()` from `src/lib/errors.ts`, not `instanceof Error`.
- `prevent_notification_content_changes` forbids UPDATE of a notification's content; only INSERT notifications.
- Generated types (`src/lib/types.ts`) lag the live schema and the unapplied migrations; that is why `untypedDb` exists.
- Expo Go shows its own floating developer-tools button; it is not part of the app.

# TenisX Admin Redesign — Implementation Report

Branch: `admin-redesign` (worktree `C:\Users\info\tenisx-admin`, branched from `greens-iphone-v1-fixes` @ `6b049d6`).
Nothing was pushed, merged, deployed, or applied to Supabase. Three migrations were **created but not applied**.

## Commits (local)

| Commit | What |
|---|---|
| `91fc488` | Admin light design tokens, shared UI kit, compact header, redesigned Portfolio, forced-light admin shells |
| `d4755d4` | Reports/Issues redesign, report detail sheet, atomic blockout schedule, approval toggle, 3 migrations |
| `e64534e` | Calendar rewrite, Alerts action center, Approvals queue, logic tests, SQL verification script |
| `0c1d1c3` | Contrast fixes (found by programmatic audit), notifications integration, resident cancellation reasons, admin UI spec |
| `0d5b847` | Remove the unused legacy `BlockoutSheet` |

## Status by requirement

**Implemented and tested (browser, read-only against live data, 390px and 320px):**
light-mode admin shell; compact navy header; Portfolio (summary, community cards, Add Community); community Overview / Reports / Amenities / Members; global Issues with combinable filters; report detail sheet; Alerts; Calendar month + week; Approvals queue; amenity list + approval toggle UI; Add Amenity wizard hardening; WCAG text-contrast audit of every redesigned screen; no horizontal overflow; content clears the tab bar.

**Implemented, but depends on migrations that are NOT applied (cannot be exercised end-to-end until they are):**
atomic blockout creation + explicit "Cancel Reservation & Block Slot"; resident cancellation/approval/decline notifications from the database; report status history; internal vs resident-visible report notes; cross-community booking isolation; last-admin protection. The UI degrades with a clear message ("needs the latest database update") instead of failing silently. SQL verification: `supabase/tests/admin_blockouts.sql` (not yet run).

**Implemented, needs iPhone verification:** safe-area handling, keyboard avoidance in sheets, `pageSheet` modals, tap-target feel, Dynamic Type beyond the 150% web check.

**Blocked by configuration / approval:** push notifications (see below); applying migrations; running the SQL verification.

**Not implemented:** recurring blockouts; role-change UI for members; member invitations beyond the reminder notification; participants on reservations (the schema has no participants table); Platform-level vs community-level admin distinction for *creating communities* (see Decisions).

## Findings that changed the design

1. **Floating blue gear.** There is no such component in the app source (searched `src/`; no absolutely-positioned Settings control, no dev-client dependency). It is Expo Go's own developer-tools button and does not exist in a production/TestFlight build. Screens now reserve 112pt of bottom padding so the last row is never under the tab bar or that overlay.
2. **Portfolio health score was `100 − openIssues × 5` per community.** A community with 20 open issues scored 0/100 and the average (67) mixed communities with different meanings of "open". Replaced with factual counts (members, amenities, open issues, pending) and an "All clear / N open / N pending" label. No score is shown until a defensible model exists.
3. **"20 Urgent" was `status === 'open'` on a query capped at `.limit(20)`.** Urgent now means: issue flagged urgent or high priority; booking request starting within 24 h; member request waiting > 72 h. Alerts are derived from live records, so there is nothing to dedupe, and handled items disappear. Read/unread is per device (AsyncStorage).
4. **Residents could read `admin_notes`** (RLS is row-level) and the resident app rendered it. The admin UI no longer writes it; resident screens no longer show it. Internal notes and resident-visible updates now use the existing `report_notes` table (`is_internal`), which previously was admin-only for every row (so "public notes" never reached residents).
5. **The native Notifications screen only showed chat messages.** `hoa_notifications` (booking decisions, report updates, events…) had no UI at all. It now lists them with unread state, a deep-link allowlist, and "Mark all as read".
6. **Pending bookings produced a "Booking confirmed" notification.** Fixed in the migration (type `booking_pending`).
7. **A resident could book an amenity in another community** (`WITH CHECK (auth.uid() = user_id)` only). Fixed in the migration.
8. **A blockout could be created over live reservations; the old sheet cancelled them one at a time client-side** (a failure midway left cancelled reservations and no blockout). Replaced with `admin_create_blockout()` — one transaction, explicit conflict list, required reason, court-row lock to serialise against concurrent bookings, audit trail.
9. **The calendar showed multi-day blockouts only on their first day, used the device timezone for events, and listed every reservation separately.** Rewritten on a pure, tested module (`src/lib/adminCalendar.ts`); all times are community wall-clock (America/Puerto_Rico).
10. **Supabase errors were swallowed** by `e instanceof Error ? … : fallback` (they are plain objects). Shared `errorMessage()` now used.

## Database changes required (migrations created, NOT applied)

Apply in this order with the Supabase MCP `apply_migration` (never `db push`):

1. `20261012190000_greens_v1_booking_approval_workflow.sql` — **pre-existing, also unapplied**. Adds `rejected` status and server-side status transitions. The admin approve/decline UI needs it.
2. `20261013100000_admin_reports_internal_notes_and_notifications.sql` — `hoa_notifications.dedupe_key` + unique index, new notification types, resident read policy for non-internal `report_notes`, `maintenance_report_status_history`, status-change and note triggers, freezes `admin_notes` for end-user writes.
3. `20261013110000_admin_blockouts_and_reservation_workflow.sql` — booking insert RLS (membership required), `court_maintenance` creator/resident message, admin-only `court_maintenance_private`, `court_maintenance_audit`, blockout guard trigger, court-row lock in `enforce_amenity_booking_rules`, booking notification triggers, `admin_blockout_conflicts()`, `admin_create_blockout()`, last-admin / owner-only admin guard.
4. *(opt-in)* `20261013100100_admin_reports_scrub_legacy_admin_notes.sql` — copies legacy `admin_notes` into internal notes, then clears them. Review the rows first (query in the file header).

After applying: regenerate `src/lib/types.ts`, switch `@/lib/untypedDb` call sites back to `supabase`, delete `untypedDb.ts`, and run `supabase/tests/admin_blockouts.sql` on a branch/scratch DB (it always ends in ROLLBACK).

Behavioural notes: once migration 2 is applied the *previously deployed* admin app can no longer write `admin_notes` (by design). Migration 3's guard makes direct inserts of a blockout over a live reservation fail — the old client path and `tests/blockout-enforcement.spec.ts` should be re-checked after applying.

## Push notifications

In-app records are real. **Push is not implemented**: the repo has no `expo-notifications`, no device-token table, and no sender. To finish:

1. `npx expo install expo-notifications expo-device`; request permission and register an Expo push token after sign-in; add `extra.eas.projectId` (already needed for EAS).
2. Migration: `device_push_tokens(user_id, token, platform, created_at, last_seen_at)` with RLS "own rows".
3. Edge function (service role) that, for a new `hoa_notifications` row, sends to the user's tokens via the Expo Push API and records receipts; trigger it with a database webhook on INSERT (the `dedupe_key` unique index already prevents duplicate rows, so one row = one push). Honour `notification preferences`.
4. Apple: APNs key uploaded to EAS credentials; a **development/production build** is required to test on a physical iPhone (Expo Go cannot receive production push).

## Checkpoint note

Development is paused. See `NEXT_SESSION_HANDOFF.md` for the resume guide, the Platform Admin / community-approval investigation, the admin-notes cleanup plan, and prioritised next steps. Read-only check: 0 of 81 live reports have `admin_notes`; 77 of 81 look like disposable test reports (not deleted).

## Decisions I need from you

1. **Who may create communities?** The `hoas` INSERT policy is `auth.uid() = admin_id`, so *any* signed-in user (including a resident) can create a community they administer. A previous migration deliberately allowed self-service creation, so I did not change it. If only portfolio managers (`condo_manager` / `platform_reviewer` in `user_roles`) should, say so and I'll add the policy and hide the button.
2. **Validate the migrations.** Approve either a Supabase branch (billable) or a rolled-back dry run on the live project.
3. **Scrub legacy `admin_notes`?** (optional migration 4)

## Tests

- Logic (Node, no network): `npx playwright test -c playwright.logic.config.ts` — new: 31 tests in `admin-schedule-logic.spec.ts` / `admin-calendar-logic.spec.ts` (slot states, selection, validation, month grid alignment, date math, community-timezone conversion incl. a DST zone, blockout expansion, filters, dedupe).
- Admin UI (browser, read-only): `PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test -c playwright.admin.config.ts` — 10 tests: compact header, no overlap with tab bar, programmatic WCAG contrast on 5 screens, tab navigation, filters and count consistency, calendar date integrity/alignment, urgent-alert semantics, 320px and 390px fit, 150% text scale.
- Database: `supabase/tests/admin_blockouts.sql` — written, **not run** (needs the migrations).
- TypeScript: no new errors in changed files. The repo still reports ~2,960 pre-existing error lines (casing conflicts such as `Button.tsx` vs `button.tsx`, missing `clsx`/`tailwind-merge`, generated-type drift); the codebase is **not** type-clean.

- Full existing suite on this branch (`npx playwright test`, ~9 min, live test accounts): **511 passed, 20 skipped, 0 pre-existing failures**. The one failure and 9 not-run were my new admin UI spec being picked up by the default config (sign-in hook timed out under parallel load); it is now excluded there and passes 10/10 under `playwright.admin.config.ts`. The 20 skips are pre-existing.

## Run it in Expo Go

```powershell
cd C:\Users\info\tenisx-admin
npx expo start --port 8082          # press w for web, or scan the QR code in Expo Go
```
`node_modules` is a junction to the main checkout and `.env` was copied (git-ignored). Sign in as an admin account.

## iPhone checklist (not yet done — no physical device test was performed)

- [ ] Header clears the notch/Dynamic Island; logo not clipped; bell badge readable
- [ ] Tab bar stable; last card on Portfolio / Issues / Alerts fully reachable
- [ ] Open a report → keyboard does not cover Save; discard prompt appears with unsaved edits
- [ ] Amenity → Requires admin approval toggles and survives reopening the screen
- [ ] Schedule: slots tappable, selection → form → review; with migrations applied, the cancel-and-block confirmation lists every affected resident
- [ ] Calendar month/week swipe-free navigation, Add event sheet scrolls above keyboard
- [ ] Settings → Text size larger: no overlap on Portfolio, Alerts, Calendar
- [ ] Resident account: sees cancellation reason on My Reservations and a notification in Notifications

## Continuation (next session)

1. Get the migration decision above, apply 1→3 on a branch, run `admin_blockouts.sql`, fix whatever fails.
2. Regenerate types; remove `untypedDb`.
3. Re-run `tests/blockout-enforcement.spec.ts` and the resident booking specs against the migrated DB.
4. Push notification build (section above).
5. Optional: member role-change UI, recurring blockouts, legacy `(cm)/messages.tsx` (hidden tab) still uses the old dark styling.

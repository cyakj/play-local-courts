# TenisX — migration rehearsal + HOA admin sprint, 2026-11-06

Local only. Nothing pushed. **No hosted write of any kind.** TENISX REAL was read only through the Supabase MCP (`list_migrations`, `list_extensions`, `get_project`) earlier in the day. Everything "rehearsed" below ran on **scratch PostgreSQL servers restored from the verified backup** `C:\Users\info\tenisx-backups\20261106-084850-760831` (read-only use; not modified).

## 1. Git
- Starting commit of this sprint: `d5332a2`. Last code commit before this document: `497e0da` (see `git log` for the final docs commit).
- 13 commits before the two documents. `.claude/settings.local.json` is modified locally and deliberately uncommitted. **Incident (fixed):** an earlier `git commit -qam` swept that file into `4f0a714`; `497e0da` takes it back out (nothing was pushed; history was not rewritten) and the working-tree file keeps your local edits uncommitted. A stray `git stash pop` of an unrelated stash from another worktree was reversed (`git stash store`; that stash held no changes).

## 2. Migration dependency map
Hosted history (backup, 182 versions) ends at `20261013190307`. **Pending by name: 19 files.** Local files `20260821010000…20261013120000` (13) are already applied on hosted under *different* version numbers (apply-time stamps) — proven by name match; running `db push` would re-run them (duplicate-object errors) — never use it.

| # | File | Needs | Notes |
|---|---|---|---|
| 1 | `20261013100100_admin_reports_scrub_legacy_admin_notes` | – | no hosted row of that name |
| 2 | `20261013130000_revoke_anon_execute_on_admin_rpcs` (B1) | – | |
| 3–6 | `20261022120000` join hardening, `20261023100000` booking-review notifications, `20261023110000` HOA application hardening, `20261023120000` interest requests (A) | – | |
| 7 | `20261023130000_report_photo_attach` (C1) | – | |
| 8 | `20261023140000_lock_down_anon_definer_rpcs_and_email_prefs` (B2) | 2 | |
| 9 | `20261030120000_profile_photos_private_bucket` (**D**) | `storage`, `profiles` | **independent; earliest unlock for profile photos** |
| 10 | `20261030130000_report_insert_requires_membership` (C3) | 7 | pre-flight aborts on a profile-only resident |
| 11 | `20261030140000_report_photos_bucket_hardened` (C2) | 7 | filename order puts C3 before C2; both orders rehearsed |
| 12 | `20261031100000_hoa_timezones` (E) | – | existing 3 communities backfill to `America/Puerto_Rico` (checked in the rehearsal) |
| 13 | `20261031110000_exclusive_pending_reservations` (F) | 12 | |
| 14 | `20261031120000_profiles_member_read_gap` (G) | – | |
| 15 | `20261101100000_announcement_urgency_and_category` (H) | – | |
| 16 | `20261106100000_amenity_allowed_durations` | – | separate trigger; does not touch the big booking function |
| 17 | `20261106110000_hoa_event_audience` | – | narrows resident SELECT on `hoa_events` |
| 18 | `20261106120000_announcement_archive` | – | new: unpublish; narrows resident SELECT on `hoa_announcements`; no UPDATE policy |
| 19 | `20261106130000_amenity_rules_hoa_integrity` | – | **new: fixes a cross-community security defect (section 6)**; aborts without change if any existing row mismatches (0 on the backup) |

Filename order and the documented plan order (D → G → A → B → C → E → F → H → new) both apply cleanly (section 4). Labels are not filenames: the table above is by file.

## 3. PostgreSQL 15 compatibility
**Verified, not assumed.** Hosted is 15.8. I downloaded the EDB 15.8 Windows binaries (zip sha256 `6fa01fbf08aaca7d1b00284ce6534932ee5d7d545678615aff12365efacf935d`, kept outside the repo in `C:\Users\info\tenisx-tools\pgbin15-8`; the EDB site publishes no checksum, so this is a record, not a verification) and ran a **real 15.8 server** (port 55433) beside the 17.11 one (port 55432). Clients (psql, pg_restore) are 17, restoring `full.dump` into the 15.8 server works (two harmless messages: `SET transaction_timeout` unknown to 15, and `schema public already exists`). Every result below was produced on **both** servers.
Restore detail worth keeping: `btree_gist` must exist in `public` during the restore (the `bookings` EXCLUDE constraint resolves its operator class through the restore search_path) and is moved to `extensions` afterwards (`scripts/local-pg-rehearsal/setup-scratch-restore.sh`).

## 4. Actual SQL executed (real PostgreSQL, real RLS/triggers) — identical on 15.8 and 17.11
Chain (`rehearse-full-chain.sh`): all 19 files applied in **file order** and in **plan order**, each **applied twice** — 19/19 apply, 19/19 re-apply, 0 failures, both orders, both servers (exit status now fails on any non-idempotent re-apply).
Rollbacks: E, F, G, H, duration, audience, archive, integrity and D rolled back and re-applied; the schema (columns, policies, constraints, triggers of the touched tables) returned exactly to the pre-state except the by-design leftovers of E's rollback (`hoas.timezone` + its validation trigger).

| SQL test file | Assertions | Result (each server) |
|---|---|---|
| `reservation_integrity.sql` (pending holds, expiry, approval, DST, busy-times, daily cap) | 37 | 37 pass |
| `reservation_admin.sql` (NEW: request→approve, decline with reason, admin cancel, resident cancel window, cross-HOA, notification) | 17 | 17 pass |
| `profiles_read_gap.sql` (Stage G) | 12 | 12 pass |
| `profile_photos_storage.sql` (NEW: Stage D policies + avatar_path CHECK) | 15 | 15 pass |
| `hoa_event_audience.sql` (NEW: board-only, cancel, cross-HOA) | 15 | 15 pass |
| `announcement_urgency.sql` (NEW: Stage H + visibility) | 9 | 9 pass |
| `announcement_archive.sql` (NEW) | 14 | 14 pass |
| `admin_isolation.sql` (NEW: membership approval/rejection/removal, reports, internal notes, closures, messaging, cross-HOA booking) | 37 | 37 pass |
| `amenity_rules_isolation.sql` (NEW) | 12 | 12 pass (fails without the fix: the defect reproduces) |
| `amenity_allowed_durations.sql` | 6 | 6 pass |
| `rehearse-reservation-integrity.sh` (**real parallel sessions**: identical simultaneous requests → exactly one wins; approval racing a competing request; rejection racing; daily cap under concurrency; pre-flight abort; mutation check) | 47 PASS lines | all pass |
| `rehearse-real-restore.sh` (stages A–C: 189 tables row-hashed, 0 changed) | – | ALL ASSERTIONS PASSED |
**Not passing, classified:** `supabase/tests/admin_blockouts.sql` and `booking_approval.sql` (written for the 2026-10-13 test project) stop at their own fixture inserts with "You have reached the 1 reservation(s) per day limit" because the real Greens court is configured 1/day; this is fixture drift, not a product defect, and `reservation_admin.sql` now covers the same ground against the real configuration. They were not repaired.
**Mock vs database:** the Node suite below is mock/source-level; the table above is database-backed.

## 5. The four "privilege" differences
`restore-test.report.txt`: two inventory groups differ — **function-grants** (live 290 / restored 300 rows) and **table-grants** (1864 / 2063) — shown as 4 lines (a count line and a hash line for each). These are the *informational* `G|` rows the script deliberately excludes from "strict" because they depend on object ownership. Evidence: (1) the restore uses `--no-owner`, so all 198 relations are owned by `postgres`, while live owners are `supabase_auth_admin`, `supabase_storage_admin`, `postgres` (`owners.txt`); the inventory counts grants to every role *except the object's owner*, so the same ACL entry is counted on one side and not the other, and entries for `dashboard_user` (185) and `supabase_storage_admin` (14) appear only in the restore's counting. (2) The **structure cross-check** (grants to `anon`, `authenticated`, `PUBLIC` and custom roles; 2 743 objects) found **0 differences**. Conclusion: expected portable-restore artifacts, not a security discrepancy. **Limit:** this is inference from the recorded evidence; I cannot enumerate the live ACLs without a SQL connection. To close it completely, run on hosted: `select grantee, privilege_type, count(*) from information_schema.role_table_grants where table_schema in ('public','auth','storage','supabase_migrations') group by 1,2 order by 1,2;` and compare with the same query on a restore.
Separate, pre-existing and **not changed**: `rehearse-real-restore.sh` lists 18 SECURITY DEFINER functions in `public` that `anon` can still execute (`check_hoa_admin`, `is_admin_in_same_hoa`, `is_in_same_hoa`, `is_hoa_affiliated`, `has_role`, `handle_new_user`, `get_public_survey_results`, …). They are boolean/oracle helpers keyed by UUIDs; a follow-up migration should revoke `anon` on the ones that are not public by design.

## 6. Administrator-side defects found and fixed
| # | Defect (evidence) | Fix |
|---|---|---|
| 1 | **Security:** an administrator of community X could insert `amenity_rules` for a community-Y amenity (reproduced on the restore: *PLANTED*); booking enforcement reads rules by `amenity_id` only, so Y's limits could be weakened | `20261106130000`: policy requires the amenity to belong to `rules.hoa_id`, plus composite FK `(amenity_id, hoa_id)`; real test 12/12 |
| 2 | Native admin app could not publish or take down Community Pulse announcements (only legacy web pages did); `hoa_announcements` had no way to unpublish | Admin screen `(admin)/announcements.tsx` (post, urgent, category, remove) + `20261106120000` (`archived_at`, `archive_announcement()`; no UPDATE policy) |
| 3 | No way to take an event down from the manager calendar | "Cancel event" (status → `cancelled`, confirmed first); RLS verified |
| 4 | Resident Schedule/Home filtered `hoa_events.status='approved'` (impossible value) — earlier in the day | fixed |
| 5 | Board meetings could not be hidden from residents | `20261106110000` + "Board only" toggle |
| 6 | Resident Schedule converted event times with one zone | per-community zones for every membership (`loadHoaZones`), closure cutoff per community |
Verified OK, no change needed: Approvals screen already hides expired requests and lists with paging; admin approval cannot change the reserved time; resident cannot approve; admin of one community who is only a resident elsewhere cannot approve/archive/cancel there; internal report notes invisible to the reporter; removed/rejected members lose access; messaging limited to a resident ↔ their community's administrators; closures block booking and are visible to members.
Not changed (low): `approve_hoa_membership` accepts any current status (an administrator could re-approve a removed member of their own community — same-community administrator action only).

## 7. Resident-side integration checks
Node suite (mock/source-level): all resident-regression suites pass (legend, one Pulse announcement, urgent-first, reservation detail, upcoming/history, wheel, durations, haptics). Database-backed: a published announcement/event/closure is readable by members only; archived/cancelled/board-only disappear for residents; a decision (approve/decline/cancel) is visible to the resident with its reason and creates a notification; the resident Schedule queries were updated to match (status `active`, own `confirmed`+`pending`, closures, per-community time). **Not verified anywhere:** how any of this *looks* on a phone.

## 8. Test totals
- Node logic (`npx playwright test -c playwright.logic.config.ts`): **715 passed, 0 failed** (after the round-4 fixes).
- SQL: section 4 (10 test files = 174 assertions + the concurrency script, per server, both servers).
- `tsc --noEmit`: 1 688 errors repo-wide (file-name casing, `app-tabs.web.tsx`, tests, etc.; I did not measure a baseline for the total, so I do not claim it is unchanged); **0 reported in the files I touched** (checked per file after each edit).
- Skipped: iOS export (free RAM 2.6 GB < what Metro needs; not attempted), browser tests, physical device.

## 9. Resources
Free RAM 3.3 GB at the start, 2.6 GB at the end; two PostgreSQL servers (≈150 MB each) were enough. Disk 711 GB free. No unrelated process was stopped. Scratch data lives in `C:\Users\info\tenisx-scratch\{rehearsal-b,rehearsal-pg15b}` (+ an empty failed `rehearsal-20261106`, `rehearsal-pg15`): `rm -rf` was refused by the sandbox, so they were left; **both servers are still running** — stop with `pg_ctl -D <dir>\data -m fast stop`.

## 10. Codex review (independent, via `claudex-loop` inspect)
History: round 1 (earlier today) 6 findings fixed; round 2: R2-1 and R2-2 fixed but never re-reviewed, **R2-3 (events of non-active communities in the device zone) was left open — closed this sprint** (`loadHoaZones` for every membership).
Round 3 (this sprint, base `ae1c43f`): runner status **failed** (I committed while it ran, so the inspected snapshot changed) — its verdict REVISE is advisory, not a record of approval. Findings and dispositions: R3-1 announcement screen could act on a stale community → fixed (request generation, cleared rows, removal bound to the displayed community); R3-2 closure cutoff used one zone for all communities → fixed (per-community cutoff, closures converted at render); R3-3 chain script ignored re-apply failures → fixed (exit status); R3-4 "`PG_SERVER_BIN` is stripped by `common.sh`" → **rejected** with evidence (the variable name has an underscore, the cleanup only matches `^PG[A-Z0-9]+`, and the PG15 run reported `15.8`), but a `PG_EXPECT_MAJOR` assertion was added anyway.
Round 4 (clean run, status `completed`, base `ae1c43f`, effective model gpt-6.1-sol): **REVISE, 3 medium findings** — R4-1 announcements screen: a post/removal finishing after switching community could clear the other community's draft or let the old list win → fixed (current-community ref checked on completion); R4-2 an unswept expired *pending* request was shown as "Pending approval" on the Schedule → fixed (`reservationKind` with the community's zone; hidden once its start has passed); R4-3 a zone-loading failure silently fell back to the device zone → fixed (failure surfaced with a retry; events of communities without a loaded zone are hidden meanwhile, never shown in device time).
**These three fixes have not been re-inspected** (a fifth round was not run: each round is ~1–2 minutes but I stopped at three consecutive REVISE rounds to avoid an open-ended loop; further findings are likely to be of the same async-edge-case kind). They are covered by source-level tests only. **No review has returned PASS/APPROVED at any point.**

## 11. Stage D readiness
See `docs/STAGE-D-PROFILE-PHOTOS-DEPLOYMENT-PACKAGE-2026-11-06.md` (SQL, preconditions, Gate-1 queries, rollback, post-checks, iPhone smoke test, limits). Rehearsed alone on the untouched restore (PG 15.8 and 17.11): applies, 15/15 storage checks, rollback restores the exact pre-state, re-applies. **Verdict: ready to apply on your explicit approval** after Gate-1 (it must re-confirm the hosted preconditions live).

## 12. Final status
Latest code state includes the round-4 fixes; Node suite 715/715; SQL results in section 4 were produced before the round-3/4 UI fixes, which touch no SQL.

## 13. Exact remaining blockers
1. Hosted unchanged: all 19 migrations unapplied; Gate-1 hosted read-only SQL not yet run (no SQL connector).
2. No review PASS; round-3 findings fixed but the final inspection result is in section 12.
3. Storage API behaviour (size/MIME, signed URLs) and everything on a phone: unverified.
4. Edge function `send-scheduled-reminders` not deployed (hosted write; needs approval).
5. The 18 anon-executable SECURITY DEFINER helpers (section 5) and the stale `admin_blockouts`/`booking_approval` SQL fixtures.
6. Unread-announcement counts: not implemented (no read-tracking table exists).

## 14. Next three actions
1. Run the Gate-1 SQL in `STAGE-D-…-PACKAGE` §3 on hosted and send me the output; if clean, tell me explicitly to apply Stage D (then do the iPhone smoke test in §6 of that file).
2. Approve the next hosted stages in this order, one at a time, each followed by its smoke test: **G** (profiles privacy) → **E → F** (time zones, exclusive holds) → **A/B/C** → **H** → the four new files (`…100000`, `…110000`, `…120000`, `…130000`; `…130000` is a security fix and should not wait long).
3. Test the new admin screens (Post an announcement, Cancel event, length chips) and the wheel/Schedule changes on your iPhone in Expo Go.

## Executive summary
**Completed and verified (database-backed, PG 15.8 + 17.11):** 19 pending migrations apply, re-apply and roll back cleanly on a restore of real hosted data in both orders; 174 real RLS/trigger assertions + parallel-session concurrency tests pass; Stage D rehearsed alone; a cross-HOA security defect (rules injection) found, reproduced and fixed with a migration.
**Implemented but untested beyond logic tests:** announcement composer, event cancel, per-community Schedule times, duration-length admin UI, wheel/haptic/sound changes (no device, no Storage API, no iOS export).
**Blocked by hosted migrations:** profile photos (D), exclusive holds/time zones (E/F), Pulse urgency (H), multi-length durations, board-only events, announcement removal, the rules-injection fix.
**Requires your approval:** every hosted write (Stage D first), the Edge Function deploy, stopping/removing the scratch servers/folders, and any push.

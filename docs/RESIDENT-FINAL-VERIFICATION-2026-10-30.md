# Resident sprint - final verification (2026-10-30)

Branch `v1/overnight-integration`. Nothing pushed, nothing applied to hosted (TENISX REAL `hqqlrliakttqsbalvuyz`). Hosted was only read (migration list).

## 1. Two-account isolation test
`tests/account-switch.spec.ts` PASSED on re-run (2/2 incl. auth setup, 2.3 min, hosted read-only). An earlier run at 14:53 FAILED once: after sign-out, `/community` stayed reachable instead of redirecting to `/login` (log: that run's `test-results` context). It did not reproduce and the cause was not isolated (a stale process already held port 8081 on both runs). Treat as an unexplained flake: re-run it in the browser checklist (item 2).

## 2. Codex inspections
- d39d9b0 (fresh session): Retry-refetches-contacts CORRECT; Tennis-mode calendar guard CORRECT; RPC bypass warning CORRECT but incomplete.
- New findings from that review, all fixed in the migration below: RPC accepted a foreign-community amenity; RPC authorised via `profiles.hoa_id` without an approved membership; caller-chosen initial status.
- Open, NOT fixed (outside the migration, user decision): calendar with zero approved memberships returns early so Tennis matches/lessons are not fetched (calendar.tsx ~152); `workstream-d-logic` tests assert source text, not behaviour; legacy `MultiStepReportDialog` still calls the RPC (so it was replaced, not revoked).
- Migration review rounds: round 1 found 5 (status bypass on direct insert, profile-only residents locked out, vacuous skips, missing UPDATE/DELETE photo assertions, non-rerunnable photo migration) - all fixed. Round 2: all confirmed resolved; 1 harness defect (mutation check accepted any failure) - fixed and re-run. Codex inspection budget (2 rounds) is now used for these files; the last harness fix was verified by running it, not by Codex.

## 3. create_maintenance_report() vulnerability
SECURITY DEFINER, executable by `authenticated`, bypasses the INSERT policy. Gaps: foreign amenity, profile-only authorisation, caller-controlled `status`. Fix = `CREATE OR REPLACE` in `20261030130000` (same signature; `_status` now ignored; approved-membership only; amenity must belong to community; grants restated, anon stays revoked). Policy also now requires `status = 'open'`.
Behaviour change: anyone relying on the `profiles.hoa_id` fallback loses reporting. Restore of the 2026-10-29 backup has 0 such users; the migration has a pre-flight that aborts if any exist on the target.

## 4. Rehearsal (isolated, local PG17 scratch, copy of the real-backup restore; hosted never contacted)
`scripts/local-pg-rehearsal/rehearse-resident-migrations.sh 55432 rehearsal_res1 restore_test`: all 9 migrations applied in order; M8 (photos) and M9 (reports) behavioural assertions PASS; both re-apply cleanly; pre-flight refuses with an approved profile-only user; mutation runs without either migration are CAUGHT with the expected FAIL line. The original 7-migration harness (`rehearse-real-restore.sh`) still passes. Limits: PG17 vs hosted PG15; storage/auth are the restore's, not live Supabase services; storage raw DELETE needed `storage.allow_delete_query`.

## 5. Pending migration inventory (hosted last applied: 20261013190307 platform_approval_and_secure_messaging)
Order to apply (all depend on the previous being applied; none applied):
1. 20261013130000 revoke_anon_execute_on_admin_rpcs - state-redundant with #7; harmless. Security: closes anon on admin RPCs.
2. 20261022120000 resident_join_flow_hardening - removes resident write policies; adds withdraw/invite/join RPCs. Needed by #5.
3. 20261023100000 admin_booking_review_notifications - constraint + trigger.
4. 20261023110000 hoa_application_hardening - guard trigger, partial unique index (duplicate applications must not exist; rehearsed).
5. 20261023120000 community_interest_requests - new table (depends on #2).
6. 20261023130000 report_photo_attach - `attach_report_photo` RPC; NEEDS bucket `report-photos`, which is MISSING on hosted (runbook 3b decision) - function works but photos cannot be stored until the bucket exists.
7. 20261023140000 lock_down_anon_definer_rpcs_and_email_prefs - revokes anon on ~40 definer RPCs, rewrites email-preference RPCs. Highest blast radius: verify the app's logged-out screens do not call a revoked RPC.
8. 20261030120000 profile_photos_private_bucket - new private bucket + `profiles.avatar_path`. Required for V1-005.
9. 20261030130000 report_insert_requires_membership - policy + RPC replacement above. Not required for any feature; closes the security gap. Pre-flight aborts on profile-only residents.
Not in the list, decision needed: `20261013100100_admin_reports_scrub_legacy_admin_notes` is OPT-IN data migration (moves legacy admin_notes out of resident-readable column); not rehearsed here; do not apply without reviewing the rows.
History caveat: hosted records versions 20261013181317 / 181335 / 181649 / 190307 for files named 20261012190000 / 20261013100000 / 110000 / 120000. A blind `supabase db push` will try to re-apply them. Apply by explicit SQL + manual history rows, or repair history first.

## 6. The 13 Resident issues (V1-001..013) - status
The original issue text is not in the repo; titles are taken from the workstream test headers, so the mapping is inferred. "Verified" here means: code + 421 Node logic tests pass + Codex inspected. NO issue has been verified on a device, and browser acceptance by the user is still pending.
- Verified (code/tests/Codex): V1-001 header branding, V1-004 schedule title scrolls, V1-010 account menu, V1-011 sheet layout, V1-012 unavailable slots, V1-013 sign out (plus account-switch test passed once, flaked once).
- Partially verified: V1-002/003 report + docs routes (routes verified; report photo attach blocked until `report-photos` bucket exists; legal doc URLs unpublished), V1-006 messaging scope (HOA-message emails not wired), V1-007 privacy (legal URLs unpublished), V1-008 notifications (`update_email_preference` body not in any migration), V1-009 account (deletion is a support request only).
- Blocked: V1-005 profile photos (needs migration #8 on hosted; cannot be verified end to end until then).

## 7. Other checks
Node logic suite: 421 passed. `tsc --noEmit` is NOT a usable gate: ~1,690 errors, mostly legacy vite/skills folders (1,548 under src/ not triaged against a baseline).

## 8. GO / NO-GO
NO-GO for applying today. GO for a staged apply once the conditions below are met:
- Fresh backup taken and restore-verified immediately before (the last is 2026-10-29).
- Rehearse #8 and #9 against a restore of that fresh backup (done here only on the 10-29 restore).
- Decide report-photos bucket and the profile-only-resident count on hosted (pre-flight covers this).
- Confirm logged-out screens do not use RPCs revoked by #7.
- Resolve the migration-history mismatch method.
- Browser acceptance checklist passed on the current build.
Recommended order: 2, 3, 4, 5, 7 (verify), 1, 6 (+ bucket), 8, 9, with a smoke test after each batch.

## 9. Browser acceptance checklist (resident account, hosted read-only unless noted)
1. Sign in; header shows TenisX branding and avatar (V1-001, 010). Open account menu: name, community, role.
2. Sign out via menu -> lands on login; open `/community` directly -> redirected to login. Sign in as admin: no resident name anywhere (V1-013, isolation flake).
3. Home/Schedule: scroll - title and month subtitle scroll with the page (V1-004).
4. Courts: open reservation sheet - layout fits, unavailable slots visible but disabled (V1-011, 012).
5. Report: open from Home, from a court card, from Community; community switch mid-form clears the form; submit (use a test community only; this writes) (V1-002).
6. Docs: opens from the Community tab (V1-003); legal links noted as unpublished.
7. Settings: privacy, notifications, account pages load; deletion shows support-request path; unsaved-changes prompt works (V1-007/008/009).
8. Messages: contact list; force an error (offline) and tap Retry - list reloads (V1-006).
9. Calendar in Community mode shows only the active community.
10. After migrations only: upload a profile photo (V1-005); report a foreign-community amenity via API must fail.

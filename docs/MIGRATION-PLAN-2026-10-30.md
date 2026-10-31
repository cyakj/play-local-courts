# TENISX REAL - staged migration plan (prepared 2026-10-30, NOT executed)

Nothing here has been applied. Hosted (`hqqlrliakttqsbalvuyz`) was only read: migration list. All SQL checks ran on a local
PG17 scratch server against a restore of the 2026-10-29 backup (`C:\Users\info\tenisx-backups\20261029-235117-04c5d3`).

## 0. Prerequisite that is still open: a FRESH backup
`scripts\hosted-backup\backup.ps1` needs the database password typed hidden. It was not available to the assistant, so no fresh
backup or restore exists yet. Every "rehearsed" claim below is against the 10-29 restore and MUST be repeated on the fresh one:
```
powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\backup.ps1        (new PowerShell window)
powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\verify-restore.ps1 -BackupDir <new folder>
bash scripts/local-pg-rehearsal/rehearse-real-restore.sh      <port> restore_test rehearsal_a
bash scripts/local-pg-rehearsal/rehearse-resident-migrations.sh <port> rehearsal_b restore_test
```
(The first script prints the exact names/ports it uses; adjust the last two to match.)

## 1. Migration history vs local filenames (resolved by analysis; hosted history untouched)
Of 180 local files, those dated 2026-05-29 or later compare to the hosted history (59 entries since 2026-06-05) as:
- 16 identical version: nothing to do.
- 34 same NAME, different VERSION (e.g. local `20261012190000_greens_v1_booking_approval_workflow` = hosted `20261013181317`).
  Compared by CONTENT: hosted records the SQL it ran (`supabase_migrations.schema_migrations.statements`); after stripping comments and
  whitespace, 48 of the 51 matched pairs (including every Stage 1 file) are identical. The 3 that differ are Stage 2 only
  (`coach_schedule_control_panel`, `open_match_listings`, `tennis_facilities`), so they cannot affect V1. 16 hosted entries have no local
  file at all (applied directly; informational). Treat the 34 as already applied. A blind `supabase db push` would try to re-apply them: **do not use db push**.
- 21 with no hosted counterpart by name: 10 are the pending set below; 11 are older Stage 2 coach/lesson/match files. Their EFFECTS were
  probed on the restore: `message_email_throttle`, `lesson_packages`, `lesson_requests.package_id`, coach location columns and the
  corrected report category constraint are present. Absent: bucket `report-photos` and function `expire_past_lesson_requests()`
  (Stage 2, hidden). So those 11 need no action for V1.
Also `20261013100100_admin_reports_scrub_legacy_admin_notes` is an opt-in data move and `20260529120441_report_photos_bucket` is
SUPERSEDED (unsafe: any user can upload to any folder). Neither is in the plan.
Recommended: apply by reviewed SQL, one file at a time, then insert one history row per applied file (version = local filename
version, name = file name). Optionally align the 34 mismatched hosted versions later (that edits hosted history: needs approval).

## 2. The ten pending migrations, in staged order (each stage ends with a smoke test; stop on any failure)
Stage A - additive / structural
1. 20261022120000 resident_join_flow_hardening (drops resident write policies; adds withdraw/invite/join RPCs)
2. 20261023100000 admin_booking_review_notifications
3. 20261023110000 hoa_application_hardening (fails loudly if duplicate pending applications exist)
4. 20261023120000 community_interest_requests (depends on stage A item 1)
   Smoke: resident login, join/withdraw flow screens load, admin booking review loads.
Stage B - security lockdown (largest blast radius)
5. 20261013130000 revoke_anon_execute_on_admin_rpcs
6. 20261023140000 lock_down_anon_definer_rpcs_and_email_prefs
   Verified: 51 functions end up closed to anon; the only policy that references one (`can_send_message`) is authenticated-only; no
   view or column default references one; no app code path that runs logged-out calls one (callers all require a session; the public
   invite and survey RPCs are not in the list). Smoke: logged-out login + signup + invite page load; logged-in booking, notifications,
   email preference save.
Stage C - reports
7. 20261023130000 report_photo_attach
8. 20261030140000 report_photos_bucket_hardened (NEW; creates the missing bucket safely)
9. 20261030130000 report_insert_requires_membership (policy + create_maintenance_report replacement; pre-flight aborts if an
   approved profile-only resident exists on hosted)
   Smoke: submit a report with and without a photo as a test resident; open it as the admin.
Stage D - profile photos
10. 20261030120000 profile_photos_private_bucket
   Smoke: upload / replace / remove a profile photo; header avatar updates.

## 3. Security fixes verified (rehearsal on the restore; mutation checks catch removal of each migration)
- Direct report insert needs an approved membership in that community, a same-community amenity, and status `open`.
- create_maintenance_report(): approved membership only (profiles.hoa_id fallback removed), amenity must belong to the community,
  initial status forced `open`, anon cannot execute.
- Existing data does not depend on the old behavior (snapshot 10-29): 81 reports, 2 reporters; 0 reports from a reporter without an
  approved membership; 0 with a cross-community amenity; 0 profile-only residents. To be re-run on the fresh backup.
- Photo buckets: own-folder-only upload/replace/delete; others and anon cannot list, replace, delete or upload; profile photos private.

## 4. Known residual risks
- Rehearsal is on PG17 with the restore's own storage/auth schema, hosted is PG15 with live Supabase services (storage MIME and size
  limits are enforced by the Storage API and were not exercised).
- `update_email_preference` and the other email functions are `SECURITY DEFINER` without `SET search_path` (they check the caller
  with auth.uid()); not changed here.
- report-photos is public-by-URL (unchanged app contract); a private bucket + signed URLs is stricter but changes the admin screens.
- Data restore is the only rollback for DDL that dropped policies; keep the fresh backup until the smoke tests pass.


---

## Addendum 2026-10-31: the final Resident codebase's database dependencies (plan UNCHANGED, still NOT applied)

Checked against the 2026-10-29 hosted snapshot (a restore of the real backup; re-run on the fresh backup). The plan above stands as
written: **no new migration is required** by the Resident corrections (V1-014 .. V1-024), the 13 original issues, or the overnight audits.

**Already on hosted (the final code works against these today):** `hoa_notifications.dedupe_key`, `report_notes.is_internal`, `hoas.logo_url`,
`hoa_events`, `hoa_documents` + private bucket `hoa-documents` + its member read policy, RPC `my_message_contacts` (the client also has a
fallback), RPC `update_email_preference`, `amenity_rules.max_duration_minutes` / `max_reservations_per_day`, the `bookings` exclusion
constraint, `bookings.cancellation_reason`.

**Still missing on hosted, and exactly which pending migration supplies it:**

| Feature (Resident code) | Missing object | Supplied by | Without it |
|---|---|---|---|
| Profile photo add / replace / remove (V1-005) | bucket `profile-photos`, column `profiles.avatar_path` | `20261030120000` | upload says "Profile photos are not enabled on this server yet" (Storage answers "Bucket not found"); initials are shown |
| Report photo attach | RPC `attach_report_photo`, bucket `report-photos` | `20261023130000` + `20261030140000` | the report is saved; the photo is not attached / upload fails with a clear message |
| Database-enforced report rules | insert policy + `create_maintenance_report()` replacement | `20261030130000` | the app already sends only valid reports; a direct API call could still file one for another community (security gap, not a feature) |
| Admin booking-review notifications | trigger that writes `booking_review_needed` | `20261023100000` | admins are not notified; residents unaffected |

**Behaviour that now works WITHOUT any migration (done in the client):** notification taps open the exact report / reservation from the ids in
the row (previously every tap fell back to a list page because no row stores a `route`); duplicate-looking notifications are
described by what they are about; the Documents, messaging, reservation and cancellation flows use only objects that already exist.

**Stage order is unchanged.** Two smoke tests to add to the existing stage smoke list:
- after Stage C: open a notification for a report and one for a reservation, and confirm each lands on its detail screen;
- after Stage D: add, replace and remove a profile photo, and confirm the header avatar and Me screen both update.

**Optional follow-up migration (recommended, NOT part of this plan, needs its own rehearsal):** close the same-community full-row read on
`profiles` described in `docs/RESIDENT-PRIVACY-RECOMMENDATIONS.md`.

# TENISX REAL - staged migration plan, revision 3 (prepared 2026-11-01, NOT executed)

Supersedes the stage table in `docs/MIGRATION-PLAN-2026-10-31.md` (rev 2 still explains the gates, the expiry job and the smoke tests for E/F). New in rev 3:
Stage G is now WRITTEN (`20261031120000_profiles_member_read_gap.sql`), the reminder/portfolio time-zone gaps are closed in code, and the hosted read-only
checks that the connector allows were run. **Nothing was applied, deployed, pushed or written to hosted.**

## 0. Evidence and limits (be exact about what is proven)
| Claim | Evidence | Status |
|---|---|---|
| Hosted history ends at `20261013190307`; none of the 13 pending migrations is applied | `list_migrations` on TENISX REAL (`hqqlrliakttqsbalvuyz`), 2026-11-01 | LIVE read |
| Hosted Postgres is **15.8**; the scratch rehearsals ran **17.x** | `list_projects`; backup header "Dumped from database version 15.8" | Gap: a PG16+ feature could pass locally and fail on hosted. A grep of all pending migrations for PG16/17-only syntax (JSON_TABLE, ANY_VALUE, MERGE, security_invoker, pg_input_is_valid ...) found none. A PG15 rehearsal is still the proper proof. |
| `btree_gist` installed (M2's EXCLUDE needs it); `pg_cron` AVAILABLE but NOT installed; `pg_net` available | `list_extensions` | LIVE read |
| 2 storage buckets, 5 objects, RLS on for all storage tables | `list_tables(storage)` | LIVE read. Bucket names/settings and policies are NOT readable with the connector (it has no SQL tool) |
| Hosted `profiles` SELECT policies | only the 10-29 backup (`schema-only.sql`): exactly "Discoverable...", "Members can view profiles in same HOA", "Users can view their own full profile"; no blanket `profiles_select_authenticated` | 10-29 evidence, NOT live. Stage G's pre-flight re-checks it on hosted and aborts if anything else exists. |
| Overlapping bookings / pending conflicts on hosted | NOT run (no SQL tool). 10-29 restore: 0 overlaps | Gate 1 SQL below must be run by you |
| All rehearsal results (34/34 + 37/37 checks, races, rollbacks) | scratch PG17 restore of the 10-29 backup | Not repeated this session (memory); NOT run for Stage G yet |
| Live Storage upload/signed URL/replace/delete | never exercised | First post-deploy upload is the real test |
Security advisor (hosted, read): 1 ERROR `security_definer_view`, WARNs: mutable function search_path, graphql-exposed tables, anon/authenticated SECURITY DEFINER functions executable (stages B closes the anon part), leaked-password protection off, **Postgres version has security patches available**. None are caused by this work; the Postgres upgrade is a Supabase dashboard action for you, to schedule AFTER the migrations settle.

## 1. Gate 0 - fresh backup (you run it; I never see the password)
`scripts/hosted-backup/backup.ps1` verified by reading it: the project ref is hard-coded to `hqqlrliakttqsbalvuyz` (TENISX REAL), it writes to a NEW
timestamped+random folder under `%USERPROFILE%\tenisx-backups\` (`New-Item` without `-Force`, so it cannot overwrite a previous backup), every session is
`default_transaction_read_only = on`, the password is read hidden and cleared at exit, and it restore-tests into a local scratch server with no Supabase connection.
The prior backup `20261029-235117-04c5d3` stays untouched.
```powershell
# 1. Close Chrome/Edge tabs you do not need first (the restore test starts a local PostgreSQL; free memory was ~1.9-3 GB, 16 GB machine).
# 2. NEW PowerShell window, repo root:
cd C:\Users\info\tenisx-native
powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\backup.ps1 -SkipVerify     # type the DB password hidden; takes the backup only
# 3. When memory is comfortably free, prove it restores (separate step, needs your OK because it starts PostgreSQL):
powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\verify-restore.ps1 -BackupDir C:\Users\info\tenisx-backups\<the new folder>
```
The backup is **not verified until `RESTORE VERIFIED` is printed** by step 3. Checks to read afterwards in the new folder: `BACKUP-COMPLETE.txt`, `fingerprint-before.txt` equals `fingerprint-after.txt` (nothing changed during the dump), `schema-only.sql` header says `Dumped from database version 15.8`.
Restore compatibility: dumped with pg_dump 17 from PG 15.8, restored on local PG 17 (forward restore is supported). Isolation from TENISX REAL: restore-test runs after `Clear-PgEnv` on a local scratch cluster; it has no connection setting for Supabase.

## 2. Gate 1 - read-only SELECTs to run on HOSTED (SQL editor; they change nothing)
```sql
-- (a) stage D pre-check: does the bucket / column already exist, and what other buckets exist?
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('avatar_path','avatar_url');
-- (b) stage G pre-check: every SELECT policy on profiles (expect exactly: Discoverable..., Members can view profiles in same HOA, Users can view their own full profile)
select policyname, cmd, permissive, roles, qual from pg_policies where schemaname='public' and tablename='profiles' order by policyname;
-- (c) storage.objects policies for the buckets in use
select policyname, cmd, roles, qual from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
-- (d) stage F pre-check (must be 0 rows) and (e) pending requests already past
--   -> queries 1-4 in docs/MIGRATION-PLAN-2026-10-31.md section 2
-- (f) scheduling facility
select extname, extversion from pg_extension where extname in ('pg_cron','btree_gist','pg_net');
select * from cron.job;   -- errors with "relation does not exist" while pg_cron is not enabled: that is expected
```
Paste me the OUTPUT of (a)-(c),(f) (no secrets in them) or run them through a connector that has SQL access; I will not guess.

## 3. Staged plan
Order (each stage = one reviewed SQL file at a time, never `db push`; after each, insert one `supabase_migrations.schema_migrations` row with the file's version/name; aligning the 34 historical mismatches is separate and needs approval):

| Stage | Migration(s) | Purpose | Depends on | Independent? |
|---|---|---|---|---|
| **D (first)** | `20261030120000_profile_photos_private_bucket` | profile photos: private bucket, 4 owner-only policies, `profiles.avatar_path` + CHECK | `storage` schema, `public.profiles` | **YES - touches only a new bucket, 4 new policies named "Owners can ... their profile photo", one new column. No reservation/notification/time-zone dependency.** |
| G | `20261031120000_profiles_member_read_gap` | close resident read of co-members' whole profile rows; name-only directory `community_member_names` | `is_admin_in_same_hoa` | Yes (no photo/tz/reservation dependency). Ship the app change in the same release: until it runs against Stage G, `fetchMemberNames` falls back to the old select (tolerant), so deploy order is safe either way. |
| A | 20261022120000, 20261023100000, 20261023110000, 20261023120000 | resident join hardening, booking-review notifications, HOA application hardening, interest requests | see rev 2 | per rev 2 |
| B | 20261013130000, 20261023140000 | revoke anon EXECUTE on admin/definer RPCs | B1 first | logged-out calls change - smoke test |
| C | 20261023130000, 20261030140000, 20261030130000 | report photos, hardened bucket, report insert requires membership | C1 -> C2; C3 pre-flight aborts on profile-only resident | per rev 2 |
| E | `20261031100000_hoa_timezones` | HOA time zones | `hoas`, `courts`, `check_hoa_admin` | before F |
| F | `20261031110000_exclusive_pending_reservations` | pending holds slots, expiry, busy-times | **E**, Gate-1 overlap query = 0 | needs E |
| notifications | `send-scheduled-reminders` Edge Function (code only, no migration) | reminders at the HOA-local time | works BEFORE or AFTER E (it detects a missing `hoas.timezone` and uses Puerto Rico; a NULL zone is skipped and logged) | Deploy only after you approve; it is a hosted write |
Rationale for D then G then the rest: D and G are the two small, self-contained, security-positive changes; A-F are the reservation/join behaviour changes that need the full rehearsal on the fresh restore.

### Per-stage detail
**D - profile photos.** Preconditions: Gate 0 backup restore-verified; Gate-1 (a) shows no `profile-photos` bucket (or one with exactly private/5242880/three types) and no conflicting policies. Data-conflict check: none (new column, nullable). Rehearsal: SQL applied in the 10-29 full-chain rehearsal; Storage API behaviour cannot be rehearsed locally, so the live smoke test IS the rehearsal - use a TEST account. Rollback: clear `avatar_path` values; drop the 4 policies; delete the bucket only if empty; drop the CHECK and column (does not touch `avatar_url` or the public `avatars` bucket). Verify: `docs/PROFILE-PHOTO-DEPLOYMENT-CHECKLIST.md` step 3 queries. Approval: yours. The Supabase connector in this session has no SQL/apply tool, so you would run the file in the SQL editor (or enable a write-capable connection and tell me).
**G - profile read gap.** Preconditions: Gate-1 (b) exactly the three expected policies (the migration also aborts on its own otherwise). Data conflict: none. Rehearsal REQUIRED before hosted: `supabase/tests/profiles_read_gap.sql` on a scratch restore (written, not yet run). Rollback: `supabase/rollbacks/20261031120000_rollback_profiles_member_read_gap.sql`. Verify: as a resident, `select phone_number from profiles where id = '<other member>'` returns 0 rows; Messages still shows administrator names; Reports note authors show; admin Pending Requests / Manage Amenities still show resident names. Risk to watch: any resident-side screen that reads co-member columns other than id/full_name; none found in Stage 1 (grep of `src/`), Stage 2 screens (coach/match/ladders) read other users but are hidden. Approval: yours, after the rehearsal.
**A-C.** Unchanged from rev 2 (`docs/MIGRATION-PLAN-2026-10-31.md`); they need the rehearsal repeated on the fresh restore.
**E, F.** Unchanged from rev 2 section 3, plus: rehearse once on **PG 15** if a PG15 `postgres.exe` is available (hosted is 15.8), because all earlier proof is PG17.
**Reminders function.** Deploy with the Supabase CLI/dashboard only on your approval. Verify: invoke once with no bookings due (returns `remindersSent: 0`), then check the next real reservation gets its 1-hour email at the community-local time.

## 4. Expiry job
Unchanged (rev 2 section 4). `pg_cron` is available but not installed on hosted; enabling it is a hosted change that needs your approval. Correctness does not depend on it.

## 5. GO / NO-GO
- **Profile photos (Stage D alone): CONDITIONAL GO** once (1) the fresh backup exists AND `RESTORE VERIFIED`, (2) Gate-1 (a) is clean, (3) you approve the write. It is independent and low-risk.
- **Stage G: NO-GO until** the scratch rehearsal of `profiles_read_gap.sql` passes and Gate-1 (b) matches.
- **A, B, C, E, F: NO-GO** until the rehearsal is repeated on the fresh restore (ideally PG15), Gate-1 overlap query returns 0 rows, and you approve each stage.

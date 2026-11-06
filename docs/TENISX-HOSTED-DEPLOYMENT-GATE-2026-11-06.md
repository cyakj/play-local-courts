# TenisX — hosted deployment gate (2026-11-06)

**Nothing in this document has been applied to TENISX REAL.** No hosted write, Storage change, Edge Function deploy or push happened in this work. Every result below comes from scratch PostgreSQL 15.8 / 17.11 restores of the verified backup `C:\Users\info\tenisx-backups\20261106-084850-760831`, or from Node tests. Hosted facts are "as of that backup (2026-11-06 08:48)" until the Gate-1 output in §5 is pasted back and read.

## 1. Final HEAD and what changed in this pass
Starting HEAD `c1031dd`. New local commits (see `git log`): the migration `20261106140000`, its rollback and test, two repaired SQL fixtures, an isolation-test change, the rehearsal script (now 20 files), and this document. `.claude/settings.local.json` is untouched and uncommitted.

## 2. Security findings and resolutions
| # | Finding | Resolution | Status |
|---|---|---|---|
| S1 | An administrator of community A could write booking rules for community B's amenity (policy checked only `rules.hoa_id`). | Migration `20261106130000` (composite FK + policy requiring the amenity to belong to the rules' community, USING and WITH CHECK). Test `amenity_rules_isolation.sql` 12/12. **Newly proven standalone on an untouched restore** (no other pending migration needed), PG 15.8 and 17.11. | Fixed locally; **not on hosted** |
| S2 | 10 RLS-helper SECURITY DEFINER functions executable by anon (5 are "is user X admin / member / role" oracles for any user id). | New migration `20261106140000` revokes anon, keeps authenticated. Test `anon_helper_execute.sql` 21/21: anon cannot execute the ten; authenticated can; anon reads of every anon-readable table still raise no permission error. Applied, re-applied, rolled back, re-applied on both versions; also standalone on the untouched restore. | Fixed locally; **not on hosted** |
| S3 | 58 anon-executable definer functions on the backup (the restore). | 40 are closed by already-written pending migrations (`…013130000`, `…023140000`); after all 20 files, **9 remain by design** (S2 table below). | Closed by chain; **not on hosted** |

### SECURITY DEFINER audit (functions still executable by anon after all 20 pending files)
All have `SET search_path = public` except `handle_new_user` (auth trigger; see note).
| Function | Purpose | Anon exec | Classification |
|---|---|---|---|
| `get_public_hoa_invite_by_code(text)` | invite landing page: name/enabled/expiry for a code | intentional (pre-login) | **Safe** — returns no member data; a code must be known (brute force limited by code entropy; rate limiting is a Supabase-API concern) |
| `get_public_survey_results(uuid)`, `get_survey_member_count(uuid)` | survey results/counts | no useful result for anon | **Safe** — return empty unless `auth.uid()` is an approved member of the survey's community |
| `clinic_enrollment_counts(uuid[])` | aggregate enrolled counts per clinic id | yes | **Safe, low** — aggregate only; needs known clinic ids. Optional later restriction |
| `check_hoa_admin(uuid,uuid)` | RLS helper: is user an approved admin of a community | yes (policy reachability) | **Needs restriction (low, deferred)** — oracle for known UUIDs; referenced by policies granted to PUBLIC on tables anon can read, so revoking would turn empty anon results into permission errors. Do after reviewing those policies |
| `can_view_ladder(uuid)`, `is_ladder_admin(uuid)` | ladder RLS helpers | yes (policy reachability) | **Safe** — use `auth.uid()` (NULL for anon → false); Stage 2 ladders feature |
| `handle_new_user()` | `auth.users` signup trigger | yes (grant only) | **Safe** — a trigger function cannot be called as an RPC; left alone on purpose to avoid any signup risk |
| `sweep_expired_before_booking_insert()` | BEFORE INSERT trigger on bookings | yes (grant only) | **Safe** — trigger function, not callable as RPC |

The ten functions revoked in S2 were each checked: no policy reachable by anon references them (query in the migration header's rationale; empirical anon-read test). Residual: a **signed-in** user can still probe the five "oracle" helpers for another user's UUID (needs a known UUID; no data returned beyond a boolean). Closing that needs policy rewrites — deferred, low severity, documented.

No function was found that **modifies another community's records** or **bypasses RLS to return rows** to anon. Mutating RPCs (approve/reject membership, blockouts, archive_announcement, etc.) were all closed to anon by earlier pending migrations and verified by `admin_isolation.sql` (37/37), `reservation_admin.sql` (17/17) and the chain.

## 3. SQL fixture tests
| File | Before | Cause | After |
|---|---|---|---|
| `admin_blockouts.sql` | failed at section 9 ("1 reservation(s) per day limit") | **Fixture defect**: earlier sections left a booking on the 1/day Greens court | 34 PASS, 0 FAIL — fixture now clears its own earlier bookings (table owner, rolled-back transaction). Production rule untouched |
| `booking_approval.sql` | 10 PASS but check #10 **SKIPPED** depending on the time of day | **Fixture defect**: relied on the clock | Check #10 now runs always: widens the pool's own rules inside the rolled-back transaction. 10 PASS, 0 SKIP |
Neither failure was a product defect. Run on both PG versions.

## 4. Codex review status
- Rounds 1–4 (earlier): **REVISE** each time; fixes applied; **no PASS**.
- Round 5 (this pass): fresh Codex inspection of `a7181a4..HEAD` (round-4 fixes, migration 140000, fixtures) — see the "Codex round 5" block appended at the bottom of this file when it returns. **Until a result says APPROVED, this work has NOT passed independent review.**

## 5. Stage D hosted preflight — run in the Supabase SQL editor (all SELECT)
Paste each block, then send me the output. **Do not apply Stage D** until I have read it.
```sql
-- 1. Storage buckets. EXPECT: no row id='profile-photos'. Existing: avatars(public), branding(public), hoa-documents(private),
--    hoa-verification-documents(private), score-photos(public). A pre-existing profile-photos with other settings = STOP.
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

-- 2. Storage policies on objects. EXPECT: none named like "Owners can % their profile photo" and none mentioning 'profile-photos'.
select policyname, cmd, roles from pg_policies where schemaname='storage' and tablename='objects' order by policyname;

-- 3a. EXPECT: avatar_url present, avatar_path absent
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='profiles' and column_name in ('avatar_url','avatar_path');

-- 4. Migration history. EXPECT: newest version 20261013190307; NO row named profile_photos_private_bucket.
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;
select count(*) as already_registered from supabase_migrations.schema_migrations where name ilike '%profile_photos%';

-- 5. Schema conflicts. EXPECT: 0 rows for each.
select conname from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_avatar_path_check';
select tgname from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal;   -- informational: shows the storage delete guard

-- 6. RLS on storage.objects. EXPECT: relrowsecurity = true.
select relrowsecurity from pg_class where oid='storage.objects'::regclass;

-- 7. Privileges that Stage D relies on. EXPECT: authenticated has SELECT/INSERT/UPDATE/DELETE on storage.objects; profiles UPDATE for authenticated.
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='storage' and table_name='objects' and grantee in ('authenticated','anon') order by 1,2;
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name='profiles' and grantee in ('authenticated','anon') order by 1,2;

-- 8. Baseline for before/after comparison.
select count(*) as profiles, count(avatar_url) as with_legacy_avatar from public.profiles;
select version() ;
```
**Acceptable:** exactly the EXPECT lines. **Stop and send me the output** if: a `profile-photos` bucket exists, `avatar_path` or its constraint exists, a policy already mentions `profile-photos`, `relrowsecurity` is false, or the newest migration version is not `20261013190307`.

## 6. Rollout plan (hosted history uses apply-time versions; `supabase db push` is NOT safe)
**Method for every stage:** a fresh backup is restore-verified (done; retake after any large hosted data change); run the stage's preconditions as read-only SQL; apply the listed file **verbatim, one file per transaction** in the Supabase SQL editor (or MCP `apply_migration` once a write connection is authorised); register it:
`insert into supabase_migrations.schema_migrations (version,name) values (to_char(now() at time zone 'utc','YYYYMMDDHH24MISS'), '<file name without version prefix>');`
Why not `db push`: 13 older local files (`20260821010000…20261013120000`) already exist on hosted under *different* version numbers; a push re-runs them (duplicate-object errors) and runs all pending files at once.

**Order (dependency-correct; security first).** Dependencies: B2 needs B1; C2/C3 need C1; F needs E; everything else is independent. `130000` and `140000` have no dependencies and were each applied **alone on the untouched restore**.

| Stage | File(s) | Needs | Schema/security effect | Verify (read-only) | Rollback / recovery | Stop if |
|---|---|---|---|---|---|---|
| **S1 security** | `20261106130000_amenity_rules_hoa_integrity` | – | unique `courts(id,hoa_id)`, composite FK on `amenity_rules`, stricter admin policy. Preflight aborts without change if any rule row mismatches | `select count(*) from amenity_rules r join courts c on c.id=r.amenity_id where c.hoa_id<>r.hoa_id` = 0; policy `HOA admins can manage amenity rules` present; constraint `amenity_rules_amenity_hoa_fkey` present | `supabase/rollbacks/20261106130000_*.sql` | the migration raises a mismatch notice (report rows, do not force) |
| **S2 security** | `20261106140000_revoke_anon_policy_helper_functions` | – | anon loses EXECUTE on 10 helpers | `select proname, has_function_privilege('anon',oid,'execute') from pg_proc where proname in ('has_role','is_in_same_hoa','is_hoa_affiliated','is_admin_in_same_hoa','can_create_ladder','can_view_ladder_row','_is_listing_creator','_is_listing_participant','_listing_open_for_join','_listing_readable')` all false | `supabase/rollbacks/20261106140000_*.sql` | a signed-in resident gets "permission denied for function" anywhere (re-grant `authenticated` immediately) |
| **D** | `20261030120000_profile_photos_private_bucket` | `storage`, `profiles` | private bucket, 4 owner-only policies, `profiles.avatar_path` + CHECK | package `docs/STAGE-D-…` §5 | `supabase/rollbacks/20261030120000_*.sql` (re-runnable; keeps a non-empty bucket) | §5 preflight stop conditions |
| **G** | `20261031120000_profiles_member_read_gap` | – | members read only their own `profiles` row (+ admins read community members); closes full-row co-member read | resident-account API read of another member's profile returns 0 rows; `profiles_read_gap.sql` | its header rollback; test 12 checks | any app screen that lists other members' names breaks — restore the old policy and report |
| **A** | `20261013100100`, `20261022120000`, `20261023100000`, `20261023110000`, `20261023120000` | `20261013100100` is **opt-in and rewrites data** (moves legacy `maintenance_reports.admin_notes` into internal notes) — run its `select id,hoa_id,left(admin_notes,80)…` review first; decide separately | join-flow hardening, notifications, application-field protection, interest requests | per-file headers; `assert-resident-migrations.sql` | per-file header | the review of `admin_notes` shows content the owner doesn't want moved |
| **B** | `20261013130000`, `20261023140000` (B1 then B2) | B2 needs B1 | anon revoked on ~40 definer RPCs; email-preference functions require the caller to be the target | `select count(*) …has_function_privilege('anon')` ↓; resident can still read/update own email preferences | per-file header | signup or login breaks (should not: `handle_new_user` is untouched) |
| **C** | `20261023130000` (C1), `20261030130000` (C3), `20261030140000` (C2) | C1 first | resident photo attach RPC; report insert requires membership (preflight aborts for a profile-only resident); hardened public-read `report-photos` bucket | bucket + policies exist; a resident member can file a report with a photo | per-file header / package | preflight aborts: list the affected residents |
| **E** | `20261031100000_hoa_timezones` | – | `hoas.timezone`, community-time cancellation/advance windows; existing 3 communities → `America/Puerto_Rico` | `select id,name,timezone from hoas` | header | any community other than the 3 known |
| **F** | `20261031110000_exclusive_pending_reservations` | E | pending holds the slot exclusively; EXCLUDE constraint; expiry at start time | `reservation_integrity.sql` equivalents; two residents cannot hold the same slot | header | existing overlapping pending/confirmed rows (migration would abort — send them) |
| **H** | `20261101100000_announcement_urgency_and_category` | – | `is_urgent`, `category` columns | columns exist; existing rows default `general`/false | header | – |
| **N1** | `20261106100000_amenity_allowed_durations` | – | 3 optional duration lists + trigger | `amenity_allowed_durations.sql` | `supabase/rollbacks/20261106100000_*` | – |
| **N2** | `20261106110000_hoa_event_audience` | – | `audience` column, narrower resident SELECT policy | residents still see every existing event | `supabase/rollbacks/20261106110000_*` | resident can't see a normal event |
| **N3** | `20261106120000_announcement_archive` | – | `archived_at`, narrower SELECT, `archive_announcement()` (no UPDATE policy) | admin remove works, resident no longer sees it | `supabase/rollbacks/20261106120000_*` | – |

**Smoke tests per stage (resident account / administrator account):** S1 admin saves amenity rules for their own amenity (works) · S2 resident signs in, opens Schedule, Community, Profile (nothing errors) · D, see package §6 · G resident opens Me/Profile; admin opens members list · A/B resident onboarding screen, email preferences · C resident files a report with photo · E/F book an amenity, a second resident cannot take the same pending slot, admin approves/declines · H admin posts an urgent announcement; resident sees the dot · N1 admin saves allowed durations; resident picker shows them · N2 admin creates a board-only meeting; resident does not see it · N3 admin removes an announcement; resident no longer sees it.

**Continue to the next stage only after the previous stage's read-only verification matches and its smoke test passes.**

## 7. Expo Go device test sequence (NOT performed — no device validation is claimed)
Use a TEST resident and a TEST administrator of The Greens, after the relevant stages are applied. Stages D/G/E/F/H/N1–N3 must be on before steps 1, 4, 5, 8, 9. **iOS export:** not attempted (free RAM about 2.6 GB at the start of the sprint); run `npx expo export --platform ios` when ≥4 GB is free.
1. Profile photo: add JPEG, replace with PNG, remove; 6 MB image and a PDF refused; second account cannot see it.
2. Book an amenity (auto-confirm pool): appears as confirmed; availability greys the slot for a second resident.
3. Tennis Singles/Doubles: buttons show the duration; only allowed durations selectable.
4. Approval-required court: request shows "Pending approval"; second resident cannot take the slot; admin approves → confirmed; admin declines → released.
5. Community Pulse: urgent announcement shows the coral dot; a removed announcement disappears.
6. Community events: a normal event appears; a board-only meeting does not appear for the resident.
7. Admin announcements: post (urgent + category), switch community mid-post (no cross-contamination), remove with confirmation.
8. Admin event cancellation from the manager calendar: confirm dialog; event disappears for residents.
9. Wheel: sound is quieter, in sync with each notch; haptics stronger; no ghost rows.
10. Schedule times: with the phone set to another time zone, events/closures show The Greens' local time (Puerto Rico).

## 8. Remaining risks
- Hosted state is unverified until §5 output is read. Facts come from the 08:48 backup.
- No independent PASS exists (see §4).
- Storage API behaviour (size limit, MIME, signed URLs) and every device behaviour are untested.
- `check_hoa_admin` anon oracle and signed-in oracle on 5 helpers remain (low).
- Edge function `send-scheduled-reminders` not deployed; unread announcement counts not implemented.
- The scratch PG servers (ports 55432, 55433) and folders under `C:\Users\info\tenisx-scratch` are still present.

## 9. Exact approval steps
1. Run §5 in the Supabase SQL editor; paste the results to me. I will say whether Stage D's preconditions hold.
2. Say "apply Stage D" (or run it yourself per the package). Then the device test in package §6.
3. Say "apply S1, then S2" — these are the security fixes and can go before D if you prefer (they are independent).
4. Then approve the remaining stages one at a time in the §6 order. Before **A** decide separately about the opt-in `20261013100100` data move.
5. Only after all stages: Expo Go test sequence (§7). Edge function deploy and any push are separate approvals.

## 10. Ready vs not ready
**Ready to deploy (rehearsed on restores of the real data, applied/re-applied/rolled back on PG 15.8 and 17.11):** all 20 pending files, in file order and in §6 order; S1 and S2 standalone.
**Not ready:** anything touching hosted before §5 is read and you approve; independent Codex PASS; device validation; iOS export; Edge function; the optional `20261013100100` data move needs your decision.

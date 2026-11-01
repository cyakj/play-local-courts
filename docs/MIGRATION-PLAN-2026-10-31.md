# TENISX REAL - staged migration plan, revision 2 (prepared 2026-10-31, NOT executed)

Supersedes the ordering in `docs/MIGRATION-PLAN-2026-10-30.md` (that document still explains the history mismatch and the first ten
migrations; this one adds Stages E-G and the new gates). **Nothing here has been applied. Hosted (`hqqlrliakttqsbalvuyz`) was only READ.**

## 0. What the evidence is, and is not
| Claim | Evidence | Relies on the old 2026-10-29 backup? |
|---|---|---|
| Hosted history ends at `20261013190307`; none of the 12 migrations below is applied | `list_migrations` read on 2026-10-31 (the Supabase connector later disconnected, so it was not re-read) | No (live read) |
| M1, M2 and the ten earlier migrations apply cleanly in the order below; verification script 34/34; races; pre-flight abort; rollbacks | scratch Postgres 17 on a restore of the **2026-10-29** backup (`restore_test`) | **YES** - every rehearsal result |
| Zero overlapping pending/confirmed bookings | same restore (M2's own pre-flight passed) | **YES** - hosted may have changed since 10-29 |
| Existing data: 3 communities (all Dorado, Puerto Rico), 17 confirmed / 1 pending / 29 cancelled bookings | same restore | **YES** |
| Storage limits (MIME/size), pg_cron, Supabase auth/storage services | NOT exercised (scratch server has none of them) | n/a |
Nothing is production-ready until the **fresh verified backup** exists and the rehearsal below is repeated on its restore.

## 1. Gate 0 - fresh backup and restore verification (you must do this)
```
powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\backup.ps1            (new window; type the database password hidden)
powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\verify-restore.ps1 -BackupDir <the new folder>
bash scripts/local-pg-rehearsal/rehearse-real-restore.sh <port> restore_test rehearsal_a
bash scripts/local-pg-rehearsal/rehearse-resident-migrations.sh <port> rehearsal_b restore_test
bash scripts/local-pg-rehearsal/rehearse-reservation-integrity.sh <port> rehearsal_ri restore_test
```
All three rehearsals must print no FAIL. Keep the fresh backup until every smoke test below has passed.

## 2. Gate 1 - conflict detection on HOSTED (read-only SELECTs; run before Stage F)
M2 refuses to apply when two pending/confirmed bookings overlap, and never edits or deletes them. Run these in the Supabase SQL editor
(read-only) or tell me to run them through the connector once it reconnects:
```sql
-- 1. overlapping active reservations (must return 0 rows before Stage F)
SELECT a.id AS booking_a, b.id AS booking_b, a.court_id, a.date, a.start_time, a.end_time, a.status AS status_a,
       b.start_time AS b_start, b.end_time AS b_end, b.status AS status_b
FROM public.bookings a JOIN public.bookings b
  ON a.court_id = b.court_id AND a.id < b.id
 AND a.status IN ('pending','confirmed') AND b.status IN ('pending','confirmed')
 AND tsrange(a.date + a.start_time, a.date + a.end_time, '[)') && tsrange(b.date + b.start_time, b.date + b.end_time, '[)')
ORDER BY a.date, a.start_time;

-- 2. pending requests whose start has already passed (they will become 'expired' the first time a sweep runs)
SELECT b.id, b.court_id, b.date, b.start_time FROM public.bookings b
WHERE b.status = 'pending' AND (b.date + b.start_time) <= (now() AT TIME ZONE 'America/Puerto_Rico') ORDER BY b.date;

-- 3. existing bookings in communities that M1 will NOT mark Puerto Rico (these keep their stored times; expect 0 today)
SELECT count(*) FROM public.bookings b JOIN public.courts c ON c.id=b.court_id JOIN public.hoas h ON h.id=c.hoa_id
WHERE h.address !~* '(puerto rico|,\s*pr\b|\mdorado\M)';

-- 4. communities that will have NO time zone after M1 (reservations are refused for these until an admin sets one)
SELECT id, name, address FROM public.hoas WHERE address !~* '(puerto rico|,\s*pr\b|\mdorado\M) ';
```
If query 1 returns rows: **stop**. Decide per pair (which request stands); resolve through the app/admin or an approved one-off SQL change by
you. I did not and will not change those rows.
On the 10-29 restore: query 1 = 0 rows; query 2 = 1 row (the lone pending booking, 2026-10-13, already past: it becomes `expired`).

## 3. The ordered plan (each stage ends with a smoke test; stop on any failure; apply by reviewed SQL one file at a time, never `db push`)
| Stage | Migration (version_name) | Depends on | Notes |
|---|---|---|---|
| A | 20261022120000 resident_join_flow_hardening | - | as in the 10-30 plan |
| A | 20261023100000 admin_booking_review_notifications | - | |
| A | 20261023110000 hoa_application_hardening | - | aborts if duplicate pending applications exist |
| A | 20261023120000 community_interest_requests | A1 | |
| B | 20261013130000 revoke_anon_execute_on_admin_rpcs | - | blast radius: logged-out calls |
| B | 20261023140000 lock_down_anon_definer_rpcs_and_email_prefs | B1 | |
| C | 20261023130000 report_photo_attach | - | |
| C | 20261030140000 report_photos_bucket_hardened | C1 | |
| C | 20261030130000 report_insert_requires_membership | - | pre-flight aborts on a profile-only resident |
| D | 20261030120000 profile_photos_private_bucket | - | enables profile photos (section 6) |
| **E** | **20261031100000 hoa_timezones (M1)** | `hoas`, `courts`, `user_roles`, `check_hoa_admin` | additive column; **replaces** `enforce_amenity_booking_rules`, `enforce_booking_cancellation_window`, `admin_create_blockout` (current hosted bodies = those in the 10-29 restore) |
| **F** | **20261031110000 exclusive_pending_reservations (M2)** | **E** (refuses to run without it), Gate 1 query 1 = 0 | new constraint, `expired` status, sweep, busy-times function |
| **G** | profiles read-gap fix (**NOT written**) | decision | see section 5 |

Why E before F: M2's expiry, transition guard and busy-times function call M1's `hoa_local_now_for_court` / `reservation_time_problem`; M2 raises
"Apply 20261031100000 first" otherwise (tested). Why both after A-D: the rehearsal chain applied exactly this order; M1/M2 re-define
functions last touched by `20261012190000`/`20261013110000` (already on hosted), and nothing in A-D redefines them.
After applying, insert one history row per applied file (version = filename version, name = file name); aligning the 34 mismatched hosted
versions is a separate hosted-history edit that needs your approval.

### Smoke tests
- After E: `select name, timezone from hoas;` -> The Greens/DBE/The Fairways = America/Puerto_Rico; a resident can still book tomorrow; cancel inside the
  window is refused, outside allowed; HOA manager can create a blockout for today.
- After F: as resident A request a slot on an approval-required amenity (stays pending); as resident B try an overlapping time -> "just taken"; B
  sees A's interval as Reserved in the picker; administrator approves A (stays the same time); reject another and re-request the slot; a past-start
  pending request cannot be approved ("This request has expired"). In the SQL editor: `select public.expire_pending_bookings();` is NOT callable by
  a logged-in user (permission denied) - correct.
- Rollback (only if needed): `supabase/rollbacks/20261031110000_rollback_exclusive_pending_reservations.sql`, then
  `.../20261031100000_rollback_hoa_timezones.sql` (verified apply -> rollback -> re-apply on a scratch restore). The data restore from the fresh backup
  remains the safety net for anything else.

## 4. The expiry job (optional; correctness does not depend on it)
Expired holds are released without any timer: the insert trigger sweeps the amenity first, approval of a started request is refused, and the
busy-times function ignores expired rows. A job only keeps the stored status tidy for administrators. Hosted `pg_cron` was **not** checked (the
Supabase connector disconnected) and enabling it is a hosted change that needs your approval. If you approve:
```sql
create extension if not exists pg_cron;
select cron.schedule('expire-pending-bookings', '*/5 * * * *', $$select public.expire_pending_bookings()$$);
-- remove:  select cron.unschedule('expire-pending-bookings');
```
It is idempotent and runs as the database owner. An Edge Function on a schedule calling the same function with the backend key is the alternative.

## 5. Stage G - resident profile read exposure (still OPEN, not drafted)
`docs/RESIDENT-PRIVACY-RECOMMENDATIONS.md`: any approved member can read co-members' whole `profiles` row (phone, birth date, unit, coordinates) over
the API. The fix replaces the broad same-HOA SELECT policy with a narrow directory function. I did **not** write the migration in this round: it needs your
decision (recommended: yes, pre-launch), an audit that no Stage 1 screen reads co-members' full rows, a rehearsal, and its own approval. Until then the
exposure remains; it does not block Stages A-F, but I would not launch publicly with it open.

## 6. Profile photos - your exact steps
See `docs/PROFILE-PHOTO-DEPLOYMENT-CHECKLIST.md` (updated). Short form: complete Gate 0 -> apply only Stage D (`20261030120000`) -> run its verification
queries -> upload / replace / remove with a TEST resident, try a 6 MB file and a PDF, confirm a second account cannot read the first account's object.
Until Stage D is applied, uploads stay blocked and the app keeps saying so honestly.

## 7. Time zone administration (after Stage E)
Set or correct a community's zone with `select public.set_hoa_timezone('<hoa uuid>', 'America/Los_Angeles');` (a community administrator of that HOA or TenisX staff
only; invalid names are rejected). A community with no zone refuses new reservations with a plain message; existing reservations stay readable. Any new
community outside Puerto Rico MUST be given its zone before residents can book. The Resident app shows "All times shown in <zone>" when the phone's zone
differs from the community's.

## 8. GO / NO-GO
**NO-GO for hosted deployment today.** Missing: (1) the fresh verified backup, (2) the rehearsal repeated on its restore, (3) Gate 1 results from hosted,
(4) your explicit approval of each stage, (5) a decision on Stage G, (6) an end-to-end check of Storage/pg_cron on hosted (not testable locally).
Once 1-4 are done the code and migrations in this branch are ready to stage in the order above.

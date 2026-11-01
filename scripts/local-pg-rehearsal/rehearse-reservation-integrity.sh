#!/usr/bin/env bash
# Rehearsal of 20261031100000_hoa_timezones.sql + 20261031110000_exclusive_pending_reservations.sql on disposable copies of a
# scratch restore. Never connects to Supabase. Output has no row contents beyond PASS/FAIL lines.
# usage (repo root): bash scripts/local-pg-rehearsal/rehearse-reservation-integrity.sh <port> <rehearsal-db> <restored-source-db>
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
validate_args "${1:-}" "${2:-}"
SRC="${3:-}"
[[ "$SRC" =~ ^restore[a-z0-9_]{0,40}$ ]] || { echo "source database name must match ^restore[a-z0-9_]{0,40}\$" >&2; exit 2; }
M1=supabase/migrations/20261031100000_hoa_timezones.sql
M2=supabase/migrations/20261031110000_exclusive_pending_reservations.sql
A=f9fd5120-1735-4a27-a651-14a95e76a051   # resident of The Greens
B=f6eec1c1-fa0e-4806-b0fb-c61480870a95   # administrator of The Greens (also a member)
COURT="(select id from courts where name='The Greens Court')"
fresh() { pq -d postgres -c "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1 TEMPLATE $SRC" >/dev/null; }
rc=0

echo "== 1. apply M1 then M2 (each in one transaction) and run the verification script"
fresh "$DB"
pq -d "$DB" -1 -f "$M1" 2>&1 | { grep -v NOTICE || true; }
pq -d "$DB" -1 -f "$M2" 2>&1 | { grep -v NOTICE || true; }
out="$(pq -d "$DB" -f supabase/tests/reservation_integrity.sql 2>&1 | grep -E '^(PASS|FAIL)|failures=' || true)"
echo "$out"
echo "$out" | grep -q 'failures=0 ' || { echo "FAIL verification script reported failures"; rc=1; }

echo "== 2. idempotent re-apply"
pq -d "$DB" -1 -f "$M1" >/dev/null 2>&1 && pq -d "$DB" -1 -f "$M2" >/dev/null 2>&1 && echo "PASS M1 and M2 re-apply cleanly" || { echo "FAIL not re-appliable"; rc=1; }

echo "== 3. concurrency: two sessions, overlapping requests (real parallel transactions)"
fresh "${DB}c"
pq -d "${DB}c" -1 -f "$M1" >/dev/null 2>&1; pq -d "${DB}c" -1 -f "$M2" >/dev/null 2>&1
pq -d "${DB}c" -c "delete from bookings where user_id in ('$A','$B') and date = (now() at time zone 'America/Puerto_Rico')::date + 1" >/dev/null
DAY="((now() at time zone 'America/Puerto_Rico')::date + 1)"
as() { echo "set role authenticated; select set_config('request.jwt.claim.sub','$1',false);"; }
ins() { echo "insert into bookings (court_id,user_id,date,start_time,end_time,status,play_type) values ($COURT,'$1',$DAY,'$2','$3','confirmed','singles');"; }

# 3a. two residents insert the SAME interval at the same moment: exactly one wins
( pq -d "${DB}c" -c "$(as $A) begin; $(ins $A 12:00 13:00) select pg_sleep(3); commit;" >/tmp/s1.$$ 2>&1 ) &
sleep 1
( pq -d "${DB}c" -c "$(as $B) $(ins $B 12:00 13:00)" >/tmp/s2.$$ 2>&1 ) &
wait
n="$(pq -d "${DB}c" -At -c "select count(*) from bookings where court_id=$COURT and date=$DAY and start_time='12:00'")"
if [ "$n" = "1" ] && grep -q 'exclusion constraint' /tmp/s2.$$; then echo "PASS simultaneous identical requests: exactly one succeeds, the other gets 23P01"; else echo "FAIL simultaneous insert: rows=$n"; cat /tmp/s2.$$; rc=1; fi

# 3b. admin approves A while B tries to take the same time: approval keeps the interval, B is refused
pq -d "${DB}c" -c "delete from bookings where date=$DAY" >/dev/null
pq -d "${DB}c" -c "$(as $A) $(ins $A 14:00 15:00)" >/dev/null
( pq -d "${DB}c" -c "$(as $B) begin; update bookings set status='confirmed' where user_id='$A' and date=$DAY; select pg_sleep(3); commit;" >/tmp/s3.$$ 2>&1 ) &
sleep 1
( pq -d "${DB}c" -c "$(as $B) $(ins $B 14:30 15:30)" >/tmp/s4.$$ 2>&1 ) &
wait
st="$(pq -d "${DB}c" -At -c "select status||' '||start_time||'-'||end_time from bookings where user_id='$A' and date=$DAY")"
n="$(pq -d "${DB}c" -At -c "select count(*) from bookings where user_id='$B' and date=$DAY")"
if [ "$st" = "confirmed 14:00:00-15:00:00" ] && [ "$n" = "0" ] && grep -q 'exclusion constraint' /tmp/s4.$$; then echo "PASS approval racing a competing request: confirmed, interval unchanged, competitor refused"; else echo "FAIL approve race: [$st] rows=$n"; cat /tmp/s4.$$; rc=1; fi

# 3c. admin rejects A while B tries to take the same time: B waits for the rejection and then succeeds
pq -d "${DB}c" -c "delete from bookings where date=$DAY" >/dev/null
pq -d "${DB}c" -c "$(as $A) $(ins $A 16:00 17:00)" >/dev/null
( pq -d "${DB}c" -c "$(as $B) begin; update bookings set status='rejected' where user_id='$A' and date=$DAY; select pg_sleep(3); commit;" >/tmp/s5.$$ 2>&1 ) &
sleep 1
( pq -d "${DB}c" -c "$(as $B) $(ins $B 16:00 17:00)" >/tmp/s6.$$ 2>&1 ) &
wait
n="$(pq -d "${DB}c" -At -c "select count(*) from bookings where user_id='$B' and date=$DAY and status in ('pending','confirmed')")"
if [ "$n" = "1" ]; then echo "PASS rejection racing a competing request: hold released, competitor succeeds"; else echo "FAIL reject race rows=$n"; cat /tmp/s6.$$; rc=1; fi
rm -f /tmp/s?.$$

echo "== 4. pre-flight: existing overlapping pending/confirmed rows abort M2 and change nothing"
fresh "${DB}p"
pq -d "${DB}p" -1 -f "$M1" >/dev/null 2>&1
pq -d "${DB}p" -c "set session_replication_role = replica" -c "insert into bookings (court_id,user_id,date,start_time,end_time,status,play_type) select $COURT,'$A',date '2030-01-10','10:00','11:00','pending','singles'" \
  -c "insert into bookings (court_id,user_id,date,start_time,end_time,status,play_type) select $COURT,'$B',date '2030-01-10','10:30','11:30','pending','singles'" >/dev/null
before="$(pq -d "${DB}p" -At -c "select count(*)||'/'||md5(string_agg(id::text||status, ',' order by id)) from bookings")"
o="$(pq -d "${DB}p" -1 -f "$M2" 2>&1)" && { echo "FAIL M2 applied over overlapping rows"; rc=1; } || { echo "$o" | grep -q 'Cannot apply' && echo "PASS M2 refused to apply and said why" || { echo "FAIL wrong refusal: $o"; rc=1; }; }
after="$(pq -d "${DB}p" -At -c "select count(*)||'/'||md5(string_agg(id::text||status, ',' order by id)) from bookings")"
con="$(pq -d "${DB}p" -At -c "select string_agg(conname, ',') from pg_constraint where conrelid='public.bookings'::regclass and conname like 'bookings_no_overlapping%'")"
[ "$before" = "$after" ] && [ "$con" = "bookings_no_overlapping_confirmed" ] && echo "PASS data and old constraint untouched ($con)" || { echo "FAIL state changed: $before vs $after / $con"; rc=1; }

echo "== 5. mutation check: without the new constraint the verification script must FAIL"
fresh "${DB}m"
pq -d "${DB}m" -1 -f "$M1" >/dev/null 2>&1; pq -d "${DB}m" -1 -f "$M2" >/dev/null 2>&1
pq -d "${DB}m" -c "alter table bookings drop constraint bookings_no_overlapping_active" >/dev/null
mo="$(pq -d "${DB}m" -f supabase/tests/reservation_integrity.sql 2>&1 | { grep -E 'failures=' || true; })"
echo "$mo" | grep -q 'failures=0 ' && { echo "FAIL mutation not detected"; rc=1; } || echo "PASS mutation detected ($mo)"

echo "== 6. full chain: the ten pending migrations (Stages A-D, in plan order), then M1 and M2, then the verification script"
CHAIN=(20261022120000_resident_join_flow_hardening 20261023100000_admin_booking_review_notifications 20261023110000_hoa_application_hardening
  20261023120000_community_interest_requests 20261013130000_revoke_anon_execute_on_admin_rpcs 20261023140000_lock_down_anon_definer_rpcs_and_email_prefs
  20261023130000_report_photo_attach 20261030140000_report_photos_bucket_hardened 20261030130000_report_insert_requires_membership
  20261030120000_profile_photos_private_bucket 20261031100000_hoa_timezones 20261031110000_exclusive_pending_reservations)
fresh "${DB}f"
for f in "${CHAIN[@]}"; do
  pq -d "${DB}f" -1 -f "supabase/migrations/$f.sql" >/dev/null 2>&1 || { echo "FAIL chain stopped at $f"; rc=1; break; }
done
co="$(pq -d "${DB}f" -f supabase/tests/reservation_integrity.sql 2>&1 | { grep -E 'failures=' || true; })"
echo "$co" | grep -q 'failures=0 ' && echo "PASS full chain applies and the verification script passes ($co)" || { echo "FAIL full chain verification: $co"; rc=1; }
# the new functions must not be callable by anon
an="$(pq -d "${DB}f" -At -c "select string_agg(p.proname, ',') from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('expire_pending_bookings','get_amenity_busy_times','set_hoa_timezone','hoa_timezone_for_court','hoa_local_now_for_court','hoa_local_date_for_court') and has_function_privilege('anon', p.oid, 'EXECUTE')")"
[ -z "$an" ] && echo "PASS none of the new functions is executable by anon" || { echo "FAIL anon can execute: $an"; rc=1; }

exit $rc

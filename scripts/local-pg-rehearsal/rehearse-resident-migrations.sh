#!/usr/bin/env bash
# Rehearsal of the ten pending migrations in the EXACT staged order of docs/MIGRATION-PLAN-2026-10-30.md, on a disposable copy
# of a scratch restore. Never connects to Supabase. Output has no row contents.
# usage (repo root): bash scripts/local-pg-rehearsal/rehearse-resident-migrations.sh <port> <rehearsal-db> <restored-source-db> [--without=<version>]
#   --without=V: mutation check; the assertions MUST fail on a copy lacking that migration, with that migration's own FAIL line.
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
validate_args "${1:-}" "${2:-}"
SRC="${3:-}"; MODE="${4:-}"
[[ "$SRC" =~ ^restore[a-z0-9_]{0,40}$ ]] || { echo "source database name must match ^restore[a-z0-9_]{0,40}\$" >&2; exit 2; }
WITHOUT=""
if [[ "$MODE" == --without=* ]]; then WITHOUT="${MODE#--without=}"; [[ "$WITHOUT" =~ ^[0-9]{14}$ ]] || { echo "bad --without version" >&2; exit 2; }; fi

# Stage A (additive), B (security lockdown), C (reports), D (profile photos). Each migration is applied in its own transaction.
STAGES=(
  "A 20261022120000_resident_join_flow_hardening"
  "A 20261023100000_admin_booking_review_notifications"
  "A 20261023110000_hoa_application_hardening"
  "A 20261023120000_community_interest_requests"
  "B 20261013130000_revoke_anon_execute_on_admin_rpcs"
  "B 20261023140000_lock_down_anon_definer_rpcs_and_email_prefs"
  "C 20261023130000_report_photo_attach"
  "C 20261030140000_report_photos_bucket_hardened"
  "C 20261030130000_report_insert_requires_membership"
  "D 20261030120000_profile_photos_private_bucket"
)
apply_all() { # $1 database, $2 stop-before version ('' = apply all)
  local entry st f
  for entry in "${STAGES[@]}"; do
    st="${entry%% *}"; f="${entry#* }"
    [[ -n "${2:-}" && "$f" == "$2"_* ]] && return 0
    [[ -n "$WITHOUT" && "$f" == "$WITHOUT"_* ]] && { echo "SKIP (mutation) $f"; continue; }
    echo "apply [$st] $f"
    o="$(pq -d "$1" -1 -f "supabase/migrations/$f.sql" 2>&1)" || { echo "$o" | grep -v 'NOTICE:' >&2; echo "MIGRATION FAILED: $f" >&2; exit 1; }
  done
}

pq -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB TEMPLATE $SRC"
apply_all "$DB" ""

rc=0; out=""
for a in assert-resident-migrations.sql assert-report-bucket.sql; do
  r=0; o="$(pq -d "$DB" -f "$D/$a" 2>&1)" || r=$?   # each file's own status counts; a later pass must not hide an earlier failure
  out="$out"$'\n'"$o"; [ $r -eq 0 ] || rc=$r
done
echo "$out" | grep -E 'PASS|SKIP|FAIL|ERROR' | sed -E 's/^psql:[^ ]+ //; s/^(NOTICE|ERROR|WARNING): +//'

if [ -z "$WITHOUT" ] && [ $rc -eq 0 ]; then
  # Idempotency: the three new migrations must be re-appliable.
  for f in 20261030120000_profile_photos_private_bucket 20261030130000_report_insert_requires_membership 20261030140000_report_photos_bucket_hardened; do
    pq -d "$DB" -1 -f "supabase/migrations/$f.sql" >/dev/null 2>&1 || { echo "FAIL not re-appliable: $f" >&2; exit 1; }
  done
  echo "PASS the three new migrations re-apply cleanly"

  # Pre-flight, on a BASELINE: everything before 20261030130000 applied, an approved profile-only resident exists. The
  # migration must stop for the right reason AND leave the old policy and function exactly as they were.
  PF="${DB}pf"; validate_args "$PORT" "$PF"
  pq -d postgres -c "DROP DATABASE IF EXISTS $PF" -c "CREATE DATABASE $PF TEMPLATE $SRC"
  apply_all "$PF" 20261030130000 >/dev/null
  pq -d "$PF" <<'SQL'
SET session_replication_role = replica;
DO $$ DECLARE u uuid := gen_random_uuid(); h uuid; BEGIN
  SELECT id INTO h FROM public.hoas LIMIT 1;
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.profiles (id, hoa_id, hoa_status) VALUES (u, h, 'approved');
END $$;
SET session_replication_role = origin;
SQL
  snap() { pq -d "$PF" -At -c "select md5(coalesce((select string_agg(pg_get_expr(polwithcheck, polrelid), '|' order by polname) from pg_policy where polrelid = 'public.maintenance_reports'::regclass and polcmd = 'a'), '') || pg_get_functiondef('public.create_maintenance_report(uuid,text,text,text,text,uuid,text,text)'::regprocedure))"; }
  before="$(snap)"
  pf=0; pfo="$(pq -d "$PF" -1 -f supabase/migrations/20261030130000_report_insert_requires_membership.sql 2>&1)" || pf=$?
  [ $pf -ne 0 ] || { echo "FAIL pre-flight did not stop the migration" >&2; exit 1; }
  echo "$pfo" | grep -q "back-fill memberships before applying" || { echo "FAIL pre-flight stopped for the wrong reason" >&2; exit 1; }
  [ "$before" = "$(snap)" ] || { echo "FAIL the failed migration changed the old policy or function" >&2; exit 1; }
  echo "PASS pre-flight refuses while an approved profile-only resident exists, and leaves the old policy and function untouched"
  pq -d postgres -c "DROP DATABASE IF EXISTS $PF"
fi

if [ -n "$WITHOUT" ]; then
  case "$WITHOUT" in
    20261030120000) want='FAIL M8 bucket missing' ;;
    20261030130000) want='FAIL M9 direct insert into another community allowed' ;;
    20261030140000) want='FAIL M10 bucket missing' ;;
    *) want='' ;;
  esac
  if [ -z "$want" ]; then echo "no mutation expectation for $WITHOUT (only the three new migrations are asserted here)" >&2; exit 1; fi
  if [ $rc -eq 0 ]; then echo "MUTATION NOT CAUGHT" >&2; exit 1; fi
  # An unrelated error (connection, missing fixtures) must not count as a catch.
  echo "$out" | grep -qF "$want" || { echo "MUTATION FAILED FOR THE WRONG REASON (expected: $want)" >&2; echo "$out" | grep -E 'ERROR|FAIL' | head -3 >&2; exit 1; }
  echo "MUTATION CAUGHT (expected: $want)"; exit 0
fi
[ $rc -eq 0 ] || { echo "ASSERTIONS FAILED" >&2; exit 1; }
echo "ALL ASSERTIONS PASSED"

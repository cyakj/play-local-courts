#!/usr/bin/env bash
# Rehearsal of the two Resident-sprint migrations (20261030120000, 20261030130000) AFTER the seven earlier pending ones, on a
# disposable copy of a scratch restore. Never connects to Supabase. Output has no row contents.
# usage (repo root): bash scripts/local-pg-rehearsal/rehearse-resident-migrations.sh <port> <rehearsal-db> <restored-source-db> [--without=<version>]
#   --without=V: mutation check; the assertions MUST fail on a copy lacking that migration.
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
validate_args "${1:-}" "${2:-}"
SRC="${3:-}"; MODE="${4:-}"
[[ "$SRC" =~ ^restore[a-z0-9_]{0,40}$ ]] || { echo "source database name must match ^restore[a-z0-9_]{0,40}\$" >&2; exit 2; }
WITHOUT=""
if [[ "$MODE" == --without=* ]]; then WITHOUT="${MODE#--without=}"; [[ "$WITHOUT" =~ ^[0-9]{14}$ ]] || { echo "bad --without version" >&2; exit 2; }; fi
pq -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB TEMPLATE $SRC"
for f in 20261013130000_revoke_anon_execute_on_admin_rpcs 20261022120000_resident_join_flow_hardening 20261023100000_admin_booking_review_notifications 20261023110000_hoa_application_hardening 20261023120000_community_interest_requests 20261023130000_report_photo_attach 20261023140000_lock_down_anon_definer_rpcs_and_email_prefs 20261030120000_profile_photos_private_bucket 20261030130000_report_insert_requires_membership; do
  [[ -n "$WITHOUT" && "$f" == "$WITHOUT"_* ]] && { echo "SKIP (mutation) $f"; continue; }
  echo "apply $f"
  o="$(pq -d "$DB" -1 -f "supabase/migrations/$f.sql" 2>&1)" || { echo "$o" | grep -v 'NOTICE:' >&2; echo "MIGRATION FAILED: $f" >&2; exit 1; }
done
rc=0; out="$(pq -d "$DB" -f "$D/assert-resident-migrations.sql" 2>&1)" || rc=$?
echo "$out" | grep -E 'PASS|SKIP|FAIL|ERROR' | sed -E 's/^psql:[^ ]+ //; s/^(NOTICE|ERROR|WARNING): +//'
if [ -z "$WITHOUT" ] && [ $rc -eq 0 ]; then
  # Idempotency: both migrations must be re-appliable.
  for f in 20261030120000_profile_photos_private_bucket 20261030130000_report_insert_requires_membership; do
    pq -d "$DB" -1 -f "supabase/migrations/$f.sql" >/dev/null 2>&1 || { echo "FAIL not re-appliable: $f" >&2; exit 1; }
  done
  echo "PASS both migrations re-apply cleanly"
  # Pre-flight: an approved profile-only resident (no membership row) must make 20261030130000 stop, and leave the old policy.
  pf="$(pq -d "$DB" <<'SQL' 2>&1
BEGIN;
SET LOCAL session_replication_role = replica;
DO $$ DECLARE u uuid := gen_random_uuid(); h uuid; BEGIN
  SELECT id INTO h FROM public.hoas LIMIT 1;
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.profiles (id, hoa_id, hoa_status) VALUES (u, h, 'approved');
END $$;
SET LOCAL session_replication_role = origin;
\i supabase/migrations/20261030130000_report_insert_requires_membership.sql
ROLLBACK;
SQL
)" && { echo "FAIL pre-flight did not stop the migration" >&2; exit 1; }
  echo "$pf" | grep -q "back-fill memberships before applying" || { echo "FAIL pre-flight stopped for the wrong reason" >&2; exit 1; }
  echo "PASS pre-flight refuses to run while an approved profile-only resident exists"
fi
if [ -n "$WITHOUT" ]; then
  case "$WITHOUT" in
    20261030120000) want='FAIL M8 bucket missing' ;;
    20261030130000) want='FAIL M9 direct insert into another community allowed' ;;
    *) want='' ;;
  esac
  if [ -z "$want" ]; then echo "no mutation expectation for $WITHOUT (only the two Resident migrations are asserted here)" >&2; exit 1; fi
  if [ $rc -eq 0 ]; then echo "MUTATION NOT CAUGHT" >&2; exit 1; fi
  # An unrelated error (connection, missing fixtures) must not count as a catch.
  echo "$out" | grep -qF "$want" || { echo "MUTATION FAILED FOR THE WRONG REASON (expected: $want)" >&2; echo "$out" | grep -E 'ERROR|FAIL' | head -3 >&2; exit 1; }
  echo "MUTATION CAUGHT (expected: $want)"; exit 0
fi
[ $rc -eq 0 ] || { echo "ASSERTIONS FAILED" >&2; exit 1; }
echo "ALL ASSERTIONS PASSED"

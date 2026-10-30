#!/usr/bin/env bash
# Rehearsal of ALL SEVEN pending migrations on a disposable copy of a RESTORE OF THE REAL BACKUP (made by
# scripts/hosted-backup/verify-restore.ps1 logic; the restored database lives on a scratch server on 127.0.0.1).
# It never connects to Supabase. The copy is made with CREATE DATABASE ... TEMPLATE, so the restored source is untouched.
# Output has no row contents (counts, PASS/SKIP/FAIL lines, function names only).
# usage (repo root): bash scripts/local-pg-rehearsal/rehearse-real-restore.sh <port> <restored-source-db> <rehearsal-db> [--no-migrations | --without=<migration version>]
#   --no-migrations / --without=V: mutation checks. The assertions MUST fail on a copy lacking (that) migration, proving they are not vacuous.
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
validate_args "${1:-}" "${3:-}"
SRC="${2:-}"; MODE="${4:-}"
# The source must be a scratch RESTORE (name starts with "restore"), never a rehearsal database, and never the destination.
[[ "$SRC" =~ ^restore[a-z0-9_]{0,40}$ ]] || { echo "source database name must match ^restore[a-z0-9_]{0,40}\$" >&2; exit 2; }
[[ "$SRC" != "$DB" ]] || { echo "source and destination must differ" >&2; exit 2; }
WITHOUT=""
if [[ "$MODE" == --without=* ]]; then WITHOUT="${MODE#--without=}"; [[ "$WITHOUT" =~ ^[0-9]{14}$ ]] || { echo "bad --without version" >&2; exit 2; }; MODE=""
elif [[ "$MODE" != "" && "$MODE" != "--no-migrations" ]]; then echo "unknown option" >&2; exit 2; fi

pq -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB TEMPLATE $SRC"
pq -d "$DB" <<'SQL'
CREATE SCHEMA zz;
CREATE TABLE zz.baseline (tbl text PRIMARY KEY, n bigint, h text);
INSERT INTO zz.baseline
SELECT format('%I.%I', n.nspname, c.relname),
       (xpath('/row/c/text()', q.x))[1]::text::bigint, (xpath('/row/h/text()', q.x))[1]::text
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL (SELECT query_to_xml(format('select count(*) as c, coalesce(md5(string_agg(md5(t::text), %L order by md5(t::text))), %L) as h from %I.%I as t', ',', '-', n.nspname, c.relname), false, true, '') AS x) q
WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','auth','storage','supabase_migrations','backup_20261013')
  AND NOT (n.nspname = 'auth' AND c.relname IN ('sessions','refresh_tokens','audit_log_entries','flow_state','one_time_tokens','mfa_amr_claims'));
CREATE TABLE zz.fnpriv AS
SELECT p.oid::regprocedure::text AS sig, p.proname::text AS proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f';
SQL
# The function names M7 targets, read from the migration itself so the assertions cannot drift from it.
M7NAMES="$(sed -n '/names text\[\] := ARRAY\[/,/\];/p' supabase/migrations/20261023140000_lock_down_anon_definer_rpcs_and_email_prefs.sql | grep -oE "'[a-z_0-9]+'" | tr -d "'" | paste -sd, -)"
[[ "$M7NAMES" =~ ^[a-z_0-9]+(,[a-z_0-9]+)+$ ]] || { echo "could not read the M7 function list" >&2; exit 1; }
pq -d "$DB" -v n="$M7NAMES" <<'SQL2'
CREATE TABLE zz.m7names AS SELECT unnest(string_to_array(:'n', ',')) AS name;
SQL2
if [[ "$MODE" == "" ]]; then
  for f in 20261013130000_revoke_anon_execute_on_admin_rpcs 20261022120000_resident_join_flow_hardening 20261023100000_admin_booking_review_notifications 20261023110000_hoa_application_hardening 20261023120000_community_interest_requests 20261023130000_report_photo_attach 20261023140000_lock_down_anon_definer_rpcs_and_email_prefs; do
    [[ -n "$WITHOUT" && "$f" == "$WITHOUT"_* ]] && { echo "SKIP (mutation) $f"; continue; }
    echo "apply $f"
    mig_out="$(pq -d "$DB" -1 -f "supabase/migrations/$f.sql" 2>&1)" || { echo "$mig_out" | grep -v 'NOTICE:' >&2; echo "MIGRATION FAILED: $f" >&2; exit 1; }
  done
fi
rc=0; out="$(pq -d "$DB" -f "$D/assert-real-restore.sql" 2>&1)" || rc=$?
echo "$out" | grep -E 'PASS|SKIP|INFO|FAIL|ERROR' | sed -E 's/^psql:[^ ]+ //; s/^(NOTICE|ERROR|WARNING): +//'
if [ -n "$WITHOUT$MODE" ]; then
  # Mutation run (exit 0 = behaved as required). The assertions must fail with the FAIL line of THAT migration; an unrelated
  # SQL/connection error does not count. 20261013130000 is state-redundant with 20261023140000 and must NOT be caught.
  case "${WITHOUT:-none}" in
    none)            want='FAIL (table count|M1)' ;;
    20261013130000)  want='' ;;
    20261022120000)  want='FAIL (M2|M5 \(depends on M2\))' ;;
    20261023100000)  want='FAIL M3' ;;
    20261023110000)  want='FAIL M4' ;;
    20261023120000)  want='FAIL (M5|table count)' ;;
    20261023130000)  want='FAIL M6' ;;
    20261023140000)  want='FAIL M7' ;;
    *) echo "no mutation expectation for $WITHOUT" >&2; exit 1 ;;
  esac
  if [ -z "$want" ]; then
    [ $rc -eq 0 ] || { echo "UNEXPECTED: omitting the redundant migration changed the result" >&2; exit 1; }
    echo "REDUNDANT (as documented): the end state is identical without this migration"; exit 0
  fi
  [ $rc -ne 0 ] || { echo "MUTATION NOT CAUGHT: assertions passed without a migration" >&2; exit 1; }
  echo "$out" | grep -qE "ERROR: +$want" || { echo "MUTATION FAILED FOR THE WRONG REASON (expected: $want)" >&2; echo "$out" | grep -E 'ERROR' | head -3 >&2; exit 1; }
  echo "MUTATION CAUGHT (expected: $want)"; exit 0
fi
[ $rc -eq 0 ] || { echo "ASSERTIONS FAILED" >&2; exit 1; }
echo "ALL ASSERTIONS PASSED (SKIP lines, if any, are not passes)"

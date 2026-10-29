#!/usr/bin/env bash
# Negative case: duplicate open applications must make M4 FAIL with the intended error and roll back completely
# (no guard trigger, no index, every fixture row unchanged).
# usage (from the repo root): bash scripts/local-pg-rehearsal/rehearse-duplicate-apps.sh <port> <rehearsal-db-name>
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
validate_args "${1:-}" "${2:-}"

ERR="$(mktemp)"; trap 'rm -f "$ERR"' EXIT

pq -d postgres -c "CREATE DATABASE $DB"
pq -d "$DB" -f "$D/bootstrap-supabase-stub.sql" >/dev/null 2>&1
pq -d "$DB" -f "$D/fixture-reconstructed-baseline.sql"
pq -d "$DB" -f "$D/seed-existing-data.sql"
# Two OPEN applications by the same applicant for the same name (case/whitespace-insensitive) - added AFTER the baseline snapshot.
pq -d "$DB" -c "INSERT INTO public.hoa_applications (applicant_id, hoa_name, status) VALUES ('00000000-0000-0000-0000-0000000000a8','  SOME new hoa ','pending'), ('00000000-0000-0000-0000-0000000000a8','Some New HOA','needs_more_info')"

if pq -d "$DB" -1 -f supabase/migrations/20261023110000_hoa_application_hardening.sql 2>"$ERR"; then
  echo "FAIL: M4 succeeded despite duplicate open applications" >&2; exit 1
fi
grep -q "hoa_applications_one_open_per_name cannot be created" "$ERR" || { echo "FAIL: M4 failed, but not with the intended diagnostic:" >&2; cat "$ERR" >&2; exit 1; }

pq -d "$DB" -t -A -c "
DO \$\$
DECLARE bad int;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_hoa_application_write_trigger') THEN RAISE EXCEPTION 'guard trigger present after rollback'; END IF;
  IF to_regclass('public.hoa_applications_one_open_per_name') IS NOT NULL THEN RAISE EXCEPTION 'index present after rollback'; END IF;
  SELECT count(*) INTO bad FROM public.zz_rehearsal_baseline b
    LEFT JOIN public.hoa_applications a ON b.tbl = 'hoa_applications' AND a.id::text = b.row_key
   WHERE b.tbl = 'hoa_applications' AND (a.id IS NULL OR md5(to_jsonb(a)::text) <> b.h);
  IF bad <> 0 THEN RAISE EXCEPTION '% baseline application rows missing/changed', bad; END IF;
  IF (SELECT count(*) FROM public.hoa_applications) <> 4 THEN RAISE EXCEPTION 'application row count changed'; END IF;
END \$\$;"
echo "OK: M4 refused duplicate open applications with the intended error and rolled back completely"

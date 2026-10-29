#!/usr/bin/env bash
# Repeatable rehearsal: fresh scratch database on the DISPOSABLE local server -> Supabase stub -> reconstructed fixture ->
# seed -> apply the changed migrations one at a time -> behavioural assertions (fail-fast).
# usage (from the repo root): bash scripts/local-pg-rehearsal/rehearse.sh <port> <rehearsal-db-name>
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
validate_args "${1:-}" "${2:-}"

pq -d postgres -c "CREATE DATABASE $DB"
# The stub is idempotent for the cluster-wide roles; any other error stops the run.
out="$(pq -d "$DB" -f "$D/bootstrap-supabase-stub.sql" 2>&1)" || { echo "$out" >&2; echo "bootstrap failed" >&2; exit 1; }
pq -d "$DB" -f "$D/fixture-reconstructed-baseline.sql"
pq -d "$DB" -f "$D/seed-existing-data.sql"
for f in 20261022120000_resident_join_flow_hardening 20261023110000_hoa_application_hardening 20261023140000_lock_down_anon_definer_rpcs_and_email_prefs; do
  echo "apply $f"; pq -d "$DB" -1 -f "supabase/migrations/$f.sql"
done
pq -d "$DB" -t -A -f "$D/assert-after-upgrade.sql" | grep -v '^[0-9a-f-]\{36\}$' | grep -v '^$'
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "ASSERTIONS FAILED" >&2; exit 1; }

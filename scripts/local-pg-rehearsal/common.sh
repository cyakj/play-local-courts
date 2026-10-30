#!/usr/bin/env bash
# Shared guards for the local rehearsal scripts. Source this file; do not run it.
# These scripts only ever talk to 127.0.0.1 and only to databases whose name starts with "rehearsal".
set -euo pipefail

PG_BIN="${PG_BIN:-/c/Users/info/tenisx-tools/pgbin17-11/pgsql/bin}"
# Drop every inherited libpq routing/credential override (PGHOSTADDR, PGSERVICE, PGPASSFILE, PGSSLMODE ...); PG_BIN is not one.
for _v in $(env | grep -oE '^PG[A-Z0-9]+' || true); do unset "$_v"; done
export PGHOSTADDR=127.0.0.1 PGOPTIONS="-c search_path=public,extensions"

validate_args() {
  PORT="${1:-}"; DB="${2:-}"
  [[ "$PORT" =~ ^[0-9]{4,5}$ ]] && (( PORT >= 1024 && PORT <= 65535 )) || { echo "port must be a number 1024-65535" >&2; exit 2; }
  [[ "$DB" =~ ^rehearsal[a-z0-9_]{0,40}$ ]] || { echo "database name must match ^rehearsal[a-z0-9_]{0,40}\$ (disposable scratch databases only)" >&2; exit 2; }
}

# psql against the scratch server. Always -h 127.0.0.1; the database is passed as a plain validated name.
# -X: never read a psql startup file. The only non-rehearsal database ever opened is the maintenance database "postgres",
# solely to CREATE/DROP the validated rehearsal database (and to CREATE ... TEMPLATE from a scratch restore).
pq() { "$PG_BIN/psql.exe" -X -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

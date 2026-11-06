#!/usr/bin/env bash
# Creates a disposable local PostgreSQL scratch server OUTSIDE the repo and the backup folder, and restores a verified backup's
# full.dump into a database named restore_ref. READ-ONLY on the backup folder; never contacts Supabase.
# usage (repo root): bash scripts/local-pg-rehearsal/setup-scratch-restore.sh <port> <backup-dir> <scratch-dir>
#   <scratch-dir> must not exist yet. Stop/remove with:  pg_ctl -D <scratch-dir>/data -m fast stop ; then delete <scratch-dir>.
D="$(dirname "${BASH_SOURCE[0]}")"
source "$D/common.sh"
PORT="${1:-}"; BK="${2:-}"; SCR="${3:-}"
[[ "$PORT" =~ ^[0-9]{4,5}$ ]] && (( PORT >= 1024 && PORT <= 65535 )) || { echo "bad port" >&2; exit 2; }
[ -f "$BK/RESTORE-VERIFIED.txt" ] && [ -f "$BK/full.dump" ] || { echo "backup is not a restore-verified backup" >&2; exit 2; }
[ ! -e "$SCR" ] || { echo "$SCR already exists" >&2; exit 2; }
case "$SCR" in "$BK"*) echo "scratch dir must be outside the backup folder" >&2; exit 2;; esac
# PG_SERVER_BIN: run the SERVER from another major version (e.g. 15.8 to match hosted) while the clients (psql/pg_restore, 17) stay as in common.sh.
SRV_BIN="${PG_SERVER_BIN:-$PG_BIN}"
mkdir -p "$SCR"
"$SRV_BIN/initdb.exe" -D "$SCR/data" -U postgres -A trust -E UTF8 --locale=C >"$SCR/initdb.out" 2>&1
"$SRV_BIN/pg_ctl.exe" -D "$SCR/data" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$SCR/server.log" -w start >"$SCR/start.out" 2>&1
# Fail loudly if the server is not the requested major version (PG_EXPECT_MAJOR, e.g. 15).
if [ -n "${PG_EXPECT_MAJOR:-}" ]; then
  got="$("$PG_BIN/psql.exe" -X -h 127.0.0.1 -p "$PORT" -U postgres -At -d postgres -c "show server_version_num" | cut -c1-2)"
  [ "$got" = "$PG_EXPECT_MAJOR" ] || { echo "server major version is $got, expected $PG_EXPECT_MAJOR" >&2; exit 1; }
fi
pq -d postgres -c "create database restore_ref"
# roles recorded from the live project (names only)
while IFS='|' read -r name _; do
  [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_.-]*$ ]] || { echo "bad role name" >&2; exit 1; }
  [ "$name" = postgres ] || pq -d postgres -c "create role \"$name\" nologin" </dev/null 2>/dev/null || true   # </dev/null: psql must not eat the loop's stdin
done < "$BK/roles.txt"
# extensions available in the portable build (pg_graphql / pgjwt / supabase_vault are not).
# btree_gist is created in PUBLIC for the restore: pg_restore resolves the default gist opclass of bookings' EXCLUDE constraint through
# the restore search_path (public), so an opclass living in "extensions" fails with "uuid has no default operator class". It is moved to
# "extensions" afterwards, which is where the hosted project has it.
pq -d restore_ref -c "create schema if not exists extensions" </dev/null
while IFS='|' read -r ext _ sch; do
  [ "$ext" = plpgsql ] && continue
  [[ "$ext" =~ ^[A-Za-z0-9_-]+$ && "$sch" =~ ^[A-Za-z0-9_]+$ ]] || continue
  [ "$ext" = btree_gist ] && sch=public
  pq -d restore_ref -c "create schema if not exists \"$sch\"" -c "create extension if not exists \"$ext\" schema \"$sch\"" </dev/null 2>/dev/null || echo "extension not available locally: $ext"
done < "$BK/extensions.txt"
# PGOPTIONS must not leak into pg_restore. The one expected error is 'schema "public" already exists' (public was used above).
env -u PGOPTIONS "$PG_BIN/pg_restore.exe" --no-owner -h 127.0.0.1 -p "$PORT" -U postgres -d restore_ref "$BK/full.dump" >"$SCR/restore.out" 2>"$SCR/restore.err" || echo "pg_restore exit $? (expected 1: see $SCR/restore.err)"
pq -d restore_ref -c "alter extension btree_gist set schema extensions" </dev/null
echo "restore errors (expect only 'schema public already exists'): $(grep -c 'error:' "$SCR/restore.err" || true)"
pq -d restore_ref -At -c "select 'users='||count(*) from auth.users" -c "select 'bookings='||count(*) from public.bookings" -c "select 'hoas='||count(*) from public.hoas" -c "select 'server='||version()"

# TENISX REAL backup 20261029-235117-04c5d3: why the first restore test said NOT VERIFIED, and what it proves now (2026-10-30)

Nothing here touched TENISX REAL. All work used the backup files and a throw-away PostgreSQL 17.11 on 127.0.0.1. The backup folder was only read (its checksums and files are unchanged; the first-run evidence is also copied to `C:\Users\info\tenisx-backups\evidence-run1-20261029`).

## Why it said RESTORE NOT VERIFIED
- The live project runs **PostgreSQL 15.8**; the restore test ran on **17.11**. Every table row matched (199 strict lines, 0 differences in data).
- Six strict differences were hash mismatches of *definition text* for constraints (455), policies (228) and views (2). Counts matched. Diffing the live `schema-only.sql` against a `pg_dump` of the restored copy shows the cause: PostgreSQL 16+ prints the same expression differently.
  - Nested `OR` / `AND` chains are flattened: `((((a OR b) OR c) OR d)` became `(a OR b OR c OR d)`. Affected: 2 `open_match_listings` check constraints and 4 `matches` / `match_reschedule_requests` policies.
  - A single-table view prints `SELECT id, name` instead of `SELECT hoas.id, hoas.name`: 1 view.
- The four "privilege" differences are only roles that Supabase owns (`postgres`, `dashboard_user`, `supabase_storage_admin`) on `auth` and `storage` objects, plus PostgreSQL 17's new `MAINTAIN` privilege. A plain local server has one owner, so those grants collapse. **No grant for `anon`, `authenticated`, `PUBLIC` or any other role differed, and nothing in the `public` schema.**
- So this was a verification-method limit (comparing text printed by two PostgreSQL versions), not missing or altered data or security rules.

## What was changed (scripts/hosted-backup)
- When the live major version (read from the `schema-only.sql` header) differs from the scratch server, the three inventories keep a strict **count** comparison, but their text hash is replaced by a new mandatory **structure cross-check**.
- Structure cross-check: `schema-only.sql` (a separate live `pg_dump`) is rebuilt in a second database on the same scratch server; per-object hashes of every constraint, policy (command, permissive, roles, USING/WITH CHECK), view, and every grant (table, column, function, schema, default ACL, with grant option) for all roles except the Supabase-internal ones must be identical to the restored `full.dump`. Zero schema load errors are required.
- `schema-only.sql` is now a required manifest entry.
- New backups also record version-independent "shape" rows (policy name/command/roles, constraint name/type, view names) from the live project; these stay strict across versions.
- `selftest.ps1` now also proves the verifier REJECTS: a schema dump missing an RLS policy, missing a grant to an API role, a policy weakened to `true`, a manifest that omits `schema-only.sql`, plus masking unit tests. (Even when the forger repairs the manifest.)

## Result on the real backup (re-run 2026-10-30)
`RESTORE VERIFIED`. pg_restore exit 0 with 0 error lines; 199 strict lines, 0 differences; structure cross-check: 2,744 objects, 0 differences, 0 load errors. Recorded counts: auth.users 8, auth.identities 8, profiles 7, hoa_memberships 5, bookings 47, hoas 3, maintenance_reports 81 (live = restored). Login tokens were stable and match.

## What this does NOT prove (read this)
- The cross-check compares two artifacts produced by the same live `pg_dump`; a defect that corrupted both identically would pass. Independent live anchors are the object counts (and shape rows in future backups). For THIS backup there is also the manual text diff above (only the 8 deparse items and internal-role grants). To remove the limit entirely, verify on a PostgreSQL **15** server (then everything is strict).
- Ownership, role attributes/memberships and Supabase-internal grants are not proven. Storage files, Auth dashboard settings and Edge Function secrets are not in the backup (see `BACKUP-HOWTO.md`).
- 3 extensions (`pg_graphql`, `pgjwt`, `supabase_vault`) are not available in the portable server; the restore does not depend on them.
- The backup is a point in time (taken 2026-10-29 ~23:51 local); a new backup is needed immediately before any hosted change.

## Answers
1. Accounts and bookings are recoverable from this backup (8 accounts with their password hashes, 47 bookings, memberships, 81 reports).
2. Another backup is **not** required for restore confidence; take a fresh one right before applying migrations if anyone used the app since.
3. Independent review: Codex, three rounds (see RESTART.md for the verdicts).

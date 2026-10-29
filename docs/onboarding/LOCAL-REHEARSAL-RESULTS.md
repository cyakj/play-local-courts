# Local PostgreSQL rehearsal - what was actually executed (2026-10-28)

Nothing here touched TENISX REAL or any hosted project. Everything ran on a throw-away PostgreSQL 17.11 started from the portable binaries in `C:\Users\info\tenisx-tools\pgbin17-11` (no admin rights, bound to 127.0.0.1:54399, data directory in the session scratchpad). **This is NOT a restore of the real backup and must not be described as one.** No real verified backup exists yet.

Reproduce: start a local server, then from the repo root `bash scripts/local-pg-rehearsal/rehearse.sh <port> rehearsal_x` and `bash scripts/local-pg-rehearsal/rehearse-duplicate-apps.sh <port> rehearsal_y`. The scripts connect only to 127.0.0.1, accept only database names starting with `rehearsal`, create the database themselves and fail fast. They create cluster-wide roles (`anon`, `authenticated`, the server-side service role, `authenticator`, `supabase_admin`) on that scratch server only.

## What the environment is
- `bootstrap-supabase-stub.sql`: roles `anon`/`authenticated`/the server-side service role, minimal `auth.users` + `auth.uid()/role()/jwt()`, minimal `storage.buckets/objects`, default Supabase-style grants. No PostgREST, GoTrue, Realtime, Storage API or edge functions.
- `fixture-reconstructed-baseline.sql`: tables the changed migrations touch (`hoas`, `hoa_memberships`, `community_join_requests`, `hoa_applications`, `email_preferences`, `user_roles`) with the pre-upgrade RLS policies, reconstructed from `src/lib/types.ts` and repo migrations. Hosted drift, hosted triggers and any policy not reproduced here are **unknown**.
- `seed-existing-data.sql`: 8 fake users, 4 communities (approved / pending / expired invite / disabled invite), memberships in several states, legacy request-only rows, 2 applications, a bucket row with NULL `allowed_mime_types`, 1 email-preference row.
- Why not the repo's own history? Replaying `supabase/migrations` from empty fails: core tables (`hoas`, `hoa_memberships`, `bookings`, `courts`, `hoa_notifications`, ...) predate the migration files, so the history is not self-contained (tolerant replay applied only part of it; see `replay-tolerant.py`). A faithful schema needs the real backup restore.

## Executed and passed (against the fixture)
Applied `20261022120000` (M2), `20261023110000` (M4), `20261023140000` (M7), each in its own transaction, in that order, to the seeded database, then ran `assert-after-upgrade.sql` (all passed):
- Existing rows preserved: a pre-upgrade snapshot (md5 of each full row, 24 rows: users, hoas, memberships, join requests, applications, email preference, bucket) is compared by key after the upgrade; none is missing or modified; the M2 backfill added exactly one pending (legacy request-only user) and one rejected (legacy rejected user) membership; 4 join requests unchanged.
- M4: bucket row unchanged (`allowed_mime_types` still NULL, size limit and privacy unchanged); guard trigger and the unique index exist.
- M2: a resident direct INSERT into `hoa_memberships` is refused by RLS; unverified-email users cannot use either join RPC; bad / unapproved-community / expired / disabled invite codes are all refused (42501); a valid invite creates a pending resident membership with `joined_via_invite` and `invite_code_used` plus the join request; a second join is refused; withdraw removes both pending rows and returns true, then false; withdraw returns false and deletes nothing for approved and rejected members and does not strip an approved member's request row; the admin-creator self-membership policy still works; anon cannot call the new RPCs.
- M7: anon lost EXECUTE on `get_email_preferences`/`set_active_hoa`; authenticated kept them; a function previously closed to authenticated (`assign_coach_role`) stayed closed; the migration helper is not callable by authenticated; service role keeps access; a signed-in user can read their own email preferences but cannot read or create another user's.
- Negative case: with duplicate open applications seeded, M4 failed with the intended diagnostic and rolled back completely (no guard trigger, no index, baseline application rows unchanged).
- Assertion sanity (mutation check): running `assert-after-upgrade.sql` on a seeded database where the migrations were NOT applied fails (`memberships expected 6, got 4`), so the assertions are not vacuous. A first version of the duplicate-join check was vacuous (it caught its own exception); Codex found that and it was rewritten.
- Static tests: `npx playwright test -c playwright.logic.config.ts` (Node-only) - see RESTART.md for the final count.

## NOT executed / still unverified
- Migrations 1 (`20261013130000`), 3 (`20261023100000`), 5 (`20261023120000`), 6 (`20261023130000`) were **not** run on any database (unchanged this session; they were not rehearsed because their prerequisites - bookings, notifications, reports, storage objects, admin RPC signatures - are not in the reconstructed fixture).
- Fresh-install replay of the full chain: not achievable (see above).
- Reservations/bookings, notification triggers, the real hosted triggers on `hoa_memberships`, `update_email_preference`'s body, real Supabase Auth (GoTrue) behaviour, PostgREST/REST headers (needed by `attach_report_photo`), Storage API, Realtime, edge functions: not exercised.
- Hosted migration-history reconciliation, lock timing/behaviour under load: not exercised.
- The unmodified earlier risks: advisor findings (security-definer views, mutable search_path, leaked-password protection, Postgres upgrade).
- Physical-device (Expo Go / iPhone) behaviour: not tested.

Conclusion: M2, M4 and M7 behave as designed on a plausible schema. The seven files are **not yet proven safe for TENISX REAL**; the next gate is a real backup followed by a rehearsal on a restore of it.

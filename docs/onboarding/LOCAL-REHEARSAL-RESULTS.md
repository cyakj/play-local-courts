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

---
# Update 2026-10-30: all seven migrations on a restore of the REAL backup (still NOTHING applied to any hosted database)

Run: `bash scripts/local-pg-rehearsal/rehearse-real-restore.sh <port> restore_test rehearsal_real2` (the restored backup lives on a scratch server on 127.0.0.1; the rehearsal copy is `CREATE DATABASE ... TEMPLATE`). Scratch server is **PostgreSQL 17.11; the live project is 15.8**, so PG15-specific behaviour is not proven. No Supabase API layer (PostgREST/GoTrue/Storage API): roles and JWT claims are simulated with `SET LOCAL ROLE` + `request.jwt.claims`, request headers with `request.headers`.

Executed (each file in its own transaction, in runbook order): `20261013130000`, `20261022120000`, `20261023100000`, `20261023110000`, `20261023120000`, `20261023130000`, `20261023140000` - all applied with no error on the real data. Then `assert-real-restore.sql`:
- **Preservation:** 189 pre-existing tables compared by per-row hash before/after: 0 changed (auth users 8, identities 8, profiles 7, memberships 5, bookings 47, hoas 3, reports 81, applications 1, notifications 183, messages 32, ...). Only the two M5 tables were added. The M2 backfill added 0 membership rows (no legacy request-only users exist in the real data; read-only section 1b of `HOSTED-VERIFY-READONLY.sql` was empty). The M3 notification type CHECK accepted all 183 existing notifications.
- **M1:** anon lost the three RPCs, authenticated kept them (also verified alone on a fresh copy).
- **M3:** pending booking notifies the community's admin exactly once and not the booker; a confirmed booking notifies nobody (rolled back).
- **M5:** RLS on, anon closed, submit works, duplicate refused, requester sees only their own, another account sees none, non-reviewer cannot update (rolled back).
- **M6:** missing API headers refused (specific reason), other user's folder refused (specific reason), a stranger cannot attach to someone else's report, owner attach writes the https URL, second attach is a no-op (rolled back).
- **M7:** anon and PUBLIC closed on the four functions; own preferences readable; another account refused on get/create/update. SECURITY DEFINER functions in `public` executable by anon: **58 before, 18 after** (the 18 are mostly RLS helper predicates plus the intentionally public invite/survey lookups; see "Still open").
- **M2/M4:** structure only (resident write policies gone, exact RPC signatures, trigger enabled on the right table, partial unique index with intended predicate). Behaviour of M2/M4 is covered by `rehearse.sh` on the fixture.
- **Mutation checks (assertions are not vacuous):** omitting each migration in turn is caught for M2, M3, M4, M5, M6, M7 and for "none applied". Omitting M1 alone is not observable at the end state because M7 revokes anon on the same three functions; that is expected, M1 is state-redundant once M7 is applied.

## New findings from the real data (verified offline, not on the hosted dashboard)
1. **The `report-photos` Storage bucket and its policies do not exist on TENISX REAL** (`storage.buckets` has avatars, branding, hoa-documents, hoa-verification-documents, score-photos; no report-photo policies). The repo migration `20260529120441_report_photos_bucket.sql` is not in the hosted migration history. Today report photo upload fails, and M6 (`attach_report_photo`) cannot work without the bucket. **Decision needed before M6:** apply that older migration (note it lets any signed-in user upload to any folder and has no UPDATE policy although the app uploads with `upsert: true`; tighten to the user's own folder if you want M6's folder rule to be the only path).
2. The hosted body of `update_email_preference` is now known: it already refuses other users ("Access denied") and has no fixed `search_path`. M7 does not rewrite it; it only revokes anon/PUBLIC.
3. `package.json` is Expo SDK 57 / React Native 0.86 (CLAUDE.md still says 56 / 0.85).

## Still open / not proven
Hosted PG15 behaviour; real PostgREST/GoTrue/Storage API; performance and locking on the hosted instance; the 18 remaining anon-executable definer functions and the Supabase advisor items listed in `MIGRATION-RISK-REVIEW.md` (not fixed by these migrations); migration-history reconciliation (the hosted history uses apply-time versions and many repo files, e.g. `report_photos_bucket`, are not recorded).

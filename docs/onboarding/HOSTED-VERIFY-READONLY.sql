-- READ-ONLY verification queries for the hosted TenisX test project (hqqlrliakttqsbalvuyz).
-- Paste ONE section at a time into the Supabase SQL editor. Every statement is a SELECT; nothing here changes data.
-- Sections 0 and 1 output counts and fingerprints only (no emails, no password hashes, no tokens).
-- Run section 1 BEFORE and AFTER any migration and compare: identical output means accounts, passwords, memberships and
-- reservations were preserved, EXCEPT the expected additions described in section 1b. Tables fingerprinted by id only
-- (profiles, hoas, applications, notifications, messages) prove the rows still exist, not that their contents are unchanged.

-- ===== 0. Identity =====
select current_database() as db, (select count(*) from auth.users) as auth_users, now() as checked_at;

-- ===== 1. Preservation fingerprint (save the result; re-run after applying migrations) =====
select 'auth.users' as t, count(*) as n, md5(string_agg(id::text, ',' order by id)) as fingerprint from auth.users
union all select 'auth.users credentials+email', count(*), md5(string_agg(id::text || coalesce(encrypted_password,'') || coalesce(email,''), ',' order by id)) from auth.users
union all select 'auth.identities', count(*), md5(string_agg(id::text, ',' order by id)) from auth.identities
union all select 'profiles', count(*), md5(string_agg(id::text, ',' order by id)) from public.profiles
union all select 'hoas', count(*), md5(string_agg(id::text, ',' order by id)) from public.hoas
union all select 'hoa_memberships', count(*), md5(string_agg(id::text || user_id::text || hoa_id::text || status::text || role::text, ',' order by id)) from public.hoa_memberships
union all select 'bookings', count(*), md5(string_agg(concat_ws('|', id, user_id, court_id, date, start_time, end_time, status, cancelled_by), ',' order by id)) from public.bookings
union all select 'maintenance_reports', count(*), md5(string_agg(id::text, ',' order by id)) from public.maintenance_reports
union all select 'hoa_applications', count(*), md5(string_agg(id::text, ',' order by id)) from public.hoa_applications
union all select 'hoa_notifications', count(*), md5(string_agg(id::text, ',' order by id)) from public.hoa_notifications
union all select 'messages', count(*), md5(string_agg(id::text, ',' order by id)) from public.messages;

-- ===== 1a. Per-row fingerprints (save these too). After migration 2, re-run and compare BY ID: every baseline id must still
-- be present with the same hash. New ids (the backfill, and the notifications it triggers) are checked separately. =====
select 'hoa_memberships' as t, id, md5(m::text) as row_hash from public.hoa_memberships m
union all select 'bookings', id, md5(b::text) from public.bookings b
union all select 'hoa_notifications', id, md5(n::text) from public.hoa_notifications n
order by 1, 2;

-- ===== 1b. Expected additions: migration 2 (20261022120000) section 7/7b adds a pending or rejected membership row for
-- legacy join requests that have none (approved communities only; never changes an existing membership). Run BEFORE
-- applying; the count is how many rows memberships are expected to grow by (each new pending row can also make the existing
-- trigger add hoa_notifications rows for that community's admins, so notification COUNT may grow too; old ids must stay). After applying, accept the
-- new membership baseline only if the old rows are unchanged and the count grew by exactly this number.
select r.status, count(*) as rows_to_be_added
  from public.community_join_requests r
  join public.hoas h on h.id = r.hoa_id and h.approval_status = 'approved'
 where r.status in ('pending', 'rejected')
   and not exists (select 1 from public.hoa_memberships m where m.user_id = r.user_id and m.hoa_id = r.hoa_id)
 group by r.status;

-- ===== 2. C1: every policy on profiles (look for profiles_select_authenticated with auth.role() = 'authenticated') =====
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'profiles' order by policyname;

-- ===== 3. C2: ladders policies and the function the insert policy calls =====
select policyname, cmd, roles, with_check from pg_policies where schemaname = 'public' and tablename = 'ladders' order by policyname;
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'can_create_ladder';

-- ===== 4. C3: SECURITY DEFINER functions in public that anon can execute =====
select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1;

-- ===== 5. C4: row level security on every public table (expect relrowsecurity = true everywhere) =====
select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' order by c.relrowsecurity, c.relname;

-- ===== 6. C6: the three email-preference functions as they exist on the hosted database =====
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('get_email_preferences', 'create_default_email_preferences', 'update_email_preference');

-- ===== 7. backup_20261013 schema: what it holds and who can reach it =====
select c.relname, c.relkind, c.reltuples::bigint as approx_rows from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'backup_20261013' and c.relkind in ('r', 'v', 'm') order by 1;
select r.rolname, has_schema_privilege(r.rolname, 'backup_20261013', 'USAGE') as schema_usage
  from pg_roles r where r.rolname in ('anon', 'authenticated', 'authenticator');
-- PARTIAL evidence only: the API's exposed-schema list is a dashboard setting (Project Settings -> API -> Exposed schemas;
-- backup_20261013 must NOT be listed there). rolconfig may be empty even when the setting is configured, so check the dashboard.
select rolname, rolconfig from pg_roles where rolname = 'authenticator';
-- Effective privileges (includes PUBLIC grants and inherited roles) of the API roles on every relation in that schema:
select c.relname, r.rolname,
       has_table_privilege(r.rolname, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.rolname, c.oid, 'INSERT,UPDATE,DELETE') as can_write,
       has_any_column_privilege(r.rolname, c.oid, 'SELECT') as can_select_any_column
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) as r(rolname)
 where n.nspname = 'backup_20261013' and c.relkind in ('r', 'v', 'm', 'p') order by 1, 2;
select p.oid::regprocedure as fn, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec, has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'backup_20261013';

-- ===== 8. Views flagged by the advisor =====
select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('referral_leaderboard', 'public_hoa_directory');
select pg_get_viewdef('public.public_hoa_directory'::regclass, true);

-- ===== 9. Which migrations from 2026-10-13 onward are already on the project =====
select version, name from supabase_migrations.schema_migrations where version >= '20261012' order by version;

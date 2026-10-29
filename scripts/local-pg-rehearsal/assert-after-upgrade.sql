-- Behavioural assertions after applying M2 -> M4 -> M7 to the seeded rehearsal database. Every check RAISEs on failure;
-- psql runs with ON_ERROR_STOP so a failing check exits non-zero. Executes as roles via SET LOCAL ROLE + fake JWT claims.
\set ON_ERROR_STOP 1
\set u1 '00000000-0000-0000-0000-0000000000a1'
\set u2 '00000000-0000-0000-0000-0000000000a2'
\set u3 '00000000-0000-0000-0000-0000000000a3'
\set u4 '00000000-0000-0000-0000-0000000000a4'
\set u5 '00000000-0000-0000-0000-0000000000a5'
\set u6 '00000000-0000-0000-0000-0000000000a6'
\set u7 '00000000-0000-0000-0000-0000000000a7'
\set u8 '00000000-0000-0000-0000-0000000000a8'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'

-- ===== 1. existing data preserved / expected additive backfill =====
DO $$
DECLARE missing int; changed int; total int;
BEGIN
  SELECT count(*) INTO total FROM public.zz_rehearsal_baseline;
  IF total <> 8+4+4+4+2+1+1 THEN RAISE EXCEPTION 'baseline snapshot has % rows, expected 24', total; END IF;
  WITH cur AS (
    SELECT 'auth.users' tbl, id::text k, md5(to_jsonb(t)::text) h FROM auth.users t
    UNION ALL SELECT 'hoas', id::text, md5(to_jsonb(t)::text) FROM public.hoas t
    UNION ALL SELECT 'hoa_memberships', id::text, md5(to_jsonb(t)::text) FROM public.hoa_memberships t
    UNION ALL SELECT 'community_join_requests', id::text, md5(to_jsonb(t)::text) FROM public.community_join_requests t
    UNION ALL SELECT 'hoa_applications', id::text, md5(to_jsonb(t)::text) FROM public.hoa_applications t
    UNION ALL SELECT 'email_preferences', id::text, md5(to_jsonb(t)::text) FROM public.email_preferences t
    UNION ALL SELECT 'storage.buckets', id, md5(to_jsonb(t)::text) FROM storage.buckets t)
  SELECT count(*) FILTER (WHERE c.k IS NULL), count(*) FILTER (WHERE c.k IS NOT NULL AND c.h <> b.h)
    INTO missing, changed
  FROM public.zz_rehearsal_baseline b LEFT JOIN cur c ON c.tbl = b.tbl AND c.k = b.row_key;
  IF missing <> 0 THEN RAISE EXCEPTION '% original rows are missing after the upgrade', missing; END IF;
  IF changed <> 0 THEN RAISE EXCEPTION '% original rows were modified by the upgrade', changed; END IF;
END $$;

DO $$
DECLARE n int; m record;
BEGIN
  SELECT count(*) INTO n FROM auth.users;               IF n <> 8 THEN RAISE EXCEPTION 'users changed: %', n; END IF;
  SELECT count(*) INTO n FROM public.hoas;              IF n <> 4 THEN RAISE EXCEPTION 'hoas changed: %', n; END IF;
  SELECT count(*) INTO n FROM public.hoa_applications;  IF n <> 2 THEN RAISE EXCEPTION 'applications changed: %', n; END IF;
  SELECT count(*) INTO n FROM public.email_preferences; IF n <> 1 THEN RAISE EXCEPTION 'email prefs changed: %', n; END IF;
  -- original 4 memberships untouched + 1 pending backfill (u4) + 1 rejected backfill (u3) = 6
  SELECT count(*) INTO n FROM public.hoa_memberships;   IF n <> 6 THEN RAISE EXCEPTION 'memberships expected 6, got %', n; END IF;
  SELECT status INTO m FROM public.hoa_memberships WHERE user_id = '00000000-0000-0000-0000-0000000000a1'::uuid; IF m.status <> 'approved' THEN RAISE EXCEPTION 'u1 changed'; END IF;
  SELECT status INTO m FROM public.hoa_memberships WHERE user_id = '00000000-0000-0000-0000-0000000000a4'::uuid; IF m.status IS DISTINCT FROM 'pending'  THEN RAISE EXCEPTION 'u4 backfill missing'; END IF;
  SELECT status INTO m FROM public.hoa_memberships WHERE user_id = '00000000-0000-0000-0000-0000000000a3'::uuid; IF m.status IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'u3 backfill missing'; END IF;
  SELECT count(*) INTO n FROM public.community_join_requests; IF n <> 4 THEN RAISE EXCEPTION 'join requests changed: %', n; END IF;
END $$;

-- ===== 2. M4: bucket untouched, guard + unique index present =====
DO $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM storage.buckets WHERE id = 'hoa-verification-documents';
  IF b.allowed_mime_types IS NOT NULL THEN RAISE EXCEPTION 'bucket allowlist was overwritten: %', b.allowed_mime_types; END IF;
  IF b.file_size_limit <> 10485760 OR b.public THEN RAISE EXCEPTION 'bucket config changed'; END IF;
  IF to_regclass('public.hoa_applications_one_open_per_name') IS NULL THEN RAISE EXCEPTION 'unique index missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_hoa_application_write_trigger' AND tgenabled = 'O') THEN RAISE EXCEPTION 'guard trigger missing'; END IF;
END $$;

-- ===== 3. M2: legacy direct writes are now blocked, RPC paths work =====
-- u8 has NO membership in c1, so only RLS can be what stops this insert (a unique_violation would not prove RLS).
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u8', true);
DO $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000000c1', 'resident', 'pending');
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'direct resident INSERT into hoa_memberships was not blocked by RLS'; END IF;
END $$;
ROLLBACK;

-- unverified email cannot join (plain + invite RPC)
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u5', true);
DO $$
BEGIN
  BEGIN PERFORM public.request_hoa_membership('00000000-0000-0000-0000-0000000000c1'::uuid); RAISE EXCEPTION 'unverified joined'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.request_hoa_membership_via_invite('CODE-C1'); RAISE EXCEPTION 'unverified joined via invite'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;

-- verified user (u8) joins via invite: attribution kept, both rows written, status pending
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u8', true);
DO $$
DECLARE mid uuid; m record; n int; dup_rejected boolean;
BEGIN
  -- bad / disabled / expired / pending-community invites are all refused with the same error
  BEGIN PERFORM public.request_hoa_membership_via_invite('NOPE'); RAISE EXCEPTION 'bad code accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.request_hoa_membership_via_invite('CODE-C2'); RAISE EXCEPTION 'unapproved community accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.request_hoa_membership_via_invite('CODE-C3'); RAISE EXCEPTION 'expired invite accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.request_hoa_membership_via_invite('CODE-C4'); RAISE EXCEPTION 'disabled invite accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  mid := public.request_hoa_membership_via_invite('CODE-C1');
  SELECT * INTO m FROM public.hoa_memberships WHERE id = mid;
  IF m.user_id <> auth.uid() OR m.role <> 'resident' OR m.status <> 'pending' OR m.joined_via_invite IS NOT TRUE OR m.invite_code_used <> 'CODE-C1' THEN
    RAISE EXCEPTION 'invite membership wrong: %', row_to_json(m); END IF;
  SELECT count(*) INTO n FROM public.community_join_requests WHERE user_id = auth.uid() AND hoa_id = m.hoa_id AND status = 'pending';
  IF n <> 1 THEN RAISE EXCEPTION 'join request row missing'; END IF;
  -- second attempt is refused (already a member)
  dup_rejected := false;
  BEGIN PERFORM public.request_hoa_membership_via_invite('CODE-C1'); EXCEPTION WHEN raise_exception THEN dup_rejected := (SQLERRM LIKE 'Membership already exists%'); END;
  IF NOT dup_rejected THEN RAISE EXCEPTION 'duplicate join was not refused with the expected error'; END IF;
  -- withdraw: removes both pending rows, returns true; second call returns false
  IF public.withdraw_membership_request(m.hoa_id) IS NOT TRUE THEN RAISE EXCEPTION 'withdraw returned false'; END IF;
  SELECT count(*) INTO n FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = m.hoa_id; IF n <> 0 THEN RAISE EXCEPTION 'membership row left'; END IF;
  SELECT count(*) INTO n FROM public.community_join_requests WHERE user_id = auth.uid() AND hoa_id = m.hoa_id; IF n <> 0 THEN RAISE EXCEPTION 'request row left'; END IF;
  IF public.withdraw_membership_request(m.hoa_id) IS NOT FALSE THEN RAISE EXCEPTION 'second withdraw should be false'; END IF;
END $$;
ROLLBACK;

-- withdraw never touches a decided member: u7 is approved (its request row is still pending); u1 approved; u3 rejected
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u7', true);
DO $$
DECLARE n int;
BEGIN
  IF public.withdraw_membership_request('00000000-0000-0000-0000-0000000000c1'::uuid) IS NOT FALSE THEN RAISE EXCEPTION 'withdraw on approved member returned true'; END IF;
  SELECT count(*) INTO n FROM public.hoa_memberships WHERE user_id = auth.uid() AND status = 'approved'; IF n <> 1 THEN RAISE EXCEPTION 'approved membership deleted'; END IF;
  SELECT count(*) INTO n FROM public.community_join_requests WHERE user_id = auth.uid(); IF n <> 1 THEN RAISE EXCEPTION 'request row of approved member deleted'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u3', true);
DO $$
DECLARE n int;
BEGIN
  IF public.withdraw_membership_request('00000000-0000-0000-0000-0000000000c1'::uuid) IS NOT FALSE THEN RAISE EXCEPTION 'withdraw on rejected returned true'; END IF;
  SELECT count(*) INTO n FROM public.hoa_memberships WHERE user_id = auth.uid() AND status = 'rejected'; IF n <> 1 THEN RAISE EXCEPTION 'rejected membership deleted'; END IF;
END $$;
ROLLBACK;

-- u2 (pending, both rows) can withdraw; u4 (legacy request-only, backfilled pending membership) can withdraw
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u2', true);
DO $$ BEGIN IF public.withdraw_membership_request('00000000-0000-0000-0000-0000000000c1'::uuid) IS NOT TRUE THEN RAISE EXCEPTION 'u2 withdraw failed'; END IF; END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u4', true);
DO $$ BEGIN IF public.withdraw_membership_request('00000000-0000-0000-0000-0000000000c1'::uuid) IS NOT TRUE THEN RAISE EXCEPTION 'u4 withdraw failed'; END IF; END $$;
ROLLBACK;

-- admin-creator self-membership policy (AddCommunityModal) still works: u6 is admin_id of a brand-new community
BEGIN;
-- (community creation itself is already closed to clients by 20261013120000; set it up as the table owner)
INSERT INTO public.hoas (id, name, admin_id) VALUES ('00000000-0000-0000-0000-0000000000c9','New by admin','00000000-0000-0000-0000-0000000000a6');
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u6', true);
INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status) VALUES (auth.uid(), '00000000-0000-0000-0000-0000000000c9', 'admin', 'approved');
ROLLBACK;

-- anon cannot call the join RPCs
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.request_hoa_membership_via_invite('CODE-C1'); RAISE EXCEPTION 'anon invite allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.withdraw_membership_request('00000000-0000-0000-0000-0000000000c1'::uuid); RAISE EXCEPTION 'anon withdraw allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;

-- ===== 4. M7 grants =====
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_email_preferences(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'anon can still execute get_email_preferences'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_email_preferences(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated lost get_email_preferences'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.set_active_hoa(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated lost set_active_hoa'; END IF;
  IF has_function_privilege('anon', 'public.set_active_hoa(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'anon can execute set_active_hoa'; END IF;
  IF has_function_privilege('authenticated', 'public.assign_coach_role(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'M7 re-opened a function that was closed to authenticated (assign_coach_role)'; END IF;
  IF has_function_privilege('authenticated', 'public.migrate_existing_hoa_memberships()', 'EXECUTE') THEN RAISE EXCEPTION 'migration helper callable by authenticated'; END IF;
  IF has_function_privilege('anon', 'public.request_hoa_membership_via_invite(text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon can execute invite RPC'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.request_hoa_membership_via_invite(text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated cannot execute invite RPC'; END IF;
  IF NOT has_function_privilege('service' || '_role', 'public.assign_coach_role(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'the server-side role lost assign_coach_role'; END IF;
END $$;

-- email preference isolation: u1 reads own, cannot read/create for u2
BEGIN;
SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'u1', true);
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.get_email_preferences('00000000-0000-0000-0000-0000000000a1'::uuid); IF n <> 1 THEN RAISE EXCEPTION 'cannot read own prefs'; END IF;
  BEGIN PERFORM * FROM public.get_email_preferences('00000000-0000-0000-0000-0000000000a2'::uuid); RAISE EXCEPTION 'read other prefs'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.create_default_email_preferences('00000000-0000-0000-0000-0000000000a2'::uuid); RAISE EXCEPTION 'created other prefs'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;

SELECT 'ALL REHEARSAL ASSERTIONS PASSED' AS result;

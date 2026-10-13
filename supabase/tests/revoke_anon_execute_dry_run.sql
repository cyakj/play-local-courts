-- Dry run for 20261013130000_revoke_anon_execute_on_admin_rpcs.sql (NOT applied by this script).
-- Run via Supabase execute_sql. It ALWAYS aborts with an exception at the end (so everything rolls back)
-- and the exception message is the report: look for "FAIL" lines and the final "SUMMARY".
-- The three REVOKE statements below must stay identical to the migration file.

DO $dry$
DECLARE
  r text := '';
  fails int := 0;
  fn text;
  fns text[] := ARRAY[
    'public.admin_blockout_conflicts(uuid, date, date, time, time)',
    'public.admin_create_blockout(uuid, date, date, time, time, text, text, text, text, uuid[], text)',
    'public.hoa_is_approved(uuid)'];
  a_before boolean[]; u_before boolean[];
  v boolean;
  v_admin uuid;
  v_state text;
  pol_refs int;
  other_anon_before int; other_anon_after int;
BEGIN
  -- 0. Snapshot: how many OTHER public functions anon can execute (must not change).
  SELECT count(*) INTO other_anon_before FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.oid::regprocedure::text <> ALL (SELECT f::regprocedure::text FROM unnest(fns) f)
     AND has_function_privilege('anon', p.oid, 'EXECUTE');

  -- 1. BEFORE state
  FOREACH fn IN ARRAY fns LOOP
    r := r || format(E'BEFORE %s anon=%s authenticated=%s\n', fn,
      has_function_privilege('anon', fn, 'EXECUTE'), has_function_privilege('authenticated', fn, 'EXECUTE'));
  END LOOP;

  -- 2. Policies that reference these functions, and which roles they apply to (anon-evaluated policies would break).
  SELECT count(*) INTO pol_refs FROM pg_policies
   WHERE schemaname = 'public'
     AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(hoa_is_approved|admin_create_blockout|admin_blockout_conflicts)'
     AND (roles && ARRAY['anon','public']::name[]);
  r := r || format(E'%s policies referencing the functions apply to anon/public (expect 0)\n', pol_refs);
  IF pol_refs <> 0 THEN fails := fails + 1; r := r || E'FAIL policy evaluated for anon\n'; END IF;

  -- 3. APPLY (identical to the migration)
  REVOKE EXECUTE ON FUNCTION public.admin_blockout_conflicts(uuid, date, date, time, time) FROM anon;
  REVOKE EXECUTE ON FUNCTION public.admin_create_blockout(uuid, date, date, time, time, text, text, text, text, uuid[], text) FROM anon;
  REVOKE EXECUTE ON FUNCTION public.hoa_is_approved(uuid) FROM anon;

  -- 4. AFTER state: anon false, authenticated still true
  FOREACH fn IN ARRAY fns LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN fails := fails + 1; r := r || format(E'FAIL anon can still execute %s\n', fn);
    ELSE r := r || format(E'PASS anon cannot execute %s\n', fn); END IF;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN fails := fails + 1; r := r || format(E'FAIL authenticated lost %s\n', fn);
    ELSE r := r || format(E'PASS authenticated keeps %s\n', fn); END IF;
  END LOOP;

  -- 5. No collateral change to other functions' anon grants
  SELECT count(*) INTO other_anon_after FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.oid::regprocedure::text <> ALL (SELECT f::regprocedure::text FROM unnest(fns) f)
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF other_anon_before <> other_anon_after THEN fails := fails + 1; r := r || E'FAIL other anon grants changed\n';
  ELSE r := r || format(E'PASS other anon-executable functions unchanged (%s)\n', other_anon_after); END IF;

  -- 6. Behavioural: really call as anon (expect 42501) and as a real community admin (expect NOT 42501).
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.hoa_is_approved(gen_random_uuid());
    fails := fails + 1; r := r || E'FAIL anon call to hoa_is_approved succeeded\n';
  EXCEPTION WHEN insufficient_privilege THEN r := r || E'PASS anon call -> 42501 (hoa_is_approved)\n';
  WHEN OTHERS THEN fails := fails + 1; r := r || format(E'FAIL anon call -> %s\n', SQLSTATE);
  END;
  BEGIN
    PERFORM public.admin_blockout_conflicts(gen_random_uuid(), current_date, current_date, '08:00', '09:00');
    fails := fails + 1; r := r || E'FAIL anon call to admin_blockout_conflicts succeeded\n';
  EXCEPTION WHEN insufficient_privilege THEN r := r || E'PASS anon call -> 42501 (admin_blockout_conflicts)\n';
  WHEN OTHERS THEN fails := fails + 1; r := r || format(E'FAIL anon call -> %s\n', SQLSTATE);
  END;
  RESET ROLE;

  SELECT m.user_id INTO v_admin FROM public.hoa_memberships m WHERE m.role = 'admin' AND m.status = 'approved' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    v := public.hoa_is_approved(gen_random_uuid());
    r := r || format(E'PASS authenticated call hoa_is_approved -> %s (no privilege error)\n', v);
  EXCEPTION WHEN OTHERS THEN fails := fails + 1; r := r || format(E'FAIL authenticated hoa_is_approved -> %s\n', SQLSTATE); END;
  BEGIN
    PERFORM public.admin_blockout_conflicts(gen_random_uuid(), current_date, current_date, '08:00', '09:00');
    r := r || E'PASS authenticated admin_blockout_conflicts executed\n';
  EXCEPTION WHEN insufficient_privilege THEN
    -- 42501 is also raised by the function's own authorisation check; distinguish by message.
    GET STACKED DIAGNOSTICS v_state = MESSAGE_TEXT;
    IF v_state ILIKE 'permission denied for function%' THEN fails := fails + 1; r := r || E'FAIL authenticated lost EXECUTE\n';
    ELSE r := r || format(E'PASS authenticated reached function body (rejected by its own check: %s)\n', v_state); END IF;
  WHEN OTHERS THEN r := r || format(E'PASS authenticated reached function body (%s)\n', SQLSTATE);
  END;
  RESET ROLE;

  RAISE EXCEPTION E'DRY RUN REPORT (rolled back)\n%SUMMARY: % failure(s)', r, fails;
END
$dry$;

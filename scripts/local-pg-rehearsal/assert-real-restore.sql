-- Behavioural assertions for ALL SEVEN pending migrations, run against a disposable copy of a RESTORE OF THE REAL BACKUP.
-- Driven by rehearse-real-restore.sh. Output contains only PASS / SKIP / FAIL lines, counts and function names: never
-- row contents, emails or ids. Every behavioural block runs in a sub-transaction that is rolled back, so the copy is unchanged.
-- A SKIP means the restored data had no suitable fixture for that check: it is NOT a pass and is reported as such.
-- An unexpected error is always a FAIL. Runs on the scratch PostgreSQL 17; the live project is PostgreSQL 15 (not proven here).
\set ON_ERROR_STOP 1

-- ===== 1. every pre-existing table has exactly the same rows as before the migrations =====
DO $$
DECLARE r record; changed text := ''; checked int := 0; now_tables int; new_tables constant int := 2;
BEGIN
  FOR r IN
    SELECT b.tbl, b.n, b.h,
           (xpath('/row/c/text()', q.x))[1]::text AS n2, (xpath('/row/h/text()', q.x))[1]::text AS h2
    FROM zz.baseline b
    CROSS JOIN LATERAL (SELECT query_to_xml(format('select count(*) as c, coalesce(md5(string_agg(md5(t::text), %L order by md5(t::text))), %L) as h from %s as t', ',', '-', b.tbl), false, true, '') AS x) q
  LOOP
    checked := checked + 1;
    IF r.n::text <> r.n2 OR r.h <> r.h2 THEN changed := changed || r.tbl || ' (' || r.n || '->' || r.n2 || ') '; END IF;
  END LOOP;
  IF checked < 50 THEN RAISE EXCEPTION 'FAIL baseline covers only % tables', checked; END IF;
  IF changed <> '' THEN RAISE EXCEPTION 'FAIL existing rows changed by the migrations in: %', changed; END IF;
  -- No table may have appeared or vanished except the two M5 tables.
  SELECT count(*) INTO now_tables FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','auth','storage','supabase_migrations','backup_20261013')
     AND NOT (n.nspname = 'auth' AND c.relname IN ('sessions','refresh_tokens','audit_log_entries','flow_state','one_time_tokens','mfa_amr_claims'))
     AND c.relname NOT LIKE 'zz%';
  IF now_tables <> checked + new_tables THEN RAISE EXCEPTION 'FAIL table count is % but % baseline + % expected new tables', now_tables, checked, new_tables; END IF;
  RAISE NOTICE 'PASS data preserved: % tables compared by row-hash, 0 changed; only the 2 M5 tables were added (auth users/identities, profiles, memberships, bookings, reports, applications, notifications, messages included)', checked;
END $$;

-- ===== 2. M1 (20261013130000): anon lost the three RPCs; signed-in users keep them =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.admin_blockout_conflicts(uuid,date,date,time,time)',
    'public.admin_create_blockout(uuid,date,date,time,time,text,text,text,text,uuid[],text)',
    'public.hoa_is_approved(uuid)'] LOOP
    IF has_function_privilege('anon', f::regprocedure, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M1 anon can still execute %', f; END IF;
    IF NOT has_function_privilege('authenticated', f::regprocedure, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M1 authenticated lost %', f; END IF;
  END LOOP;
  RAISE NOTICE 'PASS M1 anon closed, authenticated kept on the 3 functions';
END $$;

-- ===== 3. M3 (20261023100000): constraint, trigger, and behaviour =====
DO $$
DECLARE hoa uuid; adm uuid; res uuid; crt uuid; b1 uuid; b2 uuid; n_adm int; n_res int; n_conf int; def text; ctx text;
BEGIN
  IF to_regprocedure('public.notify_admins_on_booking_review()') IS NULL THEN RAISE EXCEPTION 'FAIL M3 notify_admins_on_booking_review() missing'; END IF;
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'hoa_notifications_type_check' AND conrelid = 'public.hoa_notifications'::regclass;
  IF def IS NULL THEN RAISE EXCEPTION 'FAIL M3 hoa_notifications_type_check missing'; END IF;
  IF def NOT LIKE '%booking_review_needed%' THEN RAISE EXCEPTION 'FAIL M3 type check lacks booking_review_needed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_admins_booking_review' AND tgrelid = 'public.bookings'::regclass AND tgenabled = 'O' AND tgfoid = 'public.notify_admins_on_booking_review()'::regprocedure AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'FAIL M3 trigger missing, disabled or wrong function';
  END IF;
  SELECT a.hoa_id, a.user_id, r.user_id, c.id INTO hoa, adm, res, crt
    FROM public.hoa_memberships a JOIN public.hoa_memberships r ON r.hoa_id = a.hoa_id AND r.status = 'approved' AND r.role <> 'admin'
    JOIN public.courts c ON c.hoa_id = a.hoa_id
   WHERE a.status = 'approved' AND a.role = 'admin' ORDER BY a.hoa_id, c.id LIMIT 1;
  IF crt IS NULL THEN RAISE NOTICE 'SKIP M3 behaviour: no community with an admin, a resident and an amenity in the restored data'; RETURN; END IF;
  BEGIN
    BEGIN
      INSERT INTO public.bookings (user_id, court_id, date, start_time, end_time, status) VALUES (res, crt, '2030-06-03', '10:00', '11:00', 'pending') RETURNING id INTO b1;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS ctx = PG_EXCEPTION_CONTEXT;
      -- A failure inside the new trigger is a defect; a rejection by the existing booking rules only means this fixture cannot be used.
      IF ctx LIKE '%notify_admins_on_booking_review%' THEN RAISE EXCEPTION 'FAIL M3 the new trigger raised: %', SQLERRM; END IF;
      -- Only the pre-existing booking rules (overlap exclusion, amenity rules, status/cancellation guards) may make this fixture unusable.
      IF SQLSTATE = '23P01' OR ctx ~ '(enforce_amenity_booking_rules|enforce_booking_cancellation_window|enforce_booking_status_transitions|prevent_double_booking|enforce_blockout)' THEN
        RAISE NOTICE 'SKIP M3 behaviour: existing booking rules rejected the test booking (%)', SQLERRM;
        RAISE EXCEPTION 'ROLLBACK_OK';
      END IF;
      RAISE EXCEPTION 'FAIL M3 unexpected error inserting the test booking: % (%)', SQLERRM, SQLSTATE;
    END;
    SELECT count(*) INTO n_adm FROM public.hoa_notifications WHERE user_id = adm AND type = 'booking_review_needed' AND metadata->>'booking_id' = b1::text;
    SELECT count(*) INTO n_res FROM public.hoa_notifications WHERE user_id = res AND type = 'booking_review_needed' AND metadata->>'booking_id' = b1::text;
    IF n_adm <> 1 THEN RAISE EXCEPTION 'FAIL M3 admin got % review notifications for a pending booking (expected 1)', n_adm; END IF;
    IF n_res <> 0 THEN RAISE EXCEPTION 'FAIL M3 the booker was notified'; END IF;
    INSERT INTO public.bookings (user_id, court_id, date, start_time, end_time, status) VALUES (res, crt, '2030-06-04', '10:00', '11:00', 'confirmed') RETURNING id INTO b2;
    SELECT count(*) INTO n_conf FROM public.hoa_notifications WHERE type = 'booking_review_needed' AND metadata->>'booking_id' = b2::text;
    IF n_conf <> 0 THEN RAISE EXCEPTION 'FAIL M3 a confirmed booking raised a review notification'; END IF;
    RAISE NOTICE 'PASS M3 pending booking notifies the community admin once, not the booker; confirmed booking does not notify (rolled back)';
    RAISE EXCEPTION 'ROLLBACK_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_OK' THEN RAISE; END IF;
  END;
END $$;

-- ===== 4. M5 (20261023120000): interest requests =====
DO $$
DECLARE u uuid; other uuid; rid uuid; n int;
BEGIN
  IF to_regclass('public.community_interest_requests') IS NULL OR to_regclass('public.community_interest_notes') IS NULL OR to_regprocedure('public.submit_community_interest(text,text,text,text,integer,text,text,text)') IS NULL OR to_regprocedure('public.update_community_interest(uuid,text,text,text,uuid,boolean)') IS NULL THEN RAISE EXCEPTION 'FAIL M5 tables or RPCs missing'; END IF;
  IF to_regprocedure('public.user_email_verified()') IS NULL THEN RAISE EXCEPTION 'FAIL M5 (depends on M2) user_email_verified() is missing'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.community_interest_requests'::regclass) THEN RAISE EXCEPTION 'FAIL M5 RLS off on community_interest_requests'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.community_interest_notes'::regclass) THEN RAISE EXCEPTION 'FAIL M5 RLS off on community_interest_notes'; END IF;
  IF has_function_privilege('anon', 'public.submit_community_interest(text,text,text,text,integer,text,text,text)'::regprocedure, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M5 anon can submit'; END IF;
  IF has_table_privilege('anon', 'public.community_interest_requests', 'SELECT') THEN RAISE EXCEPTION 'FAIL M5 anon can read requests'; END IF;
  SELECT id INTO u FROM auth.users WHERE email_confirmed_at IS NOT NULL ORDER BY id LIMIT 1;
  SELECT id INTO other FROM auth.users WHERE id <> u ORDER BY id LIMIT 1;
  IF u IS NULL OR other IS NULL THEN RAISE NOTICE 'SKIP M5 behaviour: need two accounts, one with a verified email'; RETURN; END IF;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    SET LOCAL ROLE authenticated;
    IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM u THEN RAISE EXCEPTION 'FAIL M5 simulation: role % uid mismatch', current_user; END IF;
    rid := public.submit_community_interest('Rehearsal Test Community', 'Testville', 'TS', 'hoa', 120, 'Test Person', 'test@example.test', 'rehearsal');
    IF rid IS NULL THEN RAISE EXCEPTION 'FAIL M5 submit returned null'; END IF;
    BEGIN
      PERFORM public.submit_community_interest('Rehearsal Test Community', 'Testville', 'TS', 'hoa', 120, 'Test Person', 'test@example.test', 'rehearsal');
      RAISE EXCEPTION 'FAIL M5 duplicate submit was accepted';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    SELECT count(*) INTO n FROM public.community_interest_requests;
    IF n <> 1 THEN RAISE EXCEPTION 'FAIL M5 requester sees % requests (expected own 1)', n; END IF;
    BEGIN
      PERFORM public.update_community_interest(rid, 'approved', 'x', NULL, NULL, false);
      RAISE EXCEPTION 'FAIL M5 a non-reviewer updated a request';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', other::text, true);
    SET LOCAL ROLE authenticated;
    IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM other THEN RAISE EXCEPTION 'FAIL M5 simulation: second account mismatch'; END IF;
    SELECT count(*) INTO n FROM public.community_interest_requests;
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL M5 another account sees % requests', n; END IF;
    RAISE NOTICE 'PASS M5 submit works, duplicate refused, requester sees only own, other account sees none, non-reviewer cannot update, anon closed (rolled back)';
    RESET ROLE;
    RAISE EXCEPTION 'ROLLBACK_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_OK' THEN RAISE; END IF;
  END;
END $$;

-- ===== 5. M6 (20261023130000): attach_report_photo =====
DO $$
DECLARE rep uuid; rep_user uuid; stranger uuid; ok boolean; url text; path text; spath text; hdr constant text := '{"host":"project.example.test","x-forwarded-proto":"https"}';
BEGIN
  IF to_regprocedure('public.attach_report_photo(uuid,text)') IS NULL THEN RAISE EXCEPTION 'FAIL M6 attach_report_photo(uuid,text) missing'; END IF;
  IF has_function_privilege('anon', 'public.attach_report_photo(uuid,text)'::regprocedure, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M6 anon can attach'; END IF;
  SELECT id, reporter_id INTO rep, rep_user FROM public.maintenance_reports WHERE photo_url IS NULL AND reporter_id IS NOT NULL ORDER BY id LIMIT 1;
  SELECT id INTO stranger FROM auth.users WHERE id <> rep_user ORDER BY id LIMIT 1;
  IF rep IS NULL OR stranger IS NULL THEN RAISE NOTICE 'SKIP M6 behaviour: need a report without a photo and a second account'; RETURN; END IF;
  path := rep_user::text || '/rehearsal-photo.jpg';
  spath := stranger::text || '/rehearsal-photo.jpg';
  BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('report-photos', 'report-photos', true) ON CONFLICT DO NOTHING;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('report-photos', path, rep_user), ('report-photos', spath, stranger);
    -- (a) the report's owner, valid objects, but NO API headers: refused for that reason.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', rep_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', rep_user::text, true);
    SET LOCAL ROLE authenticated;
    IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM rep_user THEN RAISE EXCEPTION 'FAIL M6 simulation mismatch'; END IF;
    PERFORM set_config('request.headers', '', true);
    BEGIN PERFORM public.attach_report_photo(rep, path); RAISE EXCEPTION 'FAIL M6 attached without API headers';
    EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'Photo can only be attached through the API' THEN RAISE EXCEPTION 'FAIL M6 wrong refusal for missing headers: %', SQLERRM; END IF; END;
    -- (b) valid headers, another account's EXISTING object: refused because of the folder.
    PERFORM set_config('request.headers', hdr, true);
    BEGIN PERFORM public.attach_report_photo(rep, spath); RAISE EXCEPTION 'FAIL M6 accepted another user''s folder';
    EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'Invalid photo location' THEN RAISE EXCEPTION 'FAIL M6 wrong refusal for foreign folder: %', SQLERRM; END IF; END;
    -- (c) a stranger attaching their own valid photo to someone else's report changes nothing.
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', stranger::text, true);
    SET LOCAL ROLE authenticated;
    IF auth.uid() IS DISTINCT FROM stranger THEN RAISE EXCEPTION 'FAIL M6 simulation mismatch (stranger)'; END IF;
    IF public.attach_report_photo(rep, spath) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL M6 a stranger attached a photo to another user''s report'; END IF;
    RESET ROLE;
    IF (SELECT photo_url FROM public.maintenance_reports WHERE id = rep) IS NOT NULL THEN RAISE EXCEPTION 'FAIL M6 stranger''s attempt changed the report'; END IF;
    -- (d) the owner succeeds, then a second attach does not overwrite.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', rep_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', rep_user::text, true);
    SET LOCAL ROLE authenticated;
    ok := public.attach_report_photo(rep, path);
    IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL M6 owner could not attach'; END IF;
    RESET ROLE;
    SELECT photo_url INTO url FROM public.maintenance_reports WHERE id = rep;
    IF url IS DISTINCT FROM 'https://project.example.test/storage/v1/object/public/report-photos/' || path THEN RAISE EXCEPTION 'FAIL M6 wrong photo_url written'; END IF;
    SET LOCAL ROLE authenticated;
    IF public.attach_report_photo(rep, path) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL M6 second attach overwrote an existing photo'; END IF;
    RAISE NOTICE 'PASS M6 header-less refused (specific reason), foreign folder refused (specific reason), stranger cannot attach to another''s report, owner writes the https URL, second attach is a no-op (rolled back)';
    RESET ROLE;
    RAISE EXCEPTION 'ROLLBACK_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_OK' THEN RAISE; END IF;
  END;
END $$;

-- ===== 6. M7 (20261023140000): anon on definer RPCs, email preferences =====
DO $$
DECLARE f text; open_defs text; u uuid; other uuid; n int;
BEGIN
  -- Every existing overload of every function named in the migration (the list is read from the migration file by the runner).
  DECLARE fn record; checked int := 0; svc constant text := 'service' || '_role'; want_auth boolean;
  BEGIN
    FOR fn IN SELECT p.oid, p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
               WHERE ns.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (SELECT name FROM zz.m7names) LOOP
      checked := checked + 1;
      IF has_function_privilege('anon', fn.oid, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M7 anon can still execute %', fn.sig; END IF;
      IF has_function_privilege('public', fn.oid, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M7 PUBLIC can still execute %', fn.sig; END IF;
      -- authenticated keeps exactly what it had before the migrations (zz.fnpriv), except the one-time backfill, which must be closed.
      SELECT (fp.auth AND fn.proname <> 'migrate_existing_hoa_memberships') INTO want_auth FROM zz.fnpriv fp WHERE fp.sig = fn.sig::text;
      IF want_auth IS NULL THEN RAISE EXCEPTION 'FAIL M7 no pre-migration record for %', fn.sig; END IF;
      IF has_function_privilege('authenticated', fn.oid, 'EXECUTE') IS DISTINCT FROM want_auth THEN RAISE EXCEPTION 'FAIL M7 authenticated privilege on % is not what it was before (expected %)', fn.sig, want_auth; END IF;
      IF NOT has_function_privilege(svc, fn.oid, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M7 the server-side role lost %', fn.sig; END IF;
    END LOOP;
    IF checked < 30 THEN RAISE EXCEPTION 'FAIL M7 only % targeted functions found (expected the migration''s list)', checked; END IF;
    RAISE NOTICE 'INFO M7 checked anon/PUBLIC closed, authenticated unchanged (backfill closed), server role kept, on % targeted overloads', checked;
  END;
  IF to_regprocedure('public.get_email_preferences(uuid)') IS NULL THEN RAISE EXCEPTION 'FAIL M7 get_email_preferences missing'; END IF;
  SELECT coalesce(string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text), '(none)') INTO open_defs
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE');
  RAISE NOTICE 'INFO M7 SECURITY DEFINER functions in public that anon can STILL execute (outside the migrations'' scope): %', open_defs;
  SELECT user_id INTO u FROM public.email_preferences ORDER BY user_id LIMIT 1;
  SELECT id INTO other FROM auth.users WHERE id <> u ORDER BY id LIMIT 1;
  IF u IS NULL OR other IS NULL THEN RAISE NOTICE 'SKIP M7 behaviour: need an account with an email_preferences row and a second account'; RETURN; END IF;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    SET LOCAL ROLE authenticated;
    IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM u THEN RAISE EXCEPTION 'FAIL M7 simulation mismatch'; END IF;
    SELECT count(*) INTO n FROM public.get_email_preferences(u);
    IF n <> 1 THEN RAISE EXCEPTION 'FAIL M7 own preferences returned % rows (expected 1)', n; END IF;
    BEGIN PERFORM public.get_email_preferences(other); RAISE EXCEPTION 'FAIL M7 read another user''s email preferences';
    EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM <> 'Not authorized' THEN RAISE EXCEPTION 'FAIL M7 wrong refusal: %', SQLERRM; END IF; END;
    BEGIN PERFORM public.create_default_email_preferences(other); RAISE EXCEPTION 'FAIL M7 created another user''s default preferences';
    EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM <> 'Not authorized' THEN RAISE EXCEPTION 'FAIL M7 wrong refusal: %', SQLERRM; END IF; END;
    -- The hosted body of update_email_preference (visible in the restored backup; M7 does not rewrite it) refuses other users with
    -- a plain 'Access denied' (P0001), and has no fixed search_path (an advisor finding the migrations do not fix).
    BEGIN PERFORM public.update_email_preference(other, 'booking_reminders', false); RAISE EXCEPTION 'FAIL M7 changed another user''s email preference';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Access denied' THEN RAISE EXCEPTION 'FAIL M7 wrong refusal: %', SQLERRM; END IF; END;
    RAISE NOTICE 'PASS M7 anon/PUBLIC closed on the four functions; own preferences readable (1 row); another account refused on get/create/update with the expected reasons (rolled back)';
    RESET ROLE;
    RAISE EXCEPTION 'ROLLBACK_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_OK' THEN RAISE; END IF;
  END;
END $$;

-- ===== 7. M2 (20261022120000) and M4 (20261023110000): structure present (behaviour: rehearse.sh on the fixture) =====
DO $$
DECLARE def text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hoa_memberships' AND policyname IN ('Users can request to join communities', 'hoa_memberships_insert_own_pending_resident_only', 'hoa_memberships_insert_own', 'Users can cancel their own pending requests')) THEN RAISE EXCEPTION 'FAIL M2 a resident write policy on hoa_memberships still exists'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_join_requests' AND policyname = 'Users can create their own join requests') THEN RAISE EXCEPTION 'FAIL M2 resident insert policy on community_join_requests still exists'; END IF;
  IF to_regprocedure('public.withdraw_membership_request(uuid)') IS NULL THEN RAISE EXCEPTION 'FAIL M2 withdraw_membership_request(uuid) missing'; END IF;
  IF to_regprocedure('public.request_hoa_membership_via_invite(text,text)') IS NULL THEN RAISE EXCEPTION 'FAIL M2 request_hoa_membership_via_invite(text,text) missing'; END IF;
  IF to_regprocedure('public.request_join_community(uuid,text)') IS NULL OR to_regprocedure('public.request_hoa_membership(uuid,text)') IS NULL OR to_regprocedure('public.user_email_verified()') IS NULL THEN RAISE EXCEPTION 'FAIL M2 join RPC or user_email_verified() missing'; END IF;
  IF has_function_privilege('anon', 'public.withdraw_membership_request(uuid)'::regprocedure, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M2 anon can withdraw'; END IF;
  IF to_regprocedure('public.guard_hoa_application_write()') IS NULL THEN RAISE EXCEPTION 'FAIL M4 guard_hoa_application_write() missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_hoa_application_write_trigger' AND tgrelid = 'public.hoa_applications'::regclass AND tgenabled = 'O' AND tgfoid = 'public.guard_hoa_application_write()'::regprocedure AND NOT tgisinternal) THEN RAISE EXCEPTION 'FAIL M4 application guard trigger missing, disabled or wrong function'; END IF;
  SELECT indexdef INTO def FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'hoa_applications' AND indexname = 'hoa_applications_one_open_per_name';
  IF def IS NULL THEN RAISE EXCEPTION 'FAIL M4 hoa_applications_one_open_per_name missing'; END IF;
  IF def <> 'CREATE UNIQUE INDEX hoa_applications_one_open_per_name ON public.hoa_applications USING btree (applicant_id, lower(btrim(hoa_name))) WHERE (status = ANY (ARRAY[''pending''::text, ''needs_more_info''::text]))' THEN RAISE EXCEPTION 'FAIL M4 unique index has the wrong definition: %', def; END IF;
  IF NOT (SELECT indisvalid AND indisunique AND indisready FROM pg_index WHERE indexrelid = 'public.hoa_applications_one_open_per_name'::regclass) THEN RAISE EXCEPTION 'FAIL M4 unique index is not valid/ready'; END IF;
  RAISE NOTICE 'PASS M2/M4 structure present and specific (resident write policies gone, withdraw + invite + join RPCs with exact signatures and anon closed, application guard trigger enabled on the right table/function, partial unique index with the intended columns and predicate)';
END $$;

-- Behavioural assertions for 20261030120000 (profile photos) and 20261030130000 (report insert + create_maintenance_report).
-- Runs on a disposable copy of a restore. Test rows are created inside blocks that always roll back. No row contents printed.
-- ===== M8: profile photos =====
DO $$
DECLARE b record; n int;
BEGIN
  SELECT * INTO b FROM storage.buckets WHERE id = 'profile-photos';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL M8 bucket missing'; END IF;
  IF b.public IS DISTINCT FROM false OR b.file_size_limit <> 5242880 OR b.allowed_mime_types <> ARRAY['image/jpeg','image/png','image/webp'] THEN RAISE EXCEPTION 'FAIL M8 bucket settings'; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'Owners can % their profile photo';
  IF n <> 4 THEN RAISE EXCEPTION 'FAIL M8 expected 4 owner policies, found %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='avatar_path') THEN RAISE EXCEPTION 'FAIL M8 avatar_path missing'; END IF;
  RAISE NOTICE 'PASS M8 structure: private bucket (5 MB, jpeg/png/webp), 4 owner-only policies, profiles.avatar_path';
END $$;

DO $$
DECLARE u uuid; v uuid; n int; cn text;
BEGIN
  u := gen_random_uuid(); v := gen_random_uuid();
  BEGIN
    INSERT INTO auth.users (id) VALUES (u), (v);
    INSERT INTO public.profiles (id) VALUES (u), (v) ON CONFLICT (id) DO NOTHING;
    BEGIN UPDATE public.profiles SET avatar_path = v::text || '/avatar-1.jpg' WHERE id = u; RAISE EXCEPTION 'FAIL M8 accepted a path in another user folder';
    EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS cn = CONSTRAINT_NAME; IF cn <> 'profiles_avatar_path_check' THEN RAISE EXCEPTION 'FAIL M8 wrong constraint %', cn; END IF; END;
    BEGIN UPDATE public.profiles SET avatar_path = 'x/avatar-1.jpg' WHERE id = u; RAISE EXCEPTION 'FAIL M8 accepted a malformed path';
    EXCEPTION WHEN check_violation THEN NULL; END;
    UPDATE public.profiles SET avatar_path = u::text || '/avatar-1.png' WHERE id = u;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', v::text || '/avatar-1.png', v);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    SET LOCAL ROLE authenticated;
    IF auth.uid() IS DISTINCT FROM u THEN RAISE EXCEPTION 'FAIL M8 simulation mismatch'; END IF;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', u::text || '/avatar-1.png', u);
    BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', v::text || '/avatar-1.png', u); RAISE EXCEPTION 'FAIL M8 upload into another user folder allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'profile-photos';
    IF n <> 1 THEN RAISE EXCEPTION 'FAIL M8 owner sees % objects, expected 1', n; END IF;
    UPDATE storage.objects SET name = u::text || '/avatar-2.png' WHERE bucket_id = 'profile-photos' AND name = u::text || '/avatar-1.png';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'FAIL M8 owner could not replace own photo'; END IF;
    UPDATE storage.objects SET name = u::text || '/stolen.png' WHERE bucket_id = 'profile-photos' AND name = v::text || '/avatar-1.png';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL M8 owner modified another user photo'; END IF;
    PERFORM set_config('storage.allow_delete_query', 'true', true); -- the Storage API sets this; the trigger blocks raw deletes otherwise
    DELETE FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = v::text || '/avatar-1.png';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL M8 owner deleted another user photo'; END IF;
    DELETE FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = u::text || '/avatar-2.png';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'FAIL M8 owner could not delete own photo'; END IF;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', u::text || '/avatar-1.png', u);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'profile-photos';
    IF n <> 1 THEN RAISE EXCEPTION 'FAIL M8 second user sees % profile-photos objects, expected only their own (1)', n; END IF;
    RESET ROLE;
    RAISE NOTICE 'PASS M8 behaviour: path constraint, own-folder upload only, other users cannot read (rolled back)';
    RAISE EXCEPTION 'ROLLBACK_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_OK' THEN RAISE; END IF;
  END;
END $$;

-- ===== M9: maintenance report insert policy + create_maintenance_report =====
DO $$
DECLARE hoa_a uuid; hoa_b uuid; court_a uuid; court_b uuid; member uuid; stranger uuid; fallback uuid; rejected uuid; profonly uuid; rid uuid; st text;
BEGIN
  IF has_function_privilege('anon', 'public.create_maintenance_report(uuid,text,text,text,text,uuid,text,text)'::regprocedure, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M9 anon can execute create_maintenance_report'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_maintenance_report(uuid,text,text,text,text,uuid,text,text)'::regprocedure, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL M9 authenticated lost execute'; END IF;
  SELECT c.hoa_id, c.id INTO hoa_a, court_a FROM public.courts c WHERE c.hoa_id IS NOT NULL ORDER BY c.id LIMIT 1;
  SELECT c.hoa_id, c.id INTO hoa_b, court_b FROM public.courts c WHERE c.hoa_id IS NOT NULL AND c.hoa_id <> hoa_a ORDER BY c.id LIMIT 1;
  IF hoa_a IS NULL OR hoa_b IS NULL THEN RAISE EXCEPTION 'FAIL M9 prerequisites missing: need courts in two communities (must not pass vacuously)'; END IF;
  BEGIN
    member := gen_random_uuid(); stranger := gen_random_uuid(); fallback := gen_random_uuid(); rejected := gen_random_uuid(); profonly := gen_random_uuid();
    SET LOCAL session_replication_role = replica; -- fixture rows only: skip the membership guard triggers
    INSERT INTO auth.users (id) VALUES (member), (stranger), (fallback), (rejected), (profonly);
    INSERT INTO public.profiles (id) VALUES (member), (stranger), (fallback), (rejected), (profonly) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.hoa_memberships (user_id, hoa_id, status) VALUES (member, hoa_a, 'approved'), (fallback, hoa_a, 'pending'), (rejected, hoa_a, 'rejected');
    UPDATE public.profiles SET hoa_id = hoa_a WHERE id IN (fallback, rejected);
    UPDATE public.profiles SET hoa_id = hoa_a, hoa_status = 'pending' WHERE id = profonly; -- profile match, no membership row at all
    SET LOCAL session_replication_role = origin;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', member::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.maintenance_reports (hoa_id, reporter_id, category, description, report_type, location_text) VALUES (hoa_a, member, 'other', 'rehearsal', 'location', 'gate');
    INSERT INTO public.maintenance_reports (hoa_id, amenity_id, reporter_id, category, description) VALUES (hoa_a, court_a, member, 'other', 'rehearsal');
    BEGIN INSERT INTO public.maintenance_reports (hoa_id, reporter_id, category, description, report_type, location_text) VALUES (hoa_b, member, 'other', 'x', 'location', 'gate'); RAISE EXCEPTION 'FAIL M9 direct insert into another community allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN INSERT INTO public.maintenance_reports (hoa_id, amenity_id, reporter_id, category, description) VALUES (hoa_a, court_b, member, 'other', 'x'); RAISE EXCEPTION 'FAIL M9 direct insert with a foreign amenity allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN INSERT INTO public.maintenance_reports (hoa_id, reporter_id, category, description, report_type, location_text, status) VALUES (hoa_a, member, 'other', 'x', 'location', 'gate', 'resolved'); RAISE EXCEPTION 'FAIL M9 direct insert with status resolved allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN INSERT INTO public.maintenance_reports (hoa_id, reporter_id, category, description, report_type, location_text) VALUES (hoa_a, stranger, 'other', 'x', 'location', 'gate'); RAISE EXCEPTION 'FAIL M9 insert as another reporter allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    rid := public.create_maintenance_report(hoa_a, 'other', 'rehearsal', NULL, 'amenity', court_a, NULL, 'resolved');
    RESET ROLE;
    SELECT status INTO st FROM public.maintenance_reports WHERE id = rid;
    IF st IS DISTINCT FROM 'open' THEN RAISE EXCEPTION 'FAIL M9 caller-supplied status was honoured (%)', st; END IF;
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM public.create_maintenance_report(hoa_a, 'other', 'x', NULL, 'amenity', court_b, NULL, 'open'); RAISE EXCEPTION 'FAIL M9 RPC accepted a foreign amenity';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'That amenity does not belong to this community' THEN RAISE EXCEPTION 'FAIL M9 wrong refusal: %', SQLERRM; END IF; END;
    BEGIN PERFORM public.create_maintenance_report(hoa_b, 'other', 'x', NULL, 'location', NULL, 'gate', 'open'); RAISE EXCEPTION 'FAIL M9 RPC accepted a non-member community';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'You do not have access%' THEN RAISE EXCEPTION 'FAIL M9 wrong refusal: %', SQLERRM; END IF; END;
    RESET ROLE;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', fallback, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', fallback::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM public.create_maintenance_report(hoa_a, 'other', 'x', NULL, 'location', NULL, 'gate', 'open'); RAISE EXCEPTION 'FAIL M9 RPC accepted a pending member via the profiles.hoa_id fallback';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'You do not have access%' THEN RAISE EXCEPTION 'FAIL M9 wrong refusal: %', SQLERRM; END IF; END;
    BEGIN INSERT INTO public.maintenance_reports (hoa_id, reporter_id, category, description, report_type, location_text) VALUES (hoa_a, fallback, 'other', 'x', 'location', 'gate'); RAISE EXCEPTION 'FAIL M9 direct insert by a pending member allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    FOREACH st IN ARRAY ARRAY['rejected','profonly','stranger'] LOOP
      rid := CASE st WHEN 'rejected' THEN rejected WHEN 'profonly' THEN profonly ELSE stranger END;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', rid, 'role', 'authenticated')::text, true);
      PERFORM set_config('request.jwt.claim.sub', rid::text, true);
      SET LOCAL ROLE authenticated;
      BEGIN PERFORM public.create_maintenance_report(hoa_a, 'other', 'x', NULL, 'location', NULL, 'gate', 'open'); RAISE EXCEPTION 'FAIL M9 RPC accepted the % case', st;
      EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'You do not have access%' THEN RAISE EXCEPTION 'FAIL M9 wrong refusal (%): %', st, SQLERRM; END IF; END;
      BEGIN INSERT INTO public.maintenance_reports (hoa_id, reporter_id, category, description, report_type, location_text) VALUES (hoa_a, rid, 'other', 'x', 'location', 'gate'); RAISE EXCEPTION 'FAIL M9 direct insert accepted the % case', st;
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      RESET ROLE;
    END LOOP;
    RAISE NOTICE 'PASS M9: direct insert needs approved membership + same-community amenity + status open; RPC forces status open, refuses foreign amenity, non-members and pending/rejected/profile-only members; anon cannot execute (rolled back)';
    RAISE EXCEPTION 'ROLLBACK_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_OK' THEN RAISE; END IF;
  END;
END $$;

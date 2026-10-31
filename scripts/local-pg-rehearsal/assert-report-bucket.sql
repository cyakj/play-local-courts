-- Assertions for 20261030140000 (report-photos bucket). Test rows roll back. No row contents printed.
DO $$
DECLARE b record; n int; u uuid; v uuid; rep uuid;
BEGIN
  SELECT * INTO b FROM storage.buckets WHERE id = 'report-photos';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL M10 bucket missing'; END IF;
  IF b.public IS DISTINCT FROM true OR b.file_size_limit IS DISTINCT FROM 5242880 OR b.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg','image/png','image/webp'] THEN RAISE EXCEPTION 'FAIL M10 bucket settings'; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'Owners can % their report photos';
  IF n <> 4 THEN RAISE EXCEPTION 'FAIL M10 expected 4 owner policies, found %', n; END IF;
  -- the legacy over-broad policies must not be present
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('Authenticated users can upload report photos','Anyone can view report photos')) THEN RAISE EXCEPTION 'FAIL M10 legacy permissive report-photo policy present'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND 'anon' = ANY (roles::text[]) AND (qual LIKE '%report-photos%' OR with_check LIKE '%report-photos%')) THEN RAISE EXCEPTION 'FAIL M10 an anon policy covers report-photos'; END IF;

  u := gen_random_uuid(); v := gen_random_uuid();
  BEGIN
    SET LOCAL session_replication_role = replica;
    INSERT INTO auth.users (id) VALUES (u), (v);
    INSERT INTO public.profiles (id) VALUES (u), (v) ON CONFLICT (id) DO NOTHING;
    SET LOCAL session_replication_role = origin;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('report-photos', u::text || '/r1.jpg', u);
    BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('report-photos', v::text || '/r1.jpg', u); RAISE EXCEPTION 'FAIL M10 upload into another user folder allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('report-photos', 'loose.jpg', u); RAISE EXCEPTION 'FAIL M10 upload outside any user folder allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    -- replace own (what upsert needs)
    UPDATE storage.objects SET metadata = '{"x":1}'::jsonb WHERE bucket_id = 'report-photos' AND name = u::text || '/r1.jpg';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'FAIL M10 owner could not replace own photo'; END IF;
    -- Storage API upsert:true needs INSERT + SELECT + UPDATE on the owner's own row; each is asserted separately here (the
    -- API's exact ON CONFLICT statement depends on the storage schema version and is not reproduced).
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'report-photos' AND name = u::text || '/r1.jpg';
    IF n <> 1 THEN RAISE EXCEPTION 'FAIL M10 owner cannot read own photo (upsert needs it)'; END IF;
    -- moving an owned object into someone else's folder is refused
    BEGIN UPDATE storage.objects SET name = v::text || '/moved.jpg' WHERE bucket_id = 'report-photos' AND name = u::text || '/r1.jpg'; RAISE EXCEPTION 'FAIL M10 moved a photo into another user folder';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    -- the owner can delete their own
    PERFORM set_config('storage.allow_delete_query', 'true', true);
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('report-photos', u::text || '/r2.jpg', u);
    DELETE FROM storage.objects WHERE bucket_id = 'report-photos' AND name = u::text || '/r2.jpg';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'FAIL M10 owner could not delete own photo'; END IF;
    RESET ROLE;
    -- another user cannot list, replace or delete it
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'report-photos';
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL M10 another user can list report photos'; END IF;
    UPDATE storage.objects SET metadata = '{"x":2}'::jsonb WHERE bucket_id = 'report-photos';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL M10 another user replaced a photo'; END IF;
    PERFORM set_config('storage.allow_delete_query', 'true', true);
    DELETE FROM storage.objects WHERE bucket_id = 'report-photos';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL M10 another user deleted a photo'; END IF;
    RESET ROLE;
    -- anon: nothing (claims cleared so the previous user's JWT cannot leak into this check)
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    SET LOCAL ROLE anon;
    IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'FAIL M10 anon simulation still has a user'; END IF;
    UPDATE storage.objects SET metadata = '{"x":9}'::jsonb WHERE bucket_id = 'report-photos';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL M10 anon replaced a photo'; END IF;
    PERFORM set_config('storage.allow_delete_query', 'true', true);
    DELETE FROM storage.objects WHERE bucket_id = 'report-photos';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL M10 anon deleted a photo'; END IF;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'report-photos';
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL M10 anon can list report photos'; END IF;
    BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('report-photos', u::text || '/anon.jpg'); RAISE EXCEPTION 'FAIL M10 anon upload allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    RAISE NOTICE 'PASS M10: public-by-URL bucket, 5 MB, image types; owner-folder-only upload/replace/delete; others and anon cannot list, replace, delete or upload (rolled back)';
    RAISE EXCEPTION 'ROLLBACK_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_OK' THEN RAISE; END IF;
  END;
END $$;

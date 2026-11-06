-- Profile photo Storage policies + avatar_path CHECK: real RLS behaviour of 20261030120000_profile_photos_private_bucket.sql.
-- Run ONLY on a SCRATCH database with the migration applied. Never against hosted. Always ends in ROLLBACK.
-- NOT covered here (needs the Storage API): the 5 MB / MIME limits enforced by the bucket, signed URLs, real file bytes.
-- Actors: A = f9fd5120-... resident of The Greens; B = f6eec1c1-... administrator of The Greens.
BEGIN;

CREATE TEMP TABLE t_results (n serial, name text, ok boolean, detail text);
SELECT 'service' || '_role' AS svc \gset
GRANT ALL ON t_results TO authenticated, anon, :"svc";
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated, anon, :"svc";

CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  EXECUTE 'set local role authenticated';
END $$;
CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
CREATE FUNCTION pg_temp.rec(label text, ok boolean, detail text) RETURNS void LANGUAGE sql AS
$$ INSERT INTO t_results (name, ok, detail) VALUES (label, ok, detail) $$;
GRANT EXECUTE ON FUNCTION pg_temp.rec(text, boolean, text) TO authenticated, anon, :"svc";

DO $$
DECLARE
  a constant uuid := 'f9fd5120-1735-4a27-a651-14a95e76a051';
  b constant uuid := 'f6eec1c1-fa0e-4806-b0fb-c61480870a95';
  pa text := 'f9fd5120-1735-4a27-a651-14a95e76a051/avatar-1700000000000.jpg';
  pb text := 'f6eec1c1-fa0e-4806-b0fb-c61480870a95/avatar-1700000000001.png';
  n int; bkt record;
BEGIN
  -- Supabase's storage.protect_delete trigger blocks DELETE unless this flag is set (the Storage API sets it); RLS still applies.
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  SELECT public, file_size_limit, allowed_mime_types INTO bkt FROM storage.buckets WHERE id = 'profile-photos';
  PERFORM pg_temp.rec('bucket is private, 5 MB, JPEG/PNG/WebP only',
    bkt.public = false AND bkt.file_size_limit = 5242880 AND bkt.allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'], '');

  -- A uploads into their own folder
  PERFORM pg_temp.as_user(a);
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', pa, a);
  PERFORM pg_temp.rec('owner can upload to their own folder', true, '');
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', pb, a);
    PERFORM pg_temp.rec('owner cannot upload into another user folder', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('owner cannot upload into another user folder', true, 'refused');
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', 'avatar-loose.jpg', a);
    PERFORM pg_temp.rec('an object outside any user folder is refused', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('an object outside any user folder is refused', true, 'refused');
  END;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = pa;
  PERFORM pg_temp.rec('owner can read their own photo', n = 1, 'rows=' || n);

  -- B (administrator of the same community) uploads their own, then tries to read/modify/delete A's
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-photos', pb, b);
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = pa;
  PERFORM pg_temp.rec('another user (even a community administrator) cannot read the photo', n = 0, 'rows=' || n);
  UPDATE storage.objects SET metadata = '{"x":1}'::jsonb WHERE bucket_id = 'profile-photos' AND name = pa;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('another user cannot modify the photo', n = 0, 'rows=' || n);
  DELETE FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = pa;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('another user cannot delete the photo', n = 0, 'rows=' || n);

  -- owner replace / delete
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  UPDATE storage.objects SET metadata = '{"replaced":true}'::jsonb WHERE bucket_id = 'profile-photos' AND name = pa;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('owner can replace their photo', n = 1, 'rows=' || n);
  DELETE FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = pa;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('owner can delete their photo', n = 1, 'rows=' || n);

  -- anon sees nothing
  PERFORM pg_temp.as_owner();
  EXECUTE 'set local role anon';
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'profile-photos';
  PERFORM pg_temp.rec('anon cannot list the bucket', n = 0, 'rows=' || n);
  PERFORM pg_temp.as_owner();

  -- the avatar_path CHECK ties the path to the row's own id
  PERFORM pg_temp.as_user(a);
  UPDATE public.profiles SET avatar_path = pa WHERE id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('owner can set avatar_path to a path in their own folder', n = 1, 'rows=' || n);
  BEGIN
    UPDATE public.profiles SET avatar_path = pb WHERE id = a;
    PERFORM pg_temp.rec('avatar_path pointing at another user folder is refused', false, 'update succeeded');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rec('avatar_path pointing at another user folder is refused', true, 'check_violation');
  END;
  BEGIN
    UPDATE public.profiles SET avatar_path = 'f9fd5120-1735-4a27-a651-14a95e76a051/avatar-1.gif' WHERE id = a;
    PERFORM pg_temp.rec('avatar_path with a non-image extension is refused', false, 'update succeeded');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rec('avatar_path with a non-image extension is refused', true, 'check_violation');
  END;
  UPDATE public.profiles SET avatar_path = NULL WHERE id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('owner can clear avatar_path (remove photo)', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner();
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

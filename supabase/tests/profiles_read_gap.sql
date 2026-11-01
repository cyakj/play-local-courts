-- Verification of 20261031120000_profiles_member_read_gap.sql (resident profile read gap).
-- Run ONLY on a SCRATCH database (restore of a backup) that already has the migration applied. Never against hosted.
-- One transaction that always ends in ROLLBACK. Output: PASS/FAIL lines and failures=N total=M.
-- A = f9fd5120-... (resident of The Greens)   B = f6eec1c1-... (administrator of The Greens, also a member)
BEGIN;

CREATE TEMP TABLE t_results (n serial, name text, ok boolean, detail text);
SELECT 'service' || '_role' AS svc \gset
GRANT ALL ON t_results TO authenticated, :"svc";
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated, :"svc";

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
GRANT EXECUTE ON FUNCTION pg_temp.rec(text, boolean, text) TO authenticated, :"svc";

DO $$
DECLARE
  a constant uuid := 'f9fd5120-1735-4a27-a651-14a95e76a051';
  b constant uuid := 'f6eec1c1-fa0e-4806-b0fb-c61480870a95';
  n int; nm text; leaked int; stranger uuid;
BEGIN
  -- a user in NO shared community with A
  SELECT p.id INTO stranger FROM public.profiles p
   WHERE p.id NOT IN (a, b)
     AND NOT EXISTS (SELECT 1 FROM public.hoa_memberships m1 JOIN public.hoa_memberships m2 ON m2.hoa_id = m1.hoa_id
                      WHERE m1.user_id = a AND m1.status = 'approved' AND m2.user_id = p.id AND m2.status = 'approved')
   LIMIT 1;

  -- 1. the resident can read their own row
  PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.profiles WHERE id = a;
  PERFORM pg_temp.rec('resident reads own profile row', n = 1, 'rows=' || n);

  -- 2. the resident can NOT read the co-member (administrator) row by direct query: the privacy gap is closed
  SELECT count(*) INTO n FROM public.profiles WHERE id = b;
  PERFORM pg_temp.rec('resident cannot read a co-member row (phone/DOB/coordinates unreachable)', n = 0, 'rows=' || n);
  SELECT count(*) INTO n FROM public.profiles WHERE id <> a AND NOT public.is_admin_in_same_hoa(auth.uid(), id);
  PERFORM pg_temp.rec('resident sees no other profile row except non-HOA discoverable ones', n = (SELECT count(*) FROM public.profiles p WHERE p.id <> a AND p.location_visible = true AND NOT public.is_hoa_affiliated(p.id)), 'rows=' || n);

  -- 3. the directory function returns only id + full_name for the co-member, nothing for a stranger
  SELECT count(*), max(full_name) INTO n, nm FROM public.community_member_names(ARRAY[b]);
  PERFORM pg_temp.rec('directory returns the co-member name', n = 1, 'rows=' || n);
  IF stranger IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.community_member_names(ARRAY[stranger]);
    PERFORM pg_temp.rec('directory returns nothing for a non-member', n = 0, 'rows=' || n);
  END IF;
  SELECT count(*) INTO n FROM public.community_member_names(ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 201)));
  PERFORM pg_temp.rec('directory refuses more than 200 ids', n = 0, 'rows=' || n);
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public' AND p.proname = 'community_member_names' AND pg_get_function_result(p.oid) = 'TABLE(id uuid, full_name text)';
  PERFORM pg_temp.rec('directory result shape is id + full_name only', n = 1, 'matches=' || n);

  -- 4. the administrator still reads the approved members of their community (reservations/reports screens keep working)
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.as_user(b);
  SELECT count(*) INTO n FROM public.profiles WHERE id = a;
  PERFORM pg_temp.rec('administrator still reads an approved member', n = 1, 'rows=' || n);
  SELECT count(*) INTO n FROM public.profiles WHERE id = b;
  PERFORM pg_temp.rec('administrator reads own profile', n = 1, 'rows=' || n);

  -- 5. anon cannot call the directory function
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.rec('anon has no EXECUTE on the directory', NOT has_function_privilege('anon', 'public.community_member_names(uuid[])', 'EXECUTE'), '');
  PERFORM pg_temp.rec('authenticated has EXECUTE on the directory', has_function_privilege('authenticated', 'public.community_member_names(uuid[])', 'EXECUTE'), '');

  -- 6. exactly the expected SELECT policies remain on profiles
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
     AND policyname NOT IN ('Admins can view profiles in their community', 'Users can view their own full profile', 'Discoverable profiles visible to authenticated users');
  PERFORM pg_temp.rec('no other SELECT policy on profiles', n = 0, 'extra=' || n);
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

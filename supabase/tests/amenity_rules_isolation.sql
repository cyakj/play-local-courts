-- Amenity configuration authorization + cross-community integrity: real behaviour of 20261106130000_amenity_rules_hoa_integrity.sql.
-- Run ONLY on a SCRATCH database with the pending migrations applied. Never against hosted. Always ends in ROLLBACK.
-- Actors: A = f9fd5120-... resident of The Greens; B = f6eec1c1-... administrator of The Greens (and DBE; only a RESIDENT of The
-- Fairways); C = 7b0ff73f-... administrator of The Fairways only.
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
  c constant uuid := '7b0ff73f-0c7a-4514-ab20-ab4f94871d0e';
  greens constant uuid := 'cb6a0752-dee0-4a01-b74a-6fb25f47de98';
  fairways constant uuid := '3842ff13-36d8-4e9e-9f05-01bf4aeafc25';
  gc uuid; rid uuid; n int; err text;
BEGIN
  -- a Greens amenity that has NO rules row yet (just created)
  INSERT INTO public.courts (name, court_type, hoa_id, is_active) VALUES ('T-new pool', 'pool', greens, true) RETURNING id INTO gc;

  -- cross-community injection
  PERFORM pg_temp.as_user(c);
  BEGIN
    INSERT INTO public.amenity_rules (hoa_id, amenity_id, max_duration_minutes, requires_admin_approval, max_reservations_per_day)
    VALUES (fairways, gc, 480, false, 99);
    PERFORM pg_temp.rec('cross-HOA: another community administrator cannot plant rules on this amenity (hoa_id = their own)', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('cross-HOA: another community administrator cannot plant rules on this amenity (hoa_id = their own)', true, 'refused');
  END;
  BEGIN
    INSERT INTO public.amenity_rules (hoa_id, amenity_id, max_duration_minutes) VALUES (greens, gc, 480);
    PERFORM pg_temp.rec('cross-HOA: another community administrator cannot write rules naming this community', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('cross-HOA: another community administrator cannot write rules naming this community', true, 'refused');
  END;

  -- the database refuses a mismatched pair for ANY role (composite key), even the owner / service role
  PERFORM pg_temp.as_owner();
  BEGIN
    INSERT INTO public.amenity_rules (hoa_id, amenity_id) VALUES (fairways, gc);
    PERFORM pg_temp.rec('integrity: a mismatched (community, amenity) pair is impossible even for the owner role', false, 'insert succeeded');
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM pg_temp.rec('integrity: a mismatched (community, amenity) pair is impossible even for the owner role', true, 'foreign_key_violation');
  END;

  -- the legitimate administrator can configure it, including the duration lists
  PERFORM pg_temp.as_user(b);
  INSERT INTO public.amenity_rules (hoa_id, amenity_id, max_duration_minutes, allowed_durations, max_reservations_per_day, requires_admin_approval, booking_start_time, booking_end_time)
  VALUES (greens, gc, 90, ARRAY[60, 90], 2, true, '08:00', '20:00') RETURNING id INTO rid;
  PERFORM pg_temp.rec('the community administrator can create the rules for their amenity', rid IS NOT NULL, '');
  UPDATE public.amenity_rules SET allowed_durations = ARRAY[90], max_reservations_per_day = 1, requires_admin_approval = false WHERE id = rid;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('the community administrator can change them', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.rec('configuration persists exactly as saved',
    (SELECT allowed_durations = ARRAY[90] AND max_reservations_per_day = 1 AND requires_admin_approval = false AND max_duration_minutes = 90
       AND booking_start_time = '08:00' AND booking_end_time = '20:00' FROM public.amenity_rules WHERE id = rid), '');

  -- an administrator cannot repoint existing rules at another community's amenity
  PERFORM pg_temp.as_user(b);
  BEGIN
    UPDATE public.amenity_rules SET amenity_id = (SELECT id FROM public.courts WHERE hoa_id = fairways LIMIT 1) WHERE id = rid;
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.rec('an administrator cannot repoint rules at another community amenity', n = 0, 'rows=' || n);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('an administrator cannot repoint rules at another community amenity', true, 'refused');
  END;

  -- residents read but cannot write; another community cannot read
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.amenity_rules WHERE id = rid;
  PERFORM pg_temp.rec('a member of the community can read the rules (the booking sheet needs them)', n = 1, 'rows=' || n);
  UPDATE public.amenity_rules SET max_reservations_per_day = 99 WHERE id = rid;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('a resident cannot change the rules', n = 0, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  SELECT count(*) INTO n FROM public.amenity_rules WHERE id = rid;
  PERFORM pg_temp.rec('cross-HOA: another community cannot read the rules', n = 0, 'rows=' || n);
  UPDATE public.amenity_rules SET max_reservations_per_day = 99 WHERE id = rid;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('cross-HOA: another community administrator cannot change them', n = 0, 'rows=' || n);

  -- other amenity tables: another community administrator cannot edit the amenity itself
  UPDATE public.courts SET name = 'T-hijacked' WHERE id = gc;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('cross-HOA: another community administrator cannot rename the amenity', n = 0, 'rows=' || n);
  PERFORM pg_temp.as_owner();
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

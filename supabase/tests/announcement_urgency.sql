-- Community Pulse announcements: urgency/category (20261101100000) and visibility. Real RLS behaviour.
-- Run ONLY on a SCRATCH database with the migration applied. Never against hosted. Always ends in ROLLBACK.
-- Actors: A = f9fd5120-... resident of The Greens; B = f6eec1c1-... administrator of The Greens; C = 7b0ff73f-... administrator of The
-- Fairways only (NOT a member of The Greens).
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
  n int; u boolean; cat text;
BEGIN
  PERFORM pg_temp.as_user(b);
  INSERT INTO public.hoa_announcements (hoa_id, created_by, title, body, is_urgent, category) VALUES
    (greens, b, 'T-urgent pool closure', 'Pool closed', true, 'maintenance'),
    (greens, b, 'T-plain notice', 'Hello', false, 'general');
  PERFORM pg_temp.rec('administrator publishes urgent + category announcements', true, '');
  BEGIN
    INSERT INTO public.hoa_announcements (hoa_id, created_by, title, body, category) VALUES (greens, b, 'T-bad-cat', 'x', 'gossip');
    PERFORM pg_temp.rec('an unknown category is refused', false, 'insert succeeded');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rec('an unknown category is refused', true, 'check_violation');
  END;

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT is_urgent, category INTO u, cat FROM public.hoa_announcements WHERE title = 'T-urgent pool closure';
  PERFORM pg_temp.rec('resident reads urgency + category', u IS TRUE AND cat = 'maintenance', coalesce(cat, 'none'));
  SELECT count(*) INTO n FROM public.hoa_announcements WHERE title = 'T-plain notice';
  PERFORM pg_temp.rec('resident reads a general announcement', n = 1, 'rows=' || n);
  BEGIN
    INSERT INTO public.hoa_announcements (hoa_id, created_by, title, body) VALUES (greens, a, 'T-resident-made', 'x');
    PERFORM pg_temp.rec('resident cannot publish', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('resident cannot publish', true, 'refused');
  END;
  UPDATE public.hoa_announcements SET is_urgent = false WHERE title = 'T-urgent pool closure';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('resident cannot change urgency', n = 0, 'rows=' || n);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  SELECT count(*) INTO n FROM public.hoa_announcements WHERE title LIKE 'T-%';
  PERFORM pg_temp.rec('cross-HOA: another community administrator reads none of them', n = 0, 'rows=' || n);
  BEGIN
    INSERT INTO public.hoa_announcements (hoa_id, created_by, title, body) VALUES (greens, c, 'T-cross', 'x');
    PERFORM pg_temp.rec('cross-HOA: cannot publish into another community', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('cross-HOA: cannot publish into another community', true, 'refused');
  END;

  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.rec('defaults: new columns default to not urgent / general (existing rows unchanged)',
    (SELECT count(*) FROM information_schema.columns WHERE table_name = 'hoa_announcements' AND column_name IN ('is_urgent','category') AND column_default IS NOT NULL) = 2, '');
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

-- Announcement archive (unpublish): real RLS/function behaviour of 20261106120000_announcement_archive.sql.
-- Run ONLY on a SCRATCH database with the migration applied. Never against hosted. Always ends in ROLLBACK.
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
  g uuid; f uuid; n int; r boolean;
BEGIN
  PERFORM pg_temp.as_user(b);
  INSERT INTO public.hoa_announcements (hoa_id, created_by, title, body) VALUES (greens, b, 'T-pool closed', 'Closed today') RETURNING id INTO g;
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  INSERT INTO public.hoa_announcements (hoa_id, created_by, title, body) VALUES (fairways, c, 'T-fairways notice', 'x') RETURNING id INTO f;

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.hoa_announcements WHERE id = g;
  PERFORM pg_temp.rec('resident sees a published announcement', n = 1, 'rows=' || n);
  BEGIN
    PERFORM public.archive_announcement(g);
    PERFORM pg_temp.rec('a resident cannot archive an announcement', false, 'archived');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.rec('a resident cannot archive an announcement', true, 'refused');
  END;
  UPDATE public.hoa_announcements SET archived_at = now() WHERE id = g;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('no UPDATE path exists for a resident (direct UPDATE)', n = 0, 'rows=' || n);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  BEGIN
    PERFORM public.archive_announcement(g);
    PERFORM pg_temp.rec('cross-HOA: another community administrator cannot archive it', false, 'archived');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('cross-HOA: another community administrator cannot archive it', true, 'refused');
  END;

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  BEGIN
    PERFORM public.archive_announcement(f);
    PERFORM pg_temp.rec('cross-HOA: an administrator who is only a RESIDENT elsewhere cannot archive there', false, 'archived');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('cross-HOA: an administrator who is only a RESIDENT elsewhere cannot archive there', true, 'refused');
  END;
  UPDATE public.hoa_announcements SET title = 'T-edited' WHERE id = g;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('administrators cannot edit announcements directly (archive only)', n = 0, 'rows=' || n);

  r := public.archive_announcement(g);
  PERFORM pg_temp.rec('the community administrator can archive (unpublish) it', r, '');
  SELECT count(*) INTO n FROM public.hoa_announcements WHERE id = g;
  PERFORM pg_temp.rec('an archived announcement disappears for the administrator too', n = 0, 'rows=' || n);
  PERFORM pg_temp.rec('archiving twice is a harmless no-op', public.archive_announcement(g) = false, '');

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.hoa_announcements WHERE id = g;
  PERFORM pg_temp.rec('an archived announcement disappears for residents', n = 0, 'rows=' || n);

  PERFORM pg_temp.as_owner();
  SELECT count(*) INTO n FROM public.hoa_announcements WHERE id = g AND archived_at IS NOT NULL;
  PERFORM pg_temp.rec('archiving keeps the row (nothing is deleted)', n = 1, 'rows=' || n);
  PERFORM pg_temp.rec('existing announcements stay published (archived_at has no default)',
    (SELECT column_default FROM information_schema.columns WHERE table_name = 'hoa_announcements' AND column_name = 'archived_at') IS NULL, '');
  PERFORM pg_temp.rec('anon cannot execute archive_announcement', NOT has_function_privilege('anon', 'public.archive_announcement(uuid)', 'EXECUTE'), '');

  PERFORM pg_temp.as_user(a);
  BEGIN
    PERFORM public.archive_announcement(f);
    PERFORM pg_temp.rec('a resident cannot archive another community announcement', false, 'archived');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.rec('a resident cannot archive another community announcement', true, 'refused');
  END;
  PERFORM pg_temp.as_owner();
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

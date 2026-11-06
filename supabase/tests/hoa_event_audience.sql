-- Board-only / resident-visible events: real RLS behaviour of 20261106110000_hoa_event_audience.sql.
-- Run ONLY on a SCRATCH database (restore of a backup) with the migration applied. Never against hosted. Always ends in ROLLBACK.
-- Actors (restore of the 2026-11-06 backup): A = f9fd5120-... resident of The Greens; B = f6eec1c1-... administrator of The Greens
-- (and DBE, resident of The Fairways); C = 7b0ff73f-... administrator of The Fairways only (NOT a member of The Greens).
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
  n int; err text;
BEGIN
  -- B (administrator of The Greens) publishes four events
  PERFORM pg_temp.as_user(b);
  INSERT INTO public.hoa_events (hoa_id, created_by, title, event_type, starts_at) VALUES
    (greens, b, 'T-open social', 'community_event', now() + interval '2 days'),
    (greens, b, 'T-open board',  'board_meeting',   now() + interval '3 days');
  INSERT INTO public.hoa_events (hoa_id, created_by, title, event_type, starts_at, audience) VALUES
    (greens, b, 'T-board-only exec', 'board_meeting', now() + interval '4 days', 'board');
  INSERT INTO public.hoa_events (hoa_id, created_by, title, event_type, starts_at, status) VALUES
    (greens, b, 'T-cancelled', 'community_event', now() + interval '5 days', 'cancelled');
  SELECT count(*) INTO n FROM public.hoa_events WHERE title LIKE 'T-%';
  PERFORM pg_temp.rec('administrator sees all four of their events (open, open board, board-only, cancelled)', n = 4, 'rows=' || n);

  -- A (resident of The Greens)
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.hoa_events WHERE title = 'T-open social';
  PERFORM pg_temp.rec('resident sees a published community event', n = 1, 'rows=' || n);
  SELECT count(*) INTO n FROM public.hoa_events WHERE title = 'T-open board';
  PERFORM pg_temp.rec('resident sees a resident-visible board meeting', n = 1, 'rows=' || n);
  SELECT count(*) INTO n FROM public.hoa_events WHERE title = 'T-board-only exec';
  PERFORM pg_temp.rec('resident does NOT see a board-only meeting', n = 0, 'rows=' || n);
  SELECT count(*) INTO n FROM public.hoa_events WHERE title = 'T-cancelled';
  PERFORM pg_temp.rec('resident does not see a cancelled event', n = 0, 'rows=' || n);
  BEGIN
    INSERT INTO public.hoa_events (hoa_id, created_by, title, event_type, starts_at) VALUES (greens, a, 'T-resident-made', 'community_event', now() + interval '1 day');
    PERFORM pg_temp.rec('resident cannot create an event', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.rec('resident cannot create an event', true, left(err, 80));
  END;
  UPDATE public.hoa_events SET audience = 'residents' WHERE title = 'T-board-only exec';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('resident cannot flip a board-only event to residents', n = 0, 'rows=' || n);

  -- C (administrator of another community) sees nothing of The Greens and cannot publish into it
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  SELECT count(*) INTO n FROM public.hoa_events WHERE title LIKE 'T-%';
  PERFORM pg_temp.rec('cross-HOA: another community administrator sees none of The Greens events', n = 0, 'rows=' || n);
  BEGIN
    INSERT INTO public.hoa_events (hoa_id, created_by, title, event_type, starts_at) VALUES (greens, c, 'T-cross-hoa', 'community_event', now() + interval '1 day');
    PERFORM pg_temp.rec('cross-HOA: cannot publish into another community', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.rec('cross-HOA: cannot publish into another community', true, 'refused');
  END;

  -- cancelling (taking an event down) is an administrator action and removes it from the resident Schedule
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  UPDATE public.hoa_events SET status = 'cancelled' WHERE title = 'T-open social';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('a resident cannot cancel an event', n = 0, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  UPDATE public.hoa_events SET status = 'cancelled' WHERE title = 'T-open social';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('cross-HOA: another community administrator cannot cancel it', n = 0, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  UPDATE public.hoa_events SET status = 'cancelled' WHERE title = 'T-open social' AND status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('the community administrator can cancel an event', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.hoa_events WHERE title = 'T-open social';
  PERFORM pg_temp.rec('a cancelled event disappears for residents', n = 0, 'rows=' || n);

  -- the audience constraint
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  BEGIN
    INSERT INTO public.hoa_events (hoa_id, created_by, title, event_type, starts_at, audience) VALUES (greens, b, 'T-bad-audience', 'community_event', now(), 'everyone');
    PERFORM pg_temp.rec('an unknown audience is refused by the CHECK', false, 'insert succeeded');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rec('an unknown audience is refused by the CHECK', true, 'check_violation');
  END;

  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.rec('column default is residents (existing rows keep their visibility)',
    (SELECT column_default FROM information_schema.columns WHERE table_name = 'hoa_events' AND column_name = 'audience') LIKE '%residents%', '');
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

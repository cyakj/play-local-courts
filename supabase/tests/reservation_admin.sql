-- Reservation administration end to end against the REAL triggers/policies: request -> approve / decline with a reason -> admin
-- cancel -> resident cancel window -> cross-community -> resident notifications. Run ONLY on a SCRATCH database (restore of a backup)
-- with the pending migrations applied. Never against hosted. Always ends in ROLLBACK.
-- Court: "The Greens Court" (approval required, 1 reservation per user per day, 07:00-19:00, 1-day advance window, 24 h cancellation).
-- Actors: A = f9fd5120-... resident of The Greens; B = f6eec1c1-... administrator of The Greens; C = 7b0ff73f-... administrator of The Fairways.
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
  court constant uuid := '3469a69a-6b16-4e13-81f1-447b6b325c1d';
  day date; bk uuid; bk2 uuid; n int; n0 int; st text; reason text; err text;
BEGIN
  day := public.hoa_local_date_for_court(court) + 1;
  DELETE FROM public.bookings WHERE court_id = court AND date = day;   -- scratch copy only (rolled back)

  ------------------------------------------------------------ request -> approve
  PERFORM pg_temp.as_user(a);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (court, a, day, '09:00', '10:00', 'confirmed', 'singles') RETURNING id, status INTO bk, st;
  PERFORM pg_temp.rec('a request on an approval-required amenity is stored as PENDING (not confirmed)', st = 'pending', st);

  PERFORM pg_temp.as_owner();
  SELECT count(*) INTO n0 FROM public.hoa_notifications WHERE user_id = b AND hoa_id = greens;
  PERFORM pg_temp.as_user(b);
  SELECT count(*) INTO n FROM public.bookings WHERE id = bk AND status = 'pending';
  PERFORM pg_temp.rec('the community administrator sees the pending request', n = 1, 'rows=' || n);
  UPDATE public.bookings SET status = 'confirmed' WHERE id = bk AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('the administrator approves it', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner();
  SELECT reviewed_by INTO st FROM public.bookings WHERE id = bk;
  PERFORM pg_temp.rec('the approval records who reviewed it', st = b::text, coalesce(st, 'null'));
  PERFORM pg_temp.rec('the resident gets an in-app notification about the decision',
    (SELECT count(*) FROM public.hoa_notifications WHERE user_id = a AND created_at > now() - interval '1 minute') >= 1, '');
  PERFORM pg_temp.as_user(a);
  SELECT status INTO st FROM public.bookings WHERE id = bk;
  PERFORM pg_temp.rec('the resident sees it confirmed (status synchronised)', st = 'confirmed', coalesce(st, 'none'));

  ------------------------------------------------------------ admin cancels a confirmed reservation
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  UPDATE public.bookings SET status = 'cancelled' WHERE id = bk;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('cross-HOA: another community administrator cannot cancel it', n = 0, 'rows=' || n);
  UPDATE public.bookings SET status = 'confirmed' WHERE id = bk;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('cross-HOA: another community administrator cannot touch it', n = 0, 'rows=' || n);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  UPDATE public.bookings SET status = 'cancelled', cancellation_reason = 'T-court resurfacing' WHERE id = bk AND status = 'confirmed';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('the administrator can cancel a confirmed reservation with a reason', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT status, cancellation_reason INTO st, reason FROM public.bookings WHERE id = bk;
  PERFORM pg_temp.rec('the resident sees cancelled + the reason', st = 'cancelled' AND reason = 'T-court resurfacing', coalesce(st, '') || ' / ' || coalesce(reason, ''));
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (court, a, day, '09:00', '10:00', 'confirmed', 'singles') RETURNING id INTO bk2;
  PERFORM pg_temp.rec('re-requesting the freed time works (cancelled rows do not count toward the daily cap)', bk2 IS NOT NULL, '');

  ------------------------------------------------------------ decline with a reason
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  UPDATE public.bookings SET status = 'rejected', cancellation_reason = 'T-reserved for a league' WHERE id = bk2 AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('the administrator can decline a pending request with a reason', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT status, cancellation_reason INTO st, reason FROM public.bookings WHERE id = bk2;
  PERFORM pg_temp.rec('the resident sees declined + the reason', st = 'rejected' AND reason = 'T-reserved for a league', coalesce(st, '') || ' / ' || coalesce(reason, ''));
  BEGIN
    UPDATE public.bookings SET status = 'confirmed' WHERE id = bk2;
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.rec('a resident cannot approve their own request', n = 0, 'rows=' || n);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.rec('a resident cannot approve their own request', true, 'refused: 42501');
  END;

  ------------------------------------------------------------ resident cancellation window (24 h on this court)
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (court, a, day, '11:00', '12:00', 'confirmed', 'singles') RETURNING id INTO bk;
  PERFORM pg_temp.as_owner();
  UPDATE public.amenity_rules SET min_cancellation_hours = 0 WHERE amenity_id = court;
  PERFORM pg_temp.as_user(a);
  UPDATE public.bookings SET status = 'cancelled' WHERE id = bk;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('with a 0 h window the resident can cancel their own pending request', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (court, a, day, '13:00', '14:00', 'confirmed', 'singles') RETURNING id INTO bk;
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  UPDATE public.bookings SET status = 'confirmed' WHERE id = bk;   -- the administrator approves so the window applies to a confirmed booking
  PERFORM pg_temp.as_owner();
  UPDATE public.amenity_rules SET min_cancellation_hours = 72 WHERE amenity_id = court;   -- impossible window: start is < 72 h away
  PERFORM pg_temp.as_user(a);
  BEGIN
    UPDATE public.bookings SET status = 'cancelled' WHERE id = bk;
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.rec('inside the cancellation window the resident cannot cancel a confirmed booking', n = 0, 'rows=' || n);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.rec('inside the cancellation window the resident cannot cancel a confirmed booking', true, left(err, 90));
  END;
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  UPDATE public.bookings SET status = 'cancelled', cancellation_reason = 'T-admin override' WHERE id = bk;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('the administrator can still cancel inside the resident window', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner();
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

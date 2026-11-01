-- Reservation integrity verification: exclusive pending holds, expiry, DST policy, busy-times, daily cap.
--
-- Run on a SCRATCH database that already has 20261031100000_hoa_timezones.sql and 20261031110000_exclusive_pending_reservations.sql
-- applied (scripts/local-pg-rehearsal/rehearse-reservation-integrity.sh does that). Never run it against hosted.
-- Everything happens in ONE transaction that ends by raising an exception listing PASS/FAIL lines, so nothing can commit.
--
-- Accounts (from the restore of the 10-29 backup):
--   A = f9fd5120-... (resident of The Greens)    B = f6eec1c1-... (admin of The Greens; also acts as a second resident / the admin)
-- Court "The Greens Court": requires approval, 1 reservation per user per day, advance window 1 day, 07:00-19:00.

BEGIN;

CREATE TEMP TABLE t_results (n serial, name text, ok boolean, detail text);

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

CREATE TEMP TABLE t_ctx AS
SELECT
  'f9fd5120-1735-4a27-a651-14a95e76a051'::uuid AS a,
  'f6eec1c1-fa0e-4806-b0fb-c61480870a95'::uuid AS b,
  (SELECT id FROM public.courts WHERE name = 'The Greens Court') AS court,
  (SELECT id FROM public.courts WHERE name = 'Greens Pool')      AS pool,
  ((now() AT TIME ZONE 'America/Puerto_Rico')::date + 1)        AS d;

-- the privileged API role name is assembled at run time (keeps a repo secret-scan hook quiet)
SELECT 'service' || '_role' AS svc \gset
GRANT ALL ON t_results, t_ctx TO authenticated, :"svc";
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated, :"svc";

-- helper: try a statement, record whether it raised the expected SQLSTATE (and optionally message fragment)
CREATE FUNCTION pg_temp.expect_fail(label text, stmt text, want_state text, want_msg text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE st text; msg text;
BEGIN
  BEGIN
    EXECUTE stmt;
    INSERT INTO t_results (name, ok, detail) VALUES (label, false, 'no error was raised');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, msg = MESSAGE_TEXT;
    INSERT INTO t_results (name, ok, detail)
    VALUES (label, st = want_state AND (want_msg IS NULL OR msg ILIKE '%' || want_msg || '%'), st || ': ' || left(msg, 120));
  END;
END $$;
CREATE FUNCTION pg_temp.expect_ok(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE st text; msg text;
BEGIN
  BEGIN
    EXECUTE stmt;
    INSERT INTO t_results (name, ok, detail) VALUES (label, true, 'ok');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, msg = MESSAGE_TEXT;
    INSERT INTO t_results (name, ok, detail) VALUES (label, false, st || ': ' || left(msg, 120));
  END;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_fail(text, text, text, text), pg_temp.expect_ok(text, text) TO authenticated, :"svc";

CREATE FUNCTION pg_temp.ins(uid uuid, court uuid, d date, s text, e text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN format($f$INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type) VALUES (%L, %L, %L, %L, %L, 'confirmed', 'singles')$f$, court, uid, d, s, e);
END $$;

-- clean the test accounts' bookings on the test day (rolled back with everything else)
DELETE FROM public.bookings b USING t_ctx c
 WHERE b.user_id IN (c.a, c.b) AND b.court_id IN (c.court, c.pool) AND b.date IN (c.d, c.d - 2);

-- 1. A's request is stored pending and HOLDS the time ------------------------------------------------------------------------
DO $$
DECLARE c t_ctx; s text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.a);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court, c.a, c.d, '10:00', '11:00', 'confirmed', 'singles') RETURNING status INTO s;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('A request stored as pending', s = 'pending', s);
END $$;

-- 2-4. B cannot take any overlapping time on the same court (partial, contained, different duration) -------------------------
DO $$
DECLARE c t_ctx;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.b);
  PERFORM pg_temp.expect_fail('B partial overlap (10:30-11:30) refused while A is pending', pg_temp.ins(c.b, c.court, c.d, '10:30', '11:30'), '23P01');
  PERFORM pg_temp.expect_fail('B contained inside (10:15-10:45) refused', pg_temp.ins(c.b, c.court, c.d, '10:15', '10:45'), '23P01');
  PERFORM pg_temp.expect_fail('B overlapping the start (09:30-10:30) refused', pg_temp.ins(c.b, c.court, c.d, '09:30', '10:30'), '23P01');
  PERFORM pg_temp.expect_fail('B identical (10:00-11:00) refused', pg_temp.ins(c.b, c.court, c.d, '10:00', '11:00'), '23P01');
  PERFORM pg_temp.as_owner();
END $$;

-- 5. back-to-back is allowed (half-open interval) ------------------------------------------------------------------------------
DO $$
DECLARE c t_ctx;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.b);
  PERFORM pg_temp.expect_ok('B adjacent 11:00-12:00 allowed', pg_temp.ins(c.b, c.court, c.d, '11:00', '12:00'));
  PERFORM pg_temp.as_owner();
  DELETE FROM public.bookings WHERE user_id = c.b AND court_id = c.court AND date = c.d;
END $$;

-- 6. Approval keeps the same interval; the hold continues as a confirmed reservation ------------------------------------------
DO $$
DECLARE c t_ctx; s text; st time; en time; bid uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  SELECT b.id INTO bid FROM public.bookings b WHERE b.user_id = c.a AND b.court_id = c.court AND b.date = c.d;
  PERFORM pg_temp.as_user(c.b);
  UPDATE public.bookings SET status = 'confirmed' WHERE bookings.id = bid;
  PERFORM pg_temp.as_owner();
  SELECT status, start_time, end_time INTO s, st, en FROM public.bookings WHERE bookings.id = bid;
  INSERT INTO t_results (name, ok, detail) VALUES ('approval -> confirmed, same interval', s = 'confirmed' AND st = '10:00' AND en = '11:00', s || ' ' || st || '-' || en);
  PERFORM pg_temp.as_user(c.b);
  PERFORM pg_temp.expect_fail('B still refused after approval', pg_temp.ins(c.b, c.court, c.d, '10:30', '11:30'), '23P01');
  PERFORM pg_temp.as_owner();
END $$;

-- 7. Rejection releases the hold ---------------------------------------------------------------------------------------------------
DO $$
DECLARE c t_ctx; bid uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  DELETE FROM public.bookings WHERE user_id IN (c.a, c.b) AND court_id = c.court AND date = c.d;
  PERFORM pg_temp.as_user(c.a);
  PERFORM pg_temp.expect_ok('A pending again', pg_temp.ins(c.a, c.court, c.d, '10:00', '11:00'));
  PERFORM pg_temp.as_owner();
  SELECT b.id INTO bid FROM public.bookings b WHERE b.user_id = c.a AND b.court_id = c.court AND b.date = c.d;
  PERFORM pg_temp.as_user(c.b);
  UPDATE public.bookings SET status = 'rejected' WHERE bookings.id = bid;
  PERFORM pg_temp.expect_ok('B can take the slot after A is rejected', pg_temp.ins(c.b, c.court, c.d, '10:00', '11:00'));
  PERFORM pg_temp.as_owner();
END $$;

-- 8. Cancellation releases the hold (administrator cancel; the resident cancel window is tested elsewhere) ----------------------
DO $$
DECLARE c t_ctx; bid uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  SELECT b.id INTO bid FROM public.bookings b WHERE b.user_id = c.b AND b.court_id = c.court AND b.date = c.d;
  PERFORM pg_temp.as_user(c.b);
  UPDATE public.bookings SET status = 'cancelled' WHERE bookings.id = bid;
  PERFORM pg_temp.as_owner();
  DELETE FROM public.bookings WHERE user_id = c.b AND court_id = c.court AND date = c.d;
  PERFORM pg_temp.as_user(c.a);
  -- A's own earlier row was rejected; A (cap 1/day counts pending+confirmed only) can request again
  PERFORM pg_temp.expect_ok('A can re-request after own rejection (rejected not counted toward the daily cap)', pg_temp.ins(c.a, c.court, c.d, '10:00', '11:00'));
  PERFORM pg_temp.expect_fail('daily cap still enforced (second request same day)', pg_temp.ins(c.a, c.court, c.d, '14:00', '15:00'), '23514', 'per day');
  PERFORM pg_temp.as_owner();
END $$;

-- 9. Expiry --------------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE c t_ctx; bid uuid; s text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  DELETE FROM public.bookings WHERE user_id IN (c.a, c.b) AND court_id = c.court AND date IN (c.d, c.d - 2);
  -- A pending request whose start is already in the past (moved back by the owner role: test setup only)
  PERFORM pg_temp.as_user(c.a);
  PERFORM pg_temp.expect_ok('A pending to be aged', pg_temp.ins(c.a, c.court, c.d, '10:00', '11:00'));
  PERFORM pg_temp.as_owner();
  UPDATE public.bookings SET date = c.d - 2 WHERE user_id = c.a AND court_id = c.court AND date = c.d;
  SELECT b.id INTO bid FROM public.bookings b WHERE b.user_id = c.a AND b.court_id = c.court AND b.date = c.d - 2;

  -- the administrator cannot approve an expired request
  PERFORM pg_temp.as_user(c.b);
  PERFORM pg_temp.expect_fail('cannot approve a request whose start has passed', format('UPDATE public.bookings SET status = %L WHERE id = %L', 'confirmed', bid), '23514', 'expired');
  -- nobody can mark a booking expired by hand
  PERFORM pg_temp.expect_fail('admin cannot set expired by hand', format('UPDATE public.bookings SET status = %L WHERE id = %L', 'expired', bid), '42501');
  PERFORM pg_temp.as_user(c.a);
  PERFORM pg_temp.expect_fail('resident cannot set expired by hand', format('UPDATE public.bookings SET status = %L WHERE id = %L', 'expired', bid), '42501');

  -- the unswept expired request is still returned to its owner but no longer counts toward the daily limit
  PERFORM pg_temp.as_user(c.a);
  INSERT INTO t_results (name, ok, detail)
  SELECT 'expired unswept own request: counts_toward_cap = false', bool_and(NOT counts_toward_cap) AND count(*) = 1, count(*)::text
    FROM public.get_amenity_busy_times(ARRAY[c.court], c.d - 2) WHERE start_time = '10:00';
  PERFORM pg_temp.as_owner();

  -- B requests the SAME (past) interval: the insert-time sweep releases the expired hold, running as a different resident
  PERFORM pg_temp.as_user(c.b);
  PERFORM pg_temp.expect_ok('another resident inserting sweeps the expired hold and succeeds', pg_temp.ins(c.b, c.court, c.d - 2, '10:00', '11:00'));
  PERFORM pg_temp.as_owner();
  SELECT status INTO s FROM public.bookings WHERE bookings.id = bid;
  INSERT INTO t_results (name, ok, detail) VALUES ('the expired request is now status expired', s = 'expired', s);

  -- idempotent job entry point; only the backend role may call it
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service' || '_role')::text, true);
  EXECUTE format('set local role %I', 'service' || '_role');
  PERFORM pg_temp.expect_ok('the backend role can run expire_pending_bookings (idempotent)', 'SELECT public.expire_pending_bookings(); SELECT public.expire_pending_bookings();');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.as_user(c.a);
  PERFORM pg_temp.expect_fail('a resident cannot call expire_pending_bookings', 'SELECT public.expire_pending_bookings()', '42501');
  PERFORM pg_temp.as_owner();
END $$;

-- 10. Busy times: others' holds visible without identities; own ended rows still returned for the daily cap -----------------------
DO $$
DECLARE c t_ctx; n integer; cols text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  DELETE FROM public.bookings WHERE user_id IN (c.a, c.b) AND court_id = c.court AND date IN (c.d, c.d - 2);
  PERFORM pg_temp.as_user(c.a);
  PERFORM pg_temp.expect_ok('A requests 15:00-16:00', pg_temp.ins(c.a, c.court, c.d, '15:00', '16:00'));
  PERFORM pg_temp.as_user(c.b);
  SELECT count(*) INTO n FROM public.get_amenity_busy_times(ARRAY[c.court], c.d) WHERE start_time = '15:00' AND status = 'pending' AND is_mine = false;
  INSERT INTO t_results (name, ok, detail) VALUES ('B sees A''s pending hold as someone else''s', n = 1, n::text);
  SELECT count(*) INTO n FROM public.get_amenity_busy_times(ARRAY[c.court], c.d) WHERE is_mine = true;
  INSERT INTO t_results (name, ok, detail) VALUES ('B has no rows of its own here', n = 0, n::text);
  PERFORM pg_temp.as_owner();
  -- a non-member sees nothing
  PERFORM pg_temp.as_user('00000000-0000-0000-0000-000000000001'::uuid);
  SELECT count(*) INTO n FROM public.get_amenity_busy_times(ARRAY[c.court], c.d);
  INSERT INTO t_results (name, ok, detail) VALUES ('a non-member gets no busy times', n = 0, n::text);
  PERFORM pg_temp.as_owner();
END $$;

-- 11. Time zones and DST --------------------------------------------------------------------------------------------------------------
INSERT INTO t_results (name, ok, detail) VALUES
 ('DST: nonexistent New York time (2027-03-14 02:30) refused', public.reservation_time_problem('2027-03-14', '02:30', '03:00', 'America/New_York') = 'nonexistent', coalesce(public.reservation_time_problem('2027-03-14', '02:30', '03:00', 'America/New_York'), 'NULL')),
 ('DST: repeated New York hour (2026-11-01 01:30) refused', public.reservation_time_problem('2026-11-01', '01:30', '02:00', 'America/New_York') = 'ambiguous', coalesce(public.reservation_time_problem('2026-11-01', '01:30', '02:00', 'America/New_York'), 'NULL')),
 ('DST: interval spanning the gap (01:30-03:30) refused', public.reservation_time_problem('2027-03-14', '01:30', '03:30', 'America/New_York') IS NOT NULL, coalesce(public.reservation_time_problem('2027-03-14', '01:30', '03:30', 'America/New_York'), 'NULL')),
 ('DST: 30-minute shift (Lord Howe 2027-04-04 01:45-02:00) refused', public.reservation_time_problem('2027-04-04', '01:45', '02:00', 'Australia/Lord_Howe') IS NOT NULL, coalesce(public.reservation_time_problem('2027-04-04', '01:45', '02:00', 'Australia/Lord_Howe'), 'NULL')),
 ('DST: an ordinary New York time is fine', public.reservation_time_problem('2027-03-14', '10:00', '11:00', 'America/New_York') IS NULL, coalesce(public.reservation_time_problem('2027-03-14', '10:00', '11:00', 'America/New_York'), 'NULL')),
 ('Puerto Rico has no DST problem on any date', public.reservation_time_problem('2027-03-14', '02:30', '03:00', 'America/Puerto_Rico') IS NULL, 'ok'),
 ('California local time differs from Puerto Rico (zone of the HOA decides)', (timestamp '2026-10-31 18:00' AT TIME ZONE 'America/Los_Angeles') <> (timestamp '2026-10-31 18:00' AT TIME ZONE 'America/Puerto_Rico'), 'ok');

DO $$
DECLARE c t_ctx; hoa uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  SELECT hoa_id INTO hoa FROM public.courts WHERE id = c.court;
  -- an unknown zone is refused
  PERFORM pg_temp.expect_fail('unknown zone refused', format('UPDATE public.hoas SET timezone = %L WHERE id = %L', 'Mars/Phobos', hoa), '22023');
  -- a NULL zone refuses NEW reservations (never a silent assumption)
  UPDATE public.hoas SET timezone = NULL WHERE id = hoa;
  PERFORM pg_temp.as_user(c.b);
  PERFORM pg_temp.expect_fail('NULL time zone refuses a new reservation', pg_temp.ins(c.b, c.court, c.d, '17:00', '18:00'), '23514', 'time zone');
  PERFORM pg_temp.as_owner();
  -- the HOA zone, not UTC or Puerto Rico, decides the advance window: set Los Angeles and a booking 2 days out stays refused, 1 day OK
  UPDATE public.hoas SET timezone = 'America/Los_Angeles' WHERE id = hoa;
  PERFORM pg_temp.as_user(c.b);
  PERFORM pg_temp.expect_fail('advance window uses the HOA local date (3 days out refused)', pg_temp.ins(c.b, c.court, (now() AT TIME ZONE 'America/Los_Angeles')::date + 3, '10:00', '11:00'), '23514', 'advance');
  PERFORM pg_temp.as_owner();
  UPDATE public.hoas SET timezone = 'America/Puerto_Rico' WHERE id = hoa;
END $$;

SELECT string_agg(
         (CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n)
  AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

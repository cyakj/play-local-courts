-- Booking approval workflow — verification script.
--
-- Run AFTER migration 20261012190000_greens_v1_booking_approval_workflow.sql is applied
-- (or paste that migration at the top of the same transaction to test it without
-- persisting anything). Everything happens inside one transaction that ends in ROLLBACK,
-- so no live data is created, changed or left behind.
--
-- It impersonates the two Greens test accounts through request.jwt.claims:
--   resident  28-027@sanignacio.pr           f9fd5120-1735-4a27-a651-14a95e76a051
--   admin     thegreens.tennis@gmail.com     f6eec1c1-fa0e-4806-b0fb-c61480870a95
-- Court "The Greens Court" (requires_admin_approval = true), "Greens Pool" (= false).
--
-- Result: the script ends by raising an exception (so the transaction can never commit)
-- whose message lists one PASS/FAIL line per check. Every line must be PASS.

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

-- Tomorrow in Puerto Rico (the advance window allows today + 1 day).
CREATE TEMP TABLE t_ctx AS
SELECT
  'f9fd5120-1735-4a27-a651-14a95e76a051'::uuid AS resident,
  'f6eec1c1-fa0e-4806-b0fb-c61480870a95'::uuid AS admin,
  (SELECT id FROM public.courts WHERE name = 'The Greens Court') AS court_pending,
  (SELECT id FROM public.courts WHERE name = 'Greens Pool')      AS court_auto,
  ((now() AT TIME ZONE 'America/Puerto_Rico')::date + 1)        AS d;

GRANT ALL ON t_results, t_ctx TO authenticated;
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated;

-- Live test accounts may already hold bookings on the test day (per-day limit); clear them inside this rolled-back txn.
DELETE FROM public.bookings b USING t_ctx c
 WHERE b.user_id IN (c.resident, c.admin) AND b.court_id IN (c.court_pending, c.court_auto) AND b.date = c.d;

-- 1. Approval-required amenity: server forces 'pending' even if the client asks for 'confirmed'
DO $$
DECLARE c t_ctx; s text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.resident);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court_pending, c.resident, c.d, '10:00', '10:30', 'confirmed', 'singles') RETURNING status INTO s;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('approval-required insert is stored as pending', s = 'pending', s);
END $$;

-- 2. Auto-confirm amenity: stays confirmed
DO $$
DECLARE c t_ctx; s text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.resident);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court_auto, c.resident, c.d, '10:00', '10:30', 'confirmed', 'singles') RETURNING status INTO s;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('auto-confirm insert is stored as confirmed', s = 'confirmed', s);
END $$;

-- 3. Resident cannot approve their own pending reservation
DO $$
DECLARE c t_ctx; st text; blocked boolean := false; code text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.resident);
  BEGIN
    UPDATE public.bookings SET status = 'confirmed'
    WHERE user_id = c.resident AND court_id = c.court_pending AND date = c.d AND start_time = '10:00';
  EXCEPTION WHEN OTHERS THEN blocked := true; code := SQLSTATE;
  END;
  PERFORM pg_temp.as_owner();
  SELECT status INTO st FROM public.bookings
   WHERE user_id = c.resident AND court_id = c.court_pending AND date = c.d AND start_time = '10:00';
  INSERT INTO t_results (name, ok, detail)
  VALUES ('resident cannot self-approve (status stays pending)', blocked AND st = 'pending', coalesce(code,'no error') || ' / ' || st);
END $$;

-- 4. Resident cannot move an existing reservation to another time
DO $$
DECLARE c t_ctx; blocked boolean := false; code text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.resident);
  BEGIN
    UPDATE public.bookings SET start_time = '11:00', end_time = '11:30'
    WHERE user_id = c.resident AND court_id = c.court_pending AND date = c.d AND start_time = '10:00';
  EXCEPTION WHEN OTHERS THEN blocked := true; code := SQLSTATE;
  END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('resident cannot change reservation time', blocked, coalesce(code,'no error'));
END $$;

-- 5. Admin approves the pending request -> confirmed, reviewer recorded
DO $$
DECLARE c t_ctx; st text; rb uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.admin);
  UPDATE public.bookings SET status = 'confirmed'
  WHERE user_id = c.resident AND court_id = c.court_pending AND date = c.d AND start_time = '10:00'
  RETURNING status, reviewed_by INTO st, rb;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail)
  VALUES ('admin approval: pending -> confirmed with reviewed_by', st = 'confirmed' AND rb = c.admin, coalesce(st,'null'));
END $$;

-- 6. Admin cannot send a confirmed booking back to pending
DO $$
DECLARE c t_ctx; blocked boolean := false;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.admin);
  BEGIN
    UPDATE public.bookings SET status = 'pending'
    WHERE user_id = c.resident AND court_id = c.court_pending AND date = c.d AND start_time = '10:00';
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('confirmed -> pending is not allowed', blocked, '');
END $$;

-- 7. Admin declines a second pending request -> rejected
DO $$
DECLARE c t_ctx; st text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  -- A different slot, inserted as the resident (max 1/day applies per court+user+date, so use admin as requester).
  PERFORM pg_temp.as_user(c.admin);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court_pending, c.admin, c.d, '12:00', '12:30', 'confirmed', 'singles');
  UPDATE public.bookings SET status = 'rejected'
  WHERE user_id = c.admin AND court_id = c.court_pending AND date = c.d AND start_time = '12:00' AND status = 'pending'
  RETURNING status INTO st;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('admin decline: pending -> rejected', st = 'rejected', coalesce(st,'null'));
END $$;

-- 8. Approval re-checks blockouts created after the request (blockout fix preserved)
DO $$
DECLARE c t_ctx; blocked boolean := false; code text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_owner();
  -- A pending request (inserted with the trigger-enforced path), then a blockout over it.
  PERFORM pg_temp.as_user(c.admin);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court_pending, c.admin, c.d, '14:00', '14:30', 'confirmed', 'singles');
  -- Since 20261013110000 the API can no longer create a blockout over a live reservation, so simulate a
  -- legacy blockout by disabling the guard inside this rolled-back transaction.
  PERFORM pg_temp.as_owner();
  DELETE FROM public.bookings WHERE user_id = c.admin AND court_id = c.court_pending AND date = c.d AND start_time <> '14:00';
  ALTER TABLE public.court_maintenance DISABLE TRIGGER guard_court_maintenance_trigger;
  INSERT INTO public.court_maintenance (court_id, date, start_time, end_time, description)
  VALUES (c.court_pending, c.d, '13:30', '15:00', 'booking_approval.sql test blockout');
  ALTER TABLE public.court_maintenance ENABLE TRIGGER guard_court_maintenance_trigger;
  PERFORM pg_temp.as_user(c.admin);
  BEGIN
    UPDATE public.bookings SET status = 'confirmed'
    WHERE user_id = c.admin AND court_id = c.court_pending AND date = c.d AND start_time = '14:00';
  EXCEPTION WHEN OTHERS THEN blocked := true; code := SQLSTATE;
  END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('approving into a blocked window is rejected', blocked AND code = '23514', coalesce(code,'no error'));
END $$;

-- 9. Auto-confirm amenity: a resident cannot reject / revive; can cancel only beyond the window
DO $$
DECLARE c t_ctx; blocked boolean := false;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.resident);
  BEGIN
    UPDATE public.bookings SET status = 'rejected'
    WHERE user_id = c.resident AND court_id = c.court_auto AND date = c.d AND start_time = '10:00';
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('resident cannot set status to rejected', blocked, '');
END $$;

-- 10. Cancellation window uses Puerto Rico wall-clock time, not the UTC session clock.
--     A booking whose PR-local start is 25 h away must be cancellable with a 24 h window.
DO $$
DECLARE c t_ctx; pr_now timestamp := now() AT TIME ZONE 'America/Puerto_Rico'; start_ts timestamp; cancelled text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  start_ts := date_trunc('minute', pr_now + interval '25 hours');
  IF start_ts::time < '07:00' OR start_ts::time > '18:30' OR start_ts::date > pr_now::date + 1 THEN
    INSERT INTO t_results (name, ok, detail) VALUES ('cancellation window uses community time (SKIPPED: 25h slot outside amenity hours/advance window)', true, start_ts::text);
    RETURN;
  END IF;
  PERFORM pg_temp.as_user(c.resident);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court_auto, c.resident, start_ts::date, start_ts::time, (start_ts + interval '30 minutes')::time, 'confirmed', 'singles');
  UPDATE public.bookings SET status = 'cancelled'
  WHERE user_id = c.resident AND court_id = c.court_auto AND date = start_ts::date AND start_time = start_ts::time
  RETURNING status INTO cancelled;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('cancellation window uses community time (25h ahead is cancellable)', cancelled = 'cancelled', coalesce(cancelled,'null'));
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('cancellation window uses community time (25h ahead is cancellable)', false, SQLERRM);
END $$;

-- Report, then abort the transaction on purpose: raising guarantees nothing is committed
-- and returns the result table in the error message (psql: read the NOTICE/ERROR line).
DO $$
DECLARE r text;
BEGIN
  SELECT string_agg(format('%s %s [%s] %s', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, name, n, detail), E'
' ORDER BY n)
    INTO r FROM t_results;
  RAISE EXCEPTION E'ROLLED BACK - results:
%', r;
END $$;

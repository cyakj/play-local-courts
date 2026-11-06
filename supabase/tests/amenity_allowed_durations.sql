-- Allowed-duration enforcement. Run on a SCRATCH database with 20261106100000_amenity_allowed_durations.sql applied (and the
-- migrations before it). NEVER against hosted. UNRUN as of authoring: no scratch database was started in that session.
-- One transaction that always ends in an exception listing PASS/FAIL lines, so nothing commits.
-- Uses The Greens' first court and its owner-visible rules row; adjust the lookups if your restore differs.
BEGIN;
CREATE TEMP TABLE t_results (n serial, name text, ok boolean, detail text);
CREATE FUNCTION pg_temp.try_insert(c uuid, u uuid, st time, en time, pt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, play_type, status)
  VALUES (c, u, current_date + 1, st, en, pt, 'confirmed');
  RETURN 'inserted';
EXCEPTION WHEN check_violation THEN RETURN 'rejected: ' || SQLERRM;
END $$;

DO $$
DECLARE c uuid; u uuid; rid uuid; res text;
BEGIN
  SELECT id INTO c FROM public.courts WHERE court_type = 'pool' LIMIT 1;
  SELECT id INTO u FROM auth.users LIMIT 1;
  SELECT id INTO rid FROM public.amenity_rules WHERE amenity_id = c;
  UPDATE public.amenity_rules SET booking_start_time='00:00', booking_end_time='23:59', max_duration_minutes=120,
    max_reservations_per_day=NULL, requires_admin_approval=false, advance_booking_days=30, allowed_durations=NULL WHERE id = rid;

  res := pg_temp.try_insert(c, u, '10:00', '11:30', 'singles');
  INSERT INTO t_results(name, ok, detail) VALUES ('NULL list: legacy cap allows 90', res = 'inserted', res);
  DELETE FROM public.bookings WHERE court_id = c AND user_id = u AND date = current_date + 1;

  UPDATE public.amenity_rules SET allowed_durations = ARRAY[60] WHERE id = rid;
  res := pg_temp.try_insert(c, u, '10:00', '11:30', 'singles');
  INSERT INTO t_results(name, ok, detail) VALUES ('[60]: 90 rejected', res LIKE 'rejected%', res);
  res := pg_temp.try_insert(c, u, '10:00', '11:00', 'singles');
  INSERT INTO t_results(name, ok, detail) VALUES ('[60]: 60 accepted', res = 'inserted', res);
  DELETE FROM public.bookings WHERE court_id = c AND user_id = u AND date = current_date + 1;

  UPDATE public.amenity_rules SET allowed_durations = ARRAY[60, 90] WHERE id = rid;
  res := pg_temp.try_insert(c, u, '10:00', '11:30', 'singles');
  INSERT INTO t_results(name, ok, detail) VALUES ('[60,90]: 90 accepted', res = 'inserted', res);
  DELETE FROM public.bookings WHERE court_id = c AND user_id = u AND date = current_date + 1;

  res := pg_temp.try_insert(c, u, '10:00', '10:45', 'singles');
  INSERT INTO t_results(name, ok, detail) VALUES ('[60,90]: 45 rejected', res LIKE 'rejected%', res);

  BEGIN
    UPDATE public.amenity_rules SET allowed_durations = ARRAY[7] WHERE id = rid;
    INSERT INTO t_results(name, ok, detail) VALUES ('invalid list (7 min) rejected by CHECK', false, 'accepted');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO t_results(name, ok, detail) VALUES ('invalid list (7 min) rejected by CHECK', true, SQLERRM);
  END;
END $$;

DO $$
DECLARE s text;
BEGIN
  SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' :: ' || detail, E'\n' ORDER BY n) INTO s FROM t_results;
  RAISE EXCEPTION E'RESULTS (rolled back):\n%', s;
END $$;
ROLLBACK;

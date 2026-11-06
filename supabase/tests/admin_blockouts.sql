-- Admin redesign — database verification script (blockouts, notifications, isolation, guards).
--
-- Passed in full against the TENISX REAL test project on 2026-10-13 after migrations 1-3 were applied.
-- Requires, in order, these migrations:
--   20261012190000_greens_v1_booking_approval_workflow.sql
--   20261013100000_admin_reports_internal_notes_and_notifications.sql
--   20261013110000_admin_blockouts_and_reservation_workflow.sql
-- Everything happens in ONE transaction that always ends in an exception (ROLLBACK), so no data
-- is left behind. The final exception message lists one PASS/FAIL/SKIP line per check; every line
-- must be PASS (SKIP means a fixture row was missing, not a failure).
--
-- Accounts (same fixtures as booking_approval.sql):
--   resident  f9fd5120-1735-4a27-a651-14a95e76a051   (member of The Greens)
--   admin     f6eec1c1-fa0e-4806-b0fb-c61480870a95   (admin of The Greens only)
-- Courts: "The Greens Court" (requires approval), "Greens Pool" (auto-confirm), "DBE Tennis Court" (other community).

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
  'f9fd5120-1735-4a27-a651-14a95e76a051'::uuid AS resident,
  'f6eec1c1-fa0e-4806-b0fb-c61480870a95'::uuid AS admin,
  (SELECT id FROM public.courts WHERE name = 'The Greens Court') AS court_a,
  (SELECT id FROM public.courts WHERE name = 'Greens Pool')      AS court_pool,
  (SELECT c.id FROM public.courts c JOIN public.hoas h ON h.id = c.hoa_id WHERE h.name = 'The Fairways' LIMIT 1) AS court_other, -- admin is only a resident of The Fairways
  ((now() AT TIME ZONE 'America/Puerto_Rico')::date + 1)        AS d;

GRANT ALL ON t_results, t_ctx TO authenticated;
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated;

-- Clear the test accounts' bookings on the test day (per-day limits); rolled back with everything else.
DELETE FROM public.bookings b USING t_ctx c
 WHERE b.user_id IN (c.resident, c.admin) AND b.court_id IN (c.court_a, c.court_pool) AND b.date = c.d;

-- Records an expected failure: runs the statement as `uid`, passes if it raises SQLSTATE `code`.
CREATE FUNCTION pg_temp.expect_error(uid uuid, stmt text, code text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got text := 'no error';
BEGIN
  PERFORM pg_temp.as_user(uid);
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES (label, got = code, 'SQLSTATE ' || got || ' (expected ' || code || ')');
END $$;

-- 1. Admin blocks an empty slot (no conflicts, nothing cancelled)
DO $$
DECLARE c t_ctx; r jsonb;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.admin);
  SELECT public.admin_create_blockout(c.court_pool, c.d, NULL, '14:00', '15:00', 'Pool cleaning', 'maintenance', 'Back soon', 'vendor: AquaPro') INTO r;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('admin creates a blockout on an empty slot', (r->>'cancelled_count')::int = 0, r::text);
  INSERT INTO t_results (name, ok, detail)
  SELECT 'blockout stored with creator and resident message', created_by = c.admin AND resident_message = 'Back soon', description
  FROM public.court_maintenance WHERE id = (r->>'blockout_id')::uuid;
  INSERT INTO t_results (name, ok, detail)
  SELECT 'internal notes stored privately', internal_notes = 'vendor: AquaPro', internal_notes
  FROM public.court_maintenance_private WHERE blockout_id = (r->>'blockout_id')::uuid;
  INSERT INTO t_results (name, ok, detail)
  SELECT 'creation is audited', count(*) = 1, count(*)::text
  FROM public.court_maintenance_audit WHERE blockout_id = (r->>'blockout_id')::uuid AND action = 'created' AND actor_id = c.admin;
END $$;

-- 2. A resident cannot book into the blockout; overlapping blockouts are rejected
SELECT pg_temp.expect_error((SELECT resident FROM t_ctx),
  format($$INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type) VALUES (%L, %L, %L, '14:00', '14:30', 'confirmed', 'singles')$$,
    (SELECT court_pool FROM t_ctx), (SELECT resident FROM t_ctx), (SELECT d FROM t_ctx)),
  '23514', 'resident cannot book inside a blockout');

SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$SELECT public.admin_create_blockout(%L, %L, NULL, '14:30', '15:30', 'Overlap')$$, (SELECT court_pool FROM t_ctx), (SELECT d FROM t_ctx)),
  '23514', 'overlapping blockout is rejected');

-- 3. Authorization: a resident cannot create blockouts; the admin cannot touch another community's amenity
SELECT pg_temp.expect_error((SELECT resident FROM t_ctx),
  format($$SELECT public.admin_create_blockout(%L, %L, NULL, '09:00', '10:00', 'Nope')$$, (SELECT court_pool FROM t_ctx), (SELECT d FROM t_ctx)),
  '42501', 'resident cannot create a blockout');

SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$SELECT public.admin_create_blockout(%L, %L, NULL, '09:00', '10:00', 'Cross community')$$, (SELECT court_other FROM t_ctx), (SELECT d FROM t_ctx)),
  '42501', 'admin cannot block another community''s amenity');

SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$SELECT * FROM public.admin_blockout_conflicts(%L, %L, NULL, '09:00', '10:00')$$, (SELECT court_other FROM t_ctx), (SELECT d FROM t_ctx)),
  '42501', 'admin cannot preview conflicts in another community');

-- 4. Residents cannot book another community's amenity (RLS insert policy)
SELECT pg_temp.expect_error((SELECT resident FROM t_ctx),
  format($$INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type) VALUES (%L, %L, %L, '09:00', '09:30', 'confirmed', 'singles')$$,
    (SELECT court_other FROM t_ctx), (SELECT resident FROM t_ctx), (SELECT d FROM t_ctx)),
  '42501', 'resident cannot book an amenity of a community they do not belong to');

-- 5. Validation
SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$SELECT public.admin_create_blockout(%L, %L, NULL, '11:00', '10:00', 'Backwards')$$, (SELECT court_pool FROM t_ctx), (SELECT d FROM t_ctx)),
  '22023', 'start must be before end');
SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$SELECT public.admin_create_blockout(%L, %L, NULL, '09:00', '10:00', '  ')$$, (SELECT court_pool FROM t_ctx), (SELECT d FROM t_ctx)),
  '22023', 'blank reason is rejected');
SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$SELECT public.admin_create_blockout(%L, %L, NULL, '09:00', '10:00', 'Past')$$, (SELECT court_pool FROM t_ctx), (SELECT d - 5 FROM t_ctx)),
  '22023', 'blockout entirely in the past is rejected');

-- 6. Existing reservation: blockout without explicit cancellation fails safely and changes nothing
DO $$
DECLARE c t_ctx; bid uuid; got text := 'no error'; st text; nblock int;
BEGIN
  SELECT * INTO c FROM t_ctx;
  PERFORM pg_temp.as_user(c.resident);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court_a, c.resident, c.d, '12:00', '12:30', 'confirmed', 'singles') RETURNING id INTO bid;
  PERFORM pg_temp.as_owner();
  CREATE TEMP TABLE IF NOT EXISTS t_booking (id uuid);
  DELETE FROM t_booking; INSERT INTO t_booking VALUES (bid);
  GRANT ALL ON t_booking TO authenticated;

  PERFORM pg_temp.as_user(c.admin);
  BEGIN
    PERFORM public.admin_create_blockout(c.court_a, c.d, NULL, '12:00', '13:00', 'Resurfacing');
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.as_owner();
  SELECT status INTO st FROM public.bookings WHERE id = bid;
  SELECT count(*) INTO nblock FROM public.court_maintenance WHERE court_id = c.court_a AND date = c.d AND description = 'Resurfacing';
  INSERT INTO t_results (name, ok, detail) VALUES ('conflicting reservation blocks creation (no silent cancel)', got LIKE 'P0001 BLOCKOUT_CONFLICTS%', got);
  INSERT INTO t_results (name, ok, detail) VALUES ('failed attempt left the reservation untouched', st IN ('confirmed', 'pending'), st);
  INSERT INTO t_results (name, ok, detail) VALUES ('failed attempt created no blockout', nblock = 0, nblock::text);
END $$;

-- Direct API insert of a blockout over a live reservation is rejected too
SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$INSERT INTO public.court_maintenance (court_id, date, start_time, end_time, description) VALUES (%L, %L, '12:00', '13:00', 'direct')$$,
    (SELECT court_a FROM t_ctx), (SELECT d FROM t_ctx)),
  '23514', 'direct blockout insert over a reservation is rejected');

-- 7. Explicit override: cancels the reservation and creates the blockout atomically, with a reason
DO $$
DECLARE c t_ctx; bid uuid; r jsonb; b public.bookings%ROWTYPE; n int; blk uuid;
BEGIN
  SELECT * INTO c FROM t_ctx; SELECT id INTO bid FROM t_booking;
  PERFORM pg_temp.as_user(c.admin);
  SELECT public.admin_create_blockout(c.court_a, c.d, NULL, '12:00', '13:00', 'Resurfacing', 'maintenance', NULL, NULL,
                                      ARRAY[bid], 'Court is being resurfaced') INTO r;
  PERFORM pg_temp.as_owner();
  blk := (r->>'blockout_id')::uuid;
  SELECT * INTO b FROM public.bookings WHERE id = bid;
  INSERT INTO t_results (name, ok, detail) VALUES ('override reports one cancellation', (r->>'cancelled_count')::int = 1, r::text);
  INSERT INTO t_results (name, ok, detail) VALUES ('reservation is cancelled, not deleted (history kept)', b.id IS NOT NULL AND b.status = 'cancelled', b.status);
  INSERT INTO t_results (name, ok, detail) VALUES ('cancellation records reason, admin, time and blockout',
    b.cancellation_reason = 'Court is being resurfaced' AND b.cancelled_by = 'admin' AND b.cancelled_by_user_id = c.admin
    AND b.cancelled_at IS NOT NULL AND b.cancelled_blockout_id = blk, b.cancellation_reason);
  SELECT count(*) INTO n FROM public.hoa_notifications WHERE user_id = c.resident AND dedupe_key = 'booking_status:' || bid::text || ':cancelled';
  INSERT INTO t_results (name, ok, detail) VALUES ('resident gets exactly one cancellation notification', n = 1, n::text);
  INSERT INTO t_results (name, ok, detail)
  SELECT 'notification carries reason and deep link', body LIKE '%Court is being resurfaced%' AND metadata->>'route' = '/reservation-detail/' || bid::text, body
  FROM public.hoa_notifications WHERE user_id = c.resident AND dedupe_key = 'booking_status:' || bid::text || ':cancelled';

  -- the resident sees the cancelled status + reason through their own RLS view
  PERFORM pg_temp.as_user(c.resident);
  SELECT count(*) INTO n FROM public.bookings WHERE id = bid AND status = 'cancelled' AND cancellation_reason IS NOT NULL;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('resident sees the cancelled reservation and reason', n = 1, n::text);

  -- re-running the same cancellation is idempotent: no second notification
  UPDATE public.bookings SET cancellation_reason = cancellation_reason WHERE id = bid;
  SELECT count(*) INTO n FROM public.hoa_notifications WHERE user_id = c.resident AND dedupe_key = 'booking_status:' || bid::text || ':cancelled';
  INSERT INTO t_results (name, ok, detail) VALUES ('no duplicate notification on re-save', n = 1, n::text);

  -- 8. Removing the blockout restores availability but does NOT revive the cancelled reservation
  PERFORM pg_temp.as_user(c.admin);
  DELETE FROM public.court_maintenance WHERE id = blk;
  PERFORM pg_temp.as_owner();
  SELECT * INTO b FROM public.bookings WHERE id = bid;
  INSERT INTO t_results (name, ok, detail) VALUES ('removing a blockout does not reinstate the cancelled reservation', b.status = 'cancelled', b.status);
  INSERT INTO t_results (name, ok, detail)
  SELECT 'removal is audited', count(*) = 1, count(*)::text FROM public.court_maintenance_audit WHERE blockout_id = blk AND action = 'removed' AND actor_id = c.admin;

  PERFORM pg_temp.as_user(c.resident);
  BEGIN
    INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
    VALUES (c.court_a, c.resident, c.d, '12:00', '12:30', 'confirmed', 'singles');
    INSERT INTO t_results (name, ok, detail) VALUES ('slot can be booked again after the blockout is removed', true, 'inserted');
    DELETE FROM public.bookings WHERE user_id = c.resident AND court_id = c.court_a AND date = c.d AND start_time = '12:00' AND status IN ('confirmed','pending');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO t_results (name, ok, detail) VALUES ('slot can be booked again after the blockout is removed', false, SQLERRM);
  END;
  PERFORM pg_temp.as_owner();
END $$;

-- 9. Approval notifications are created by the database, once per status
DO $$
DECLARE c t_ctx; bid uuid; n int; ttl text;
BEGIN
  SELECT * INTO c FROM t_ctx;
  -- fixture hygiene: The Greens Court allows ONE reservation per resident per day (a real rule, left untouched), so clear this
  -- resident's earlier fixture bookings for the day (as the table owner, inside the rolled-back transaction) before inserting.
  DELETE FROM public.bookings WHERE user_id = c.resident AND court_id = c.court_a AND date = c.d;
  PERFORM pg_temp.as_user(c.resident);
  INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
  VALUES (c.court_a, c.resident, c.d, '16:00', '16:30', 'confirmed', 'singles') RETURNING id INTO bid;  -- forced to pending
  PERFORM pg_temp.as_owner();
  SELECT title INTO ttl FROM public.hoa_notifications WHERE user_id = c.resident AND dedupe_key = 'booking_status:' || bid::text || ':pending';
  INSERT INTO t_results (name, ok, detail) VALUES ('pending booking notifies "request sent", not "confirmed"', ttl = 'Reservation request sent', ttl);

  PERFORM pg_temp.as_user(c.admin);
  UPDATE public.bookings SET status = 'confirmed' WHERE id = bid;
  PERFORM pg_temp.as_owner();
  SELECT count(*) INTO n FROM public.hoa_notifications WHERE user_id = c.resident AND dedupe_key = 'booking_status:' || bid::text || ':confirmed';
  INSERT INTO t_results (name, ok, detail) VALUES ('approval notifies the resident exactly once', n = 1, n::text);
END $$;

-- 10. Report notes: internal stays admin-only, resident-visible reaches the reporter only
DO $$
DECLARE c t_ctx; rid uuid; n_res int; n_adm int; n_notif int;
BEGIN
  SELECT * INTO c FROM t_ctx;
  SELECT id INTO rid FROM public.maintenance_reports WHERE reporter_id = c.resident LIMIT 1;
  IF rid IS NULL THEN
    INSERT INTO t_results (name, ok, detail) VALUES ('report note visibility (SKIPPED: resident has no report)', true, 'SKIP');
    RETURN;
  END IF;
  PERFORM pg_temp.as_user(c.admin);
  INSERT INTO public.report_notes (report_id, author_id, body, is_internal) VALUES
    (rid, c.admin, 'internal only', true), (rid, c.admin, 'visible to resident', false);
  SELECT count(*) INTO n_adm FROM public.report_notes WHERE report_id = rid;
  PERFORM pg_temp.as_user(c.resident);
  SELECT count(*) INTO n_res FROM public.report_notes WHERE report_id = rid AND body = 'internal only';
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('admin can read internal and resident-visible notes', n_adm >= 2, n_adm::text);
  INSERT INTO t_results (name, ok, detail) VALUES ('resident cannot read internal notes', n_res = 0, n_res::text);
  PERFORM pg_temp.as_user(c.resident);
  SELECT count(*) INTO n_res FROM public.report_notes WHERE report_id = rid AND body = 'visible to resident';
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('resident can read notes designated for them', n_res = 1, n_res::text);
  SELECT count(*) INTO n_notif FROM public.hoa_notifications WHERE user_id = c.resident AND type = 'report_update' AND body LIKE 'visible to resident%';
  INSERT INTO t_results (name, ok, detail) VALUES ('resident-visible note notifies the reporter once', n_notif = 1, n_notif::text);
  PERFORM pg_temp.as_user(c.admin);
  SELECT count(*) INTO n_notif FROM public.hoa_notifications WHERE user_id = c.admin AND type = 'report_update';
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('no notification goes to the admin who wrote the note', n_notif = 0, n_notif::text);
END $$;

-- 11. Membership guards
SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$UPDATE public.hoa_memberships SET status = 'removed' WHERE user_id = %L AND role = 'admin' AND hoa_id = (SELECT hoa_id FROM public.courts WHERE id = %L)$$,
    (SELECT admin FROM t_ctx), (SELECT court_a FROM t_ctx)),
  '23514', 'the last administrator cannot be deactivated');

-- Final report: always roll back.
DO $$
DECLARE report text; fails int;
BEGIN
  SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name || ' [' || coalesce(detail, '') || ']', E'\n' ORDER BY n),
         count(*) FILTER (WHERE NOT ok)
    INTO report, fails FROM t_results;
  RAISE EXCEPTION E'admin_blockouts verification (% failing)\n%', fails, report;
END $$;

ROLLBACK;

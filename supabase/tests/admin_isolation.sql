-- Administrator authorization + cross-HOA isolation against the REAL policies/functions (membership approval, maintenance reports,
-- blockouts, messaging, cross-community booking). Run ONLY on a SCRATCH database (restore of a backup) with the pending migrations
-- applied. Never against hosted. Always ends in ROLLBACK.
-- Actors: A = f9fd5120-... resident of The Greens; B = f6eec1c1-... administrator of The Greens and DBE (resident of The Fairways);
-- C = 7b0ff73f-... administrator of The Fairways only.
BEGIN;

CREATE TEMP TABLE t_results (n serial, name text, ok boolean, detail text);
SELECT 'service' || '_role' AS svc \gset
GRANT ALL ON t_results TO authenticated, :"svc";
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated, :"svc";
CREATE TEMP TABLE t_ctx (k text PRIMARY KEY, v uuid);
GRANT ALL ON t_ctx TO authenticated, :"svc";

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
  dbe constant uuid := 'f222b3de-2e6b-4f5e-999b-a7fcdd9750ae';
  mem uuid; mem2 uuid; rep uuid; rep2 uuid; court uuid; n int; st text; ok boolean; err text;
BEGIN
  SELECT id INTO court FROM public.courts WHERE hoa_id = greens LIMIT 1;
  -- A is not yet a member of DBE
  DELETE FROM public.hoa_memberships WHERE user_id = a AND hoa_id = dbe;

  ------------------------------------------------------------------ membership approval
  PERFORM pg_temp.as_user(a);
  PERFORM public.request_hoa_membership(dbe, 'T please let me in');
  PERFORM pg_temp.as_owner();
  SELECT id, status INTO mem, st FROM public.hoa_memberships WHERE user_id = a AND hoa_id = dbe;
  PERFORM pg_temp.rec('a join request creates a PENDING membership (no access yet)', st = 'pending', coalesce(st, 'none'));
  PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.hoas WHERE id = dbe;
  PERFORM pg_temp.rec('a pending applicant cannot read the community row', n = 0, 'rows=' || n);

  BEGIN PERFORM public.approve_hoa_membership(mem); PERFORM pg_temp.rec('applicant cannot approve themself (RPC)', false, 'approved');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.rec('applicant cannot approve themself (RPC)', true, 'refused'); END;
  UPDATE public.hoa_memberships SET status = 'approved' WHERE id = mem;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('applicant cannot approve themself (direct UPDATE)', n = 0, 'rows=' || n);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  BEGIN PERFORM public.approve_hoa_membership(mem); PERFORM pg_temp.rec('cross-HOA: another community administrator cannot approve (RPC)', false, 'approved');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.rec('cross-HOA: another community administrator cannot approve (RPC)', true, 'refused'); END;
  BEGIN PERFORM public.reject_hoa_membership(mem); PERFORM pg_temp.rec('cross-HOA: another community administrator cannot reject (RPC)', false, 'rejected');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.rec('cross-HOA: another community administrator cannot reject (RPC)', true, 'refused'); END;
  SELECT count(*) INTO n FROM public.community_join_requests WHERE user_id = a AND hoa_id = dbe;
  PERFORM pg_temp.rec('cross-HOA: another community administrator cannot see the join request', n = 0, 'rows=' || n);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  SELECT count(*) INTO n FROM public.community_join_requests WHERE user_id = a AND hoa_id = dbe AND status = 'pending';
  PERFORM pg_temp.rec('the community administrator sees the pending request', n = 1, 'rows=' || n);
  PERFORM public.approve_hoa_membership(mem);
  PERFORM pg_temp.as_owner();
  SELECT status INTO st FROM public.hoa_memberships WHERE id = mem;
  PERFORM pg_temp.rec('administrator approval -> membership approved', st = 'approved', st);
  SELECT status INTO st FROM public.community_join_requests WHERE user_id = a AND hoa_id = dbe;
  PERFORM pg_temp.rec('administrator approval keeps the join request in step', st = 'approved', coalesce(st, 'none'));
  PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.hoas WHERE id = dbe;
  PERFORM pg_temp.rec('after approval the resident can read the community', n = 1, 'rows=' || n);

  -- removal ends access
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  INSERT INTO public.hoa_events (hoa_id, created_by, title, event_type, starts_at) VALUES (dbe, b, 'T-dbe event', 'community_event', now() + interval '2 days');
  UPDATE public.hoa_memberships SET status = 'removed' WHERE id = mem;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('administrator can remove a member', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.hoa_events WHERE title = 'T-dbe event';
  PERFORM pg_temp.rec('a removed member no longer sees community events', n = 0, 'rows=' || n);

  -- rejection
  PERFORM pg_temp.as_owner();
  DELETE FROM public.hoa_memberships WHERE user_id = c AND hoa_id = greens;
  PERFORM pg_temp.as_user(c);
  PERFORM public.request_hoa_membership(greens, 'T hello');
  PERFORM pg_temp.as_owner();
  SELECT id INTO mem2 FROM public.hoa_memberships WHERE user_id = c AND hoa_id = greens;
  PERFORM pg_temp.as_user(b);
  PERFORM public.reject_hoa_membership(mem2);
  PERFORM pg_temp.as_owner();
  SELECT status INTO st FROM public.hoa_memberships WHERE id = mem2;
  PERFORM pg_temp.rec('administrator rejection -> membership rejected', st = 'rejected', coalesce(st, 'none'));
  PERFORM pg_temp.as_user(c);
  SELECT count(*) INTO n FROM public.court_maintenance WHERE court_id = court;
  PERFORM pg_temp.rec('a rejected applicant reads nothing of the community', n = 0, 'rows=' || n);

  ------------------------------------------------------------------ cross-community booking
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  BEGIN
    INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
    VALUES (court, c, current_date + 1, '10:00', '11:00', 'confirmed', 'singles');
    PERFORM pg_temp.rec('cross-HOA: a non-member cannot book another community amenity', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.rec('cross-HOA: a non-member cannot book another community amenity', true, 'refused'); END;

  ------------------------------------------------------------------ maintenance reports
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  rep := public.create_maintenance_report(greens, 'plumbing', 'T-leaking tap', NULL, 'amenity', court, NULL, 'open');
  INSERT INTO t_ctx VALUES ('rep', rep);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  rep2 := public.create_maintenance_report(greens, 'electrical', 'T-admin own report', NULL, 'amenity', court, NULL, 'open');
  INSERT INTO public.report_notes (report_id, author_id, body, is_internal) VALUES (rep, b, 'T-internal only', true), (rep, b, 'T-visible to reporter', false);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM public.maintenance_reports WHERE id = rep;
  PERFORM pg_temp.rec('reporter sees their own report', n = 1, 'rows=' || n);
  SELECT count(*) INTO n FROM public.maintenance_reports WHERE id = rep2;
  PERFORM pg_temp.rec('private reports: a resident cannot see another person''s report', n = 0, 'rows=' || n);
  SELECT count(*) INTO n FROM public.report_notes WHERE body = 'T-internal only';
  PERFORM pg_temp.rec('internal administrator notes are invisible to the reporter', n = 0, 'rows=' || n);
  SELECT count(*) INTO n FROM public.report_notes WHERE body = 'T-visible to reporter';
  PERFORM pg_temp.rec('resident-visible notes are readable by the reporter', n = 1, 'rows=' || n);
  UPDATE public.maintenance_reports SET status = 'resolved' WHERE id = rep;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('a resident cannot change a report status', n = 0, 'rows=' || n);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  SELECT count(*) INTO n FROM public.maintenance_reports WHERE id IN (rep, rep2);
  PERFORM pg_temp.rec('the community administrator sees all reports of the community', n = 2, 'rows=' || n);
  UPDATE public.maintenance_reports SET status = 'in_progress' WHERE id = rep;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('the community administrator can change a report status', n = 1, 'rows=' || n);

  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  SELECT count(*) INTO n FROM public.maintenance_reports WHERE id IN (rep, rep2);
  PERFORM pg_temp.rec('cross-HOA: another community administrator sees none of the reports', n = 0, 'rows=' || n);
  UPDATE public.maintenance_reports SET status = 'resolved' WHERE id = rep;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.rec('cross-HOA: another community administrator cannot change them', n = 0, 'rows=' || n);
  SELECT count(*) INTO n FROM public.report_notes WHERE report_id = rep;
  PERFORM pg_temp.rec('cross-HOA: another community administrator reads none of the notes', n = 0, 'rows=' || n);

  ------------------------------------------------------------------ blockouts / closures
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  BEGIN
    INSERT INTO public.court_maintenance (court_id, date, start_time, end_time, description) VALUES (court, current_date + 3, '08:00', '12:00', 'T-resident block');
    PERFORM pg_temp.rec('a resident cannot create a closure', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.rec('a resident cannot create a closure', true, 'refused'); END;
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  BEGIN
    INSERT INTO public.court_maintenance (court_id, date, start_time, end_time, description) VALUES (court, current_date + 3, '08:00', '12:00', 'T-cross block');
    PERFORM pg_temp.rec('cross-HOA: another community administrator cannot create a closure', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.rec('cross-HOA: another community administrator cannot create a closure', true, 'refused'); END;
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(b);
  INSERT INTO public.court_maintenance (court_id, date, start_time, end_time, description) VALUES (court, current_date + 3, '08:00', '12:00', 'T-admin block');
  PERFORM pg_temp.rec('the community administrator can create a closure', true, '');
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  UPDATE public.hoa_memberships SET status = 'approved' WHERE user_id = a AND hoa_id = greens;  -- no-op for a resident (own row, already approved)
  SELECT count(*) INTO n FROM public.court_maintenance WHERE description = 'T-admin block';
  PERFORM pg_temp.rec('residents of the community can see the closure (so the Schedule can show it)', n = 1, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(c);
  SELECT count(*) INTO n FROM public.court_maintenance WHERE description = 'T-admin block';
  PERFORM pg_temp.rec('cross-HOA: another community cannot see the closure', n = 0, 'rows=' || n);
  PERFORM pg_temp.as_owner(); PERFORM pg_temp.as_user(a);
  BEGIN
    INSERT INTO public.bookings (court_id, user_id, date, start_time, end_time, status, play_type)
    VALUES (court, a, current_date + 3, '09:00', '10:00', 'confirmed', 'singles');
    PERFORM pg_temp.rec('closure-to-booking: a booking inside the closure is refused', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.rec('closure-to-booking: a booking inside the closure is refused', err ~* 'blocked|maintenance|unavailable', left(err, 90));
  END;

  ------------------------------------------------------------------ messaging
  PERFORM pg_temp.as_owner();
  UPDATE public.hoa_memberships SET status = 'approved' WHERE user_id = a AND hoa_id = greens;
  PERFORM pg_temp.rec('resident -> own community administrator is allowed', public.can_send_message(a, b), '');
  PERFORM pg_temp.rec('administrator -> own community resident is allowed', public.can_send_message(b, a), '');
  PERFORM pg_temp.rec('cross-HOA: resident -> another community administrator is refused', NOT public.can_send_message(a, c), '');
  PERFORM pg_temp.rec('cross-HOA: another community administrator -> resident is refused', NOT public.can_send_message(c, a), '');
  PERFORM pg_temp.rec('a user cannot message themself', NOT public.can_send_message(a, a), '');
END $$;

SELECT string_agg((CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name || ' [' || detail || ']', E'\n' ORDER BY n) AS report FROM t_results \gset
\echo :report
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results \gset
\echo failures=:failures total=:total

ROLLBACK;

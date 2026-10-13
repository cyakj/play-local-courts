-- Verification for 20261013120000_platform_approval_and_secure_messaging.sql
--
-- Everything runs in ONE transaction that always ends in an exception (ROLLBACK). To DRY-RUN before the
-- migration is applied, paste the migration file contents immediately after the BEGIN below.
-- The final exception message lists PASS/FAIL/SKIP per check; every line must be PASS (SKIP = missing fixture).
--
-- Fixtures (live TENISX REAL test accounts):
--   resident   f9fd5120-1735-4a27-a651-14a95e76a051  (resident of The Greens)
--   hoa admin  f6eec1c1-fa0e-4806-b0fb-c61480870a95  (admin of The Greens and DBE)
--   reviewer   fbcf0c78-17e0-4d71-a476-42848bf005b6  (platform_reviewer)
--   applicant  b33c8142-b237-41e0-9935-cbd36eec5168  (plain resident account, used as the applying HOA rep)

BEGIN;

CREATE TEMP TABLE t_results (n serial, name text, ok boolean, detail text);
GRANT ALL ON t_results TO authenticated;
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated;

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

-- Runs `stmt` as `uid`; passes when it raises SQLSTATE `code` (or, with code 'ANY', any error).
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
  INSERT INTO t_results (name, ok, detail)
  VALUES (label, CASE WHEN code = 'ANY' THEN got <> 'no error' ELSE got = code END, 'SQLSTATE ' || got || ' (expected ' || code || ')');
END $$;

CREATE TEMP TABLE t_ctx AS SELECT
  'f9fd5120-1735-4a27-a651-14a95e76a051'::uuid AS resident,
  'f6eec1c1-fa0e-4806-b0fb-c61480870a95'::uuid AS admin,
  'fbcf0c78-17e0-4d71-a476-42848bf005b6'::uuid AS reviewer,
  'b33c8142-b237-41e0-9935-cbd36eec5168'::uuid AS applicant,
  (SELECT id FROM public.hoas WHERE name = 'The Greens') AS greens;
GRANT ALL ON t_ctx TO authenticated;

-- ===== PART A =====

INSERT INTO t_results (name, ok, detail)
SELECT 'all pre-existing communities were backfilled as approved', count(*) FILTER (WHERE approval_status <> 'approved') = 0, count(*)::text || ' communities'
FROM public.hoas;

SELECT pg_temp.expect_error((SELECT resident FROM t_ctx),
  format($$INSERT INTO public.hoas (name, admin_id) VALUES ('Sneaky HOA', %L)$$, (SELECT resident FROM t_ctx)),
  '42501', 'resident cannot create a community directly');

SELECT pg_temp.expect_error((SELECT resident FROM t_ctx),
  $$SELECT public.create_community('Sneaky HOA 2')$$, '42501', 'create_community() RPC is no longer callable by users');

SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$INSERT INTO public.user_roles (user_id, role) VALUES (%L, 'platform_reviewer')$$, (SELECT admin FROM t_ctx)),
  '42501', 'an HOA admin cannot make themselves a platform reviewer');

SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$INSERT INTO public.user_roles (user_id, role) VALUES (%L, 'admin')$$, (SELECT resident FROM t_ctx)),
  '42501', 'an HOA admin cannot insert roles for others');

SELECT pg_temp.expect_error((SELECT admin FROM t_ctx),
  format($$SELECT public.grant_admin_role(%L)$$, (SELECT resident FROM t_ctx)),
  '42501', 'an HOA admin cannot call grant_admin_role');

SELECT pg_temp.expect_error((SELECT reviewer FROM t_ctx),
  format($$INSERT INTO public.user_roles (user_id, role) VALUES (%L, 'platform_reviewer')$$, (SELECT resident FROM t_ctx)),
  '42501', 'even a platform reviewer cannot mint platform reviewers through the API');

-- Application lifecycle
DO $$
DECLARE c t_ctx; app uuid; app2 uuid; app3 uuid; hid uuid; n int; st text; got text; rows int;
BEGIN
  SELECT * INTO c FROM t_ctx;

  PERFORM pg_temp.as_user(c.applicant);
  INSERT INTO public.hoa_applications (applicant_id, hoa_name, community_location, estimated_residents, claimed_role)
  VALUES (c.applicant, 'Test Palms HOA', 'San Juan, PR', 120, 'board_member') RETURNING id INTO app;
  INSERT INTO public.hoa_applications (applicant_id, hoa_name, community_location, estimated_residents, claimed_role)
  VALUES (c.applicant, 'Test Reject HOA', 'Ponce, PR', 40, 'property_manager') RETURNING id INTO app2;
  INSERT INTO public.hoa_applications (applicant_id, hoa_name, community_location, estimated_residents, claimed_role)
  VALUES (c.applicant, 'Test Info HOA', 'Mayaguez, PR', 60, 'property_manager') RETURNING id INTO app3;
  PERFORM pg_temp.as_owner();
  SELECT count(*) INTO n FROM public.hoas WHERE name LIKE 'Test % HOA';
  INSERT INTO t_results (name, ok, detail) VALUES ('submitting an application creates no community', n = 0, n::text);

  -- applicant cannot self-approve
  PERFORM pg_temp.as_user(c.applicant);
  UPDATE public.hoa_applications SET status = 'approved' WHERE id = app;
  GET DIAGNOSTICS rows = ROW_COUNT;
  PERFORM pg_temp.as_owner();
  SELECT status INTO st FROM public.hoa_applications WHERE id = app;
  INSERT INTO t_results (name, ok, detail) VALUES ('applicant cannot approve their own application', rows = 0 AND st = 'pending', rows::text || ' rows / ' || st);

  -- RPC authorization
  got := 'no error'; PERFORM pg_temp.as_user(c.applicant);
  BEGIN PERFORM public.approve_hoa_application(app, 'self'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('applicant cannot call approve_hoa_application', got = '42501', got);

  got := 'no error'; PERFORM pg_temp.as_user(c.admin);
  BEGIN PERFORM public.approve_hoa_application(app, 'hoa admin'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('an HOA admin cannot approve a new community', got = '42501', got);

  -- reviewer visibility, return for info, reject
  PERFORM pg_temp.as_user(c.reviewer);
  SELECT count(*) INTO n FROM public.hoa_applications WHERE id IN (app, app2, app3);
  PERFORM public.update_hoa_application_status(app3, 'needs_more_info', 'Please upload the board resolution');
  PERFORM public.update_hoa_application_status(app2, 'rejected', 'Cannot verify the association');
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('reviewer sees all submitted applications', n = 3, n::text);

  PERFORM pg_temp.as_user(c.applicant);
  SELECT count(*) INTO n FROM public.application_notifications WHERE user_id = c.applicant AND application_id IN (app2, app3);
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('applicant is notified of rejection and info request', n = 2, n::text);

  -- applicant resubmits the one that needs info (-> pending)
  PERFORM pg_temp.as_user(c.applicant);
  UPDATE public.hoa_applications SET status = 'pending' WHERE id = app3;
  GET DIAGNOSTICS rows = ROW_COUNT;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('applicant can resubmit after a request for information', rows = 1, rows::text);

  -- approval
  PERFORM pg_temp.as_user(c.reviewer);
  hid := public.approve_hoa_application(app, 'Verified documents');
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail)
  SELECT 'approval activates the community', approval_status = 'approved' AND source_application_id = app AND approved_by = c.reviewer, approval_status FROM public.hoas WHERE id = hid;
  INSERT INTO t_results (name, ok, detail)
  SELECT 'approval gives the applicant an approved admin membership', count(*) = 1, count(*)::text FROM public.hoa_memberships WHERE hoa_id = hid AND user_id = c.applicant AND role = 'admin' AND status = 'approved';
  INSERT INTO t_results (name, ok, detail)
  SELECT 'application row is closed and linked', status = 'approved' AND created_hoa_id = hid AND reviewed_by = c.reviewer, status FROM public.hoa_applications WHERE id = app;

  got := 'no error'; PERFORM pg_temp.as_user(c.reviewer);
  BEGIN PERFORM public.approve_hoa_application(app, 'again'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE || ' ' || SQLERRM; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('approving twice is refused', got <> 'no error', got);

  got := 'no error'; PERFORM pg_temp.as_user(c.reviewer);
  BEGIN PERFORM public.approve_hoa_application(app2, 'reconsider'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE || ' ' || SQLERRM; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('a rejected application cannot be approved without resubmission', got <> 'no error', got);

  -- the new admin can administer it; a resident of another community cannot join a suspended/pending one
  PERFORM pg_temp.as_user(c.applicant);
  SELECT count(*) INTO n FROM public.hoas WHERE id = hid;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('the approved community is visible to its new admin', n = 1, n::text);

  UPDATE public.hoas SET approval_status = 'pending' WHERE id = hid;
  got := 'no error'; PERFORM pg_temp.as_user(c.resident);
  BEGIN INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status) VALUES (c.resident, hid, 'resident', 'pending'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('residents cannot join a community that is not approved', got = '42501', got);
  UPDATE public.hoas SET approval_status = 'approved' WHERE id = hid;
  got := 'no error'; PERFORM pg_temp.as_user(c.resident);
  BEGIN INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status) VALUES (c.resident, hid, 'resident', 'pending'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('control: residents can request to join an approved community', got = 'no error', got);
END $$;

-- ===== PART B =====

DO $$
DECLARE
  c t_ctx;
  coach uuid := '010b0152-f3f2-4213-a08a-1dca6f19f96e';
  t2 uuid;
  mid uuid; mid2 uuid; n int; got text; rows int; txt text;
  coach_free boolean; lesson_link boolean;
BEGIN
  SELECT * INTO c FROM t_ctx;

  -- 1/2. resident <-> HOA admin, both directions
  got := 'no error'; PERFORM pg_temp.as_user(c.resident);
  BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (c.resident, c.admin, 'pw test: resident to HOA') RETURNING id INTO mid;
  EXCEPTION WHEN OTHERS THEN got := SQLSTATE || ' ' || SQLERRM; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('resident can message their HOA admin', got = 'no error', got);

  got := 'no error'; PERFORM pg_temp.as_user(c.admin);
  BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (c.admin, c.resident, 'pw test: HOA reply') RETURNING id INTO mid2;
  EXCEPTION WHEN OTHERS THEN got := SQLSTATE || ' ' || SQLERRM; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('HOA admin can message a resident of their community', got = 'no error', got);

  -- 3. cannot impersonate
  got := 'no error'; PERFORM pg_temp.as_user(c.resident);
  BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (c.admin, c.resident, 'forged'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('a user cannot send a message as someone else', got = '42501', got);

  -- 4. outsider (no community) <-> community member
  SELECT NOT EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = coach AND status = 'approved') INTO coach_free;
  SELECT EXISTS (SELECT 1 FROM public.lesson_requests lr WHERE (lr.player_id = c.resident AND lr.coach_id = coach) OR (lr.player_id = coach AND lr.coach_id = c.resident)) INTO lesson_link;
  IF coach_free AND NOT lesson_link AND NOT EXISTS (SELECT 1 FROM public.messages WHERE sender_id = coach AND receiver_id = c.resident) THEN
    got := 'no error'; PERFORM pg_temp.as_user(coach);
    BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (coach, c.resident, 'cold outreach'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
    PERFORM pg_temp.as_owner();
    INSERT INTO t_results (name, ok, detail) VALUES ('an outsider cannot cold-message a community member', got = '42501', got);
    got := 'no error'; PERFORM pg_temp.as_user(c.resident);
    BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (c.resident, coach, 'to outsider'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
    PERFORM pg_temp.as_owner();
    INSERT INTO t_results (name, ok, detail) VALUES ('a community member cannot cold-message an outsider', got = '42501', got);
    -- legacy/earlier thread: replies keep working
    INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (coach, c.resident, 'earlier thread');
    got := 'no error'; PERFORM pg_temp.as_user(c.resident);
    BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (c.resident, coach, 'reply'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
    PERFORM pg_temp.as_owner();
    INSERT INTO t_results (name, ok, detail) VALUES ('replying inside an existing thread is allowed', got = 'no error', got);
  ELSE
    INSERT INTO t_results (name, ok, detail) VALUES ('outsider checks (SKIPPED: fixture has a membership, lesson link or prior thread)', true, 'SKIP');
  END IF;

  -- 5. resident <-> resident inside a community is not a V1 workflow
  PERFORM pg_temp.as_owner();
  INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status) VALUES (c.applicant, c.greens, 'resident', 'approved')
  ON CONFLICT DO NOTHING;
  got := 'no error'; PERFORM pg_temp.as_user(c.resident);
  BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (c.resident, c.applicant, 'neighbour chat'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('residents cannot start private chats with each other via the community', got = '42501', got);
  got := 'no error'; PERFORM pg_temp.as_user(c.applicant);
  BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (c.applicant, c.admin, 'second resident to HOA'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('every resident can message the HOA admin', got = 'no error', got);

  -- 6. privacy: a member who is not a participant sees nothing
  PERFORM pg_temp.as_user(c.applicant);
  SELECT count(*) INTO n FROM public.messages WHERE id IN (mid, mid2);
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('another resident cannot read a private conversation', n = 0, n::text);

  -- 7. immutability and read receipts
  PERFORM pg_temp.as_user(c.resident);
  got := 'no error';
  BEGIN UPDATE public.messages SET content = 'edited' WHERE id = mid; EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('sender cannot edit a sent message', got = '42501', got);

  PERFORM pg_temp.as_user(c.resident);
  got := 'no error';
  BEGIN UPDATE public.messages SET read_at = now() WHERE id = mid; EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('sender cannot mark their own message as read', got = '42501', got);

  PERFORM pg_temp.as_user(c.admin);
  got := 'no error';
  BEGIN UPDATE public.messages SET content = 'rewritten by recipient' WHERE id = mid; EXCEPTION WHEN OTHERS THEN got := SQLSTATE; END;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('recipient cannot rewrite message content', got = '42501', got);

  PERFORM pg_temp.as_user(c.admin);
  UPDATE public.messages SET read_at = now() WHERE id = mid;
  GET DIAGNOSTICS rows = ROW_COUNT;
  PERFORM pg_temp.as_owner();
  SELECT content INTO txt FROM public.messages WHERE id = mid;
  INSERT INTO t_results (name, ok, detail) VALUES ('recipient can mark a message read (content untouched)', rows = 1 AND txt = 'pw test: resident to HOA', rows::text);

  -- 8. history preserved
  PERFORM pg_temp.as_user(c.resident);
  DELETE FROM public.messages WHERE id = mid;
  GET DIAGNOSTICS rows = ROW_COUNT;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('participants cannot delete message history', rows = 0 AND EXISTS (SELECT 1 FROM public.messages WHERE id = mid), rows::text);

  -- 9. tennis marketplace: two users with no community can still talk
  SELECT p.id INTO t2 FROM public.profiles p
  WHERE p.id <> coach AND NOT EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = p.id AND m.status = 'approved')
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id) LIMIT 1;
  IF coach_free AND t2 IS NOT NULL THEN
    got := 'no error'; PERFORM pg_temp.as_user(coach);
    BEGIN INSERT INTO public.messages (sender_id, receiver_id, content) VALUES (coach, t2, 'tennis hello'); EXCEPTION WHEN OTHERS THEN got := SQLSTATE || ' ' || SQLERRM; END;
    PERFORM pg_temp.as_owner();
    INSERT INTO t_results (name, ok, detail) VALUES ('players outside any community can still message each other (tennis product)', got = 'no error', got);
  ELSE
    INSERT INTO t_results (name, ok, detail) VALUES ('tennis marketplace check (SKIPPED: no second community-free user)', true, 'SKIP');
  END IF;

  -- 10. contact directory
  PERFORM pg_temp.as_user(c.resident);
  SELECT count(*) INTO n FROM public.my_message_contacts() WHERE NOT contact_is_admin OR hoa_id <> c.greens;
  SELECT count(*) INTO rows FROM public.my_message_contacts() WHERE user_id = c.admin;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('resident contact list contains only admins of their own community', n = 0 AND rows = 1, n::text || ' extra / ' || rows::text || ' admin');

  PERFORM pg_temp.as_user(c.admin);
  SELECT count(*) INTO n FROM public.my_message_contacts() WHERE user_id = c.resident AND hoa_id = c.greens;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('HOA admin contact list includes residents of their community', n = 1, n::text);

  PERFORM pg_temp.as_user(c.applicant);
  SELECT count(*) INTO n FROM public.my_message_contacts() WHERE hoa_id <> c.greens;
  PERFORM pg_temp.as_owner();
  INSERT INTO t_results (name, ok, detail) VALUES ('contact list never leaks another community', n = 0, n::text);
END $$;

DO $$
DECLARE report text; fails int;
BEGIN
  SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name || ' [' || coalesce(detail, '') || ']', E'\n' ORDER BY n),
         count(*) FILTER (WHERE NOT ok)
    INTO report, fails FROM t_results;
  RAISE EXCEPTION E'platform_approval_and_messaging verification (% failing)\n%', fails, report;
END $$;

ROLLBACK;

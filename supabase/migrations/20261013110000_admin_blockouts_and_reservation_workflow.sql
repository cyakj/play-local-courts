-- Admin redesign — Milestone C: atomic blockouts, reservation notifications, isolation fixes.
--
-- NOT APPLIED to the live project. Review, then apply with the Supabase MCP `apply_migration`
-- (never `db push`). Apply AFTER, in order:
--   20261012190000_greens_v1_booking_approval_workflow.sql   (adds 'rejected', reviewed_*, status-transition trigger)
--   20261013100000_admin_reports_internal_notes_and_notifications.sql (adds hoa_notifications.dedupe_key)
-- Verification SQL: supabase/tests/admin_blockouts.sql
--
-- Problems found in the live schema (read-only inspection):
--   1. "Users can create their own bookings" only checks auth.uid() = user_id. A resident of one
--      community could book a court in another by sending its court_id. (Cross-community isolation.)
--   2. notify_booker_on_booking inserts "Booking confirmed" even when the booking is pending approval,
--      and nothing notifies the resident when an admin approves, rejects or cancels.
--   3. A blockout can be created over existing reservations, and the client-side BlockoutSheet cancelled
--      reservations one by one before inserting the blockout — a failure midway left reservations
--      cancelled with no blockout. A resident booking racing a blockout was not serialised.
--   4. court_maintenance is readable by every resident of the community, so internal notes cannot live
--      on it; and there was no record of who created/removed a blockout.
--   5. hoa_memberships UPDATE/DELETE policies let any admin demote or remove any other admin, including
--      the last one.
-- Nothing here deletes or rewrites existing rows.

-- 0. Notification types (superset; also set by 20261013100000) ------------------------------------
ALTER TABLE public.hoa_notifications DROP CONSTRAINT IF EXISTS hoa_notifications_type_check;
ALTER TABLE public.hoa_notifications
  ADD CONSTRAINT hoa_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'report_submitted', 'report_status_changed', 'report_unresolved', 'report_update',
    'member_application', 'member_approved', 'member_rejected',
    'booking_pending', 'booking_confirmed', 'booking_cancelled', 'booking_rejected', 'booking_reminder',
    'health_score_alert', 'announcement', 'survey_published', 'survey_reminder',
    'event_created', 'event_reminder', 'invite_reminder'
  ]::text[]));

-- 1. Residents may only book amenities of communities they are approved members of ------------------
DROP POLICY IF EXISTS "Users can create their own bookings" ON public.bookings;
CREATE POLICY "Users can create their own bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.courts c
      JOIN public.hoa_memberships m ON m.hoa_id = c.hoa_id
      WHERE c.id = bookings.court_id
        AND m.user_id = auth.uid()
        AND m.status = 'approved'
    )
  );

-- 2. Columns ---------------------------------------------------------------------------------------
ALTER TABLE public.court_maintenance
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS resident_message text;   -- resident-facing explanation (the table is resident-readable)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS cancelled_blockout_id uuid;  -- no FK: the audit trail must survive blockout removal

-- 3. Admin-only blockout notes -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.court_maintenance_private (
  blockout_id    uuid PRIMARY KEY REFERENCES public.court_maintenance(id) ON DELETE CASCADE,
  internal_notes text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.court_maintenance_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HOA admins manage blockout private notes" ON public.court_maintenance_private;
CREATE POLICY "HOA admins manage blockout private notes" ON public.court_maintenance_private
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.court_maintenance cm JOIN public.courts c ON c.id = cm.court_id
    WHERE cm.id = court_maintenance_private.blockout_id AND public.check_hoa_admin(auth.uid(), c.hoa_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.court_maintenance cm JOIN public.courts c ON c.id = cm.court_id
    WHERE cm.id = court_maintenance_private.blockout_id AND public.check_hoa_admin(auth.uid(), c.hoa_id)));

-- 4. Blockout audit trail ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.court_maintenance_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blockout_id uuid NOT NULL,
  court_id    uuid NOT NULL,
  hoa_id      uuid,
  action      text NOT NULL CHECK (action IN ('created', 'updated', 'removed')),
  actor_id    uuid,
  snapshot    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS court_maintenance_audit_blockout_idx ON public.court_maintenance_audit (blockout_id, created_at DESC);
ALTER TABLE public.court_maintenance_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HOA admins read blockout audit" ON public.court_maintenance_audit;
CREATE POLICY "HOA admins read blockout audit" ON public.court_maintenance_audit
  FOR SELECT TO authenticated USING (hoa_id IS NOT NULL AND public.check_hoa_admin(auth.uid(), hoa_id));

CREATE OR REPLACE FUNCTION public.log_court_maintenance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec public.court_maintenance%ROWTYPE;
  v_hoa uuid;
BEGIN
  rec := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT hoa_id INTO v_hoa FROM public.courts WHERE id = rec.court_id;
  INSERT INTO public.court_maintenance_audit (blockout_id, court_id, hoa_id, action, actor_id, snapshot)
  VALUES (
    rec.id, rec.court_id, v_hoa,
    CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'removed' END,
    auth.uid(), to_jsonb(rec)
  );
  RETURN rec;
END;
$function$;

DROP TRIGGER IF EXISTS court_maintenance_audit_trigger ON public.court_maintenance;
CREATE TRIGGER court_maintenance_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.court_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.log_court_maintenance_change();

-- 5. Guard: a blockout may never overlap another blockout or a live reservation --------------------
-- Direct inserts/updates (API, legacy client) can no longer create a blockout over reservations; the
-- only way to do that is admin_create_blockout(), which cancels them first in the same transaction.
CREATE OR REPLACE FUNCTION public.guard_court_maintenance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_end date := COALESCE(NEW.end_date, NEW.date);
BEGIN
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Blockout start time must be before its end time' USING ERRCODE = '22023';
  END IF;
  IF v_end < NEW.date THEN
    RAISE EXCEPTION 'Blockout end date must not be before its start date' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.court_id = OLD.court_id AND NEW.date = OLD.date
     AND COALESCE(NEW.end_date, NEW.date) = COALESCE(OLD.end_date, OLD.date)
     AND NEW.start_time = OLD.start_time AND NEW.end_time = OLD.end_time THEN
    RETURN NEW;  -- descriptive edit only
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.court_maintenance cm
    WHERE cm.court_id = NEW.court_id AND cm.id <> NEW.id
      AND cm.date <= v_end AND COALESCE(cm.end_date, cm.date) >= NEW.date
      AND cm.start_time < NEW.end_time AND cm.end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'This blockout overlaps an existing blockout' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.court_id = NEW.court_id AND b.status IN ('confirmed', 'pending')
      AND b.date BETWEEN NEW.date AND v_end
      AND b.start_time < NEW.end_time AND b.end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'Reservations exist in this time range. Use admin_create_blockout to cancel them explicitly.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_court_maintenance_trigger ON public.court_maintenance;
CREATE TRIGGER guard_court_maintenance_trigger
  BEFORE INSERT OR UPDATE ON public.court_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.guard_court_maintenance_change();

-- 6. Serialise bookings against blockouts (court row lock) ------------------------------------------
-- Identical to the live enforce_amenity_booking_rules plus one statement: a booking that moves/inserts
-- takes a FOR SHARE lock on its court row; admin_create_blockout takes FOR UPDATE. Whichever commits
-- second re-reads the other's committed rows, so a booking can never slip into a fresh blockout.
CREATE OR REPLACE FUNCTION public.enforce_amenity_booking_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.amenity_rules%ROWTYPE;
  is_tennis boolean;
  duration_cap integer;
  existing_count integer;
  moving boolean;
BEGIN
  moving := (TG_OP = 'INSERT')
    OR (NEW.court_id IS DISTINCT FROM OLD.court_id)
    OR (NEW.date IS DISTINCT FROM OLD.date)
    OR (NEW.start_time IS DISTINCT FROM OLD.start_time)
    OR (NEW.end_time IS DISTINCT FROM OLD.end_time);

  IF NOT moving THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.courts WHERE id = NEW.court_id FOR SHARE;

  IF NEW.status IN ('confirmed', 'pending') AND EXISTS (
    SELECT 1 FROM public.court_maintenance cm
    WHERE cm.court_id = NEW.court_id
      AND NEW.date BETWEEN cm.date AND COALESCE(cm.end_date, cm.date)
      AND NEW.start_time < cm.end_time
      AND NEW.end_time > cm.start_time
  ) THEN
    RAISE EXCEPTION 'This time is unavailable because the amenity is blocked for maintenance'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO r FROM public.amenity_rules WHERE amenity_id = NEW.court_id LIMIT 1;

    IF r.id IS NOT NULL THEN
      IF r.advance_booking_days IS NOT NULL
         AND NEW.date > (current_date + (r.advance_booking_days || ' days')::interval)::date THEN
        RAISE EXCEPTION 'Booking date is beyond the % day advance booking window for this amenity', r.advance_booking_days
          USING ERRCODE = '23514';
      END IF;

      IF r.booking_start_time IS NOT NULL AND NEW.start_time < r.booking_start_time THEN
        RAISE EXCEPTION 'Booking start time is before this amenity''s opening time (%)', r.booking_start_time
          USING ERRCODE = '23514';
      END IF;
      IF r.booking_end_time IS NOT NULL AND NEW.end_time > r.booking_end_time THEN
        RAISE EXCEPTION 'Booking end time is after this amenity''s closing time (%)', r.booking_end_time
          USING ERRCODE = '23514';
      END IF;

      SELECT (court_type = 'tennis') INTO is_tennis FROM public.courts WHERE id = NEW.court_id;
      IF is_tennis THEN
        duration_cap := CASE WHEN NEW.play_type = 'doubles'
          THEN COALESCE(r.doubles_duration_minutes, 90)
          ELSE COALESCE(r.singles_duration_minutes, 60)
        END;
      ELSE
        duration_cap := COALESCE(r.max_duration_minutes, 60);
      END IF;
      IF EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60 > duration_cap THEN
        RAISE EXCEPTION 'Booking duration exceeds the % minute maximum for this amenity', duration_cap
          USING ERRCODE = '23514';
      END IF;

      IF r.max_reservations_per_day IS NOT NULL THEN
        SELECT count(*) INTO existing_count
        FROM public.bookings
        WHERE court_id = NEW.court_id
          AND user_id = NEW.user_id
          AND date = NEW.date
          AND status IN ('confirmed', 'pending');
        IF existing_count >= r.max_reservations_per_day THEN
          RAISE EXCEPTION 'You have reached the % reservation(s) per day limit for this amenity', r.max_reservations_per_day
            USING ERRCODE = '23514';
        END IF;
      END IF;

      IF r.requires_admin_approval THEN
        NEW.status := 'pending';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. Reservation notifications: one durable, deduplicated, deep-linked record per status ------------
CREATE OR REPLACE FUNCTION public.notify_booker_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  amenity_name text;
  amenity_hoa_id uuid;
  when_txt text;
BEGIN
  SELECT name, hoa_id INTO amenity_name, amenity_hoa_id FROM public.courts WHERE id = NEW.court_id;
  when_txt := to_char(NEW.date, 'FMMon FMDD') || ' at ' || to_char(NEW.start_time, 'FMHH12:MI AM');

  IF NEW.status = 'pending' THEN
    INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata, dedupe_key)
    VALUES (
      NEW.user_id, amenity_hoa_id, 'booking_pending', 'Reservation request sent',
      COALESCE(amenity_name, 'Amenity') || ' on ' || when_txt || ' is awaiting administrator approval.',
      jsonb_build_object('booking_id', NEW.id, 'court_id', NEW.court_id, 'route', '/reservation-detail/' || NEW.id::text),
      'booking_status:' || NEW.id::text || ':pending'
    ) ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  ELSIF NEW.status = 'confirmed' THEN
    INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata, dedupe_key)
    VALUES (
      NEW.user_id, amenity_hoa_id, 'booking_confirmed', 'Booking confirmed',
      COALESCE(amenity_name, 'Amenity') || ' booked for ' || NEW.date || ' at ' || NEW.start_time,
      jsonb_build_object('booking_id', NEW.id, 'court_id', NEW.court_id, 'route', '/reservation-detail/' || NEW.id::text),
      'booking_status:' || NEW.id::text || ':confirmed'
    ) ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_booker_on_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  amenity_name text;
  amenity_hoa_id uuid;
  when_txt text;
  v_type text;
  v_title text;
  v_body text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name, hoa_id INTO amenity_name, amenity_hoa_id FROM public.courts WHERE id = NEW.court_id;
  when_txt := to_char(NEW.date, 'FMMon FMDD') || ' at ' || to_char(NEW.start_time, 'FMHH12:MI AM');

  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    v_type := 'booking_confirmed';
    v_title := 'Reservation approved';
    v_body := COALESCE(amenity_name, 'Amenity') || ' on ' || when_txt || ' has been approved.';
  ELSIF NEW.status = 'rejected' THEN
    v_type := 'booking_rejected';
    v_title := 'Reservation request declined';
    v_body := COALESCE(amenity_name, 'Amenity') || ' on ' || when_txt || ' was not approved.'
              || COALESCE(' Reason: ' || NULLIF(btrim(NEW.cancellation_reason), ''), '');
  ELSIF NEW.status = 'cancelled' AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    v_type := 'booking_cancelled';
    v_title := CASE WHEN NEW.cancelled_blockout_id IS NOT NULL
                    THEN 'Reservation cancelled: amenity unavailable'
                    ELSE 'Reservation cancelled by an administrator' END;
    v_body := COALESCE(amenity_name, 'Amenity') || ' on ' || when_txt || ' was cancelled.'
              || COALESCE(' Reason: ' || NULLIF(btrim(NEW.cancellation_reason), ''), '');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata, dedupe_key)
  VALUES (
    NEW.user_id, amenity_hoa_id, v_type, v_title, v_body,
    jsonb_build_object('booking_id', NEW.id, 'court_id', NEW.court_id,
                       'blockout_id', NEW.cancelled_blockout_id,
                       'route', '/reservation-detail/' || NEW.id::text),
    'booking_status:' || NEW.id::text || ':' || NEW.status
  ) ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_booking_status ON public.bookings;
CREATE TRIGGER trg_notify_booking_status
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booker_on_booking_status();

-- 8. Conflict preview (read-only) --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_blockout_conflicts(
  p_court_id uuid, p_date date, p_end_date date, p_start_time time, p_end_time time
)
RETURNS TABLE (
  booking_id uuid, resident_id uuid, resident_name text,
  booking_date date, slot_start time, slot_end time, booking_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoa uuid;
BEGIN
  SELECT c.hoa_id INTO v_hoa FROM public.courts c WHERE c.id = p_court_id;
  IF auth.uid() IS NULL OR v_hoa IS NULL OR NOT public.check_hoa_admin(auth.uid(), v_hoa) THEN
    RAISE EXCEPTION 'Not authorized for this amenity' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT b.id, b.user_id, COALESCE(NULLIF(btrim(p.full_name), ''), 'Resident'),
         b.date, b.start_time, b.end_time, b.status
  FROM public.bookings b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.court_id = p_court_id
    AND b.status IN ('confirmed', 'pending')
    AND b.date BETWEEN p_date AND COALESCE(p_end_date, p_date)
    AND b.start_time < p_end_time
    AND b.end_time > p_start_time
  ORDER BY b.date, b.start_time;
END;
$function$;

-- 9. Atomic blockout creation (+ optional explicit cancellation of conflicting reservations) ---------
-- Times are community wall-clock values (the app stores bookings/blockouts as date + time with no zone;
-- every community today is America/Puerto_Rico, which has no DST). "Today" is evaluated in that zone.
CREATE OR REPLACE FUNCTION public.admin_create_blockout(
  p_court_id            uuid,
  p_date                date,
  p_end_date            date,
  p_start_time          time,
  p_end_time            time,
  p_reason              text,
  p_blockout_type       text DEFAULT 'maintenance',
  p_resident_message    text DEFAULT NULL,
  p_internal_notes      text DEFAULT NULL,
  p_cancel_booking_ids  uuid[] DEFAULT '{}',
  p_cancellation_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoa uuid;
  v_end date := COALESCE(p_end_date, p_date);
  v_today date := (now() AT TIME ZONE 'America/Puerto_Rico')::date;
  v_new uuid := gen_random_uuid();
  v_conflicts uuid[];
  v_cancelled integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  -- Serialise with concurrent bookings on this amenity (bookings take FOR SHARE on the same row).
  SELECT c.hoa_id INTO v_hoa FROM public.courts c WHERE c.id = p_court_id FOR UPDATE;
  IF v_hoa IS NULL OR NOT public.check_hoa_admin(auth.uid(), v_hoa) THEN
    RAISE EXCEPTION 'Not authorized for this amenity' USING ERRCODE = '42501';
  END IF;

  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Start time must be before end time' USING ERRCODE = '22023';
  END IF;
  IF v_end < p_date THEN
    RAISE EXCEPTION 'End date must not be before start date' USING ERRCODE = '22023';
  END IF;
  IF v_end < v_today THEN
    RAISE EXCEPTION 'A blockout cannot be created entirely in the past' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.court_maintenance cm
    WHERE cm.court_id = p_court_id
      AND cm.date <= v_end AND COALESCE(cm.end_date, cm.date) >= p_date
      AND cm.start_time < p_end_time AND cm.end_time > p_start_time
  ) THEN
    RAISE EXCEPTION 'This blockout overlaps an existing blockout' USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(b.id ORDER BY b.date, b.start_time) INTO v_conflicts
  FROM public.bookings b
  WHERE b.court_id = p_court_id AND b.status IN ('confirmed', 'pending')
    AND b.date BETWEEN p_date AND v_end
    AND b.start_time < p_end_time AND b.end_time > p_start_time;

  IF v_conflicts IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM unnest(v_conflicts) AS c(id) WHERE c.id <> ALL (COALESCE(p_cancel_booking_ids, '{}'))) THEN
      RAISE EXCEPTION 'BLOCKOUT_CONFLICTS: % reservation(s) overlap this blockout and were not confirmed for cancellation',
        array_length(v_conflicts, 1)
        USING ERRCODE = 'P0001', DETAIL = to_json(v_conflicts)::text;
    END IF;
    IF p_cancellation_reason IS NULL OR btrim(p_cancellation_reason) = '' THEN
      RAISE EXCEPTION 'A cancellation reason is required when reservations are cancelled' USING ERRCODE = '22023';
    END IF;

    -- Cancel first (keeping history), then insert the blockout; same transaction, so all-or-nothing.
    UPDATE public.bookings
    SET status = 'cancelled',
        cancellation_reason = btrim(p_cancellation_reason),
        cancelled_by = 'admin',
        cancelled_at = now(),
        cancelled_by_user_id = auth.uid(),
        cancelled_blockout_id = v_new
    WHERE id = ANY (v_conflicts) AND status IN ('confirmed', 'pending');
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  END IF;

  INSERT INTO public.court_maintenance
    (id, court_id, date, end_date, start_time, end_time, description, blockout_type, resident_message, created_by)
  VALUES (
    v_new, p_court_id, p_date, CASE WHEN v_end = p_date THEN NULL ELSE v_end END,
    p_start_time, p_end_time, btrim(p_reason), COALESCE(NULLIF(btrim(p_blockout_type), ''), 'maintenance'),
    NULLIF(btrim(COALESCE(p_resident_message, '')), ''), auth.uid()
  );

  IF p_internal_notes IS NOT NULL AND btrim(p_internal_notes) <> '' THEN
    INSERT INTO public.court_maintenance_private (blockout_id, internal_notes) VALUES (v_new, btrim(p_internal_notes));
  END IF;

  RETURN jsonb_build_object('blockout_id', v_new, 'cancelled_count', v_cancelled);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_blockout_conflicts(uuid, date, date, time, time) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_blockout(uuid, date, date, time, time, text, text, text, text, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_blockout_conflicts(uuid, date, date, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_blockout(uuid, date, date, time, time, text, text, text, text, uuid[], text) TO authenticated;

-- 10. Membership guard: protect the last administrator and the admin hierarchy ---------------------
CREATE OR REPLACE FUNCTION public.guard_membership_admin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN            -- service role / migrations
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.hoas h WHERE h.id = OLD.hoa_id AND h.admin_id = auth.uid())
    INTO caller_is_owner;

  IF OLD.role = 'admin' AND OLD.status = 'approved'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NEW.status <> 'approved') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.hoa_memberships m
      WHERE m.hoa_id = OLD.hoa_id AND m.id <> OLD.id AND m.role = 'admin' AND m.status = 'approved'
    ) THEN
      RAISE EXCEPTION 'The last administrator of a community cannot be removed or demoted'
        USING ERRCODE = '23514';
    END IF;
    IF OLD.user_id <> auth.uid() AND NOT caller_is_owner THEN
      RAISE EXCEPTION 'Only the community owner can remove or demote another administrator'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role = 'admin' AND OLD.role <> 'admin' AND NOT caller_is_owner THEN
    RAISE EXCEPTION 'Only the community owner can grant the administrator role'
      USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS guard_membership_admin_changes_trigger ON public.hoa_memberships;
CREATE TRIGGER guard_membership_admin_changes_trigger
  BEFORE UPDATE OR DELETE ON public.hoa_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_membership_admin_changes();

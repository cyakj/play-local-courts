-- ROLLBACK for 20261031100000_hoa_timezones.sql
-- NOT a migration (kept outside supabase/migrations on purpose). Apply with the Supabase MCP only if the forward migration
-- must be undone. Function bodies below are the ones captured from the 2026-10-29 restore (the state before the forward migration).
-- Restores the Puerto Rico hard-coded behaviour. The additive column hoas.timezone and its validation trigger are LEFT IN PLACE
-- (harmless; dropping them would lose the configured zones). Roll back 20261031110000 FIRST: it depends on the helper functions.

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

CREATE OR REPLACE FUNCTION public.enforce_booking_cancellation_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  min_hours integer;
  booking_hoa_id uuid;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND auth.uid() = OLD.user_id THEN
    SELECT hoa_id INTO booking_hoa_id FROM public.courts WHERE id = OLD.court_id;

    IF booking_hoa_id IS NOT NULL AND check_hoa_admin(auth.uid(), booking_hoa_id) THEN
      RETURN NEW;
    END IF;

    SELECT min_cancellation_hours INTO min_hours
    FROM public.amenity_rules WHERE amenity_id = OLD.court_id;

    IF min_hours IS NOT NULL
       AND (OLD.date + OLD.start_time)
           < ((now() AT TIME ZONE 'America/Puerto_Rico') + (min_hours || ' hours')::interval) THEN
      RAISE EXCEPTION 'This reservation can no longer be cancelled -- it starts within the % hour cancellation window', min_hours
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- admin_create_blockout: original body
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

DROP FUNCTION IF EXISTS public.set_hoa_timezone(uuid, text);
DROP FUNCTION IF EXISTS public.hoa_local_date_for_court(uuid);
DROP FUNCTION IF EXISTS public.hoa_local_now_for_court(uuid, boolean);
DROP FUNCTION IF EXISTS public.hoa_timezone_for_court(uuid, boolean);
DROP FUNCTION IF EXISTS public.reservation_time_problem(date, time, time, text);

-- Per-HOA time zones (additive). NOT APPLIED to hosted (TENISX REAL). Stage E of docs/MIGRATION-PLAN-2026-10-31.md.
--
-- Product rule (final): every reservation is in the local time zone of the HOA where the amenity is physically located. The
-- resident's device zone and travel never change it. `bookings.date/start_time/end_time` stay zone-less local wall-clock values
-- (no stored instant is changed); the HOA zone says how to turn "now" into that same wall clock.
--
-- Before this migration the database hard-coded America/Puerto_Rico in the cancellation-window trigger and the blockout
-- "today" check, and used the UTC `current_date` for the advance-booking window (wrong for ~4 hours every evening).
--
-- Backfill is by EVIDENCE only: an address that names Puerto Rico / PR / Dorado gets America/Puerto_Rico. Any other community is
-- left NULL; a NULL zone refuses NEW reservations ("time zone is not set") rather than silently assuming one.
--
-- DST: reservations are stored as local wall-clock date + time, so no stored value moves. "Now" is converted with AT TIME ZONE,
-- which resolves a repeated hour (fall back) to the first occurrence and a nonexistent hour (spring forward) forward.

ALTER TABLE public.hoas ADD COLUMN IF NOT EXISTS timezone text;

CREATE OR REPLACE FUNCTION public.validate_hoa_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.timezone IS NOT NULL THEN
    NEW.timezone := btrim(NEW.timezone);
    IF NEW.timezone = '' THEN
      NEW.timezone := NULL;
    ELSIF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
      RAISE EXCEPTION 'Unknown time zone "%": use an IANA name such as America/Puerto_Rico or America/Los_Angeles', NEW.timezone
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_hoa_timezone_trigger ON public.hoas;
CREATE TRIGGER validate_hoa_timezone_trigger
  BEFORE INSERT OR UPDATE OF timezone ON public.hoas
  FOR EACH ROW EXECUTE FUNCTION public.validate_hoa_timezone();

-- Backfill by evidence; never overwrites an existing value.
DO $$
DECLARE
  n_set integer;
  n_null integer;
BEGIN
  UPDATE public.hoas
     SET timezone = 'America/Puerto_Rico'
   WHERE timezone IS NULL
     AND address ~* '(puerto rico|,\s*pr\b|\mdorado\M)';
  GET DIAGNOSTICS n_set = ROW_COUNT;
  SELECT count(*) INTO n_null FROM public.hoas WHERE timezone IS NULL;
  RAISE NOTICE 'hoas.timezone backfilled by address evidence: %; communities still without a time zone: %', n_set, n_null;
END
$$;

-- The zone of the HOA that owns a court. p_strict => raise when it is not set (used when a NEW reservation is created).
CREATE OR REPLACE FUNCTION public.hoa_timezone_for_court(p_court_id uuid, p_strict boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tz text;
BEGIN
  SELECT h.timezone INTO tz
    FROM public.courts c JOIN public.hoas h ON h.id = c.hoa_id
   WHERE c.id = p_court_id;
  IF tz IS NULL AND p_strict THEN
    RAISE EXCEPTION 'This community''s time zone is not set yet, so reservations are not available. Ask a community administrator to set it.'
      USING ERRCODE = '23514';
  END IF;
  RETURN tz;
END;
$function$;

-- "Now" at the HOA as a zone-less local timestamp (comparable with bookings.date + start_time).
CREATE OR REPLACE FUNCTION public.hoa_local_now_for_court(p_court_id uuid, p_strict boolean DEFAULT false)
RETURNS timestamp
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tz text := public.hoa_timezone_for_court(p_court_id, p_strict);
BEGIN
  IF tz IS NULL THEN RETURN NULL; END IF;
  RETURN now() AT TIME ZONE tz;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hoa_local_date_for_court(p_court_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (public.hoa_local_now_for_court(p_court_id, true))::date
$function$;

-- Who may set a community's zone: an administrator of that community, or TenisX staff (platform_reviewer).
CREATE OR REPLACE FUNCTION public.set_hoa_timezone(p_hoa_id uuid, p_timezone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.check_hoa_admin(auth.uid(), p_hoa_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_reviewer')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this community' USING ERRCODE = '42501';
  END IF;
  UPDATE public.hoas SET timezone = p_timezone WHERE id = p_hoa_id;  -- validated by validate_hoa_timezone_trigger
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community not found' USING ERRCODE = '22023';
  END IF;
  RETURN (SELECT timezone FROM public.hoas WHERE id = p_hoa_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_hoa_timezone(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_hoa_timezone(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.hoa_timezone_for_court(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoa_timezone_for_court(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.hoa_local_now_for_court(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoa_local_now_for_court(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.hoa_local_date_for_court(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoa_local_date_for_court(uuid) TO authenticated;

-- Cancellation window: the booking's local start versus "now" at THE HOA (was hard-coded America/Puerto_Rico).
CREATE OR REPLACE FUNCTION public.enforce_booking_cancellation_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  min_hours integer;
  booking_hoa_id uuid;
  local_now timestamp;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND auth.uid() = OLD.user_id THEN
    SELECT hoa_id INTO booking_hoa_id FROM public.courts WHERE id = OLD.court_id;

    IF booking_hoa_id IS NOT NULL AND check_hoa_admin(auth.uid(), booking_hoa_id) THEN
      RETURN NEW;
    END IF;

    SELECT min_cancellation_hours INTO min_hours
    FROM public.amenity_rules WHERE amenity_id = OLD.court_id;

    local_now := public.hoa_local_now_for_court(OLD.court_id, false);  -- NULL zone: cancelling is never blocked by a guess

    -- Lead time is measured between real instants (the validated local start resolved in the HOA zone versus now()), so a
    -- daylight saving change between now and the start is counted correctly.
    IF min_hours IS NOT NULL AND local_now IS NOT NULL
       AND ((OLD.date + OLD.start_time) AT TIME ZONE public.hoa_timezone_for_court(OLD.court_id, false)) < (now() + (min_hours || ' hours')::interval) THEN
      RAISE EXCEPTION 'This reservation can no longer be cancelled -- it starts within the % hour cancellation window', min_hours
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Daylight-saving policy: a reservation is REFUSED when its start or end local time does not exist (spring-forward gap), occurs
-- twice (fall-back hour), or the interval spans a UTC-offset change. Every stored reservation therefore maps to exactly one instant
-- and plain wall-clock comparison (date + start_time versus the HOA's local now) is exact.
CREATE OR REPLACE FUNCTION public.reservation_time_problem(p_date date, p_start time, p_end time, p_tz text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  s timestamp := p_date + p_start;
  e timestamp := p_date + p_end;
  si timestamptz;
  ei timestamptz;
BEGIN
  IF p_tz IS NULL THEN RETURN NULL; END IF;
  si := s AT TIME ZONE p_tz;
  ei := e AT TIME ZONE p_tz;
  -- nonexistent local time: converting there and back does not return the same wall clock
  IF (si AT TIME ZONE p_tz) <> s OR (ei AT TIME ZONE p_tz) <> e THEN RETURN 'nonexistent'; END IF;
  -- repeated local time: another instant (within +-2 h, probed every 15 min so 30 and 60 minute shifts are both caught) has the same wall clock
  IF EXISTS (
    SELECT 1 FROM generate_series(-8, 8) g
    WHERE g <> 0 AND (((si + g * interval '15 minutes') AT TIME ZONE p_tz) = s OR ((ei + g * interval '15 minutes') AT TIME ZONE p_tz) = e)
  ) THEN RETURN 'ambiguous'; END IF;
  -- the interval crosses a UTC-offset change: real length differs from the wall-clock length
  IF (ei - si) <> (e - s) THEN RETURN 'spans_change'; END IF;
  RETURN NULL;
END;
$function$;

-- Amenity rules: same body as before except (a) a NEW reservation needs the HOA's time zone and (b) the advance-booking window is
-- measured from the HOA's local date (it used the UTC date).
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
  hoa_today date;
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

  -- Every NEW or MOVED reservation (insert, or an administrator changing court/date/times) must resolve to one real interval.
  IF public.reservation_time_problem(NEW.date, NEW.start_time, NEW.end_time, public.hoa_timezone_for_court(NEW.court_id, TG_OP = 'INSERT')) IS NOT NULL THEN
    RAISE EXCEPTION 'That time is affected by the daylight saving time change (it does not exist, repeats, or spans the change). Please choose another time.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    hoa_today := public.hoa_local_date_for_court(NEW.court_id);  -- raises when the community's time zone is not set
    SELECT * INTO r FROM public.amenity_rules WHERE amenity_id = NEW.court_id LIMIT 1;

    IF r.id IS NOT NULL THEN
      IF r.advance_booking_days IS NOT NULL
         AND NEW.date > (hoa_today + (r.advance_booking_days || ' days')::interval)::date THEN
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

-- Blockout creation: "today" is the HOA's local date (was hard-coded America/Puerto_Rico).
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
  v_today date := public.hoa_local_date_for_court(p_court_id);
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

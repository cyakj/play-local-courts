-- Correction to enforce_amenity_booking_rules() (previous migration in this
-- same pass): the blanket max_duration_minutes check broke every legitimate
-- tennis booking. Live-caught by testing the *positive* path, not just the
-- exploit: "The Greens Court" (court_type='tennis') has
-- singles_duration_minutes=90, doubles_duration_minutes=90, but
-- max_duration_minutes=60 -- three different values live in production.
--
-- courts.tsx's own duration logic (sheetDuration, confirmed by reading the
-- source) already branches on court_type: for court_type='tennis' it uses
-- singles_duration_minutes / doubles_duration_minutes (default 60/90)
-- depending on play_type, and max_duration_minutes is only the effective
-- cap for non-tennis amenities (the ones AddAmenityWizard.tsx actually
-- configures, default 60). The trigger must mirror that exact split, not
-- invent a single blanket rule -- otherwise the DB check itself becomes the
-- functional regression.
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
BEGIN
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

  RETURN NEW;
END;
$function$;

-- I2: amenity_rules (requires_admin_approval, advance_booking_days,
-- max_reservations_per_day, operating hours/max_duration_minutes) were
-- enforced client-side only (or, for requires_admin_approval and
-- max_reservations_per_day, not enforced anywhere at all -- both insert
-- call sites, courts.tsx and amenity-book.tsx, hardcode status='confirmed'
-- unconditionally, and neither screen checks the daily cap before
-- inserting). A direct API/SDK call could ignore every one of these.
--
-- These four are exactly the rules the Greens V1 admin UI actually
-- configures (AddAmenityWizard.tsx / manage-amenities.tsx saveDetail()):
-- booking_start_time/end_time, max_duration_minutes, advance_booking_days,
-- max_reservations_per_day, requires_admin_approval. Investigated but NOT
-- enforced here: max_reservations_per_week, min_time_between_reservations,
-- peak-hour durations, security deposits, singles/doubles-only, ball
-- machine, lifeguard ack -- none of these are set by any Greens V1 admin
-- screen (confirmed via grep); they are legacy Tennis-mode columns sitting
-- at their schema defaults, unconfigured and not part of the current
-- product's authoritative rule set, so enforcing them would be inventing a
-- rule nothing in the product actually sets.
--
-- requires_admin_approval specifically: bookings.status previously allowed
-- only 'confirmed'/'cancelled' (bookings_status_check), so there was no
-- valid non-confirmed state to put an approval-required booking into --
-- widened to also allow 'pending'. my-reservations.tsx's bookingStatus()
-- already has a dedicated display case for 'pending', so this is a value
-- the client already expects to handle, not a new concept.
--
-- Slot-reservation semantics for a pending booking: bookings_no_overlapping_confirmed
-- is (deliberately, unchanged here) scoped to status='confirmed' only, so a
-- pending booking does NOT hold the slot against other residents while
-- awaiting approval -- first admin approval (a normal UPDATE ... SET
-- status='confirmed', still subject to the same EXCLUDE constraint) wins if
-- two residents' pending requests for the same amenity turn out to overlap;
-- the second approval attempt will itself get rejected with 23P01. This
-- preserves the existing overlap guarantee exactly as-is; no admin
-- approve/reject UI is added in this pass (out of scope -- see the
-- accompanying report), so a pending booking has no in-app path to
-- 'confirmed' yet beyond a direct DB update.
--
-- SECURITY DEFINER (matching check_hoa_admin/is_in_same_hoa/
-- is_hoa_affiliated) so the rule check doesn't depend on the caller's RLS
-- visibility of amenity_rules/other bookings.
ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'pending'::text]));

CREATE OR REPLACE FUNCTION public.enforce_amenity_booking_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.amenity_rules%ROWTYPE;
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
    IF r.max_duration_minutes IS NOT NULL
       AND EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60 > r.max_duration_minutes THEN
      RAISE EXCEPTION 'Booking duration exceeds the % minute maximum for this amenity', r.max_duration_minutes
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

DROP TRIGGER IF EXISTS enforce_amenity_booking_rules_trigger ON public.bookings;
CREATE TRIGGER enforce_amenity_booking_rules_trigger
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_amenity_booking_rules();

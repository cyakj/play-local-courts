-- I5: min_cancellation_hours (amenity_rules) was enforced client-side only
-- -- canCancelBooking() in my-reservations.tsx only gates whether the
-- Cancel button renders; the actual UPDATE ... SET status='cancelled'
-- WHERE id=... AND user_id=... is permitted by "Users can cancel their own
-- bookings" (USING auth.uid()=user_id, no WITH CHECK, no time-window
-- condition at all). A resident could cancel within the admin-configured
-- cutoff via a direct API call.
--
-- Fix: a BEFORE UPDATE trigger (not a tightened RLS policy) so a rejection
-- surfaces as a clear, catchable error instead of a silent
-- zero-rows-affected no-op -- the same failure mode already fixed
-- elsewhere in this codebase for admin mutations (saveReport() /
-- member-deactivate in (cm)/community/[hoaId].tsx).
--
-- Only restricts the OWNING user cancelling their own still-active booking
-- (status transitioning away from 'cancelled', auth.uid() = OLD.user_id).
-- An HOA admin cancelling a booking in their own HOA is explicitly exempted
-- -- "Admins can update bookings in their HOA" already grants unrestricted
-- admin cancellation with no time window, and this pass does not invent a
-- new override where none existed; it only preserves that existing one
-- exactly as-is, including for the edge case where an admin is cancelling
-- their own booking.
--
-- date + start_time is compared against now()::timestamp (session-local,
-- Postgres default UTC on Supabase) with no per-court timezone column in
-- the schema -- the same naive local-time arithmetic already used by
-- bookings_no_overlapping_confirmed's tsrange comparisons, so this doesn't
-- introduce a new timezone assumption, just applies the existing one to a
-- new comparison against now().
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
       AND (OLD.date + OLD.start_time) < (now()::timestamp + (min_hours || ' hours')::interval) THEN
      RAISE EXCEPTION 'This reservation can no longer be cancelled -- it starts within the % hour cancellation window', min_hours
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_booking_cancellation_window_trigger ON public.bookings;
CREATE TRIGGER enforce_booking_cancellation_window_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_cancellation_window();

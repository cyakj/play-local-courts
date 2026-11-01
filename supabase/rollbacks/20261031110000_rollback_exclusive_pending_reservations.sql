-- ROLLBACK for 20261031110000_exclusive_pending_reservations.sql
-- NOT a migration (kept outside supabase/migrations on purpose). Apply with the Supabase MCP only if the forward migration
-- must be undone. Function bodies below are the ones captured from the 2026-10-29 restore (the state before the forward migration).
-- DATA NOTE: rows with status 'expired' are set back to 'cancelled' (cancelled_by left as is) because the old CHECK has no
-- 'expired'. Their reservations were never approved and had already passed, so no live reservation changes meaning.
-- Run INSIDE one transaction.

DROP TRIGGER IF EXISTS bookings_00_sweep_expired ON public.bookings;
DROP FUNCTION IF EXISTS public.sweep_expired_before_booking_insert();
DROP FUNCTION IF EXISTS public.get_amenity_busy_times(uuid[], date);
DROP FUNCTION IF EXISTS public.expire_pending_bookings(uuid);

CREATE OR REPLACE FUNCTION public.enforce_booking_status_transitions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  booking_hoa_id uuid;
  caller_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT hoa_id INTO booking_hoa_id FROM public.courts WHERE id = OLD.court_id;
  caller_is_admin := booking_hoa_id IS NOT NULL AND public.check_hoa_admin(auth.uid(), booking_hoa_id);

  IF caller_is_admin THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status = 'pending'   AND NEW.status IN ('confirmed', 'rejected', 'cancelled'))
        OR (OLD.status = 'confirmed' AND NEW.status = 'cancelled')
      ) THEN
        RAISE EXCEPTION 'A % reservation cannot be changed to %', OLD.status, NEW.status
          USING ERRCODE = '23514';
      END IF;

      IF NEW.status = 'confirmed' THEN
        IF EXISTS (
          SELECT 1 FROM public.court_maintenance cm
          WHERE cm.court_id = NEW.court_id
            AND NEW.date BETWEEN cm.date AND COALESCE(cm.end_date, cm.date)
            AND NEW.start_time < cm.end_time
            AND NEW.end_time > cm.start_time
        ) THEN
          RAISE EXCEPTION 'This time is unavailable because the amenity is blocked for maintenance'
            USING ERRCODE = '23514';
        END IF;
      END IF;

      IF NEW.status IN ('confirmed', 'rejected') THEN
        NEW.reviewed_by := auth.uid();
        NEW.reviewed_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.court_id IS DISTINCT FROM OLD.court_id
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time
     OR NEW.play_type IS DISTINCT FROM OLD.play_type
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    RAISE EXCEPTION 'Reservation details can only be changed by a community administrator'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed')) THEN
    RAISE EXCEPTION 'Only a community administrator can approve or decline a reservation'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.bookings SET status = 'cancelled' WHERE status = 'expired';
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'pending'::text, 'rejected'::text]));

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_overlapping_active;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlapping_confirmed
  EXCLUDE USING gist (court_id WITH =, tsrange((date + start_time), (date + end_time), '[)') WITH &&)
  WHERE (status = 'confirmed');

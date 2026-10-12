-- Greens V1 — reservation approval workflow, hardening and cancellation-window timezone.
--
-- NOT APPLIED to the live project. Review, then apply with the Supabase MCP
-- `apply_migration` (never `db push`). Verification SQL: supabase/tests/booking_approval.sql.
--
-- Background (found while investigating "court is pending, pool is confirmed"):
--   * `enforce_amenity_booking_rules` already forces status='pending' on INSERT when
--     amenity_rules.requires_admin_approval = true. "The Greens Court" has that flag set,
--     "Greens Pool" does not, so the observed pending/confirmed split is correct.
--   * BUT nothing stops a resident from approving their own booking afterwards:
--     "Users can cancel their own bookings" is `FOR UPDATE USING (auth.uid() = user_id)`
--     with no WITH CHECK, and the trigger returns early on any UPDATE that does not
--     move the booking. A resident could PATCH {"status":"confirmed"} on their own
--     pending booking, or revive a cancelled one.
--   * There was no 'rejected' status, so an admin could not decline a request.
--   * `enforce_booking_cancellation_window` compared the booking's local wall-clock
--     start to now()::timestamp, which is UTC on Supabase — 4 hours ahead of Puerto Rico
--     (America/Puerto_Rico, UTC-4, no DST) — so it rejected cancellations the app showed
--     as allowed.
--
-- Historical rows are not modified.

-- 1. Allow an admin to decline a pending request ---------------------------------------
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'pending'::text, 'rejected'::text]));

-- Who reviewed (approved/rejected) a request, and when.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Resident-facing notification when a request is declined.
ALTER TABLE public.hoa_notifications DROP CONSTRAINT IF EXISTS hoa_notifications_type_check;
ALTER TABLE public.hoa_notifications
  ADD CONSTRAINT hoa_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'report_submitted', 'report_status_changed', 'report_unresolved',
    'member_application', 'member_approved', 'member_rejected',
    'booking_confirmed', 'booking_cancelled', 'booking_rejected', 'booking_reminder',
    'health_score_alert', 'announcement', 'survey_published', 'survey_reminder',
    'event_created', 'event_reminder', 'invite_reminder'
  ]::text[]));

-- 2. Server-side status transitions ----------------------------------------------------
-- Admins of the booking's HOA: pending -> confirmed | rejected | cancelled, confirmed -> cancelled.
-- Everyone else (the resident who owns the booking): may only cancel a pending/confirmed
-- booking; cannot approve/reject/revive it, change who/what/when it is for, or edit review fields.
-- Calls with no JWT (service role, SQL editor, migrations) are not restricted.
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
        -- Approval must respect blockouts created after the request was made.
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

  -- Non-admin caller.
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

DROP TRIGGER IF EXISTS enforce_booking_status_transitions_trigger ON public.bookings;
CREATE TRIGGER enforce_booking_status_transitions_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_status_transitions();

-- 3. Cancellation window in the community's wall-clock time ----------------------------
-- bookings.date/start_time are Puerto Rico wall-clock values; compare them with Puerto Rico
-- "now", not the UTC session clock. (The app has no per-HOA timezone column today; every
-- Greens V1 community is in America/Puerto_Rico.)
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

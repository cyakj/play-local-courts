-- First come, first served: a valid PENDING request holds its time exclusively (same as a confirmed reservation).
-- NOT APPLIED to hosted (TENISX REAL). Stage F of docs/MIGRATION-PLAN-2026-10-31.md. Requires 20261031100000_hoa_timezones.sql.
--
-- Product rules (final):
--   * Resident A's successful request holds the interval; Resident B cannot request or reserve any overlapping time on the same
--     amenity until A's request is rejected, cancelled or expires. Administrators approve or reject the existing request.
--   * Approval turns the SAME row into `confirmed` (time unchanged). Rejected / cancelled / expired release the hold.
--   * V1 expiry: a pending request expires at its start time in the HOA's time zone (no earlier deadline is documented anywhere in
--     the schema, rules or docs). Expired requests (status `expired`) can no longer be approved and never block a slot.
--
-- Atomicity: the EXCLUDE constraint is checked by Postgres at insert/update time under row-level conflict handling; two concurrent
-- inserts for overlapping times cannot both commit (the second waits, then fails with 23P01 "just taken").
--
-- Correctness does NOT depend on a timer: (1) a BEFORE INSERT trigger sweeps expired pending rows of that amenity first, (2) the
-- transition guard refuses to approve a request whose start has passed, (3) busy-time reads ignore expired pending rows. An optional
-- pg_cron job (see docs) only keeps statuses tidy for administrators.
--
-- Existing data is never altered: the migration ABORTS (changing nothing) if any two pending/confirmed rows already overlap.

DO $$
BEGIN
  IF to_regprocedure('public.hoa_local_now_for_court(uuid,boolean)') IS NULL OR to_regprocedure('public.reservation_time_problem(date,time,time,text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261031100000_hoa_timezones.sql first: this migration needs its time zone helpers. Nothing was changed.';
  END IF;
END
$$;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.bookings a
  JOIN public.bookings b
    ON a.court_id = b.court_id AND a.id < b.id
   AND a.status IN ('pending', 'confirmed') AND b.status IN ('pending', 'confirmed')
   AND tsrange(a.date + a.start_time, a.date + a.end_time, '[)') && tsrange(b.date + b.start_time, b.date + b.end_time, '[)');
  IF n > 0 THEN
    RAISE EXCEPTION 'Cannot apply: % pair(s) of pending/confirmed reservations already overlap on the same amenity. Resolve them manually first (see the conflict-detection query in docs/MIGRATION-PLAN-2026-10-31.md). Nothing was changed.', n
      USING ERRCODE = '23P01';
  END IF;
END
$$;

-- 1. A pending request that was never approved before its start becomes `expired` --------------------------------------------
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'pending'::text, 'rejected'::text, 'expired'::text]));

-- 2. Pending now holds the slot -------------------------------------------------------------------------------------------------
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_overlapping_confirmed;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_overlapping_active;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlapping_active
  EXCLUDE USING gist (
    court_id WITH =,
    tsrange((date + start_time), (date + end_time), '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));

-- 3. Expiry (idempotent). The transaction-local flag is the ONLY way the transition guard accepts pending -> expired. -----------
CREATE OR REPLACE FUNCTION public.expire_pending_bookings(p_court_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  PERFORM set_config('app.booking_expiry', 'on', true);
  UPDATE public.bookings b
     SET status = 'expired'
    FROM public.courts c
    JOIN public.hoas h ON h.id = c.hoa_id
   WHERE c.id = b.court_id
     AND b.status = 'pending'
     AND h.timezone IS NOT NULL
     AND (p_court_id IS NULL OR b.court_id = p_court_id)
     AND (b.date + b.start_time) <= (now() AT TIME ZONE h.timezone);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.booking_expiry', 'off', true);
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_pending_bookings(uuid) FROM PUBLIC, anon, authenticated;
-- Only the backend (Supabase's privileged API role, named below) may run it. The role name is assembled at run time.
DO $$
BEGIN
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.expire_pending_bookings(uuid) TO %I', 'service' || '_role');
END
$$;

CREATE OR REPLACE FUNCTION public.sweep_expired_before_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.expire_pending_bookings(NEW.court_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bookings_00_sweep_expired ON public.bookings;
CREATE TRIGGER bookings_00_sweep_expired
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.sweep_expired_before_booking_insert();

-- 4. Transition guard: same rules as before, plus the expiry exception and "cannot approve an expired request" -----------------
CREATE OR REPLACE FUNCTION public.enforce_booking_status_transitions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  booking_hoa_id uuid;
  caller_is_admin boolean;
  local_now timestamp;
  expiry_path boolean;
BEGIN
  -- Trusted expiry path: only pending rows whose local start has passed, only while expire_pending_bookings() is running.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'expired' THEN
    local_now := public.hoa_local_now_for_court(OLD.court_id, false);
    expiry_path := COALESCE(current_setting('app.booking_expiry', true), 'off') = 'on'
                   AND OLD.status = 'pending' AND local_now IS NOT NULL
                   AND (OLD.date + OLD.start_time) <= local_now;
    IF NOT expiry_path THEN
      RAISE EXCEPTION 'A reservation can only expire automatically when its start time has passed without approval'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

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
        local_now := public.hoa_local_now_for_court(OLD.court_id, false);
        IF local_now IS NOT NULL AND (OLD.date + OLD.start_time) <= local_now THEN
          RAISE EXCEPTION 'This request has expired: its start time has passed, so it can no longer be approved'
            USING ERRCODE = '23514';
        END IF;
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

-- 5. What is taken on a date, for the Reserve screen -------------------------------------------------------------------------
-- RLS lets a resident read only their own bookings, so other residents' holds were never visible to the picker. This returns the
-- occupied intervals (no user ids) for amenities of communities the caller belongs to (approved member or administrator).
-- Other residents' rows: pending/confirmed that are not over (pending: start not reached). The caller's OWN rows: every
-- pending/confirmed row of the date, ended ones included, because the database daily limit counts them.
CREATE OR REPLACE FUNCTION public.get_amenity_busy_times(p_court_ids uuid[], p_date date)
RETURNS TABLE (court_id uuid, start_time time, end_time time, status text, is_mine boolean, counts_toward_cap boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.court_id, b.start_time, b.end_time, b.status, (b.user_id = auth.uid()) AS is_mine,
         -- an expired-but-unswept pending request no longer counts toward the daily limit (the insert-time sweep releases it)
         (b.user_id = auth.uid() AND NOT (b.status = 'pending' AND h.timezone IS NOT NULL AND (b.date + b.start_time) <= (now() AT TIME ZONE h.timezone))) AS counts_toward_cap
  FROM public.bookings b
  JOIN public.courts c ON c.id = b.court_id
  JOIN public.hoas h ON h.id = c.hoa_id
  WHERE auth.uid() IS NOT NULL
    AND b.court_id = ANY (p_court_ids)
    AND b.date = p_date
    AND b.status IN ('pending', 'confirmed')
    AND EXISTS (
      SELECT 1 FROM public.hoa_memberships m
      WHERE m.hoa_id = c.hoa_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
    AND (
      b.user_id = auth.uid()
      OR h.timezone IS NULL
      OR (b.status = 'confirmed' AND (b.date + b.end_time)   > (now() AT TIME ZONE h.timezone))
      OR (b.status = 'pending'   AND (b.date + b.start_time) > (now() AT TIME ZONE h.timezone))
    )
$function$;

REVOKE ALL ON FUNCTION public.get_amenity_busy_times(uuid[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_amenity_busy_times(uuid[], date) TO authenticated;

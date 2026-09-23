-- Freshly reproduced live: admin creates a real blockout (Greens Pool,
-- 07:00-18:00), resident then directly POSTs a confirmed booking for
-- 09:00-10:00 the same court/date via REST -- HTTP 201, accepted. Neither
-- bookings_no_overlapping_confirmed (only checks other bookings) nor
-- enforce_amenity_booking_rules (only checks amenity_rules) reference
-- court_maintenance at all. Blockout filtering exists only client-side in
-- courts.tsx's slot generation -- no DB backstop.
--
-- Semantics mirrored from the existing product/schema, not invented:
-- BlockoutSheet.findConflicts() is the authoritative source. A blockout row
-- has no status/enabled/deleted flag -- every row is implicitly active;
-- removal is a real DELETE. date/end_date form an INCLUSIVE day range
-- (end_date IS NULL means single-day, matching findConflicts()'s
-- `mode === 'range' ? gte(from).lte(to) : eq(from)`). "All Day" is
-- persisted as start_time/end_time = the amenity's own open/close hours
-- (insertBlockout()), not a literal 00:00-23:59 sentinel -- so no special
-- "all day" case is needed, the normal start_time/end_time comparison
-- already covers it correctly.
--
-- Extends the existing authoritative validation trigger
-- (enforce_amenity_booking_rules, added for I2) rather than adding a
-- second, unrelated trigger. Now fires on UPDATE too, so a direct API call
-- that tries to move an existing booking's court/date/time into a blocked
-- interval is caught as well as a fresh INSERT -- guarded so the one real
-- UPDATE call site in the app (my-reservations.tsx's cancel, which only
-- ever sets status) is completely unaffected: validation only re-runs when
-- court_id/date/start_time/end_time actually change, and the
-- amenity_rules-specific checks (advance window, hours, duration, per-day
-- cap, requires_admin_approval-forcing) remain INSERT-only exactly as
-- before, so an admin/resident cancelling a booking can never be silently
-- flipped back to 'pending' by this trigger.
--
-- No admin bypass: the codebase has no admin-side INSERT into bookings at
-- all (grep confirms only courts.tsx/amenity-book.tsx, both resident-
-- facing) and no existing semantics suggesting one should exist, so the
-- blockout check applies unconditionally -- consistent with "do not invent
-- an admin bypass." This does not affect BlockoutSheet's own
-- admin-conflict-resolution flow, which inserts into court_maintenance,
-- not bookings, and is untouched.
--
-- Only applies to active (non-cancelled) rows -- a 'cancelled' row doesn't
-- claim the slot, matching bookings_no_overlapping_confirmed's own
-- WHERE status='confirmed' scoping and this trigger's own per-day-cap
-- counting of confirmed+pending as "active."
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

DROP TRIGGER IF EXISTS enforce_amenity_booking_rules_trigger ON public.bookings;
CREATE TRIGGER enforce_amenity_booking_rules_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_amenity_booking_rules();

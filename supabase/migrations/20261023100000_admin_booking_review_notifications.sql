-- Notify approved community admins when a reservation needs approval, excluding the booker.
-- NOT APPLIED: must be applied by the user after review, after 20261013110000.
-- Confirmed inserts and resident-initiated cancellations deliberately do NOT notify admins;
-- they are visible in the amenity schedule. Resident booking notifications remain unchanged.

ALTER TABLE public.hoa_notifications DROP CONSTRAINT IF EXISTS hoa_notifications_type_check;
ALTER TABLE public.hoa_notifications
  ADD CONSTRAINT hoa_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'report_submitted', 'report_status_changed', 'report_unresolved', 'report_update',
    'member_application', 'member_approved', 'member_rejected',
    'booking_pending', 'booking_confirmed', 'booking_cancelled', 'booking_rejected', 'booking_reminder',
    'health_score_alert', 'announcement', 'survey_published', 'survey_reminder',
    'event_created', 'event_reminder', 'invite_reminder', 'booking_review_needed'
  ]::text[]));

CREATE OR REPLACE FUNCTION public.notify_admins_on_booking_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  amenity_name text;
  amenity_hoa_id uuid;
  resident_name text;
  when_txt text;
BEGIN
  SELECT name, hoa_id INTO amenity_name, amenity_hoa_id FROM public.courts WHERE id = NEW.court_id;
  SELECT NULLIF(btrim(full_name), '') INTO resident_name FROM public.profiles WHERE id = NEW.user_id;
  when_txt := to_char(NEW.date, 'FMMon FMDD') || ' at ' || to_char(NEW.start_time, 'FMHH12:MI AM');

  INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata, dedupe_key)
  SELECT m.user_id, amenity_hoa_id, 'booking_review_needed', 'Reservation needs approval',
         COALESCE(resident_name, 'A resident') || ' requested ' || COALESCE(amenity_name, 'Amenity')
           || ' on ' || when_txt || '.',
         jsonb_build_object('booking_id', NEW.id, 'court_id', NEW.court_id, 'route', '/(admin)/manage-amenities'),
         'admin_booking_review:' || NEW.id::text || ':' || m.user_id::text
  FROM public.hoa_memberships m
  WHERE m.hoa_id = amenity_hoa_id AND m.role = 'admin' AND m.status = 'approved'
    AND m.user_id <> NEW.user_id
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_admins_booking_review ON public.bookings;
CREATE TRIGGER trg_notify_admins_booking_review
  AFTER INSERT ON public.bookings
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_admins_on_booking_review();

REVOKE ALL ON FUNCTION public.notify_admins_on_booking_review() FROM PUBLIC, anon, authenticated;

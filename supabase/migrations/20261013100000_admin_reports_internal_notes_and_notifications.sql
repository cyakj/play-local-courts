-- Admin redesign — Milestone B: report note visibility, status history, idempotent notifications.
--
-- NOT APPLIED to the live project. Review, then apply with the Supabase MCP
-- `apply_migration` (never `db push`). Must be applied AFTER 20261012190000
-- (booking approval workflow), whose notification-type list this file extends.
--
-- Reuses existing infrastructure — no parallel notes or notification system:
--   * public.report_notes (is_internal flag, admin-only ALL policy) already exists. Today it is
--     admin-only for EVERY row, so the resident app's "public notes" query returns nothing.
--     Here: is_internal = true stays admin-only; is_internal = false (an explicit
--     "update for resident") becomes readable by the reporting resident.
--   * public.maintenance_reports.admin_notes is readable by the reporting resident (RLS is
--     row-level) and rendered by the resident app, so it cannot hold internal text. It is
--     frozen for end-user writes; the admin UI writes report_notes instead.
--   * public.hoa_notifications is the single in-app notification store; it gains an
--     idempotency key and a deep-link route in metadata.
-- No existing rows are deleted or rewritten. (Scrubbing legacy admin_notes is a separate,
-- opt-in file: 20261013100100_admin_reports_scrub_legacy_admin_notes.sql.)

-- 1. Notification idempotency + new types -------------------------------------------------
ALTER TABLE public.hoa_notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS hoa_notifications_user_dedupe_uidx
  ON public.hoa_notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.hoa_notifications DROP CONSTRAINT IF EXISTS hoa_notifications_type_check;
ALTER TABLE public.hoa_notifications
  ADD CONSTRAINT hoa_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'report_submitted', 'report_status_changed', 'report_unresolved', 'report_update',
    'member_application', 'member_approved', 'member_rejected',
    'booking_pending', 'booking_confirmed', 'booking_cancelled', 'booking_rejected', 'booking_reminder',
    'health_score_alert', 'announcement', 'survey_published', 'survey_reminder',
    'event_created', 'event_reminder', 'invite_reminder'
  ]::text[]));

-- 2. report_notes: residents may read the notes designated for them ----------------------
DROP POLICY IF EXISTS "Reporters read resident-visible notes" ON public.report_notes;
CREATE POLICY "Reporters read resident-visible notes" ON public.report_notes
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.maintenance_reports mr
      WHERE mr.id = report_notes.report_id AND mr.reporter_id = auth.uid()
    )
  );

-- 3. Status history (admin-only) ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_report_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES public.maintenance_reports(id) ON DELETE CASCADE,
  hoa_id      uuid NOT NULL REFERENCES public.hoas(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_status_history_report_idx
  ON public.maintenance_report_status_history (report_id, created_at DESC);
ALTER TABLE public.maintenance_report_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HOA admins read report status history" ON public.maintenance_report_status_history;
CREATE POLICY "HOA admins read report status history" ON public.maintenance_report_status_history
  FOR SELECT TO authenticated USING (public.check_hoa_admin(auth.uid(), hoa_id));
-- No write policies: rows are written only by the SECURITY DEFINER trigger below.

-- 4. Status change -> history row + ONE deduplicated, deep-linked resident notification ----
CREATE OR REPLACE FUNCTION public.notify_reporter_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  amenity_name text;
  history_id   uuid;
  status_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO amenity_name FROM public.courts WHERE id = NEW.amenity_id;

  INSERT INTO public.maintenance_report_status_history (report_id, hoa_id, from_status, to_status, changed_by)
  VALUES (NEW.id, NEW.hoa_id, OLD.status, NEW.status, auth.uid())
  RETURNING id INTO history_id;

  status_label := replace(NEW.status, '_', ' ');

  INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata, dedupe_key)
  VALUES (
    NEW.reporter_id, NEW.hoa_id, 'report_status_changed',
    'Report update: ' || initcap(status_label),
    'Your ' || replace(NEW.category, '_', ' ') || ' report'
      || COALESCE(' for ' || amenity_name, '') || ' is now ' || status_label || '.',
    jsonb_build_object('report_id', NEW.id, 'new_status', NEW.status,
                       'route', '/report-detail/' || NEW.id::text),
    'report_status:' || history_id::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_report_status ON public.maintenance_reports;
CREATE TRIGGER trg_notify_report_status
  AFTER UPDATE ON public.maintenance_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_reporter_on_status_change();

-- 5. Resident-visible note -> notify the reporter ----------------------------------------------------
-- If the admin changed the status in the same action (within 30s), the status notification already
-- tells the resident to look at the report, and the note is shown in the report's activity timeline,
-- so no second notification is sent (one action never yields two). Notifications are never UPDATEd
-- here: prevent_notification_content_changes() forbids editing a notification's content.
CREATE OR REPLACE FUNCTION public.notify_reporter_on_public_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rpt public.maintenance_reports%ROWTYPE;
BEGIN
  IF NEW.is_internal THEN
    RETURN NEW;
  END IF;

  SELECT * INTO rpt FROM public.maintenance_reports WHERE id = NEW.report_id;
  IF NOT FOUND OR rpt.reporter_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.maintenance_report_status_history h
    WHERE h.report_id = NEW.report_id
      AND h.changed_by IS NOT DISTINCT FROM NEW.author_id
      AND h.created_at > now() - interval '30 seconds'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata, dedupe_key)
  VALUES (
    rpt.reporter_id, rpt.hoa_id, 'report_update', 'New update on your report', left(NEW.body, 200),
    jsonb_build_object('report_id', rpt.id, 'route', '/report-detail/' || rpt.id::text),
    'report_note:' || NEW.id::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_report_public_note ON public.report_notes;
CREATE TRIGGER trg_notify_report_public_note
  AFTER INSERT ON public.report_notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_reporter_on_public_note();

-- 6. Freeze the resident-readable admin_notes column for end-user writes -------------------------
CREATE OR REPLACE FUNCTION public.deprecate_report_admin_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'admin_notes is deprecated: add an internal or resident-visible report note instead'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS deprecate_report_admin_notes_trigger ON public.maintenance_reports;
CREATE TRIGGER deprecate_report_admin_notes_trigger
  BEFORE UPDATE ON public.maintenance_reports
  FOR EACH ROW EXECUTE FUNCTION public.deprecate_report_admin_notes();

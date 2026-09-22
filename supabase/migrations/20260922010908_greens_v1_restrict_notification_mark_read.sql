-- "Users can mark own as read" (hoa_notifications, FOR UPDATE, USING
-- auth.uid()=user_id, no WITH CHECK) reused USING as the post-update check,
-- so a recipient could rewrite their own notification's title/body/type/
-- hoa_id/user_id, not just flip `read`. There is no separate admin UPDATE
-- policy on this table (only insert-by-admin and this recipient-only
-- update), so unlike profiles/hoa_memberships there's no privileged path to
-- preserve here.
--
-- Mirrors the existing prevent_profile_sensitive_changes trigger pattern:
-- block the mutation outright (rather than silently reverting fields) when
-- a protected column would change.
CREATE OR REPLACE FUNCTION public.prevent_notification_content_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.hoa_id IS DISTINCT FROM OLD.hoa_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Not allowed to change notification content, recipient, HOA, or type'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_notification_content_changes_trigger ON public.hoa_notifications;
CREATE TRIGGER prevent_notification_content_changes_trigger
  BEFORE UPDATE ON public.hoa_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_notification_content_changes();

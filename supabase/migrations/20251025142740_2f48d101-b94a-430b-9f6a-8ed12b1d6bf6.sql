-- Fix the create_default_email_preferences function to avoid ambiguous column reference
DROP FUNCTION IF EXISTS public.create_default_email_preferences(uuid);

CREATE OR REPLACE FUNCTION public.create_default_email_preferences(target_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, booking_confirmations boolean, booking_reminders boolean, cancellation_notifications boolean, admin_announcements boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_preferences public.email_preferences%ROWTYPE;
BEGIN
  -- Only allow users to create preferences for themselves
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Insert default preferences with explicit column names
  INSERT INTO public.email_preferences (
    user_id,
    booking_confirmations,
    booking_reminders,
    cancellation_notifications,
    admin_announcements
  ) VALUES (
    target_user_id,
    true,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    updated_at = now()
  RETURNING 
    email_preferences.id,
    email_preferences.user_id,
    email_preferences.booking_confirmations,
    email_preferences.booking_reminders,
    email_preferences.cancellation_notifications,
    email_preferences.admin_announcements,
    email_preferences.created_at,
    email_preferences.updated_at
  INTO new_preferences;

  RETURN QUERY
  SELECT 
    new_preferences.id,
    new_preferences.user_id,
    new_preferences.booking_confirmations,
    new_preferences.booking_reminders,
    new_preferences.cancellation_notifications,
    new_preferences.admin_announcements,
    new_preferences.created_at,
    new_preferences.updated_at;
END;
$function$;
-- Drop existing functions to update their return types
DROP FUNCTION IF EXISTS public.get_email_preferences(uuid);
DROP FUNCTION IF EXISTS public.create_default_email_preferences(uuid);

-- Add new email preference columns for lessons and matches
ALTER TABLE public.email_preferences 
ADD COLUMN IF NOT EXISTS lesson_confirmations boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS lesson_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS match_confirmations boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS match_reminders boolean DEFAULT true;

-- Recreate get_email_preferences function with new columns
CREATE FUNCTION public.get_email_preferences(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  booking_confirmations boolean,
  booking_reminders boolean,
  cancellation_notifications boolean,
  admin_announcements boolean,
  lesson_confirmations boolean,
  lesson_reminders boolean,
  match_confirmations boolean,
  match_reminders boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.id,
    ep.user_id,
    ep.booking_confirmations,
    ep.booking_reminders,
    ep.cancellation_notifications,
    ep.admin_announcements,
    ep.lesson_confirmations,
    ep.lesson_reminders,
    ep.match_confirmations,
    ep.match_reminders,
    ep.created_at,
    ep.updated_at
  FROM email_preferences ep
  WHERE ep.user_id = target_user_id;
END;
$$;

-- Recreate create_default_email_preferences function with new columns
CREATE FUNCTION public.create_default_email_preferences(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  booking_confirmations boolean,
  booking_reminders boolean,
  cancellation_notifications boolean,
  admin_announcements boolean,
  lesson_confirmations boolean,
  lesson_reminders boolean,
  match_confirmations boolean,
  match_reminders boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO email_preferences (user_id, booking_confirmations, booking_reminders, cancellation_notifications, admin_announcements, lesson_confirmations, lesson_reminders, match_confirmations, match_reminders)
  VALUES (target_user_id, true, true, true, true, true, true, true, true)
  RETURNING email_preferences.id INTO new_id;
  
  RETURN QUERY
  SELECT 
    ep.id,
    ep.user_id,
    ep.booking_confirmations,
    ep.booking_reminders,
    ep.cancellation_notifications,
    ep.admin_announcements,
    ep.lesson_confirmations,
    ep.lesson_reminders,
    ep.match_confirmations,
    ep.match_reminders,
    ep.created_at,
    ep.updated_at
  FROM email_preferences ep
  WHERE ep.id = new_id;
END;
$$;
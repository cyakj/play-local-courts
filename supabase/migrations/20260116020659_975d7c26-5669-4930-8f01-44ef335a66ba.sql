-- Add notification_preferences column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"match_requests": true, "lesson_updates": true, "community_announcements": true, "new_messages": true}'::jsonb;
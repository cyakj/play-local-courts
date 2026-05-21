-- Add new privacy columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hide_contact_until_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_activity_status boolean DEFAULT true;
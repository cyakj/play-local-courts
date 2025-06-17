
-- Add new columns to profiles table for tennis identity
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS home_court_id uuid REFERENCES public.courts(id),
ADD COLUMN IF NOT EXISTS utr_rating numeric(3,1),
ADD COLUMN IF NOT EXISTS wtn_rating numeric(4,1),
ADD COLUMN IF NOT EXISTS usta_ranking text;

-- Create match_preferences table
CREATE TABLE IF NOT EXISTS public.match_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  looking_to_play boolean NOT NULL DEFAULT false,
  match_types text[] NOT NULL DEFAULT '{}', -- ['singles', 'doubles', 'mixed_doubles']
  preferred_times text[] NOT NULL DEFAULT '{}', -- ['morning', 'afternoon', 'evening']
  preferred_days text[] NOT NULL DEFAULT '{}', -- ['monday', 'tuesday', etc.]
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on match_preferences
ALTER TABLE public.match_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for match_preferences
CREATE POLICY "Users can view their own match preferences"
  ON public.match_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match preferences"
  ON public.match_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own match preferences"
  ON public.match_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own match preferences"
  ON public.match_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policy to allow users to view other users' match preferences when they're looking to play
CREATE POLICY "Users can view others' active match preferences"
  ON public.match_preferences
  FOR SELECT
  USING (looking_to_play = true);

-- Create index for efficient matchmaking searches
CREATE INDEX IF NOT EXISTS idx_match_preferences_looking_to_play 
  ON public.match_preferences(looking_to_play) 
  WHERE looking_to_play = true;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_match_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER match_preferences_updated_at
  BEFORE UPDATE ON public.match_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_match_preferences_updated_at();

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

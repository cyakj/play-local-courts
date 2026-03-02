
-- Phase 1: Add columns to ladders table
ALTER TABLE public.ladders
  ADD COLUMN IF NOT EXISTS max_freeze_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS min_players_required integer,
  ADD COLUMN IF NOT EXISTS score_photo_required boolean DEFAULT false;

-- Add columns to ladder_teams table
ALTER TABLE public.ladder_teams
  ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS freeze_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS freeze_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS walkover_losses integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_strikes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_withdrawn boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

-- Add columns to ladder_matches table
ALTER TABLE public.ladder_matches
  ADD COLUMN IF NOT EXISTS is_retirement boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retired_by_team_id uuid REFERENCES public.ladder_teams(id),
  ADD COLUMN IF NOT EXISTS is_walkover boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_void boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_photo_url_team1 text,
  ADD COLUMN IF NOT EXISTS score_photo_url_team2 text,
  ADD COLUMN IF NOT EXISTS extension_requested_by uuid,
  ADD COLUMN IF NOT EXISTS extension_days integer,
  ADD COLUMN IF NOT EXISTS extension_reason text,
  ADD COLUMN IF NOT EXISTS extension_status text,
  ADD COLUMN IF NOT EXISTS original_deadline_date date;

-- Create competition_notifications table
CREATE TABLE IF NOT EXISTS public.competition_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id uuid NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on competition_notifications
ALTER TABLE public.competition_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own competition notifications
CREATE POLICY "Users can view own competition notifications"
  ON public.competition_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Users can update (mark read) their own notifications
CREATE POLICY "Users can update own competition notifications"
  ON public.competition_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS: Authenticated users can insert notifications (for system use)
CREATE POLICY "Authenticated users can insert competition notifications"
  ON public.competition_notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create score-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('score-photos', 'score-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Authenticated users can upload score photos
CREATE POLICY "Authenticated users can upload score photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'score-photos' AND auth.uid() IS NOT NULL);

-- Storage RLS: Anyone can view score photos (public bucket)
CREATE POLICY "Anyone can view score photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'score-photos');

-- Storage RLS: Users can update their own score photos
CREATE POLICY "Users can update own score photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'score-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

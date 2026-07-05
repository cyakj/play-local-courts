-- Safe non-destructive: add player profile fields to profiles table.
-- All columns nullable so existing rows are unaffected. No RLS changes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dominant_hand      TEXT,
  ADD COLUMN IF NOT EXISTS match_preference   TEXT,
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS preferred_play_times TEXT[];

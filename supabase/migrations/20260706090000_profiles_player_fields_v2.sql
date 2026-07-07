-- Safe non-destructive: add remaining player profile fields to profiles table.
-- All columns nullable so existing rows are unaffected. No RLS changes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS backhand         TEXT,
  ADD COLUMN IF NOT EXISTS playing_style    TEXT,
  ADD COLUMN IF NOT EXISTS favorite_surface TEXT,
  ADD COLUMN IF NOT EXISTS tennis_goals     TEXT[],
  ADD COLUMN IF NOT EXISTS years_playing    SMALLINT;

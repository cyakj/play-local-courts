-- Fix: Add DELETE policy for ladder admins to delete their ladders
CREATE POLICY "Ladder admins can delete their ladders"
ON public.ladders
FOR DELETE
USING (admin_id = auth.uid());

-- Allow coaches to create ladders (not just HOA admins)
DROP POLICY IF EXISTS "Admins can create ladders in their HOA" ON public.ladders;
CREATE POLICY "Admins and coaches can create ladders"
ON public.ladders
FOR INSERT
WITH CHECK (
  admin_id = auth.uid() AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM coaches WHERE user_id = auth.uid())
  )
);

-- Add new columns for enhanced ladder configuration
ALTER TABLE public.ladders
ADD COLUMN IF NOT EXISTS gender_restriction TEXT DEFAULT NULL CHECK (gender_restriction IN ('mens', 'womens', 'mixed', NULL)),
ADD COLUMN IF NOT EXISTS third_set_format TEXT DEFAULT 'super_tiebreak' CHECK (third_set_format IN ('super_tiebreak', 'full_set')),
ADD COLUMN IF NOT EXISTS scoring_mode TEXT DEFAULT 'cumulative' CHECK (scoring_mode IN ('cumulative', 'challenge')),
ADD COLUMN IF NOT EXISTS challenge_range INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS acceptance_window_hours INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS defense_period_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS play_by_deadline_days INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS participation_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loss_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS secondary_tiebreaker TEXT DEFAULT 'games_won' CHECK (secondary_tiebreaker IN ('head_to_head', 'games_won', 'sets_won', 'matches_played'));
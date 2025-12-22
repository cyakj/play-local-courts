-- Add RLS policy to allow coaches to view profiles of players who have left them reviews
CREATE POLICY "Coaches can view profiles of reviewers"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.coach_reviews
    WHERE coach_reviews.player_id = profiles.id
    AND coach_reviews.coach_id = auth.uid()
  )
);
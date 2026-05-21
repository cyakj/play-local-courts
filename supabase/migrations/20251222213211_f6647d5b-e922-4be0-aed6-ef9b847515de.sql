-- Allow coaches to view profiles of players who have requested lessons from them
CREATE POLICY "Coaches can view profiles of their lesson requesters"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM lesson_requests lr
    WHERE lr.player_id = profiles.id 
    AND lr.coach_id = auth.uid()
  )
);
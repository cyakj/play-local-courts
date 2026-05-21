-- Allow users to view profiles of coaches (users who have a coaches record)
-- This enables the "Find a Coach" feature to work across HOAs
CREATE POLICY "Anyone can view coach profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.coaches 
    WHERE coaches.user_id = profiles.id
  )
);
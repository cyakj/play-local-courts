-- Fix coaches table RLS policies to allow self-registration
DROP POLICY IF EXISTS "Coaches can view and edit their own profile" ON public.coaches;

-- Create separate policies for better control
CREATE POLICY "Coaches can insert their own profile"
ON public.coaches
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches can view their own profile"
ON public.coaches
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Coaches can update their own profile"
ON public.coaches
FOR UPDATE
USING (user_id = auth.uid());

-- Keep the existing public view policy
-- "Anyone can view coach profiles" already exists
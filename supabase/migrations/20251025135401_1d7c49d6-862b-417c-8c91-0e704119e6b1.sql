-- Allow users to insert their own profile during registration
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- The coaches table already has the correct policy for insert
-- But let's make sure it exists
DROP POLICY IF EXISTS "Coaches can insert their own profile" ON public.coaches;
CREATE POLICY "Coaches can insert their own profile"
ON public.coaches
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
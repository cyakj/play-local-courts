-- Fix infinite recursion by ensuring security definer functions bypass RLS properly
-- and simplify the profiles RLS to use a single user check for own profile

-- Drop problematic policies first
DROP POLICY IF EXISTS "Admins can view profiles in their HOA" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their HOA" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles of join request applicants" ON public.profiles;

-- Create a simple security definer function to check admin status without RLS
CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Create a simple security definer function to get user's HOA IDs
CREATE OR REPLACE FUNCTION public.get_user_hoa_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT hoa_id FROM public.hoa_memberships 
    WHERE user_id = _user_id AND status = 'approved'
  )
$$;

-- Now create cleaner profiles policies that don't cause recursion
-- Users can always view their own profile
CREATE POLICY "Users can view their own profile v2"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view profiles of anyone in their HOA
CREATE POLICY "Admins can view profiles in their HOA v2"
ON public.profiles
FOR SELECT
USING (
  user_is_admin() AND
  EXISTS (
    SELECT 1 FROM public.hoa_memberships hm
    WHERE hm.user_id = profiles.id
    AND hm.status = 'approved'
    AND hm.hoa_id = ANY(get_user_hoa_ids(auth.uid()))
  )
);

-- Regular users in same HOA can view each other
CREATE POLICY "Users can view profiles in same HOA v2"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships hm
    WHERE hm.user_id = profiles.id
    AND hm.status = 'approved'
    AND hm.hoa_id = ANY(get_user_hoa_ids(auth.uid()))
  )
);

-- Admins can view profiles of join request applicants
CREATE POLICY "Admins can view join request applicants v2"
ON public.profiles
FOR SELECT
USING (
  user_is_admin() AND
  EXISTS (
    SELECT 1 FROM public.community_join_requests cjr
    WHERE cjr.user_id = profiles.id
    AND cjr.status = 'pending'
    AND cjr.hoa_id = ANY(get_user_hoa_ids(auth.uid()))
  )
);

-- Drop old duplicative policy if exists
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
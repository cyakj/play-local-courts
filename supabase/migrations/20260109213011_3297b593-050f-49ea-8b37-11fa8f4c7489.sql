-- Drop the problematic self-referencing policies on hoa_memberships
DROP POLICY IF EXISTS "HOA admins can manage community memberships" ON public.hoa_memberships;
DROP POLICY IF EXISTS "HOA admins can view community memberships" ON public.hoa_memberships;
DROP POLICY IF EXISTS "Users can update their own memberships" ON public.hoa_memberships;

-- Create a SECURITY DEFINER function to check if user is admin of a specific HOA
-- This avoids infinite recursion by bypassing RLS
CREATE OR REPLACE FUNCTION public.is_hoa_admin(_user_id uuid, _hoa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = _user_id
    AND hoa_id = _hoa_id
    AND role = 'admin'
    AND status = 'approved'
  )
$$;

-- Recreate the admin policies using the security definer function
CREATE POLICY "HOA admins can view community memberships v2"
ON public.hoa_memberships
FOR SELECT
USING (
  is_hoa_admin(auth.uid(), hoa_id)
);

CREATE POLICY "HOA admins can manage community memberships v2"
ON public.hoa_memberships
FOR UPDATE
USING (
  is_hoa_admin(auth.uid(), hoa_id)
);

-- Recreate user update policy without the complex subquery that could cause issues
CREATE POLICY "Users can update their own memberships v2"
ON public.hoa_memberships
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
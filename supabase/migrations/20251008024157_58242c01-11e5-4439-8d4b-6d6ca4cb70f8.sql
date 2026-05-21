-- Fix infinite recursion in profiles RLS policies
-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view profiles in their HOA" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their HOA" ON public.profiles;

-- Create security definer functions to bypass RLS
CREATE OR REPLACE FUNCTION public.is_in_same_hoa(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p1, profiles p2
    WHERE p1.id = _user_id
      AND p2.id = _target_user_id
      AND p1.hoa_id = p2.hoa_id
      AND p1.hoa_status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_in_same_hoa(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p1, profiles p2
    WHERE p1.id = _user_id
      AND p2.id = _target_user_id
      AND p1.hoa_id = p2.hoa_id
      AND public.has_role(_user_id, 'admin'::app_role)
  )
$$;

-- Recreate the policies using the security definer functions
CREATE POLICY "Users can view profiles in their HOA"
ON public.profiles
FOR SELECT
USING (public.is_in_same_hoa(auth.uid(), id));

CREATE POLICY "Admins can view profiles in their HOA"
ON public.profiles
FOR SELECT
USING (public.is_admin_in_same_hoa(auth.uid(), id));
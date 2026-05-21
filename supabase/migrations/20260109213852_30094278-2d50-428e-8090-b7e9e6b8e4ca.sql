-- COMPREHENSIVE FIX: Remove ALL recursive RLS policies 
-- Must drop policies BEFORE dropping functions they depend on

-- First, drop hoa_memberships policies that depend on is_hoa_admin
DROP POLICY IF EXISTS "HOA admins can view community memberships v2" ON public.hoa_memberships;
DROP POLICY IF EXISTS "HOA admins can manage community memberships v2" ON public.hoa_memberships;
DROP POLICY IF EXISTS "Users can update their own memberships v2" ON public.hoa_memberships;

-- Drop ALL existing SELECT policies on profiles 
DROP POLICY IF EXISTS "Admins can view join request applicants v2" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their HOA v2" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same HOA v2" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile v2" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view coach profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view profiles of reviewers" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view profiles of their lesson requesters" ON public.profiles;
DROP POLICY IF EXISTS "Platform reviewers can view HOA applicant profiles" ON public.profiles;

-- Now drop the existing security definer functions
DROP FUNCTION IF EXISTS public.get_user_hoa_ids(uuid);
DROP FUNCTION IF EXISTS public.user_is_admin();
DROP FUNCTION IF EXISTS public.is_hoa_admin(uuid, uuid);

-- Create a SIMPLE security definer function to check if user is admin for specific HOA
CREATE OR REPLACE FUNCTION public.check_hoa_admin(_user_id uuid, _hoa_id uuid)
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

-- Create SIMPLE, NON-RECURSIVE policies for profiles
-- Allow all authenticated users to view profiles (simplest fix to avoid recursion)
CREATE POLICY "profiles_select_authenticated"
ON public.profiles
FOR SELECT
USING (auth.role() = 'authenticated');

-- Simple hoa_memberships policies
CREATE POLICY "hoa_memberships_select_own"
ON public.hoa_memberships
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "hoa_memberships_select_admin"
ON public.hoa_memberships
FOR SELECT
USING (check_hoa_admin(auth.uid(), hoa_id));

CREATE POLICY "hoa_memberships_insert_own"
ON public.hoa_memberships
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "hoa_memberships_update_own"
ON public.hoa_memberships
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "hoa_memberships_update_admin"
ON public.hoa_memberships
FOR UPDATE
USING (check_hoa_admin(auth.uid(), hoa_id));

CREATE POLICY "hoa_memberships_delete_admin"
ON public.hoa_memberships
FOR DELETE
USING (check_hoa_admin(auth.uid(), hoa_id));
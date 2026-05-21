-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can view profiles of join request applicants" ON public.profiles;

-- Create a security definer function to get a user's HOA ID without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_hoa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hoa_id FROM public.profiles WHERE id = _user_id
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Admins can view profiles of join request applicants"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM community_join_requests cjr
    WHERE cjr.user_id = profiles.id
    AND cjr.hoa_id = get_user_hoa_id(auth.uid())
    AND cjr.status = 'pending'
  )
);
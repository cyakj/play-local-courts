-- Fix infinite recursion in profiles SELECT policies by removing self-references to profiles

-- 1) Rewrite helper functions to use hoa_memberships instead of profiles
CREATE OR REPLACE FUNCTION public.is_in_same_hoa(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hoa_memberships hm1
    JOIN public.hoa_memberships hm2
      ON hm2.hoa_id = hm1.hoa_id
    WHERE hm1.user_id = _user_id
      AND hm2.user_id = _target_user_id
      AND hm1.status = 'approved'
      AND hm2.status = 'approved'
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
    FROM public.hoa_memberships hm_admin
    JOIN public.hoa_memberships hm_target
      ON hm_target.hoa_id = hm_admin.hoa_id
    WHERE hm_admin.user_id = _user_id
      AND hm_admin.role = 'admin'
      AND hm_admin.status = 'approved'
      AND hm_target.user_id = _target_user_id
  )
$$;

-- 2) Replace join-request applicant policy to avoid profiles lookup
DROP POLICY IF EXISTS "Admins can view profiles of join request applicants" ON public.profiles;

CREATE POLICY "Admins can view profiles of join request applicants"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.community_join_requests cjr
    JOIN public.hoa_memberships hm_admin
      ON hm_admin.hoa_id = cjr.hoa_id
    WHERE hm_admin.user_id = auth.uid()
      AND hm_admin.role = 'admin'
      AND hm_admin.status = 'approved'
      AND cjr.user_id = profiles.id
      AND cjr.status = 'pending'
  )
);

-- 3) Remove no-longer-needed function (was indirectly referenced by the previous policy)
DROP FUNCTION IF EXISTS public.get_user_hoa_id(uuid);

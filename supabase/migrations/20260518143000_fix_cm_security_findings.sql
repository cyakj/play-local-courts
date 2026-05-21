-- Fix unread badge security follow-up findings

-- 1) Prevent self-granting admin memberships
DROP POLICY IF EXISTS "hoa_memberships_insert_own" ON public.hoa_memberships;
CREATE POLICY "hoa_memberships_insert_own_pending_resident_only"
ON public.hoa_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'resident'
  AND status = 'pending'
);

-- 2) Restrict public HOA reads and expose only safe fields via helper view
DROP POLICY IF EXISTS "Anyone can read hoa by invite_code" ON public.hoas;
DROP POLICY IF EXISTS "Public can read hoas" ON public.hoas;
DROP POLICY IF EXISTS "Anyone can read hoas" ON public.hoas;
DROP POLICY IF EXISTS "Authenticated users can read hoas" ON public.hoas;

CREATE POLICY "Approved members can read full hoa details"
ON public.hoas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.hoa_memberships hm
    WHERE hm.hoa_id = hoas.id
      AND hm.user_id = auth.uid()
      AND hm.status = 'approved'
  )
);

CREATE OR REPLACE VIEW public.public_hoa_directory AS
SELECT id, name
FROM public.hoas;

GRANT SELECT ON public.public_hoa_directory TO anon, authenticated;

-- 3) Prevent self-assigning maintenance_worker role
DROP POLICY IF EXISTS "Users can insert own maintenance_worker role" ON public.user_roles;

CREATE POLICY "Only admins can assign user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

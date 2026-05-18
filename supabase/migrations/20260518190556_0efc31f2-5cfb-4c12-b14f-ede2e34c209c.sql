DROP POLICY IF EXISTS "hoa_memberships_insert_own" ON public.hoa_memberships;
DROP POLICY IF EXISTS "hoa_memberships_insert_own_pending_resident_only" ON public.hoa_memberships;
CREATE POLICY "hoa_memberships_insert_own_pending_resident_only"
ON public.hoa_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'resident'
  AND status = 'pending'
);

DROP POLICY IF EXISTS "Anyone can view community names for search" ON public.hoas;
DROP POLICY IF EXISTS "Anyone can read hoa by invite_code" ON public.hoas;
DROP POLICY IF EXISTS "Approved members can read full hoa details" ON public.hoas;
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
SELECT id, name, community_type
FROM public.hoas;

GRANT SELECT ON public.public_hoa_directory TO anon;
GRANT SELECT ON public.public_hoa_directory TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_hoa_invite_by_code(_invite_code text)
RETURNS TABLE (
  id uuid,
  name text,
  invite_enabled boolean,
  invite_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.name, h.invite_enabled, h.invite_expires_at
  FROM public.hoas h
  WHERE h.invite_code = _invite_code
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_hoa_invite_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_hoa_invite_by_code(text) TO authenticated;

DROP POLICY IF EXISTS "Users can insert own maintenance_worker role" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can assign user roles" ON public.user_roles;
CREATE POLICY "Only admins can assign user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);
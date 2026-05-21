-- Robust ladder creation guard to prevent false RLS denials for valid HOA admins/coaches
CREATE OR REPLACE FUNCTION public.can_create_ladder(_admin_id uuid, _hoa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND _admin_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.coaches c
        WHERE c.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.hoa_memberships hm
        WHERE hm.user_id = auth.uid()
          AND hm.role = 'admin'
          AND hm.status = 'approved'
          AND (_hoa_id IS NULL OR hm.hoa_id = _hoa_id)
      )
    );
$$;

DROP POLICY IF EXISTS "Admins and coaches can create ladders" ON public.ladders;

CREATE POLICY "Admins and coaches can create ladders"
ON public.ladders
FOR INSERT
TO authenticated
WITH CHECK (public.can_create_ladder(admin_id, hoa_id));
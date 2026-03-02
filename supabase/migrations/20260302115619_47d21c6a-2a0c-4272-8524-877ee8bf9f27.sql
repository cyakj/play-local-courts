DROP POLICY IF EXISTS "Admins and coaches can create ladders" ON public.ladders;

CREATE POLICY "Admins and coaches can create ladders"
ON public.ladders
FOR INSERT
TO authenticated
WITH CHECK (
  admin_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coach'::app_role)
    OR EXISTS (SELECT 1 FROM coaches WHERE coaches.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM hoa_memberships
      WHERE hoa_memberships.user_id = auth.uid()
        AND hoa_memberships.role = 'admin'
        AND hoa_memberships.status = 'approved'
    )
  )
);
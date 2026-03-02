-- Drop and recreate with a simple inline check - no function indirection
DROP POLICY IF EXISTS "Admins and coaches can create ladders" ON public.ladders;

CREATE POLICY "Admins and coaches can create ladders"
ON public.ladders
FOR INSERT
TO authenticated
WITH CHECK (
  admin_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.coaches WHERE user_id = auth.uid())
  )
);

-- Also fix SELECT/UPDATE/DELETE to be scoped to authenticated
DROP POLICY IF EXISTS "Users can view accessible ladders" ON public.ladders;
CREATE POLICY "Users can view accessible ladders"
ON public.ladders FOR SELECT TO authenticated
USING (public.can_view_ladder(id));

DROP POLICY IF EXISTS "Ladder admins can update their ladders" ON public.ladders;
CREATE POLICY "Ladder admins can update their ladders"
ON public.ladders FOR UPDATE TO authenticated
USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Ladder admins can delete their ladders" ON public.ladders;
CREATE POLICY "Ladder admins can delete their ladders"
ON public.ladders FOR DELETE TO authenticated
USING (admin_id = auth.uid());
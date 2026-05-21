CREATE POLICY "Members can view profiles in same HOA"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.is_in_same_hoa(auth.uid(), id)
  OR public.is_admin_in_same_hoa(auth.uid(), id)
);
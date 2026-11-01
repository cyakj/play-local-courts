-- Rollback of 20261031120000_profiles_member_read_gap.sql: restores the broad same-HOA read (the privacy gap) and removes the directory function.
-- Only use it if a screen that needs co-member rows breaks and cannot wait for a fix. NOT APPLIED anywhere.
DROP POLICY IF EXISTS "Admins can view profiles in their community" ON public.profiles;
DROP POLICY IF EXISTS "Members can view profiles in same HOA" ON public.profiles;
CREATE POLICY "Members can view profiles in same HOA"
  ON public.profiles FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR public.is_in_same_hoa(auth.uid(), id) OR public.is_admin_in_same_hoa(auth.uid(), id));
DROP FUNCTION IF EXISTS public.community_member_names(uuid[]);

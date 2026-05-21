-- Fix courts RLS to use hoa_memberships instead of legacy profiles.hoa_id

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view courts in their HOA" ON public.courts;
DROP POLICY IF EXISTS "Admins can manage courts in their HOA" ON public.courts;

-- Create new policy that checks hoa_memberships for approved members
CREATE POLICY "Users can view courts in their HOA v2" 
ON public.courts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE hoa_memberships.user_id = auth.uid()
      AND hoa_memberships.hoa_id = courts.hoa_id
      AND hoa_memberships.status = 'approved'
  )
);

-- Create admin policy using the check_hoa_admin function
CREATE POLICY "Admins can manage courts in their HOA v2" 
ON public.courts 
FOR ALL 
USING (check_hoa_admin(auth.uid(), hoa_id))
WITH CHECK (check_hoa_admin(auth.uid(), hoa_id));
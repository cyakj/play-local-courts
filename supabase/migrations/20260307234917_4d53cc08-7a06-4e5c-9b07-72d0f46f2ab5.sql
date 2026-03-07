-- Allow HOA admins (via hoa_memberships) to manage amenity rules
DROP POLICY IF EXISTS "HOA admins can manage their amenity rules" ON public.amenity_rules;

CREATE POLICY "HOA admins can manage amenity rules"
ON public.amenity_rules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE hoa_memberships.user_id = auth.uid()
    AND hoa_memberships.hoa_id = amenity_rules.hoa_id
    AND hoa_memberships.role = 'admin'
    AND hoa_memberships.status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE hoa_memberships.user_id = auth.uid()
    AND hoa_memberships.hoa_id = amenity_rules.hoa_id
    AND hoa_memberships.role = 'admin'
    AND hoa_memberships.status = 'approved'
  )
);

-- Also update the read policy to use memberships
DROP POLICY IF EXISTS "Residents can view their HOA amenity rules" ON public.amenity_rules;

CREATE POLICY "Members can view their HOA amenity rules"
ON public.amenity_rules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE hoa_memberships.user_id = auth.uid()
    AND hoa_memberships.hoa_id = amenity_rules.hoa_id
    AND hoa_memberships.status = 'approved'
  )
);
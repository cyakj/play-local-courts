-- Rollback for 20261106130000_amenity_rules_hoa_integrity.sql. Restores the original (weaker) policy and drops the composite key.
-- WARNING: this re-opens the cross-community rules-injection defect that the migration closes. Use only if the migration itself blocks
-- an urgent fix, and re-apply it afterwards.
DROP POLICY IF EXISTS "HOA admins can manage amenity rules" ON public.amenity_rules;
CREATE POLICY "HOA admins can manage amenity rules" ON public.amenity_rules FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_memberships
          WHERE hoa_memberships.user_id = auth.uid() AND hoa_memberships.hoa_id = amenity_rules.hoa_id
            AND hoa_memberships.role = 'admin' AND hoa_memberships.status = 'approved')
);
ALTER TABLE public.amenity_rules DROP CONSTRAINT IF EXISTS amenity_rules_amenity_hoa_fkey;
ALTER TABLE public.courts DROP CONSTRAINT IF EXISTS courts_id_hoa_id_key;

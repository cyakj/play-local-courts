-- Amenity rules must belong to the SAME community as their amenity.   NOT APPLIED to hosted (TENISX REAL).
--
-- DEFECT (reproduced on a restore of the 2026-11-06 backup): the policy "HOA admins can manage amenity rules" checked only that the
-- caller administers amenity_rules.hoa_id, never that amenity_rules.amenity_id is an amenity OF that community. An administrator of
-- community X could therefore INSERT a rules row (hoa_id = X, amenity_id = <an amenity of community Y>). Booking enforcement
-- (enforce_amenity_booking_rules) reads rules by amenity_id alone, so such a row could weaken Y's limits (duration, per-day count,
-- approval, opening hours) or make them ambiguous. UNIQUE (hoa_id, amenity_id) does not prevent it.
--
-- FIX (two layers):
--   1. the policy is recreated so the amenity must belong to amenity_rules.hoa_id (USING and WITH CHECK);
--   2. a composite foreign key (amenity_id, hoa_id) -> courts (id, hoa_id) makes a mismatched row impossible for ANY role, including
--      the service role and SQL editor.
-- PRE-FLIGHT: the migration ABORTS (changing nothing) if any existing row already mismatches; on the 2026-11-06 backup there are 0.
-- Existing rows and data are untouched. Depends on: public.amenity_rules, public.courts, public.hoa_memberships.

DO $$
DECLARE
  bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM public.amenity_rules r JOIN public.courts c ON c.id = r.amenity_id
  WHERE c.hoa_id <> r.hoa_id;
  IF bad > 0 THEN
    RAISE EXCEPTION 'amenity_rules_hoa_integrity: % existing amenity_rules row(s) belong to a different community than their amenity; fix or delete them first', bad;
  END IF;
END $$;

-- courts(id) is already the primary key; the pair is trivially unique and is what the composite key references.
-- (re-runnable: the dependent foreign key is dropped before the unique constraint it references)
ALTER TABLE public.amenity_rules DROP CONSTRAINT IF EXISTS amenity_rules_amenity_hoa_fkey;
ALTER TABLE public.courts DROP CONSTRAINT IF EXISTS courts_id_hoa_id_key;
ALTER TABLE public.courts ADD CONSTRAINT courts_id_hoa_id_key UNIQUE (id, hoa_id);

ALTER TABLE public.amenity_rules
  ADD CONSTRAINT amenity_rules_amenity_hoa_fkey FOREIGN KEY (amenity_id, hoa_id) REFERENCES public.courts (id, hoa_id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "HOA admins can manage amenity rules" ON public.amenity_rules;
CREATE POLICY "HOA admins can manage amenity rules" ON public.amenity_rules FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hoa_memberships m
            WHERE m.user_id = auth.uid() AND m.hoa_id = amenity_rules.hoa_id AND m.role = 'admin' AND m.status = 'approved')
    AND EXISTS (SELECT 1 FROM public.courts c WHERE c.id = amenity_rules.amenity_id AND c.hoa_id = amenity_rules.hoa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hoa_memberships m
            WHERE m.user_id = auth.uid() AND m.hoa_id = amenity_rules.hoa_id AND m.role = 'admin' AND m.status = 'approved')
    AND EXISTS (SELECT 1 FROM public.courts c WHERE c.id = amenity_rules.amenity_id AND c.hoa_id = amenity_rules.hoa_id)
  );

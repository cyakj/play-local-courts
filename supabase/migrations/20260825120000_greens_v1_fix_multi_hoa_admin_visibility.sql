-- Greens V1 functional audit fix: admin visibility broke for any admin who
-- manages more than one HOA (e.g. a Condo Manager, or a board member serving
-- two communities).
--
-- Root cause: the admin-scoped SELECT policy on public.bookings and
-- public.maintenance_reports (and the admin UPDATE policy on
-- public.bookings) gated on `has_role(auth.uid(), 'admin') AND
-- profiles.hoa_id = <row's hoa>`. profiles.hoa_id is a single value, so an
-- admin approved (via hoa_memberships) for a *second* HOA silently saw zero
-- rows for that HOA's reservation calendar / maintenance reports — no
-- error, just an empty list.
--
-- public.courts and public.amenity_rules were already fixed for this same
-- class of bug via public.check_hoa_admin(user_id, hoa_id), which checks
-- hoa_memberships (role='admin', status='approved') per-HOA instead of a
-- single profile column. This migration brings bookings/maintenance_reports
-- admin policies in line with that same, already-trusted function.
--
-- Verified before applying: user f6eec1c1-fa0e-4806-b0fb-c61480870a95 is an
-- approved admin (hoa_memberships) of both cb6a0752-... and f222b3de-...,
-- but profiles.hoa_id only ever equals one of them — so has_role() AND
-- profiles.hoa_id check failed for the second HOA even though
-- check_hoa_admin() correctly returns true.

DROP POLICY IF EXISTS "Admins can view all bookings in their HOA" ON public.bookings;
CREATE POLICY "Admins can view all bookings in their HOA"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = bookings.court_id
        AND public.check_hoa_admin(auth.uid(), c.hoa_id)
    )
  );

DROP POLICY IF EXISTS "Admins can update bookings in their HOA" ON public.bookings;
CREATE POLICY "Admins can update bookings in their HOA"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = bookings.court_id
        AND public.check_hoa_admin(auth.uid(), c.hoa_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courts c
      WHERE c.id = bookings.court_id
        AND public.check_hoa_admin(auth.uid(), c.hoa_id)
    )
  );

DROP POLICY IF EXISTS "HOA admins can view all reports for their HOA" ON public.maintenance_reports;
CREATE POLICY "HOA admins can view all reports for their HOA"
  ON public.maintenance_reports
  FOR SELECT
  TO authenticated
  USING (public.check_hoa_admin(auth.uid(), maintenance_reports.hoa_id));

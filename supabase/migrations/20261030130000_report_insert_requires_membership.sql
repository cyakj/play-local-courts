-- PROPOSED - NOT APPLIED, NOT YET REHEARSED against a restore of the real backup (do that before applying, like the
-- other pending migrations: take a fresh backup, rehearse, get explicit approval).
--
-- Gap found by Codex inspection of the Resident sprint: the only INSERT policy on public.maintenance_reports is
--   "Users can create their own reports"  WITH CHECK (auth.uid() = reporter_id)
-- (migration 20250813002534). It never looks at hoa_id or amenity_id, so any signed-in user can file a report against
-- ANY community (or attach another community's amenity) by calling the API directly, even though the app only offers
-- the active community. The client now scopes everything correctly; this makes the database agree.
--
-- NOT COVERED YET (found by the follow-up inspection): the SECURITY DEFINER function create_maintenance_report()
-- (migration 20260318132108) inserts as its owner, so it bypasses this policy and accepts an amenity id without checking
-- its community. The app does not call it, but it is executable by authenticated users: review/replace it (or revoke
-- EXECUTE) in the same rehearsed migration before relying on this policy.
--
-- New rule: the reporter must be an APPROVED member of the report's community, and an amenity (if given) must belong
-- to that same community. Only the resident Report screen inserts into this table (verified by grep), so no other
-- writer is affected.
DROP POLICY IF EXISTS "Users can create their own reports" ON public.maintenance_reports;

CREATE POLICY "Users can create their own reports"
  ON public.maintenance_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND EXISTS (
      SELECT 1 FROM public.hoa_memberships m
      WHERE m.user_id = auth.uid()
        AND m.hoa_id = maintenance_reports.hoa_id
        AND m.status = 'approved'
    )
    AND (
      maintenance_reports.amenity_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.courts c
        WHERE c.id = maintenance_reports.amenity_id
          AND c.hoa_id = maintenance_reports.hoa_id
      )
    )
  );

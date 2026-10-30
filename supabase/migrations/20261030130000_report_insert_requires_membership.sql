-- PROPOSED - NOT APPLIED; rehearsed only on a scratch copy (see the rehearsal notes), NOT yet on a restore of the real backup (do that before applying, like the
-- other pending migrations: take a fresh backup, rehearse, get explicit approval).
--
-- Gap found by Codex inspection of the Resident sprint: the only INSERT policy on public.maintenance_reports is
--   "Users can create their own reports"  WITH CHECK (auth.uid() = reporter_id)
-- (migration 20250813002534). It never looks at hoa_id or amenity_id, so any signed-in user can file a report against
-- ANY community (or attach another community's amenity) by calling the API directly, even though the app only offers
-- the active community. The client now scopes everything correctly; this makes the database agree.
--
-- The SECURITY DEFINER function create_maintenance_report() (migration 20260318132108) inserts as its owner, so it bypasses
-- the policy above. Codex found three gaps in it, all fixed below by replacing it (same signature, same grant): it accepted an
-- amenity from another community, it also authorised anyone whose profiles.hoa_id matched even without an approved
-- membership, and it let the caller choose the initial status. The Expo resident Report screen inserts directly; the legacy
-- MultiStepReportDialog still calls the function, so it is replaced, not revoked.
--
-- New rule: the reporter must be an APPROVED member of the report's community (a hoa_memberships row; the legacy
-- profiles.hoa_id fallback is intentionally NOT honoured), an amenity (if given) must belong to that same community, and a
-- resident can only file a report as 'open' (also true of the RPC). Only the resident Report screen inserts into this
-- table (verified by grep), so no other writer is affected.
--
-- Pre-flight: the app still recognises a legacy "profiles.hoa_id + hoa_status = approved" resident who has no approved
-- membership row. Such a person would lose the ability to report, so stop loudly instead of locking anyone out; back-fill
-- their membership (reviewed, as its own migration) and re-run. The 2026-10-29 backup restore has none.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.profiles p
   WHERE p.hoa_id IS NOT NULL AND p.hoa_status = 'approved'
     AND NOT EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = p.id AND m.hoa_id = p.hoa_id AND m.status = 'approved');
  IF n > 0 THEN
    RAISE EXCEPTION '% approved profile-only resident(s) have no approved hoa_memberships row; back-fill memberships before applying', n;
  END IF;
END
$$;

DROP POLICY IF EXISTS "Users can create their own reports" ON public.maintenance_reports;

CREATE POLICY "Users can create their own reports"
  ON public.maintenance_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND maintenance_reports.status = 'open'
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


-- Same signature as 20260318132108, so existing callers keep working. _status is accepted for compatibility but ignored:
-- every new report starts 'open'.
CREATE OR REPLACE FUNCTION public.create_maintenance_report(
  _hoa_id uuid,
  _category text,
  _description text,
  _photo_url text DEFAULT NULL,
  _report_type text DEFAULT 'amenity',
  _amenity_id uuid DEFAULT NULL,
  _location_text text DEFAULT NULL,
  _status text DEFAULT 'open'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to submit a report';
  END IF;
  IF _hoa_id IS NULL THEN
    RAISE EXCEPTION 'A community is required to submit a report';
  END IF;
  IF COALESCE(trim(_category), '') = '' THEN
    RAISE EXCEPTION 'A category is required to submit a report';
  END IF;
  IF COALESCE(trim(_description), '') = '' THEN
    RAISE EXCEPTION 'A description is required to submit a report';
  END IF;
  IF _report_type NOT IN ('amenity', 'location') THEN
    RAISE EXCEPTION 'Invalid report type';
  END IF;
  IF _report_type = 'amenity' AND _amenity_id IS NULL THEN
    RAISE EXCEPTION 'Amenity reports must include an amenity';
  END IF;
  IF _report_type = 'location' AND COALESCE(trim(_location_text), '') = '' THEN
    RAISE EXCEPTION 'Location reports must include a location';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships hm
    WHERE hm.user_id = _user_id AND hm.hoa_id = _hoa_id AND hm.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'You do not have access to submit a report for this community';
  END IF;

  IF _report_type = 'amenity' AND NOT EXISTS (
    SELECT 1 FROM public.courts c WHERE c.id = _amenity_id AND c.hoa_id = _hoa_id
  ) THEN
    RAISE EXCEPTION 'That amenity does not belong to this community';
  END IF;

  INSERT INTO public.maintenance_reports (
    hoa_id, amenity_id, reporter_id, category, description, photo_url, status, report_type, location_text
  )
  VALUES (
    _hoa_id,
    CASE WHEN _report_type = 'amenity' THEN _amenity_id ELSE NULL END,
    _user_id, _category, _description, _photo_url, 'open', _report_type,
    CASE WHEN _report_type = 'location' THEN _location_text ELSE NULL END
  )
  RETURNING id INTO _report_id;

  RETURN _report_id;
END;
$$;

-- CREATE OR REPLACE keeps existing grants; restate them so the end state does not depend on history (anon stays revoked by 20261023140000).
REVOKE ALL ON FUNCTION public.create_maintenance_report(uuid, text, text, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_maintenance_report(uuid, text, text, text, text, uuid, text, text) TO authenticated;

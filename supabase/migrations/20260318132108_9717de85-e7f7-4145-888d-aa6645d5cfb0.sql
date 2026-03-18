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
    SELECT 1
    FROM public.hoa_memberships hm
    WHERE hm.user_id = _user_id
      AND hm.hoa_id = _hoa_id
      AND hm.status = 'approved'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.hoa_id = _hoa_id
  ) THEN
    RAISE EXCEPTION 'You do not have access to submit a report for this community';
  END IF;

  INSERT INTO public.maintenance_reports (
    hoa_id,
    amenity_id,
    reporter_id,
    category,
    description,
    photo_url,
    status,
    report_type,
    location_text
  )
  VALUES (
    _hoa_id,
    CASE WHEN _report_type = 'amenity' THEN _amenity_id ELSE NULL END,
    _user_id,
    _category,
    _description,
    _photo_url,
    COALESCE(_status, 'open'),
    _report_type,
    CASE WHEN _report_type = 'location' THEN _location_text ELSE NULL END
  )
  RETURNING id INTO _report_id;

  RETURN _report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_maintenance_report(uuid, text, text, text, text, uuid, text, text) TO authenticated;
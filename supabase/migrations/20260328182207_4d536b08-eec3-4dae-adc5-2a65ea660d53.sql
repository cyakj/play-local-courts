CREATE OR REPLACE FUNCTION public.get_public_survey_results(_survey_id uuid)
RETURNS TABLE (answers jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hoa_id uuid;
  _status text;
  _results_visibility text;
  _results_reveal text;
  _is_member boolean;
BEGIN
  SELECT hoa_id, status, results_visibility, results_reveal
  INTO _hoa_id, _status, _results_visibility, _results_reveal
  FROM public.hoa_surveys
  WHERE id = _survey_id;

  IF _hoa_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.hoa_memberships
    WHERE user_id = auth.uid()
      AND hoa_id = _hoa_id
      AND status = 'approved'
  ) INTO _is_member;

  IF NOT _is_member THEN
    RETURN;
  END IF;

  IF _results_visibility <> 'community' THEN
    RETURN;
  END IF;

  IF _status <> 'closed' AND _results_reveal <> 'on_submit' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.answers
  FROM public.hoa_survey_responses r
  WHERE r.survey_id = _survey_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_survey_member_count(_survey_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hoa_id uuid;
  _is_member boolean;
  _count integer;
BEGIN
  SELECT hoa_id
  INTO _hoa_id
  FROM public.hoa_surveys
  WHERE id = _survey_id;

  IF _hoa_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.hoa_memberships
    WHERE user_id = auth.uid()
      AND hoa_id = _hoa_id
      AND status = 'approved'
  ) INTO _is_member;

  IF NOT _is_member THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::integer
  INTO _count
  FROM public.hoa_memberships
  WHERE hoa_id = _hoa_id
    AND status = 'approved';

  RETURN COALESCE(_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_survey_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_survey_member_count(uuid) TO authenticated;
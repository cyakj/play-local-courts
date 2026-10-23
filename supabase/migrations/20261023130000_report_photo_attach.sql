-- Let a resident attach the photo to THEIR OWN new maintenance report. NOT APPLIED: the user applies after review.
--
-- Problem: maintenance_reports has UPDATE policies only for community admins and assigned workers
-- (20260328171248, 20260306032502). The native report screen inserts the report, uploads the photo, then does
-- UPDATE maintenance_reports SET photo_url = ... as the reporter. RLS filters that row out: zero rows, no error,
-- so the photo was uploaded but never attached to the report.
--
-- Fix: a narrow SECURITY DEFINER function. The client sends only the storage OBJECT PATH, never a URL, so it
-- cannot make a report point at an external host. The function requires that the object really exists in this
-- project's report-photos bucket inside the caller's own folder, and builds the public URL itself from the
-- API gateway's Host header (the gateway, not the caller, decides the project origin). Only the reporter can
-- attach, and only while the report has no photo yet. No broader UPDATE policy is added.

CREATE OR REPLACE FUNCTION public.attach_report_photo(p_report_id uuid, p_object_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated integer;
  api_host text;
  api_scheme text;
  public_url text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- '<own uid>/<file>' with a conservative character set; no traversal, no nested folders.
  IF p_object_path IS NULL
     OR length(p_object_path) > 200
     OR p_object_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
     OR p_object_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid photo location' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'report-photos' AND name = p_object_path
  ) THEN
    RAISE EXCEPTION 'Photo not found' USING ERRCODE = '22023';
  END IF;

  api_host := NULLIF(btrim(COALESCE(NULLIF(current_setting('request.headers', true), '')::json ->> 'host', '')), '');
  IF api_host IS NULL OR api_host !~ '^[A-Za-z0-9.-]+(:[0-9]+)?$' THEN
    RAISE EXCEPTION 'Photo can only be attached through the API' USING ERRCODE = '22023';
  END IF;
  -- The gateway terminates TLS and forwards the original scheme; hosted projects are always https. A local HTTP
  -- Supabase stack reports http, so the stored URL stays loadable in development too.
  api_scheme := lower(COALESCE(NULLIF(current_setting('request.headers', true), '')::json ->> 'x-forwarded-proto', 'https'));
  IF api_scheme NOT IN ('http', 'https') THEN
    api_scheme := 'https';
  END IF;
  public_url := api_scheme || '://' || api_host || '/storage/v1/object/public/report-photos/' || p_object_path;

  UPDATE public.maintenance_reports
  SET photo_url = public_url
  WHERE id = p_report_id
    AND reporter_id = auth.uid()
    AND photo_url IS NULL;
  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN updated > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.attach_report_photo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_report_photo(uuid, text) TO authenticated;

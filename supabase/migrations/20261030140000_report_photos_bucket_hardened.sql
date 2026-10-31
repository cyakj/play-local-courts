-- PROPOSED - NOT APPLIED. Rehearsed on a scratch copy of the 2026-10-29 backup restore only.
--
-- Replaces 20260529120441_report_photos_bucket.sql, which must NOT be applied: it let any signed-in user upload into ANY
-- folder (WITH CHECK only required a login) and added a SELECT policy that lets anyone LIST the bucket.
--
-- 'report-photos' does not exist on TENISX REAL. The app (src/app/report.tsx) uploads '<uid>/<reportId>.jpg', and
-- attach_report_photo() (20261023130000) stores the PUBLIC object URL on the report, which report-detail renders directly. So
-- the bucket stays public-READ BY URL (unchanged contract); everything else is locked down:
--   * upload / replace / delete only inside the caller's own folder (first path segment = auth.uid())
--   * 5 MB limit, JPEG / PNG / WebP only (the client sniffs magic bytes too)
--   * no policy lets anon or other users list or read objects through the API; only the public URL (which needs the
--     unguessable user id + report id) serves a file. The owner can read their own folder (needed for upsert).
-- Trade-off decided by the product owner: a PRIVATE bucket with signed URLs would be stricter but changes
-- attach_report_photo, report-detail and the admin report screens. Not done here.
--
-- Same loud-failure convention as the profile-photos bucket: if a 'report-photos' bucket already exists with different
-- settings we stop instead of silently keeping (or overwriting) it.
DO $$
DECLARE
  existing record;
BEGIN
  SELECT * INTO existing FROM storage.buckets WHERE id = 'report-photos';
  IF FOUND THEN
    IF existing.public IS DISTINCT FROM true
       OR existing.file_size_limit IS DISTINCT FROM 5242880
       OR existing.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg', 'image/png', 'image/webp'] THEN
      RAISE EXCEPTION 'storage bucket report-photos already exists with different settings (public=%, limit=%, mime=%); review before applying',
        existing.public, existing.file_size_limit, existing.allowed_mime_types;
    END IF;
  ELSE
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('report-photos', 'report-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);
  END IF;
END
$$;

DROP POLICY IF EXISTS "Owners can read their report photos" ON storage.objects;
CREATE POLICY "Owners can read their report photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners can upload their report photos" ON storage.objects;
CREATE POLICY "Owners can upload their report photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners can replace their report photos" ON storage.objects;
CREATE POLICY "Owners can replace their report photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners can delete their report photos" ON storage.objects;
CREATE POLICY "Owners can delete their report photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- V1-005: resident profile photos in a PRIVATE bucket.
--
-- NOT APPLIED to hosted (TENISX REAL). The existing 'avatars' bucket is public-read
-- (migration 20250617122237) and is used by Stage 2 tennis features via getPublicUrl, so it cannot be flipped to
-- private without breaking them. Profile photos therefore get their own bucket:
--   * private (no public URL; the app renders short-lived signed URLs)
--   * every policy is owner-only: the first folder of the object name must equal the caller's uid
--   * 5 MB limit, JPEG / PNG / WebP only (the client also sniffs magic bytes)
-- The private object path lives in a NEW column, profiles.avatar_path ('<uid>/avatar-<ms>.<ext>'). profiles.avatar_url is
-- left untouched: Stage 2 screens (coach students, add-players) read it as a renderable URL, and a relative object path
-- there would break them. The existing profiles UPDATE policy for the row owner already covers writing the column.
--
-- Same loud-failure convention as the other bucket migrations: if a 'profile-photos' bucket already exists with
-- different settings we stop instead of silently keeping (or overwriting) it.
DO $$
DECLARE
  existing record;
BEGIN
  SELECT * INTO existing FROM storage.buckets WHERE id = 'profile-photos';
  IF FOUND THEN
    IF existing.public IS DISTINCT FROM false
       OR existing.file_size_limit IS DISTINCT FROM 5242880
       OR existing.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg', 'image/png', 'image/webp'] THEN
      RAISE EXCEPTION 'storage bucket profile-photos already exists with different settings (public=%, limit=%, mime=%); review before applying',
        existing.public, existing.file_size_limit, existing.allowed_mime_types;
    END IF;
  ELSE
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('profile-photos', 'profile-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);
  END IF;
END
$$;

DROP POLICY IF EXISTS "Owners can read their profile photo" ON storage.objects;
CREATE POLICY "Owners can read their profile photo"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners can upload their profile photo" ON storage.objects;
CREATE POLICY "Owners can upload their profile photo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners can replace their profile photo" ON storage.objects;
CREATE POLICY "Owners can replace their profile photo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners can delete their profile photo" ON storage.objects;
CREATE POLICY "Owners can delete their profile photo"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_path_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_path_check
  CHECK (
    avatar_path IS NULL
    OR (avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9]+\.(jpg|png|webp)$'
        AND split_part(avatar_path, '/', 1) = id::text)
  );

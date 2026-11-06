-- ROLLBACK for 20261030120000_profile_photos_private_bucket.sql (Stage D). NOT a migration; apply only if D must be undone.
-- Touches ONLY what D created: the 4 "... their profile photo" policies, profiles.avatar_path + its CHECK, and (if empty) the
-- 'profile-photos' bucket. The legacy public 'avatars' bucket, profiles.avatar_url and every other policy are untouched.
--
-- ORDER MATTERS and the file does it for you:
--   1. avatar_path values are cleared first (a photo reference must not outlive the policies that protect it).
--   2. The policies are dropped.
--   3. The bucket is deleted ONLY when it holds no objects. Storage FILES cannot be removed by SQL: Supabase blocks direct deletes
--      from storage.objects. If the bucket is not empty, delete the files through the dashboard / Storage API first, then re-run.
--      (Photos already uploaded are NOT lost by this script: a non-empty bucket is kept, only the policies/column go.)
-- Data loss: the avatar_path references (users fall back to initials / the legacy avatar_url). Objects are kept if present.

DO $$
BEGIN
  -- re-runnable: the column is gone after a first run
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_path') THEN
    UPDATE public.profiles SET avatar_path = NULL WHERE avatar_path IS NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Owners can read their profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload their profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Owners can replace their profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their profile photo" ON storage.objects;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_path_check;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_path;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'profile-photos') THEN
    -- the Storage protect_delete trigger guards storage.objects only; buckets may be removed once empty
    PERFORM set_config('storage.allow_delete_query', 'true', true);
    DELETE FROM storage.buckets WHERE id = 'profile-photos';
  ELSE
    RAISE NOTICE 'bucket profile-photos still holds objects and was KEPT; delete the files through the Storage API, then re-run this script';
  END IF;
END $$;

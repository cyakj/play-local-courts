-- Stage G: close the resident profile read gap (docs/RESIDENT-PRIVACY-RECOMMENDATIONS.md, step 1).   NOT APPLIED to hosted.
--
-- Problem: policy "Members can view profiles in same HOA" lets ANY approved member of a community read every co-member's WHOLE
-- profiles row over the API (phone_number, date_of_birth, unit_number, latitude/longitude, zip_code, notification_preferences, ...).
-- The app UI never shows those columns to residents, but a resident calling the API directly can read them.
--
-- Fix (enforced in the database, not by hiding UI):
--   1. A member can read ONLY their own row, a community administrator can still read their community's approved members
--      (is_admin_in_same_hoa, unchanged), and the separate non-HOA "discoverable profiles" policy is untouched.
--   2. Residents that only need a co-member's DISPLAY NAME (secure messages with staff, note authors) get it from
--      public.community_member_names(uuid[]): returns id + full_name only, only for people who share an approved community with the
--      caller (or the caller), at most 200 ids per call. No phone, birth date, unit, address or coordinates.
--
-- Safety: the pre-flight refuses to run (changing nothing) if ANOTHER permissive SELECT policy on profiles would still let every
-- signed-in user, or every community member, read whole rows - the fix would silently not work. It never edits such a policy; it names it.
-- Depends on: public.profiles, public.hoa_memberships, public.is_admin_in_same_hoa(uuid,uuid). Independent of the photo, time zone
-- and reservation migrations. Re-appliable.

DO $$
DECLARE
  p record;
BEGIN
  IF to_regprocedure('public.is_admin_in_same_hoa(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_admin_in_same_hoa(uuid,uuid) is missing; stop and review. Nothing was changed.';
  END IF;
  FOR p IN
    SELECT policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd IN ('SELECT', 'ALL') AND permissive = 'PERMISSIVE'
      AND policyname NOT IN ('Members can view profiles in same HOA', 'Admins can view profiles in their community',
                             'Users can view their own full profile', 'Discoverable profiles visible to authenticated users')
  LOOP
    -- Any other SELECT policy is unexpected: report it instead of guessing. A blanket one (true / auth.role()) defeats the fix outright.
    RAISE EXCEPTION 'profiles has an unexpected permissive SELECT policy "%" (USING %). Review it before applying; nothing was changed.',
      p.policyname, p.qual;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.community_member_names(p_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND cardinality(COALESCE(p_ids, ARRAY[]::uuid[])) <= 200
    AND p.id = ANY (COALESCE(p_ids, ARRAY[]::uuid[]))
    AND (
      p.id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.hoa_memberships mine
        JOIN public.hoa_memberships theirs ON theirs.hoa_id = mine.hoa_id
        WHERE mine.user_id = auth.uid() AND mine.status = 'approved'
          AND theirs.user_id = p.id AND theirs.status = 'approved'
      )
    )
$function$;

REVOKE ALL ON FUNCTION public.community_member_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_member_names(uuid[]) TO authenticated;

-- Replace the broad same-HOA policy (own row + administrators of the person's community only).
DROP POLICY IF EXISTS "Members can view profiles in same HOA" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their community" ON public.profiles;
CREATE POLICY "Admins can view profiles in their community"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin_in_same_hoa(auth.uid(), id));

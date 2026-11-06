-- Announcement archive (unpublish).   NOT APPLIED to hosted (TENISX REAL).
--
-- hoa_announcements had only INSERT (admin) and SELECT policies: once published, a notice could not be taken down by anyone except
-- through SQL. This adds `archived_at` (NULL = published) and a function an administrator of the SAME community calls to archive one.
-- Archived rows are hidden from EVERYONE (residents and administrators) by the recreated SELECT policy, so no client has to filter.
-- There is deliberately NO UPDATE policy: administrators cannot edit or move announcements, only archive them through the function
-- (which checks administrator rights itself). Nothing is deleted.
--
-- RLS CHANGE: replaces policy "Residents view announcements" (narrowing: hides archived rows). Additive nullable column, no back-fill:
-- every existing announcement stays published. The resident app never selects the column, so it works before and after this migration;
-- the administrator screen detects a missing function/column and says so.
-- Depends on: public.hoa_announcements, public.hoa_memberships. Independent of every other pending migration.

ALTER TABLE public.hoa_announcements ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DROP POLICY IF EXISTS "Residents view announcements" ON public.hoa_announcements;
CREATE POLICY "Residents view announcements" ON public.hoa_announcements FOR SELECT TO authenticated USING (
  archived_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.hoa_memberships m
    WHERE m.user_id = auth.uid() AND m.hoa_id = hoa_announcements.hoa_id AND m.status = 'approved'
      AND (hoa_announcements.audience = 'all_residents' OR m.role = 'admin')
  )
);

CREATE OR REPLACE FUNCTION public.archive_announcement(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  h uuid;
BEGIN
  SELECT hoa_id INTO h FROM public.hoa_announcements WHERE id = p_id AND archived_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;   -- unknown or already archived: nothing to do
  END IF;
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships m
    WHERE m.user_id = auth.uid() AND m.hoa_id = h AND m.role = 'admin' AND m.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only community administrators can remove announcements' USING ERRCODE = '42501';
  END IF;
  UPDATE public.hoa_announcements SET archived_at = now() WHERE id = p_id;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_announcement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_announcement(uuid) TO authenticated;

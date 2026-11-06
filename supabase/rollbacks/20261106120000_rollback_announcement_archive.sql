-- Rollback for 20261106120000_announcement_archive.sql. Restores the original resident SELECT policy and drops the function and the
-- column. WARNING: announcements archived (unpublished) by administrators become VISIBLE again the moment the original policy returns
-- and the column is dropped. Delete such rows first if they must stay hidden:
--   DELETE FROM public.hoa_announcements WHERE archived_at IS NOT NULL;
DROP FUNCTION IF EXISTS public.archive_announcement(uuid);
DROP POLICY IF EXISTS "Residents view announcements" ON public.hoa_announcements;
CREATE POLICY "Residents view announcements" ON public.hoa_announcements FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships m
    WHERE m.user_id = auth.uid() AND m.hoa_id = hoa_announcements.hoa_id AND m.status = 'approved'
      AND (hoa_announcements.audience = 'all_residents' OR m.role = 'admin')
  )
);
ALTER TABLE public.hoa_announcements DROP COLUMN IF EXISTS archived_at;

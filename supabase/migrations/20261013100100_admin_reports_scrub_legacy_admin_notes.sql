-- OPT-IN. NOT APPLIED. Requires 20261013100000_admin_reports_internal_notes_and_notifications.sql.
--
-- Legacy `maintenance_reports.admin_notes` values were readable by the reporting resident.
-- This copies each one into public.report_notes as an INTERNAL note (text and original
-- timestamp preserved; author = the community's admin_id, or the nil UUID if unset), then
-- clears the resident-readable column. Review what it touches first:
--   select id, hoa_id, left(admin_notes, 80) from maintenance_reports where admin_notes is not null;
--
-- Idempotent: a note already copied (same report + text) is not copied twice.

INSERT INTO public.report_notes (report_id, author_id, body, is_internal, created_at)
SELECT r.id,
       COALESCE(h.admin_id, '00000000-0000-0000-0000-000000000000'::uuid),
       '[Migrated legacy note] ' || r.admin_notes,
       true,
       r.updated_at
FROM public.maintenance_reports r
JOIN public.hoas h ON h.id = r.hoa_id
WHERE r.admin_notes IS NOT NULL AND btrim(r.admin_notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.report_notes n
    WHERE n.report_id = r.id AND n.body = '[Migrated legacy note] ' || r.admin_notes
  );

-- Only rows whose copy exists. The deprecation trigger ignores calls without a JWT.
UPDATE public.maintenance_reports r
SET admin_notes = NULL
WHERE r.admin_notes IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.report_notes n
    WHERE n.report_id = r.id AND n.body = '[Migrated legacy note] ' || r.admin_notes
  );

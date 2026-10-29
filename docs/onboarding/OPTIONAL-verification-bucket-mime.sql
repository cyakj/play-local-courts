-- OPTIONAL, NOT a migration, NOT APPLIED. Run only after an explicit product decision.
--
-- Background: bucket 'hoa-verification-documents' was created (20260102102038) with NO allowed_mime_types, so any file
-- type is accepted today. The native app only offers JPG/PNG/WEBP/HEIC/PDF (src/lib/hoaApplication.ts); the legacy web
-- form also offers .doc/.docx. Migration 20261023110000 used to overwrite the allowlist; that statement was removed so
-- existing allowed upload types are preserved.
--
-- Step 1 - record the CURRENT value (read-only) and keep the output:
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'hoa-verification-documents';

-- Step 2 - only if you deliberately want to restrict uploads, review/edit this list, then run it in a transaction:
-- BEGIN;
-- UPDATE storage.buckets
-- SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
-- WHERE id = 'hoa-verification-documents';
-- -- re-run Step 1 and confirm exactly one row changed, then COMMIT (or ROLLBACK).
--
-- Rollback: UPDATE storage.buckets SET allowed_mime_types = <value recorded in Step 1> WHERE id = 'hoa-verification-documents';
-- Existing objects are never modified by either change; only future uploads are affected.

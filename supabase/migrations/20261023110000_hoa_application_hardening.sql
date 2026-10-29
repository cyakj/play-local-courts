-- HOA Admin applications: close applicant-writable integrity holes. NOT APPLIED: the user applies after review.
--
-- Problem: RLS on public.hoa_applications cannot restrict COLUMNS. The applicant INSERT policy only checks
-- applicant_id, and the resubmit UPDATE policy only checks status. An applicant could therefore INSERT a row
-- with status 'approved', reviewed_by / created_hoa_id of their choosing, or document paths in another user's
-- folder, and a forged 'approved' row blocks the real approval ("Application already approved").
-- Authority itself is only ever granted by approve_hoa_application (platform_reviewer), which is unchanged.
--
-- 1. BEFORE INSERT/UPDATE guard: non-reviewers may only create 'pending' rows and may only edit applicant fields.
-- 2. Duplicate protection: one open (pending / needs_more_info) application per applicant per community name.
-- 3. (Removed) The bucket MIME allowlist is NOT changed here; see the NOTE at the end of this file.
-- Platform reviewers and the service role (auth.uid() IS NULL) are unaffected; the review RPCs run as the reviewer.

CREATE OR REPLACE FUNCTION public.guard_hoa_application_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  doc text;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'platform_reviewer'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.applicant_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only change your own application' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'
       OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.created_hoa_id IS NOT NULL THEN
      RAISE EXCEPTION 'A new application must be pending and unreviewed' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.applicant_id IS DISTINCT FROM OLD.applicant_id
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.created_hoa_id IS DISTINCT FROM OLD.created_hoa_id
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Review fields cannot be changed by the applicant' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Evidence is append-only for the applicant: earlier documents stay, and at most 5 are attached. A legacy row
  -- that already exceeds 5 may be resubmitted as long as it does not grow.
  IF TG_OP = 'UPDATE'
     -- array_remove(.., NULL) and (.., ''): a legacy row holding NULL / empty elements can still be resubmitted (repair path);
     -- NEW may not contain NULLs (rejected in the loop below).
     AND NOT (array_remove(array_remove(COALESCE(OLD.verification_documents, '{}'::text[]), NULL), '')
              <@ COALESCE(NEW.verification_documents, '{}'::text[])) THEN
    RAISE EXCEPTION 'Existing documents cannot be removed' USING ERRCODE = '42501';
  END IF;
  IF cardinality(COALESCE(NEW.verification_documents, '{}'::text[])) > 5
     AND (TG_OP = 'INSERT'
          OR cardinality(NEW.verification_documents) > cardinality(COALESCE(OLD.verification_documents, '{}'::text[]))) THEN
    RAISE EXCEPTION 'At most 5 documents can be attached' USING ERRCODE = '42501';
  END IF;

  FOREACH doc IN ARRAY COALESCE(NEW.verification_documents, '{}'::text[]) LOOP
    -- NULL elements make both LIKEs NULL (not true), so they must be rejected explicitly; the object name
    -- after '<uid>/' must be non-empty.
    IF doc IS NULL
       OR doc NOT LIKE auth.uid()::text || '/%'
       OR doc LIKE '%..%'
       OR length(doc) <= length(auth.uid()::text) + 1 THEN
      RAISE EXCEPTION 'Documents must be uploaded to your own folder' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_hoa_application_write_trigger ON public.hoa_applications;
CREATE TRIGGER guard_hoa_application_write_trigger
  BEFORE INSERT OR UPDATE ON public.hoa_applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_hoa_application_write();

-- Fails the migration (rolling the whole file back) if duplicate open applications already exist, so a successful
-- run always means the duplicate protection is installed. No rows are changed: an operator must decide which
-- duplicate to keep (list them with HOSTED-VERIFY-READONLY.sql), then re-run this file.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.hoa_applications
    WHERE status IN ('pending', 'needs_more_info')
    GROUP BY applicant_id, lower(btrim(hoa_name))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'hoa_applications_one_open_per_name cannot be created: duplicate open applications exist. Resolve them (no data was changed), then re-run this migration.'
      USING ERRCODE = '23505';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS hoa_applications_one_open_per_name
      ON public.hoa_applications (applicant_id, lower(btrim(hoa_name)))
      WHERE status IN ('pending', 'needs_more_info');
  END IF;
END
$do$;

-- NOTE: this migration deliberately does NOT touch storage.buckets. The bucket 'hoa-verification-documents' was
-- created without an allowed_mime_types list (any type accepted) and the legacy web form also accepts .doc/.docx.
-- Narrowing uploads is a separate, explicitly approved change: see docs/onboarding/OPTIONAL-verification-bucket-mime.sql.

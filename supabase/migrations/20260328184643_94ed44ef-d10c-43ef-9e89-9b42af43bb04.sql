DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'hoa-documents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('hoa-documents', 'hoa-documents', false);
  END IF;
END $$;

DROP POLICY IF EXISTS "HOA admins can upload HOA documents" ON storage.objects;
DROP POLICY IF EXISTS "HOA admins can update HOA documents" ON storage.objects;
DROP POLICY IF EXISTS "HOA admins can delete HOA documents" ON storage.objects;
DROP POLICY IF EXISTS "Approved HOA members can read HOA documents" ON storage.objects;

CREATE POLICY "HOA admins can upload HOA documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hoa-documents'
  AND EXISTS (
    SELECT 1
    FROM public.hoa_memberships hm
    WHERE hm.user_id = auth.uid()
      AND hm.hoa_id::text = (storage.foldername(name))[1]
      AND hm.role = 'admin'
      AND hm.status = 'approved'
  )
);

CREATE POLICY "HOA admins can update HOA documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hoa-documents'
  AND EXISTS (
    SELECT 1
    FROM public.hoa_memberships hm
    WHERE hm.user_id = auth.uid()
      AND hm.hoa_id::text = (storage.foldername(name))[1]
      AND hm.role = 'admin'
      AND hm.status = 'approved'
  )
)
WITH CHECK (
  bucket_id = 'hoa-documents'
  AND EXISTS (
    SELECT 1
    FROM public.hoa_memberships hm
    WHERE hm.user_id = auth.uid()
      AND hm.hoa_id::text = (storage.foldername(name))[1]
      AND hm.role = 'admin'
      AND hm.status = 'approved'
  )
);

CREATE POLICY "HOA admins can delete HOA documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'hoa-documents'
  AND EXISTS (
    SELECT 1
    FROM public.hoa_memberships hm
    WHERE hm.user_id = auth.uid()
      AND hm.hoa_id::text = (storage.foldername(name))[1]
      AND hm.role = 'admin'
      AND hm.status = 'approved'
  )
);

CREATE POLICY "Approved HOA members can read HOA documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hoa-documents'
  AND EXISTS (
    SELECT 1
    FROM public.hoa_documents d
    JOIN public.hoa_memberships hm
      ON hm.hoa_id = d.hoa_id
    WHERE d.file_name = storage.filename(name)
      AND d.file_url LIKE '%' || name
      AND hm.user_id = auth.uid()
      AND hm.status = 'approved'
      AND (
        d.visibility = 'all_residents'
        OR hm.role = 'admin'
      )
  )
);
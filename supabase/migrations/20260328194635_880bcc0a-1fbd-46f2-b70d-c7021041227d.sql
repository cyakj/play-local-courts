DROP POLICY IF EXISTS "Approved HOA members can read HOA documents" ON storage.objects;

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
    WHERE d.file_url LIKE '%' || storage.objects.name
      AND hm.user_id = auth.uid()
      AND hm.status = 'approved'
      AND (
        d.visibility = 'all_residents'
        OR hm.role = 'admin'
      )
  )
);
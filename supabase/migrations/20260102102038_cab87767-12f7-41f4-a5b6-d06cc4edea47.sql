-- Create storage bucket for HOA verification documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('hoa-verification-documents', 'hoa-verification-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for hoa-verification-documents bucket
CREATE POLICY "Users can upload verification documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hoa-verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'hoa-verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Platform reviewers can view all verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'hoa-verification-documents' AND public.has_role(auth.uid(), 'platform_reviewer'::public.app_role));
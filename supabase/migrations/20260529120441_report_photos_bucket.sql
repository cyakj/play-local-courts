-- Create storage bucket for maintenance report photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload report photos
CREATE POLICY "Authenticated users can upload report photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'report-photos' AND auth.uid() IS NOT NULL);

-- Anyone can view report photos (public bucket)
CREATE POLICY "Anyone can view report photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-photos');

-- Users can delete their own report photos (folder = user_id)
CREATE POLICY "Users can delete own report photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'report-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

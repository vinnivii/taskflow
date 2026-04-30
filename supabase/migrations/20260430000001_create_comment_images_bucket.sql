-- Create public bucket for comment image attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comment-images',
  'comment-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "comment_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comment-images' AND auth.role() = 'authenticated');

-- Allow public read
CREATE POLICY IF NOT EXISTS "comment_images_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comment-images');

-- Allow owner to delete their own files
CREATE POLICY IF NOT EXISTS "comment_images_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'comment-images' AND auth.uid()::text = (storage.foldername(name))[1]);

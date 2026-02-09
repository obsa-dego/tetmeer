-- ============================================
-- TETMEER Supabase Storage 설정
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('public-assets', 'public-assets', true, 10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
  ),
  ('private-uploads', 'private-uploads', false, 52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'application/json']
  )
ON CONFLICT (id) DO NOTHING;

-- 2. public-assets 버킷: 누구나 읽기 가능
CREATE POLICY "public_assets_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'public-assets');

-- 3. public-assets 버킷: 인증된 사용자만 업로드
CREATE POLICY "public_assets_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'public-assets'
    AND auth.role() = 'authenticated'
  );

-- 4. public-assets 버킷: 인증된 사용자만 업데이트
CREATE POLICY "public_assets_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'public-assets'
    AND auth.role() = 'authenticated'
  );

-- 5. private-uploads 버킷: 인증된 사용자만 업로드
CREATE POLICY "private_uploads_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'private-uploads'
    AND auth.role() = 'authenticated'
  );

-- 6. private-uploads 버킷: 인증된 사용자만 읽기
CREATE POLICY "private_uploads_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'private-uploads'
    AND auth.role() = 'authenticated'
  );

-- 7. private-uploads 버킷: 인증된 사용자만 업데이트
CREATE POLICY "private_uploads_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'private-uploads'
    AND auth.role() = 'authenticated'
  );

-- 8. private-uploads 버킷: 인증된 사용자만 삭제
CREATE POLICY "private_uploads_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'private-uploads'
    AND auth.role() = 'authenticated'
  );

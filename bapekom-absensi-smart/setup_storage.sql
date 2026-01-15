-- Setup Supabase Storage for Attendance Photos
-- Create a public bucket for storing attendance photos

-- Create storage bucket (run this in Supabase SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for the bucket
-- Allow anyone to upload their own photos
CREATE POLICY "Users can upload their own photos" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'attendance-photos');

-- Allow anyone to read all photos
CREATE POLICY "Anyone can read attendance photos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'attendance-photos');

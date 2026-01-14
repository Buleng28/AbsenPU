-- 1. Hapus policy yang bermasalah (penyebab loop)
DROP POLICY IF EXISTS "Enable full access for admins" ON "public"."users";

-- 2. Buat function "is_admin" jalur khusus (SECURITY DEFINER)
-- Fungsi ini berjalan "di belakang layar" untuk mengecek role tanpa memicu RLS berulang
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Pasang ulang policy menggunakan function di atas
CREATE POLICY "Enable full access for admins" ON "public"."users"
AS PERMISSIVE FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

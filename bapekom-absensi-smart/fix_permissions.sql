-- 1. Pastikan RLS aktif
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Izinkan SEMUA orang yang login untuk MELIHAT (Select) data user
-- (Diperlukan agar profil bisa dimuat saat login)
CREATE POLICY "Enable read access for authenticated users" ON "public"."users"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

-- 3. Izinkan ADMIN untuk MELAKUKAN SEMUANYA (Insert, Update, Delete)
CREATE POLICY "Enable full access for admins" ON "public"."users"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  (SELECT role FROM "public"."users" WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM "public"."users" WHERE id = auth.uid()) = 'admin'
);

-- 4. Izinkan User untuk mengupdate profil mereka sendiri (Optional, untuk foto profil dsb)
CREATE POLICY "Enable update for users based on id" ON "public"."users"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

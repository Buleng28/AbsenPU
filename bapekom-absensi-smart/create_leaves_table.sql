-- Create enum for leave status
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Create leaves table
CREATE TABLE IF NOT EXISTS leaves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    attachment_url TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do EVERYTHING (Select, Insert, Update, Delete)
-- Assuming we interpret 'admin' role from the joined users table or via metadata
-- For simplicity in this project context, we check the public.users table or relying on the app logic, 
-- but secure way is checking auth.users metadata or a secure function.
-- Reusing the is_admin() function if created previously, or using a subquery.

-- Policy: Users can VIEW their own leaves
CREATE POLICY "Users can view own leaves" ON leaves
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own leaves
CREATE POLICY "Users can insert own leaves" ON leaves
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can VIEW ALL leaves
-- We use a simpler approach: allow if the current user is an admin in the public.users table
CREATE POLICY "Admins can view all leaves" ON leaves
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy: Admins can UPDATE leaves (approve/reject)
CREATE POLICY "Admins can update leaves" ON leaves
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy: Admins can DELETE leaves
CREATE POLICY "Admins can delete leaves" ON leaves
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

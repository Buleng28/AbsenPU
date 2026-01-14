-- Create attendance table if not exists
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    "userName" TEXT NOT NULL,
    division TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    type TEXT NOT NULL, -- 'in' or 'out'
    "photoUrl" TEXT,
    location JSONB NOT NULL,
    "isLate" BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'valid' -- 'valid' or 'invalid'
);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do EVERYTHING
CREATE POLICY "Admins can do everything on attendance" ON attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy: Users can view their own attendance
CREATE POLICY "Users can view own attendance" ON attendance
    FOR SELECT
    USING (auth.uid() = "userId");

-- Policy: Users can insert their own attendance
CREATE POLICY "Users can insert own attendance" ON attendance
    FOR INSERT
    WITH CHECK (auth.uid() = "userId");

-- Note: We use double quotes for camelCase column names like "userId" 
-- to match how Supabase JS client usually sends them if not mapped.

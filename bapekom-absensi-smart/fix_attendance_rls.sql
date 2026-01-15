-- Fix RLS Policies for Attendance Table
-- Issue: Users can't insert attendance records - RLS too strict for the app's auth model
-- This app uses custom user IDs, not Supabase Auth, so we need to disable RLS
-- or make it very permissive

-- Option 1: DISABLE RLS completely (recommended for development)
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

-- If you want to keep RLS but make it work, use this instead:
-- Uncomment the code below and comment out the DISABLE line above

/*
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can do everything on attendance" ON attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance;

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to do anything (because app uses custom auth)
CREATE POLICY "Allow all for authenticated service" ON attendance
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);
*/

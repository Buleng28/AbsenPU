-- Archive attendance records older than specified interval
-- IMPORTANT: Run a backup (pg_dump) before executing.
-- Create archive table (one-time):
CREATE TABLE IF NOT EXISTS attendance_archive (LIKE attendance INCLUDING ALL);

-- Example: move rows older than 1 year
-- This inserts into archive and deletes from original table in one statement.
WITH moved AS (
  INSERT INTO attendance_archive
  SELECT * FROM attendance
  WHERE timestamp < now() - interval '1 year'
  RETURNING id
)
DELETE FROM attendance WHERE id IN (SELECT id FROM moved);

-- Check counts after move
SELECT (SELECT COUNT(*) FROM attendance_archive) AS archive_count,
       (SELECT COUNT(*) FROM attendance) AS attendance_count;

-- NOTE: For very large tables, run in batches (see maintenance script) to avoid long transactions.

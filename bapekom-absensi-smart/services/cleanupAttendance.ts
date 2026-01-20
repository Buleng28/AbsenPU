import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your .env');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BATCH_SIZE = 1000; // adjust as needed
const YEARS = Number(process.env.CLEANUP_YEARS || '1');
const cutoffIso = new Date(Date.now() - YEARS * 365 * 24 * 60 * 60 * 1000).toISOString();
const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

(async function main() {
  console.log(`Starting attendance cleanup: moving records older than ${YEARS} year(s) (before ${cutoffIso})`);
  if (dryRun) console.log('-- DRY RUN MODE -- No changes will be made (set DRY_RUN=1 or remove flag to execute)');

  // Ensure archive table exists (skip create in dry-run)
  if (!dryRun) {
    try {
      const sql = `CREATE TABLE IF NOT EXISTS attendance_archive (LIKE attendance INCLUDING ALL);`;
      const { error: execErr } = await supabaseAdmin.rpc('execute_sql', { sql });
      if (execErr) {
        console.warn('Warning: execute_sql RPC returned an error (this may be fine if not available):', execErr.message);
      } else {
        console.log('Confirmed attendance_archive exists (or created).');
      }
    } catch (e) {
      console.warn('Could not ensure archive table via RPC, proceeding and will attempt to insert directly. Error:', e);
    }
  } else {
    console.log('Skipping create/check of archive table in dry-run mode.');
  }

  let totalMoved = 0;
  let totalFound = 0;
  while (true) {
    // Select a batch of rows to move (oldest first)
    const { data: batch, error: selectErr } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .lt('timestamp', cutoffIso)
      .order('timestamp', { ascending: true })
      .limit(BATCH_SIZE);

    if (selectErr) {
      console.error('Error selecting batch from attendance:', selectErr.message);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;

    const ids = batch.map((r: any) => r.id);

    if (dryRun) {
      totalFound += ids.length;
      console.log(`Dry run: would move batch of ${ids.length} rows (sample ids: ${ids.slice(0, 5).join(', ')})`);
    } else {
      // Insert into archive
      const { error: insertErr } = await supabaseAdmin.from('attendance_archive').insert(batch as any);
      if (insertErr) {
        console.error('Failed to insert into attendance_archive:', insertErr.message);
        process.exit(1);
      }

      // Delete from main table
      const { error: deleteErr } = await supabaseAdmin.from('attendance').delete().in('id', ids);
      if (deleteErr) {
        console.error('Failed to delete archived rows from attendance:', deleteErr.message);
        process.exit(1);
      }

      totalMoved += ids.length;
      console.log(`Moved batch: ${ids.length} rows (total moved: ${totalMoved})`);
    }

    // If batch was smaller than page size, we're likely done
    if (batch.length < BATCH_SIZE) break;
  }

  if (dryRun) {
    console.log('Dry-run completed. Total rows that would be moved:', totalFound);
    console.log('Run without DRY_RUN=1 / --dry-run to perform the actual move.');
  } else {
    console.log('Attendance cleanup completed. Total rows moved:', totalMoved);
  }
})();

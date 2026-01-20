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

const BUCKET = process.env.CLEANUP_BUCKET || 'attendance-photos';
const YEARS = Number(process.env.CLEANUP_YEARS || '1');
const cutoff = Date.now() - YEARS * 365 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

(async function main() {
  console.log(`Starting storage cleanup for bucket '${BUCKET}' - removing objects older than ${YEARS} year(s)`);
  if (dryRun) console.log('-- DRY RUN MODE -- No changes will be made (set DRY_RUN=1 or remove flag to execute)');

  let offset = 0;
  let totalDeleted = 0;
  let totalFound = 0;

  while (true) {
    const { data, error, status } = await supabaseAdmin.storage.from(BUCKET).list('', { limit: PAGE_SIZE, offset });
    if (error) {
      console.error('Error listing storage objects:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    const toDelete: string[] = [];

    for (const obj of data) {
      // Attempt to parse timestamp from filename pattern: ..._TIMEMS.jpg
      const match = obj.name.match(/_(\d+)\.[a-zA-Z]+$/);
      let ts = null;
      if (match) {
        ts = Number(match[1]);
      } else if ((obj as any).updated_at) {
        ts = new Date((obj as any).updated_at).getTime();
      }

      if (!ts) {
        console.warn('Could not determine timestamp for object, skipping:', obj.name);
        continue;
      }

      if (ts < cutoff) {
        toDelete.push(obj.name);
      }
    }

    if (toDelete.length > 0) {
      if (dryRun) {
        totalFound += toDelete.length;
        console.log(`Dry run: would delete ${toDelete.length} objects (sample: ${toDelete.slice(0, 10).join(', ')})`);
      } else {
        const { error: removeErr } = await supabaseAdmin.storage.from(BUCKET).remove(toDelete);
        if (removeErr) {
          console.error('Failed to remove some objects:', removeErr.message);
          process.exit(1);
        }
        totalDeleted += toDelete.length;
        console.log(`Deleted ${toDelete.length} objects (total deleted: ${totalDeleted})`);
      }
    }

    // If less than page, done (note: list may paginate differently; increase offset otherwise)
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (dryRun) {
    console.log('Dry-run completed. Total objects that would be deleted:', totalFound);
    console.log('Run without DRY_RUN=1 / --dry-run to perform the actual delete.');
  } else {
    console.log('Storage cleanup completed. Total objects deleted:', totalDeleted);
  }
})();

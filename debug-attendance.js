// Debug script to check attendance data in Supabase
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './bapekom-absensi-smart/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendance() {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching attendance:', error);
      return;
    }

    console.log(`\n✅ Found ${data.length} records\n`);
    
    if (data.length > 0) {
      data.forEach((record, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  ID: ${record.id}`);
        console.log(`  User: ${record.userName}`);
        console.log(`  Timestamp: ${record.timestamp}`);
        console.log(`  Timestamp Type: ${typeof record.timestamp}`);
        console.log(`  Type: ${record.type}`);
        console.log(`  ---`);
      });

      // Check today's date
      const today = new Date().toISOString().split('T')[0];
      console.log(`\nToday's date: ${today}`);
      
      const todayRecords = data.filter(r => {
        const recordDate = new Date(r.timestamp).toISOString().split('T')[0];
        return recordDate === today;
      });

      console.log(`Records for today: ${todayRecords.length}`);
      if (todayRecords.length > 0) {
        todayRecords.forEach(r => {
          console.log(`  - ${r.userName} at ${r.timestamp}`);
        });
      }
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkAttendance();

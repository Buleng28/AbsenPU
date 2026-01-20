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

      // Check today's date (UTC, container local, and Jakarta)
      const todayUTC = new Date().toISOString().split('T')[0];
      const todayLocal = new Date().toLocaleDateString('en-CA');
      const todayJakarta = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      console.log(`\nToday's UTC date: ${todayUTC}`);
      console.log(`Today's Local date (container): ${todayLocal}`);
      console.log(`Today's Jakarta date (simulated): ${todayJakarta}`);
      
      const todayRecordsUTC = data.filter(r => {
        const recordDateUTC = new Date(r.timestamp).toISOString().split('T')[0];
        return recordDateUTC === todayUTC;
      });

      const todayRecordsLocal = data.filter(r => {
        const recordDateLocal = new Date(r.timestamp).toLocaleDateString('en-CA');
        return recordDateLocal === todayLocal;
      });

      const todayRecordsJakarta = data.filter(r => {
        const recordDateJakarta = new Date(r.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        return recordDateJakarta === todayJakarta;
      });

      console.log(`Records for today (UTC): ${todayRecordsUTC.length}`);
      if (todayRecordsUTC.length > 0) {
        todayRecordsUTC.forEach(r => {
          console.log(`  - (UTC) ${r.userName} at ${r.timestamp}`);
        });
      }

      console.log(`Records for today (container local): ${todayRecordsLocal.length}`);
      if (todayRecordsLocal.length > 0) {
        todayRecordsLocal.forEach(r => {
          console.log(`  - (Local) ${r.userName} at ${r.timestamp} -> localDate: ${new Date(r.timestamp).toLocaleDateString('en-CA')}`);
        });
      }

      console.log(`Records for today (Jakarta): ${todayRecordsJakarta.length}`);
      if (todayRecordsJakarta.length > 0) {
        todayRecordsJakarta.forEach(r => {
          console.log(`  - (Jakarta) ${r.userName} at ${r.timestamp} -> jakartaDate: ${new Date(r.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })}`);
        });
      }
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkAttendance();

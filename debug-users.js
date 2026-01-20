// Debug script to check user divisions in Supabase
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './bapekom-absensi-smart/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(100);

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${data.length} users`);
  data.forEach((u, i) => {
    console.log(`${i + 1}. ${u.name} - division: ${u.division || 'N/A'} - role: ${u.role}`);
  });
}

checkUsers();

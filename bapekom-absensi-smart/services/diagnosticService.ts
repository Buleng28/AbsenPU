// Diagnostic script to check Supabase configuration and RLS status
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const checkSupabaseHealth = async () => {
  console.log('=== SUPABASE HEALTH CHECK ===');
  
  // Check if Supabase is configured
  console.log('1. Supabase Configured:', isSupabaseConfigured);
  
  if (!isSupabaseConfigured || !supabase) {
    console.error('❌ Supabase is not configured!');
    return;
  }
  
  // Check attendance table access
  console.log('\n2. Testing attendance table access...');
  try {
    const { data, error, status } = await supabase
      .from('attendance')
      .select('count', { count: 'exact' });
    
    if (error) {
      console.error('❌ Error accessing attendance table:');
      console.error('   Status:', status);
      console.error('   Message:', error.message);
      console.error('   Code:', error.code);
    } else {
      console.log('✅ Attendance table accessible');
      console.log('   Record count:', data);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }
  
  // Check users table access
  console.log('\n3. Testing users table access...');
  try {
    const { data, error, status } = await supabase
      .from('users')
      .select('count', { count: 'exact' });
    
    if (error) {
      console.error('❌ Error accessing users table:');
      console.error('   Status:', status);
      console.error('   Message:', error.message);
    } else {
      console.log('✅ Users table accessible');
      console.log('   Record count:', data);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }
  
  // Check leaves table access
  console.log('\n4. Testing leaves table access...');
  try {
    const { data, error } = await supabase
      .from('leaves')
      .select('count', { count: 'exact' });
    
    if (error) {
      console.error('❌ Error accessing leaves table:', error.message);
    } else {
      console.log('✅ Leaves table accessible');
      console.log('   Record count:', data);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }
  
  console.log('\n=== END HEALTH CHECK ===\n');
};

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase URL and service key are required. Make sure to create a .env file.");
}

// Create a Supabase client with service_role permissions
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// --- User Data Definition ---
// IMPORTANT: Change these passwords to something secure in a real environment.
const usersToSeed = [
  {
    email: 'admin@example.com',
    password: 'password', // Change this!
    username: 'admin',
    name: 'Administrator',
    role: 'admin'
  },
  {
    email: 'intern@example.com',
    password: 'password', // Change this!
    username: 'ahmad',
    name: 'Ahmad Subarjo',
    role: 'intern'
  }
];

/**
 * Deletes a user from both auth.users and the public.users table to ensure a clean slate.
 */
const deleteUser = async (userData: typeof usersToSeed[0]) => {
  console.log(`--- Cleaning up user: ${userData.username} (${userData.email}) ---`);
  
  // 1. Clean up the public 'users' table by username
  // This is the most important step to prevent the "duplicate key" error.
  console.log(`Deleting from public.users table with username: ${userData.username}`);
  const { error: publicDeleteError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('username', userData.username);

  if (publicDeleteError) {
    console.warn(`Could not delete from public.users table for username ${userData.username}:`, publicDeleteError.message);
  } else {
    console.log(`Successfully cleaned public.users table for username ${userData.username}.`);
  }

  // 2. Clean up the auth.users table by email
  const { data: authUsers, error: findError } = await supabaseAdmin.auth.admin.listUsers();
  if (findError) {
    console.error(`Error listing auth users:`, findError.message);
    return;
  }

  const existingAuthUser = authUsers.users.find(u => u.email === userData.email);

  if (existingAuthUser) {
    console.log(`Found auth user ${userData.email} with ID ${existingAuthUser.id}. Deleting...`);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
    if (authError) {
      console.error(`Failed to delete auth user ${userData.email}:`, authError.message);
    } else {
      console.log(`Successfully deleted auth user ${userData.email}.`);
    }
  } else {
    console.log(`Auth user ${userData.email} does not exist. No need to delete from auth schema.`);
  }
};


/**
 * Creates a user in auth.users and a corresponding profile in public.users
 */
const createUser = async (userData: typeof usersToSeed[0]) => {
  console.log(`\n--- Creating user: ${userData.username} (${userData.email}) ---`);
  
  // 1. Create user in the authentication system
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true, // Auto-confirm email for simplicity in seeding
  });

  if (authError) {
    // Check if the auth user already exists, which can happen if cleanup failed partially
    if (authError.message.includes('already exists')) {
       console.warn(`Auth user ${userData.email} already exists. Skipping auth creation.`);
    } else {
      console.error(`Failed to create auth user for ${userData.email}:`, authError.message);
      return;
    }
  }
  
  const { data: { user: authUser } } = await supabaseAdmin.auth.getUser();
  if (!authUser && !authData?.user) {
     console.error(`Failed to get user data after creating auth user for ${userData.email}.`);
     return;
  }
  const userId = authUser?.id || authData?.user?.id;

  console.log(`Successfully created/confirmed auth user for ${userData.email} with ID: ${userId}`);

  // 2. Create the user profile in the public 'users' table
  const profileData = {
    id: userId,
    username: userData.username,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    password: userData.password // Add password to satisfy not-null constraint
  };

  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert(profileData);

  if (profileError) {
    console.error(`Failed to create profile for ${userData.email}:`, profileError.message);
    // If profile creation fails, it's good practice to clean up the auth user
    if (userId) {
       console.log(`Rolling back auth user for ${userData.email}...`);
       await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    return;
  }

  console.log(`Successfully created user profile for ${userData.email}.`);
};

/**
 * Main seeding function
 */
const seed = async () => {
  console.log("--- Starting database seed process ---");

  // First, delete all users to ensure a clean slate
  for (const user of usersToSeed) {
    await deleteUser(user);
  }
  
  // Then, create them again
  for (const user of usersToSeed) {
    await createUser(user);
  }

  console.log("\n--- Database seed process finished ---");
};

// Run the seed function
seed().catch(error => {
  console.error("\nAn unexpected error occurred during seeding:", error);
  process.exit(1);
});

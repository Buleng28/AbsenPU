import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { User } from '../types';

/**
 * Fetches a list of all users from the database.
 * @returns {Promise<User[]>} A promise that resolves to an array of user objects.
 */
export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('users').select('*');

  if (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
  return data || [];
};

/**
 * Adds a new user to the database.
 * @param {Omit<User, 'id'>} newUser - The user data to add.
 * @returns {Promise<User>} A promise that resolves to the newly created user.
 */
export const addUser = async (newUser: Omit<User, 'id'> & { password?: string, email?: string }): Promise<User> => {
  // 1. Cek apakah kita punya Service Key untuk mendaftarkan Auth User
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
  let authUserId = null;

  if (serviceKey && newUser.email && newUser.password) {
    try {
      // Inisialisasi client admin khusus untuk operasi ini
      const supabaseURL = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAdmin = createClient(supabaseURL, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      console.log(`Mendaftarkan user ${newUser.email} ke Supabase Auth...`);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true // Langsung confirm agar bisa login
      });

      if (authError) {
        throw new Error(`Gagal membuat Login Auth: ${authError.message}`);
      }

      if (authData.user) {
        authUserId = authData.user.id;
        console.log("Auth User created dengan ID:", authUserId);
      }
    } catch (e: any) {
      console.error("Auth creation failed:", e);
      // Opsional: Throw error atau lanjut insert ke DB saja (tapi nanti ga bisa login)
      throw new Error(e.message || "Gagal mendaftarkan login pengguna.");
    }
  } else {
    console.warn("Service Key atau Email/Password tidak lengkap. User hanya akan dibuat di database publik (TIDAK BISA LOGIN).");
  }

  // 2. Simpan data profil ke tabel users
  // Jika authUserId ada, gunakan itu sebagai ID. Jika tidak, biarkan Supabase generate (tapi ini akan bikin data login tidak sinkron).
  interface UserPayload {
    name: string;
    username: string;
    division: string;
    role: 'intern' | 'admin';
    email?: string | null; // Izinkan string atau null
    password?: string;
    id?: string;
  }

  const payload: UserPayload = {
    name: newUser.name,
    username: newUser.username,
    division: newUser.division,
    role: newUser.role,
    email: newUser.email || null, // Pastikan dikirim
    password: newUser.password // Simpan password plain text juga untuk referensi admin (opsional, hati-hati security)
  };

  if (authUserId) {
    payload.id = authUserId;
  }

  const { data, error } = await supabase
    .from('users')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Error adding user to public DB:", error);
    // Jika gagal simpan DB, idealnya kita rollback (hapus) Auth User yang tadi dibuat
    if (authUserId && serviceKey) {
      // Rollback logic (simplified)
      console.log("Rolling back auth user...");
      const supabaseURL = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAdmin = createClient(supabaseURL, serviceKey);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }
    throw error;
  }
  return data;
};

/**
 * Updates an existing user in the database.
 * Supports updating password and email in Supabase Auth if provided.
 * @param {User & { password?: string, email?: string }} updatedUser - The updated user data.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
export const updateUser = async (updatedUser: User & { password?: string, email?: string }): Promise<boolean> => {
  // 1. Update Public User Data
  const { error } = await supabase
    .from('users')
    .update({
      name: updatedUser.name,
      username: updatedUser.username,
      division: updatedUser.division,
      role: updatedUser.role,
      // We don't update email here directly, we let Auth sync handle it or update it if needed for reference
      // But typically email is in Auth. If we store it in public users too:
      email: updatedUser.email
    })
    .eq('id', updatedUser.id);

  if (error) {
    console.error("Error updating user in public DB:", error);
    return false;
  }

  // 2. Update Supabase Auth Data (Password/Email) if Service Key is available
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
  if (serviceKey && (updatedUser.password || updatedUser.email)) {
    try {
      const supabaseURL = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAdmin = createClient(supabaseURL, serviceKey);

      const authUpdates: any = {};
      if (updatedUser.password && updatedUser.password.trim() !== '') {
        authUpdates.password = updatedUser.password;
        console.log(`Updating password for user ${updatedUser.id}`);
      }
      if (updatedUser.email) {
        authUpdates.email = updatedUser.email;
        authUpdates.email_confirm = true; // Auto confirm change
        console.log(`Updating email for user ${updatedUser.id}`);
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          updatedUser.id,
          authUpdates
        );

        if (authError) {
          console.error("Error updating Supabase Auth:", authError);
          // We don't return false here because public data might have been updated successfully.
          // Ideally we should warn the user.
        } else {
          console.log("Supabase Auth updated successfully.");
        }
      }
    } catch (e) {
      console.error("Exception during Auth update:", e);
    }
  }

  return true;
};

/**
 * Deletes a user from the database.
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
export const deleteUser = async (userId: string): Promise<boolean> => {
  // 1. Hapus data absensi terlebih dahulu (menghindari error foreign key)
  // Gunakan kolom 'userId' sesuai skema yang ditemukan sebelumnya
  const { error: attendanceError } = await supabase
    .from('attendance')
    .delete()
    .eq('userId', userId);

  if (attendanceError) {
    console.warn("Warning: Failed to delete attendance records:", attendanceError);
    // Kita lanjut saja, siapa tahu tidak ada data absen
  }

  // 2. Hapus User dari Auth (jika Service Key tersedia)
  // Ini cara paling bersih karena biasanya akan men-trigger delete di public.users juga (jika cascade on)
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
  if (serviceKey) {
    try {
      const supabaseURL = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAdmin = createClient(supabaseURL, serviceKey);

      console.log(`Menghapus user ${userId} dari Auth...`);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authError) {
        console.error("Gagal menghapus Auth User:", authError);
        // Jika gagal hapus Auth (mungkin karena ga ada di Auth), kita coba hapus manual di public
      } else {
        console.log("Berhasil menghapus Auth User.");
        // Cek apakah di public table masih ada?
        const { data } = await supabase.from('users').select('id').eq('id', userId).single();
        if (!data) return true; // Sudah terhapus otomatis via cascade
      }
    } catch (e) {
      console.error("Error saat menghapus Auth User:", e);
    }
  }

  // 3. Fallback: Hapus dari tabel public.users secara manual
  // (Jika step 2 gagal atau tidak ada Service Key, atau tidak cascade)
  console.log(`Menghapus user ${userId} dari tabel public...`);
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error("Error deleting user from public DB:", error);
    return false;
  }
  return true;
};

/**
 * Logs in a user with their username and password.
 * This function first looks up the user's email from the 'users' table based on their username,
 * then uses that email to authenticate with Supabase Auth.
 * @param {string} username - The user's username.
 * @param {string} password - The user's password.
 * @returns {Promise<User | null>} A promise that resolves to the user object if login is successful, otherwise null.
 */
export const loginUser = async (username: string, password: string): Promise<User | null> => {
  // Step 1: Find the user's email by their username from the public 'users' table.
  console.log(`Attempting to find user with username: ${username}`);
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('username', username)
    .single();

  // Handle case where username is not found or another error occurs.
  if (userError) {
    console.error(`Database error when searching for user "${username}":`, userError);
    throw new Error('Terjadi kesalahan pada server saat mencari pengguna.');
  }
  if (!userData) {
    console.error(`Login failed: User with username "${username}" not found in the 'users' table.`);
    throw new Error(`Username "${username}" tidak ditemukan.`);
  }
  if (!userData.email) {
    console.error(`Login failed: User with username "${username}" has no associated email.`);
    throw new Error('Akun pengguna tidak memiliki email terkait.');
  }

  const email = userData.email;
  console.log(`Found email "${email}" for username "${username}". Attempting to sign in.`);

  // Step 2: Use the fetched email and the provided password to sign in with Supabase Auth.
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Handle authentication errors (e.g., incorrect password).
  if (authError) {
    console.error(`Authentication error for email "${email}":`, authError.message);
    // Supabase returns a specific message for invalid credentials.
    if (authError.message.includes('Invalid login credentials')) {
      throw new Error('Password yang dimasukkan salah.');
    }
    throw new Error('Gagal melakukan autentikasi.');
  }

  if (!authData.user) {
    // This case is unlikely if authError is not thrown, but it's good for safety.
    console.error("Authentication successful but no user data returned.");
    throw new Error('Gagal mendapatkan data pengguna setelah autentikasi.');
  }

  console.log(`User ${email} signed in successfully. Fetching user profile...`);

  // Step 3: Fetch the complete user profile from the 'users' table to return to the app.
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error(`Error fetching user profile for user ID ${authData.user.id}:`, profileError);
      // If the profile doesn't exist, log the user out to prevent a broken state.
      await supabase.auth.signOut();
      throw new Error('Gagal mengambil profil pengguna setelah login.');
    }

    if (!profileData) {
      console.error(`No profile found for user ID ${authData.user.id} after login.`);
      await supabase.auth.signOut();
      throw new Error('Profil pengguna tidak ditemukan setelah login.');
    }

    console.log("Successfully fetched user profile.");
    return profileData as User;

  } catch (e) {
    // Ensure user is logged out in case of any failure during profile fetching.
    console.error("An error occurred during profile fetching, signing out.", e);
    await supabase.auth.signOut();
    throw e;
  }
};
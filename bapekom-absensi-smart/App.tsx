import React, { useState, useEffect, FormEvent } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { User } from './types';
import InternDashboard from './components/InternDashboard';
import AdminDashboard from './components/AdminDashboard';
import { loginUser } from './services/userService';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { checkSupabaseHealth } from './services/diagnosticService';

const App: React.FC = () => {
  // State management
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);

  // Render an error message if Supabase is not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-800">
        <div className="text-center p-8 bg-white shadow-lg rounded-lg max-w-lg">
          <h1 className="text-2xl font-bold mb-4">Kesalahan Konfigurasi</h1>
          <p>
            Koneksi ke Supabase gagal. Pastikan Anda telah membuat file <code>.env</code> di root folder.
          </p>
          <p className="mt-2">
            File tersebut harus berisi variabel <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  // Effect to check for an existing session on app load
  useEffect(() => {
    // Run diagnostic check
    checkSupabaseHealth();
    
    const checkSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) throw profileError;
          if (profileData) {
            setCurrentUser(profileData);
          }
        }
      } catch (err) {
        console.error("Error checking session:", err);
        // If session check fails, ensure user is logged out
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Set up a listener for auth state changes (e.g., logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsSuccess(false);
      } else if (event === 'SIGNED_IN' && session?.user) {
        // This could be used to re-fetch user profile if needed
      }
    });

    // Cleanup listener on component unmount
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Handler for the login form submission
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginUser(username, password);
      if (user) {
        setIsSuccess(true);
        // Wait for the success animation to be visible before switching dashboards
        setTimeout(() => {
          setCurrentUser(user);
          setLoading(false);
        }, 1500);
      } else {
        // This case might not be hit if loginUser throws, but is good for safety
        throw new Error("Pengguna tidak ditemukan.");
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke server. Silakan coba lagi.');
      setLoading(false);
    }
  };

  // Handler for the logout button
  // Handler for the logout button
  const handleLogout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("Logout warning:", error.message);
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Always cleanup local state even if server fails
      setCurrentUser(null);
      setLoading(false);
    }
  };

  // Render a loading spinner while checking the session
  if (loading && !isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <i className="fas fa-circle-notch fa-spin text-4xl text-blue-600"></i>
      </div>
    );
  }

  // Render the Login page if no user is authenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-50 font-sans">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[70vh] h-[70vh] bg-blue-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-move-orb" style={{ animationDuration: '25s' }}></div>
          <div className="absolute top-[20%] -right-[10%] w-[60vh] h-[60vh] bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-move-orb" style={{ animationDuration: '30s', animationDirection: 'reverse' }}></div>
        </div>

        <div className={`relative w-full max-w-md bg-white/60 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/50 p-8 md:p-10 transition-all duration-700`}>
          {isSuccess && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-white/80 backdrop-blur-xl rounded-[2.5rem] animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4 animate-fade-in-up">
                <i className="fas fa-check text-3xl text-white"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>Login Berhasil!</h2>
              <p className="text-slate-500 mt-2 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>Mengalihkan ke dashboard...</p>
            </div>
          )}

          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg mx-auto flex items-center justify-center mb-6 p-3 transform hover:rotate-6 transition-transform duration-500">
              <img src="./logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">BAPEKOM</h1>
            <p className="text-slate-500 text-sm font-medium mt-1 tracking-wide">Sistem Absensi Digital</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            {error && (
              <div className="bg-rose-50/80 text-rose-500 text-xs font-bold p-4 rounded-2xl flex items-start gap-3 border border-rose-100 animate-fade-in">
                <i className="fas fa-exclamation-circle text-lg mt-0.5"></i>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-2">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <i className="fas fa-user text-slate-400 group-focus-within:text-blue-600"></i>
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading || isSuccess}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 rounded-2xl text-slate-700 text-sm focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all placeholder-slate-300 font-semibold"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <i className="fas fa-lock text-slate-400 group-focus-within:text-blue-600"></i>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || isSuccess}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 rounded-2xl text-slate-700 text-sm focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all placeholder-slate-300 font-semibold"
                  placeholder="Masukkan Kata Sandi"
                />
              </div>
            </div>

            <button type="submit" disabled={loading || isSuccess} className={`w-full mt-6 py-4 text-white rounded-2xl text-sm font-bold shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-70 flex justify-center items-center gap-3 ${loading ? 'bg-slate-800' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700'}`}>
              {loading ? <><i className="fas fa-circle-notch fa-spin"></i> Memproses...</> : 'Masuk Aplikasi'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render the appropriate dashboard if a user is authenticated
  return (
    <div className="animate-fade-in-up">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      {currentUser.role === 'intern' ? (
        <InternDashboard user={currentUser} onLogout={handleLogout} />
      ) : (
        <AdminDashboard user={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;

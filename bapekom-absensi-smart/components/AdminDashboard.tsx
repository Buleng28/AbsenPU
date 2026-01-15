import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { User, AttendanceRecord, DashboardStats, WeeklyStats, SystemSettings, LeaveRequest } from '../types';
import { getTodaysRecords, getRecentRecords, getAllStats, getWeeklyStats, getUserAttendanceHistory, getAllAttendanceRecords } from '../services/attendanceService';
import { generateDailySummary } from '../services/geminiService';
import { getUsers, addUser, updateUser, deleteUser } from '../services/userService';
import { getSettings, saveSettings } from '../services/settingsService';
import { getLeaveRequests, updateLeaveStatus, getPendingLeaveCount } from '../services/leaveService';
import DailyStatusChart from './DailyStatusChart';
import DivisionPieChart from './DivisionPieChart';
import WeeklyBarChart from './WeeklyBarChart';
import AttendanceOverview from './AttendanceOverview';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

// Helper to check if user is super admin
const isSuperAdmin = (user: User): boolean => user.role === 'super-admin' || user.username === 'ulil.amri';

// Helper to safely extract error messages and prevent [object Object]
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    // Check if message property exists and is a string
    if (errObj.message && typeof errObj.message === 'string') {
      return errObj.message;
    }
    // Fallback to stringifying the object, handling circular references safely
    try {
      return JSON.stringify(error);
    } catch {
      return "Terjadi kesalahan (Detail error tidak dapat ditampilkan)";
    }
  }

  return String(error);
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  // Theme State
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'overview' | 'users' | 'settings' | 'leaves' | 'history'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dashboard State
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showLateAlert, setShowLateAlert] = useState(true);

  // User Management State
  const [usersList, setUsersList] = useState<(User & { password?: string })[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    division: '',
    role: 'intern' as 'intern' | 'admin' | 'super-admin'
  });
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // User History Detail & Edit State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserHistory, setSelectedUserHistory] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState<User | null>(null);
  const [isClosingSidebar, setIsClosingSidebar] = useState(false);

  // Full Attendance History State
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingAllAttendance, setLoadingAllAttendance] = useState(false);
  
  // History Filter State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchName, setSearchName] = useState<string>('');

  // Settings State
  const [settingsForm, setSettingsForm] = useState<SystemSettings>(getSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Leave Management State
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  type LeaveFilterType = 'all' | 'pending' | 'approved' | 'rejected';
  const [leaveFilter, setLeaveFilter] = useState<LeaveFilterType>('pending');

  // Photo Modal State
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');

  // Rejection Modal State
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [leaveRequestToReject, setLeaveRequestToReject] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    fetchData();
    fetchUsers();
    setSettingsForm(getSettings());
    fetchLeaves();
  }, []);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'overview') {
      fetchAttendanceHistory();
    }
  }, [activeTab]);

  // Auto-reload data every 30 seconds for dashboard tab
  useEffect(() => {
    if (activeTab === 'dashboard') {
      const interval = setInterval(() => {
        fetchData();
        fetchLeaves();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchAttendanceHistory = async () => {
    setLoadingAllAttendance(true);
    try {
      const data = await getAllAttendanceRecords();
      setAllAttendance(data);
    } catch (error) {
      toast.error("Gagal memuat riwayat absensi: " + getErrorMessage(error));
    } finally {
      setLoadingAllAttendance(false);
    }
  };

  // Function to filter attendance by month and name
  const getFilteredAttendance = () => {
    let filtered = allAttendance;

    // Filter by month if selected
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.timestamp);
        const recordYear = recordDate.getFullYear().toString();
        const recordMonth = String(recordDate.getMonth() + 1).padStart(2, '0');
        return recordYear === year && recordMonth === month;
      });
    }

    // Filter by name if searched
    if (searchName.trim()) {
      filtered = filtered.filter(record =>
        record.userName.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    return filtered;
  };

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
      months.push({ value: `${year}-${month}`, label: monthName });
    }
    return months;
  };

  const fetchData = async () => {
    try {
      const recs = await getTodaysRecords();
      const recent = await getRecentRecords();
      const st = await getAllStats();
      const weekly = await getWeeklyStats();

      setRecords(recs);
      setRecentRecords(recent);
      setStats(st);
      setWeeklyStats(weekly);

      if (st.lateToday > 0) {
        setShowLateAlert(true);
      }
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error("Error fetching dashboard data:", message);
      toast.error(`Gagal memuat data dashboard: ${message}`);
    }
  };

  const fetchUsers = async () => {
    try {
      const allUsers = await getUsers();
      setUsersList(allUsers);
    } catch (error) {
      toast.error("Gagal memuat data pengguna.");
    }
  };

  const fetchLeaves = async () => {
    const leaves = await getLeaveRequests();
    setLeaveRequests(leaves);
    const count = await getPendingLeaveCount();
    setPendingLeaveCount(count);
  };

  const handleLeaveAction = async (id: string, action: 'approved' | 'rejected', reason?: string) => {
    if (action === 'rejected' && !reason) {
      const requestToReject = leaveRequests.find(req => req.id === id);
      if (requestToReject) {
        setLeaveRequestToReject(requestToReject);
        setShowRejectionModal(true);
      }
      return;
    }

    if (confirm(`Apakah Anda yakin ingin ${action === 'approved' ? 'menyetujui' : 'menolak'} pengajuan ini?`)) {
      const success = await updateLeaveStatus(id, action, reason);
      if (success) {
        toast.success(`Pengajuan berhasil ${action === 'approved' ? 'disetujui' : 'ditolak'}`);
        fetchLeaves();
        fetchData(); // Refresh stats to update Alpa/OnLeave counts
        if (action === 'rejected') {
          setShowRejectionModal(false);
          setRejectionReason('');
        }
      } else {
        toast.error("Gagal memperbarui status pengajuan");
      }
    }
  };

  const handleGenerateSummary = async () => {
    setGeneratingAi(true);
    setSummary('');
    try {
      const allInterns = usersList.filter(u => u.role === 'intern');
      const presentUserIds = new Set(records.map(r => r.userId));
      const today = new Date().toISOString().split('T')[0];
      const onLeaveUserIds = new Set(
        leaveRequests
          .filter(req => req.status === 'approved' && req.startDate <= today && req.endDate >= today)
          .map(req => req.userId)
      );
      const absentNames = allInterns
        .filter(u => !presentUserIds.has(u.id) && !onLeaveUserIds.has(u.id))
        .map(u => u.name);

      const result = await generateDailySummary(records, absentNames);

      const safeSummary = typeof result === 'string' ? result : "Gagal memproses respons AI.";
      setSummary(safeSummary);
      toast.success("Ringkasan AI berhasil dibuat!");
    } catch (e: any) {
      console.error(e);
      const msg = getErrorMessage(e);
      setSummary("Gagal memuat ringkasan AI.");
      toast.error(`Gagal memuat ringkasan AI: ${msg}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExportExcel = () => {
    if (records.length === 0) {
      toast.warning("Tidak ada data untuk diexport");
      return;
    }

    const headers = ["Waktu", "Nama", "Divisi", "Tipe Absen", "Koordinat", "Status Lokasi", "Terlambat", "URL Foto"];

    const csvRows = [
      headers.join(","),
      ...records.map(r => {
        const time = new Date(r.timestamp).toLocaleTimeString('id-ID');
        const late = r.isLate ? "Ya" : "Tidak";
        const coords = `"${r.location.latitude}, ${r.location.longitude}"`
        return [
          time,
          `"${r.userName}"`,
          `"${r.division}"`,
          r.type.toUpperCase(),
          coords,
          r.status,
          late,
          `"${r.photoUrl}"`
        ].join(",");
      })
    ];

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `absensi_bapekom_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Data berhasil diexport!");
  };

  const handleExportUsersData = async () => {
    try {
      if (usersList.length === 0) {
        toast.warning("Tidak ada data user.");
        return;
      }

      const allRecords = await getAllAttendanceRecords();

      const headers = ["ID", "Nama Lengkap", "Username", "Divisi", "Role", "Total Hadir (Kali)", "Total Terlambat (Kali)", "Terakhir Absen"];

      const csvRows = [
        headers.join(","),
        ...usersList.map(u => {
          const userRecords = allRecords.filter(r => r.userId === u.id);
          const presentCount = userRecords.filter(r => r.type === 'in').length;
          const lateCount = userRecords.filter(r => r.type === 'in' && r.isLate).length;

          let lastSeen = "-";
          if (userRecords.length > 0) {
            const latest = userRecords.reduce((prev, current) => (new Date(prev.timestamp) > new Date(current.timestamp)) ? prev : current);
            lastSeen = new Date(latest.timestamp).toLocaleString('id-ID');
          }

          return [
            u.id,
            `"${u.name}"`,
            u.username,
            `"${u.division}"`,
            u.role,
            presentCount,
            lateCount,
            `"${lastSeen}"`
          ].join(",");
        })
      ];

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `data_magang_bapekom_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Data user & statistik berhasil diexport!");

    } catch (e: any) {
      toast.error("Gagal mengekspor data user: " + getErrorMessage(e));
    }
  };

  const handleExportAttendanceData = () => {
    if (allAttendance.length === 0) {
      toast.warn("Tidak ada data untuk diexport.");
      return;
    }

    try {
      const headers = ["Waktu", "Nama Magang", "Divisi", "Tipe", "Status", "Latitude", "Longitude", "Terlambat"];
      const csvContent = [
        headers.join(","),
        ...allAttendance.map(r => [
          new Date(r.timestamp).toLocaleString(),
          `"${r.userName}"`,
          `"${r.division}"`,
          r.type.toUpperCase(),
          r.status.toUpperCase(),
          r.location.latitude,
          r.location.longitude,
          r.isLate ? "YA" : "TIDAK"
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `riwayat_absensi_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Riwayat absensi berhasil diexport!");
    } catch (e: any) {
      toast.error("Gagal mengekspor data: " + getErrorMessage(e));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.username || !newUserForm.email || !newUserForm.password) {
      toast.warn("Mohon lengkapi data.");
      return;
    }

    try {
      await addUser(newUserForm);
      toast.success("User berhasil ditambahkan! User dapat login dengan email dan password yang telah ditetapkan.");
      setShowAddUserModal(false);
      setNewUserForm({ name: '', username: '', email: '', password: '', division: '', role: 'intern' });
      fetchUsers();
      fetchData(); // Refresh total interns count
    } catch (error: any) {
      const errorMessage = error.message || "Gagal menambahkan user.";
      console.error("Error adding user:", error);
      toast.error(`Gagal menambahkan user: ${errorMessage}`);
    }
  };

  const handleUserClick = async (user: User) => {
    if (user.role === 'admin') return;
    setIsClosingSidebar(false);
    setSelectedUser(user);
    setEditUserForm(user);
    setIsEditingUser(false);
    setLoadingHistory(true);
    try {
      const history = await getUserAttendanceHistory(user.id);
      setSelectedUserHistory(history);
    } catch (err: any) {
      console.error(err);
      toast.error(`Gagal memuat riwayat user: ${getErrorMessage(err)}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    if (window.confirm(`Apakah Anda yakin ingin menghapus user ${user.name}?`)) {
      try {
        await deleteUser(user.id);
        fetchUsers();
        fetchData(); // Update stats
        toast.success(`User ${user.name} berhasil dihapus.`);
        if (selectedUser?.id === user.id) {
          setSelectedUser(null);
        }
      } catch (error) {
        toast.error("Gagal menghapus user.");
      }
    }
  };

  const handleCloseSidebar = () => {
    setIsClosingSidebar(true);
    setTimeout(() => {
      setSelectedUser(null);
      setIsClosingSidebar(false);
    }, 300);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserForm) return;
    if (!editUserForm.name || !editUserForm.username) {
      toast.warn("Nama dan Username tidak boleh kosong.");
      return;
    }
    try {
      const success = await updateUser(editUserForm);
      if (success) {
        setSelectedUser(editUserForm);
        setIsEditingUser(false);
        fetchUsers();
        toast.success("Data user berhasil diperbarui!");
      } else {
        toast.error("Gagal memperbarui data user.");
      }
    } catch (error) {
      toast.error("Gagal memperbarui data user.");
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    const lat = Number(settingsForm.officeLat);
    const lng = Number(settingsForm.officeLng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error("Latitude tidak valid. Nilai harus antara -90 dan 90.");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast.error("Longitude tidak valid. Nilai harus antara -180 dan 180.");
      return;
    }

    const dist = Number(settingsForm.maxDistanceMeters);
    if (isNaN(dist) || dist <= 0) {
      toast.error("Jarak maksimum harus berupa angka positif lebih dari 0.");
      return;
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!settingsForm.lateThreshold || !timeRegex.test(settingsForm.lateThreshold)) {
      toast.error("Waktu 'Batas Telat' tidak valid. Format harus HH:mm (contoh: 07:40).");
      return;
    }
    if (!settingsForm.clockOutTimeMonThu || !timeRegex.test(settingsForm.clockOutTimeMonThu)) {
      toast.error("Waktu 'Pulang (Sen-Kam)' tidak valid.");
      return;
    }
    if (!settingsForm.clockOutTimeFri || !timeRegex.test(settingsForm.clockOutTimeFri)) {
      toast.error("Waktu 'Pulang (Jum)' tidak valid.");
      return;
    }

    const success = saveSettings(settingsForm);
    if (success) {
      setSettingsSaved(true);
      toast.success("Pengaturan berhasil disimpan.");
      setTimeout(() => setSettingsSaved(false), 3000);
    } else {
      toast.error("Gagal menyimpan pengaturan");
    }
  };

  const filteredLeaves = leaveRequests.filter(req => {
    if (leaveFilter === 'all') return true;
    return req.status === leaveFilter;
  });

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex flex-col md:flex-row font-sans text-slate-600 dark:text-slate-400 transition-colors duration-300">

        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 md:static shadow-2xl md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div>
            <div className="flex items-center justify-between mb-10 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
                  <img src="./logo.png" alt="Logo" className="w-full h-full" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight leading-none">BAPEKOM</h2>
                  <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase block mt-0.5">Wilayah VIII</span>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <nav className="space-y-2">
              {['dashboard', 'overview', 'users', 'leaves', 'history', 'settings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab as any); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all shadow-sm text-left ${activeTab === tab ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}
                >
                  <i className={`fas fa-${tab === 'dashboard' ? 'home' : tab === 'overview' ? 'chart-line' : tab === 'users' ? 'users' : tab === 'leaves' ? 'envelope-open-text' : tab === 'history' ? 'history' : 'cog'} w-5 text-center`}></i>
                  <span className="text-sm font-medium capitalize">{tab === 'overview' ? 'Analisis' : tab === 'users' ? 'Data Magang' : tab === 'leaves' ? 'Perizinan' : tab === 'history' ? 'Riwayat Absen' : tab}</span>
                  {tab === 'leaves' && pendingLeaveCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingLeaveCount}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-2">
            <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center gap-3 py-3 px-4 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
              <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} w-5 text-center`}></i>
              <span className="text-sm font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button onClick={onLogout} className="w-full flex items-center gap-3 py-3 px-4 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all">
              <i className="fas fa-sign-out-alt w-5 text-center"></i>
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen w-full">
          <div className="md:hidden flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform">
                <i className="fas fa-bars"></i>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-center">
                  <img src="./logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="font-bold dark:text-white text-sm">BAPEKOM</h1>
                  {isSuperAdmin(user) && <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wide">Super Admin</p>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-xs">
                <p className="font-bold dark:text-white">{user.name}</p>
                <p className="text-slate-400">{isSuperAdmin(user) ? 'Super Admin' : 'Admin'}</p>
              </div>
              <button onClick={onLogout} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center active:scale-95 transition-transform"><i className="fas fa-sign-out-alt"></i></button>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="animate-fade-in space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Overview</h1>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Pantau aktivitas absensi magang hari ini.</p>
                </div>
                <button onClick={handleExportExcel} className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all">
                  <i className="fas fa-file-excel"></i> Export Excel
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Hadir Hari Ini - Biru */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50 p-5 rounded-2xl border-2 border-blue-300 dark:border-blue-700 shadow-lg shadow-blue-500/20 relative overflow-hidden group hover:shadow-xl hover:shadow-blue-500/30 transition-all">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-blue-600"><i className="fas fa-users text-6xl"></i></div>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-1">{stats?.presentToday || 0}</p>
                  <p className="text-[10px] md:text-xs text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">Hadir Hari Ini</p>
                </div>
                
                {/* Terlambat - Kuning */}
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/50 p-5 rounded-2xl border-2 border-yellow-400 dark:border-yellow-700 shadow-lg shadow-yellow-500/20 relative overflow-hidden group hover:shadow-xl hover:shadow-yellow-500/30 transition-all">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-yellow-600"><i className="fas fa-clock text-6xl"></i></div>
                  <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300 mb-1">{stats?.lateToday || 0}</p>
                  <p className="text-[10px] md:text-xs text-yellow-600 dark:text-yellow-400 uppercase font-bold tracking-wider">Terlambat</p>
                </div>
                
                {/* Izin/Sakit - Biru */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50 p-5 rounded-2xl border-2 border-blue-300 dark:border-blue-700 shadow-lg shadow-blue-500/20 relative overflow-hidden group hover:shadow-xl hover:shadow-blue-500/30 transition-all">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-blue-600"><i className="fas fa-notes-medical text-6xl"></i></div>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-1">{stats?.onLeaveToday || 0}</p>
                  <p className="text-[10px] md:text-xs text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">Izin/Sakit</p>
                </div>
                
                {/* Alpa - Merah */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/50 p-5 rounded-2xl border-2 border-red-400 dark:border-red-700 shadow-lg shadow-red-500/20 relative overflow-hidden group hover:shadow-xl hover:shadow-red-500/30 transition-all">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-red-600"><i className="fas fa-user-times text-6xl"></i></div>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-300 mb-1">{stats?.alpaToday || 0}</p>
                  <p className="text-[10px] md:text-xs text-red-600 dark:text-red-400 uppercase font-bold tracking-wider">Alpa (Tidak Hadir)</p>
                </div>
                
                {/* Total Peserta - Hitam */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-5 rounded-2xl border-2 border-slate-700 dark:border-slate-600 shadow-lg shadow-slate-900/20 relative overflow-hidden group hover:shadow-xl hover:shadow-slate-900/30 transition-all">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-slate-400"><i className="fas fa-id-card text-6xl"></i></div>
                  <p className="text-3xl font-bold text-white mb-1">{stats?.totalInterns || 0}</p>
                  <p className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider">Total Peserta</p>
                </div>
              </div>

              {pendingLeaveCount > 0 && (
                <div
                  onClick={() => setActiveTab('leaves')}
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center animate-pulse">
                      <i className="fas fa-bell"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">Persetujuan Pending</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Ada {pendingLeaveCount} pengajuan izin baru yang perlu ditinjau.</p>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-slate-400"></i>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <DailyStatusChart stats={stats} />
                <DivisionPieChart users={usersList} />
              </div>

              <div className="w-full">
                <WeeklyBarChart stats={weeklyStats} />
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold dark:text-white flex items-center gap-2"><i className="fas fa-robot text-purple-500"></i> Ringkasan Harian (AI)</h3>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={generatingAi}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {generatingAi ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-magic"></i>}
                    Generate Summary
                  </button>
                </div>

                {summary ? (
                  <div className="bg-purple-50 dark:bg-slate-800 p-4 rounded-xl text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line border border-purple-100 dark:border-slate-700 animate-fade-in">
                    {summary}
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-slate-400 text-sm italic">Klik tombol untuk membuat ringkasan otomatis aktivitas hari ini menggunakan Gemini AI.</p>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm">
                <h3 className="font-bold mb-4 dark:text-white">Aktivitas Terkini (30 Hari Terakhir)</h3>
                {recentRecords.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">Memuat data aktivitas...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-slate-400 border-b dark:border-slate-800"><th className="pb-3 pl-2">Waktu</th><th className="pb-3">User</th><th className="pb-3">Status</th><th className="pb-3 text-right pr-2">Bukti</th></tr>
                      </thead>
                      <tbody>
                        {recentRecords.map(r => (
                          <tr key={r.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 pl-2 dark:text-slate-300 font-mono">{new Date(r.timestamp).toLocaleTimeString()}</td>
                            <td className="py-3">
                              <div className="font-bold dark:text-white">{r.userName}</div>
                              <div className="text-[10px] text-slate-400 uppercase font-semibold">{r.division}</div>
                            </td>
                            <td className="py-3">
                              <div className="flex gap-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.type === 'in' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>{r.type}</span>
                                {r.isLate && r.type === 'in' && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-100">Telat</span>}
                              </div>
                            </td>
                            <td className="py-3 text-right pr-2">
                              <div className="w-10 h-10 ml-auto bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden cursor-pointer border dark:border-slate-700 shadow-sm hover:scale-110 transition-transform" onClick={() => window.open(r.photoUrl, '_blank')}>
                                <img src={r.photoUrl} alt="Bukti" className="w-full h-full object-cover" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-2xl font-bold dark:text-white">Data Magang</h1>
                  <p className="text-slate-400 text-sm mt-1">Kelola data peserta magang.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleExportUsersData} className="px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors text-sm font-bold">
                    <i className="fas fa-file-csv"></i> Export CSV
                  </button>
                  {isSuperAdmin(user) && (
                    <button onClick={() => setShowAddUserModal(true)} className="w-10 h-10 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors" title="Tambah User (Super Admin Only)"><i className="fas fa-plus"></i></button>
                  )}
                </div>
              </div>

              {!isSuperAdmin(user) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl text-sm text-amber-700 dark:text-amber-400 mb-6 flex items-center gap-2">
                  <i className="fas fa-info-circle"></i>
                  Anda adalah Admin biasa. Hanya Super Admin yang bisa menambah atau menghapus user.
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs font-bold">
                      <tr><th className="px-6 py-4">Nama</th><th className="px-6 py-4">Divisi</th><th className="px-6 py-4">Role</th><th className="px-6 py-4 text-center">Aksi</th></tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                      {usersList.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => handleUserClick(u)}>
                          <td className="px-6 py-4">
                            <div className="font-bold dark:text-white">{u.name}</div>
                            <div className="text-xs text-slate-400">@{u.username}</div>
                          </td>
                          <td className="px-6 py-4 dark:text-slate-300">{u.division}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              u.role === 'super-admin' 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                : u.role === 'admin' 
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {u.role === 'super-admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Intern'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isSuperAdmin(user) && u.role !== 'super-admin' && (
                              <button onClick={(e) => handleDeleteClick(e, u)} className="text-slate-400 hover:text-red-500 p-2 transition-colors" title="Hapus User"><i className="fas fa-trash-alt"></i></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="animate-fade-in space-y-8">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Analisis Absensi</h1>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Data riwayat absensi dan analisis kehadiran peserta magang.</p>
                </div>
                <button onClick={fetchAttendanceHistory} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors" title="Refresh Data">
                  <i className={`fas fa-sync-alt ${loadingAllAttendance ? 'fa-spin' : ''}`}></i>
                </button>
              </div>
              {loadingAllAttendance ? (
                <div className="text-center py-20">
                  <i className="fas fa-circle-notch fa-spin text-4xl text-slate-300 mb-4"></i>
                  <p className="text-slate-400">Memuat data analisis...</p>
                </div>
              ) : (
                <AttendanceOverview allAttendance={allAttendance} users={usersList} />
              )}
            </div>
          )}

          {activeTab === 'leaves' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Manajemen Perizinan</h1>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Daftar pengajuan izin dan sakit peserta magang.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border dark:border-slate-800 flex mb-6">
                {['pending', 'approved', 'rejected', 'all'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setLeaveFilter(filter as LeaveFilterType)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize ${leaveFilter === filter ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    {filter === 'all' ? 'Semua' : filter === 'pending' ? 'Menunggu' : filter === 'approved' ? 'Disetujui' : 'Ditolak'}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {filteredLeaves.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <i className="far fa-folder-open text-4xl text-slate-300 mb-4"></i>
                    <p className="text-slate-500">Tidak ada data pengajuan untuk status ini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredLeaves.map(req => (
                      <div key={req.id} className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-6 ${req.status === 'pending' ? 'border-amber-200 dark:border-amber-900/50 shadow-amber-500/5' : req.status === 'approved' ? 'border-emerald-200 dark:border-emerald-900/50 shadow-emerald-500/5' : 'border-red-200 dark:border-red-900/50 shadow-red-500/5'}`}>
                        <div className="w-full md:w-32 h-32 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden cursor-pointer border dark:border-slate-700 relative group" onClick={() => req.attachmentUrl && window.open(req.attachmentUrl, '_blank')}>
                          {req.attachmentUrl ? (
                            <>
                              <img src={req.attachmentUrl} alt="Bukti" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-search-plus text-white"></i></div>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                              <i className="fas fa-image mb-1 text-2xl opacity-20"></i> No Image
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{req.userName}</h3>
                              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">{req.division} • {new Date(req.requestDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${req.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              req.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                              {req.status === 'pending' ? 'Menunggu' : req.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                            </span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-4 text-sm space-y-2 border border-slate-100 dark:border-slate-700">
                            <div className="flex gap-4">
                              <span className="font-semibold w-24 text-slate-500 text-xs uppercase tracking-wide">Tipe</span>
                              <span className={`font-bold uppercase ${req.type === 'sakit' ? 'text-red-600' : 'text-purple-600'}`}>{req.type}</span>
                            </div>
                            <div className="flex gap-4">
                              <span className="font-semibold w-24 text-slate-500 text-xs uppercase tracking-wide">Tanggal</span>
                              <span className="text-slate-800 dark:text-slate-200 font-medium">{req.startDate} s.d {req.endDate}</span>
                            </div>
                            <div className="flex gap-4">
                              <span className="font-semibold w-24 text-slate-500 text-xs uppercase tracking-wide">Alasan</span>
                              <span className="text-slate-800 dark:text-slate-200 italic">"{req.reason}"</span>
                            </div>
                          </div>

                          {req.status === 'pending' && (
                            <div className="flex gap-3 justify-end">
                              <button
                                onClick={() => handleLeaveAction(req.id, 'rejected')}
                                className="px-4 py-2 bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-sm font-bold transition-all"
                              >
                                Tolak
                              </button>
                              <button
                                onClick={() => handleLeaveAction(req.id, 'approved')}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
                              >
                                Setujui
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-2xl font-bold dark:text-white">Riwayat Absensi Seluruhnya</h1>
                  <p className="text-slate-400 text-sm mt-1">Data absensi lengkap dari seluruh peserta magang.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Cari nama peserta magang..."
                      value={searchName}
                      onChange={e => setSearchName(e.target.value)}
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-slate-400 dark:placeholder-slate-500"
                    />
                  </div>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                  >
                    {getMonthOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button onClick={fetchAttendanceHistory} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors" title="Refresh Data">
                    <i className={`fas fa-sync-alt ${loadingAllAttendance ? 'fa-spin' : ''}`}></i>
                  </button>
                  <button onClick={handleExportAttendanceData} className="px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors text-sm font-bold">
                    <i className="fas fa-file-csv"></i> Export CSV
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 overflow-hidden">
                {searchName && (
                  <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b dark:border-slate-800 text-sm text-blue-700 dark:text-blue-300">
                    Hasil pencarian untuk <span className="font-bold">"{searchName}"</span>: {getFilteredAttendance().length} data
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Waktu</th>
                        <th className="px-6 py-4">Nama Magang</th>
                        <th className="px-6 py-4">Tipe</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Bukti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                      {loadingAllAttendance ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">Memuat data riwayat...</td>
                        </tr>
                      ) : getFilteredAttendance().length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">Belum ada data riwayat absensi untuk bulan ini.</td>
                        </tr>
                      ) : (
                        getFilteredAttendance().map(r => (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-bold dark:text-white">{new Date(r.timestamp).toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{new Date(r.timestamp).toLocaleTimeString()}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold dark:text-white">{r.userName}</div>
                              <div className="text-[10px] text-slate-400 uppercase font-semibold">{r.division}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.type === 'in' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>{r.type === 'in' ? 'Masuk' : 'Pulang'}</span>
                                {r.isLate && r.type === 'in' && <span className="w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-100 italic">Terlambat</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${r.status === 'valid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 font-mono' : 'bg-red-50 text-red-600 border border-red-100 font-mono'}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="w-10 h-10 ml-auto bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden cursor-pointer border dark:border-slate-700 shadow-sm hover:scale-110 transition-transform" onClick={() => { setSelectedPhoto(r.photoUrl); setShowPhotoModal(true); }}>
                                <img src={r.photoUrl} alt="Bukti" className="w-full h-full object-cover" />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fade-in max-w-2xl">
              <h1 className="text-2xl md:text-3xl font-bold mb-8 dark:text-white">Pengaturan Sistem</h1>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border dark:border-slate-800 shadow-sm">
                  <h3 className="font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Lokasi Kantor</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-sm border-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        value={settingsForm.officeLat}
                        onChange={e => setSettingsForm({ ...settingsForm, officeLat: parseFloat(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-sm border-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        value={settingsForm.officeLng}
                        onChange={e => setSettingsForm({ ...settingsForm, officeLng: parseFloat(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Max Jarak (Meter)</label>
                    <input
                      type="number"
                      min="1"
                      className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-sm border-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                      value={settingsForm.maxDistanceMeters}
                      onChange={e => setSettingsForm({ ...settingsForm, maxDistanceMeters: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border dark:border-slate-800 shadow-sm">
                  <h3 className="font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Waktu Absensi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Batas Telat</label>
                      <input
                        type="time"
                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-sm border-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        value={settingsForm.lateThreshold}
                        onChange={e => setSettingsForm({ ...settingsForm, lateThreshold: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Pulang (Sen-Kam)</label>
                      <input
                        type="time"
                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-sm border-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        value={settingsForm.clockOutTimeMonThu}
                        onChange={e => setSettingsForm({ ...settingsForm, clockOutTimeMonThu: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Pulang (Jum)</label>
                      <input
                        type="time"
                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-sm border-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        value={settingsForm.clockOutTimeFri}
                        onChange={e => setSettingsForm({ ...settingsForm, clockOutTimeFri: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className={`w-full py-4 text-white rounded-xl font-bold shadow-lg transition-all ${settingsSaved ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {settingsSaved ? <span className="flex items-center justify-center gap-2"><i className="fas fa-check"></i> Pengaturan Disimpan!</span> : "Simpan Pengaturan"}
                </button>
              </form>
            </div>
          )}
        </main>

        {showAddUserModal && isSuperAdmin(user) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up border dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Tambah User Baru</h3>
                <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 dark:placeholder-slate-600"
                    placeholder="Contoh: Budi Santoso"
                    value={newUserForm.name}
                    onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Divisi</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 dark:placeholder-slate-600"
                    placeholder="Contoh: IT Support"
                    value={newUserForm.division}
                    onChange={e => setNewUserForm({ ...newUserForm, division: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 dark:placeholder-slate-600"
                    placeholder="Contoh: email@example.com"
                    value={newUserForm.email}
                    onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Username</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 dark:placeholder-slate-600"
                      placeholder="username"
                      value={newUserForm.username}
                      onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Password</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 dark:placeholder-slate-600"
                      placeholder="password"
                      value={newUserForm.password}
                      onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Role</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm text-slate-700 dark:text-slate-200 font-medium"
                    value={newUserForm.role}
                    onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value as 'intern' | 'admin' | 'super-admin' })}
                  >
                    <option value="intern">Intern (Magang)</option>
                    <option value="admin">Admin Biasa</option>
                    {isSuperAdmin(user) && <option value="super-admin">Super Admin</option>}
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-colors"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <div className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isClosingSidebar ? 'opacity-0' : 'opacity-100'}`} onClick={handleCloseSidebar}></div>
            <div className={`relative w-full md:w-[480px] bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto flex flex-col border-l border-slate-100 dark:border-slate-800 ${isClosingSidebar ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold dark:text-white">{selectedUser.name}</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500">@{selectedUser.username} • {selectedUser.division}</p>
                </div>
                <button onClick={handleCloseSidebar} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><i className="fas fa-times"></i></button>
              </div>

              {!isEditingUser ? (
                <button
                  onClick={() => setIsEditingUser(true)}
                  className="w-full mb-6 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <i className="fas fa-edit mr-2"></i> Edit Data User
                </button>
              ) : (
                <form onSubmit={handleSaveEditUser} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl mb-6 space-y-4 border border-slate-100 dark:border-slate-700">
                  <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Edit Detail Pengguna</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nama Lengkap</label>
                      <input className="w-full p-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={editUserForm?.name} onChange={e => editUserForm && setEditUserForm({ ...editUserForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Username</label>
                      <input className="w-full p-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={editUserForm?.username} onChange={e => editUserForm && setEditUserForm({ ...editUserForm, username: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email</label>
                    <input className="w-full p-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={editUserForm?.email || ''} onChange={e => editUserForm && setEditUserForm({ ...editUserForm, email: e.target.value })} placeholder="email@example.com" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Divisi</label>
                      <input className="w-full p-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={editUserForm?.division} onChange={e => editUserForm && setEditUserForm({ ...editUserForm, division: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Password Baru (Opsional)</label>
                      <input className="w-full p-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" type="password" placeholder="Isi untuk ganti password" value={editUserForm?.password || ''} onChange={e => editUserForm && setEditUserForm({ ...editUserForm, password: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setIsEditingUser(false)} className="flex-1 py-2 text-xs font-bold text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                    <button type="submit" className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-colors">Simpan Perubahan</button>
                  </div>
                </form>
              )}

              <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide text-slate-400"><i className="fas fa-history"></i> Riwayat Absensi</h3>
              <div className="space-y-3">
                {loadingHistory ? (
                  <div className="text-center py-10 text-slate-400"><i className="fas fa-circle-notch fa-spin"></i> Memuat...</div>
                ) : selectedUserHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">Belum ada riwayat absensi.</div>
                ) : (
                  selectedUserHistory.map((record, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => window.open(record.photoUrl, '_blank')}>
                        <img src={record.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-sm dark:text-white">{new Date(record.timestamp).toLocaleDateString()}</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${record.type === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{record.type}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <p className="text-xs text-slate-500 font-mono">{new Date(record.timestamp).toLocaleTimeString()}</p>
                          <p className="text-[10px] text-slate-400 truncate w-24 text-right">{record.location.latitude.toFixed(4)}, {record.location.longitude.toFixed(4)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {showRejectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up border dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Alasan Penolakan</h3>
                <button onClick={() => setShowRejectionModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleLeaveAction(leaveRequestToReject!.id, 'rejected', rejectionReason); }}>
                <textarea
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 dark:placeholder-slate-600"
                  rows={4}
                  placeholder="Masukkan alasan penolakan..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectionModal(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-colors"
                  >
                    Kirim Penolakan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPhotoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowPhotoModal(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-fade-in-up border dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Bukti Absensi</h3>
                <button onClick={() => setShowPhotoModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center max-h-96">
                <img src={selectedPhoto} alt="Bukti Absensi" className="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

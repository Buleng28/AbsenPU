import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { User, LocationData, AttendanceRecord, LeaveRequest } from '../types';
import CameraCapture from './CameraCapture';
import MonthlyRecap from './MonthlyRecap';
import { submitAttendance, getTodaysRecords, getUserAttendanceHistory, getUserStats } from '../services/attendanceService';
import { updateUser } from '../services/userService';
import { getSettings } from '../services/settingsService';
import { createLeaveRequest, getLeaveRequestsByUser, updateLeaveRequest } from '../services/leaveService';

interface InternDashboardProps {
   user: User;
   onLogout: () => void;
}

const InternDashboard: React.FC<InternDashboardProps> = ({ user: initialUser, onLogout }) => {
   const [user, setUser] = useState<User>(initialUser);
   const [showCamera, setShowCamera] = useState(false);
   const [loading, setLoading] = useState(false);
   const [location, setLocation] = useState<LocationData | null>(null);
   const [error, setError] = useState<string>('');
   const [warning, setWarning] = useState<string>('');
   const [history, setHistory] = useState<AttendanceRecord[]>([]);
   const [attendanceType, setAttendanceType] = useState<'in' | 'out'>('in');
   const [currentTime, setCurrentTime] = useState(new Date());

   // Welcome Animation State
   const [showWelcome, setShowWelcome] = useState(true);

   // Profile Upload State
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [uploadingPhoto, setUploadingPhoto] = useState(false);

   // Leave Request State
   const [showLeaveModal, setShowLeaveModal] = useState(false);
   const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
   const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'recap'>('attendance');
   const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
   const [leaveForm, setLeaveForm] = useState({
      type: 'sakit' as 'sakit' | 'izin',
      startDate: '',
      endDate: '',
      reason: '',
      attachmentUrl: ''
   });

   // Personal Stats State
   const [personalStats, setPersonalStats] = useState({ present: 0, late: 0, onLeave: 0 });
   const attachmentInputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      const welcomeTimer = setTimeout(() => {
         setShowWelcome(false);
      }, 5000); // Hide after 5 seconds

      loadHistory();
      loadLeaveHistory();
      getLocation();

      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => {
         clearInterval(timer);
         clearTimeout(welcomeTimer);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const getLocation = () => {
      setError('');
      setLocation(null);
      if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(
            (position) => {
               setLocation({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy
               });
            },
            (err) => {
               console.error(err);
               let msg = "Gagal mendapatkan lokasi. Pastikan GPS aktif.";
               if (err.code === 1) msg = "Izin lokasi ditolak. Mohon izinkan akses lokasi.";
               else if (err.code === 2) msg = "Posisi tidak tersedia. Pastikan GPS aktif.";
               else if (err.code === 3) msg = "Waktu habis saat mencari lokasi.";
               setError(msg);
               toast.error(msg);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
         );
      } else {
         setError("Browser tidak mendukung geolokasi.");
      }
   };

   const loadHistory = async () => {
      try {
         const recs = await getUserAttendanceHistory(user.id);
         setHistory(recs);

         const stats = await getUserStats(user.id);
         setPersonalStats(stats);
      } catch (err) {
         console.error("Failed to load user history:", err);
         toast.error("Gagal memuat riwayat absensi.");
      }
   };

   const loadLeaveHistory = async () => {
      const leaves = await getLeaveRequestsByUser(user.id);

      // Smart Notification: Check for recently updated status
      const lastSeenStatus = localStorage.getItem(`last_leave_status_${user.id}`);
      const latestLeave = leaves[0]; // Assuming sorted by date desc

      if (latestLeave && latestLeave.id + latestLeave.status !== lastSeenStatus) {
         if (latestLeave.status === 'approved') {
            toast.success(`🎉 Izin Anda pada ${latestLeave.startDate} telah DISETUJUI!`, { autoClose: 5000 });
         } else if (latestLeave.status === 'rejected') {
            toast.error(`⚠️ Izin Anda pada ${latestLeave.startDate} DITOLAK. Alasan: ${latestLeave.rejectionReason || '-'}`, { autoClose: 7000 });
         }
         localStorage.setItem(`last_leave_status_${user.id}`, latestLeave.id + latestLeave.status);
      }

      setLeaveHistory(leaves);
   };

   // Helper function to check if two dates are the same day
   const isSameDay = (date1: Date, date2: Date): boolean => {
      return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
   };

   const handleClockInClick = () => {
      setAttendanceType('in');
      if (!location) {
         if (error) toast.error("Lokasi tidak terdeteksi. Silakan aktifkan GPS.");
         else toast.info("Sedang mencari lokasi... Tunggu sebentar.");
         return;
      }
      setShowCamera(true);
   };

   const handleClockOutClick = () => {
      setAttendanceType('out');

      // Validasi waktu dihapus - absen pulang bisa kapan saja sebelum jam 12 malam

      if (!location) {
         if (error) toast.error("Lokasi tidak terdeteksi. Silakan aktifkan GPS.");
         else toast.info("Sedang mencari lokasi... Tunggu sebentar.");
         return;
      }
      setShowCamera(true);
   };

   const onPhotoCaptured = async (imageData: string) => {
      setShowCamera(false);
      if (!location) return;

      setLoading(true);
      try {
         await submitAttendance({
            userId: user.id,
            userName: user.name,
            division: user.division || 'Umum',
            timestamp: new Date().toISOString(),
            type: attendanceType,
            photoUrl: imageData,
            location: location,
         });
         await loadHistory();
         toast.success(`Berhasil ${attendanceType === 'in' ? 'Masuk' : 'Pulang'}!`);
      } catch (e) {
         console.error(e);
         toast.error("Gagal mengirim data absensi.");
      } finally {
         setLoading(false);
      }
   };

   const handleProfilePhotoClick = () => {
      if (fileInputRef.current) {
         fileInputRef.current.click();
      }
   };

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
         if (file.size > 500 * 1024) {
            toast.warning("Ukuran foto terlalu besar. Maksimal 500KB.");
            return;
         }

         setUploadingPhoto(true);
         try {
            const reader = new FileReader();
            reader.onloadend = () => {
               const base64String = reader.result as string;
               const updatedUser = { ...user, profilePhotoUrl: base64String };
               const success = updateUser(updatedUser);
               if (success) {
                  setUser(updatedUser);
                  toast.success("Foto profil diperbarui");
               } else {
                  toast.error("Gagal menyimpan foto profil.");
               }
               setUploadingPhoto(false);
            };
            reader.onerror = () => {
               toast.error("Gagal membaca file gambar.");
               setUploadingPhoto(false);
            };
            reader.readAsDataURL(file);
         } catch (error) {
            toast.error("Terjadi kesalahan saat memproses gambar.");
            setUploadingPhoto(false);
         }
      }
   };

   // Leave Logic
   const handleLeaveAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
         if (file.size > 1024 * 1024) { // 1MB limit for attachments
            toast.warning("Ukuran file terlalu besar. Maksimal 1MB.");
            return;
         }
         const reader = new FileReader();
         reader.onloadend = () => {
            setLeaveForm({ ...leaveForm, attachmentUrl: reader.result as string });
         };
         reader.readAsDataURL(file);
      }
   };

   const submitLeaveRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
         toast.warn("Mohon lengkapi semua field.");
         return;
      }
      if (leaveForm.type === 'sakit' && !leaveForm.attachmentUrl) {
         toast.warn("Untuk izin sakit, wajib melampirkan foto surat dokter/bukti.");
         return;
      }

      setLoading(true);
      try {
         let success = false;
         if (editingLeave) {
            success = await updateLeaveRequest(editingLeave.id, {
               type: leaveForm.type,
               startDate: leaveForm.startDate,
               endDate: leaveForm.endDate,
               reason: leaveForm.reason,
               attachmentUrl: leaveForm.attachmentUrl
            });
         } else {
            success = await createLeaveRequest({
               userId: user.id,
               type: leaveForm.type,
               startDate: leaveForm.startDate,
               endDate: leaveForm.endDate,
               reason: leaveForm.reason,
               attachmentUrl: leaveForm.attachmentUrl
            });
         }

         if (success) {
            toast.success(editingLeave ? "Pengajuan berhasil diperbarui!" : "Pengajuan berhasil dikirim!");
            setShowLeaveModal(false);
            setEditingLeave(null);
            setLeaveForm({ type: 'sakit', startDate: '', endDate: '', reason: '', attachmentUrl: '' });
            await loadLeaveHistory();
         } else {
            toast.error("Gagal memproses pengajuan.");
         }
      } catch (err) {
         console.error(err);
         toast.error("Terjadi kesalahan.");
      } finally {
         setLoading(false);
      }
   };

   const handleEditLeave = (leave: LeaveRequest) => {
      setEditingLeave(leave);
      setLeaveForm({
         type: leave.type,
         startDate: leave.startDate,
         endDate: leave.endDate,
         reason: leave.reason,
         attachmentUrl: leave.attachmentUrl || ''
      });
      setShowLeaveModal(true);
   };

   // Cek absensi hari ini
   const today = new Date();
   const todayCheckIn = history.find(r => r.type === 'in' && isSameDay(new Date(r.timestamp), today));
   const todayCheckOut = history.find(r => r.type === 'out' && isSameDay(new Date(r.timestamp), today));

   return (
      <div className="min-h-screen bg-slate-50 font-sans pb-24">
         {/* Floating Welcome Message */}
         {showWelcome && (
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-full shadow-lg animate-float-in-out text-center">
               <p className="font-bold text-sm">Selamat Datang, {user.name}!</p>
               <p className="text-xs">Semoga Hari-Harimu Menyenangkan</p>
            </div>
         )}

         <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

         {/* Modern Header */}
         <header className="relative bg-slate-900 text-white pb-24 rounded-b-[2.5rem] shadow-2xl overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600 rounded-full blur-[100px] opacity-30 -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600 rounded-full blur-[80px] opacity-20 -ml-16 -mb-16"></div>

            <div className="relative z-10 px-6 pt-8">
               <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                     <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
                        <img src="./logo.png" alt="Logo" className="w-6 h-6" />
                     </div>
                     <div>
                        <h1 className="font-bold text-lg tracking-tight">BAPEKOM</h1>
                        <p className="text-[10px] text-blue-200 tracking-widest uppercase">Wilayah VIII Makassar</p>
                     </div>
                  </div>
                  <button onClick={onLogout} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
                     <i className="fas fa-sign-out-alt text-sm"></i>
                  </button>
               </div>

               <div className="flex flex-col items-center justify-center mt-2">
                  <div className="relative group mb-4">
                     <div onClick={handleProfilePhotoClick} className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-blue-400 to-indigo-500 shadow-xl cursor-pointer hover:scale-105 transition-transform">
                        <div className="w-full h-full rounded-full bg-slate-800 overflow-hidden relative">
                           {user.profilePhotoUrl ? (
                              <img src={user.profilePhotoUrl} alt={user.name} className="w-full h-full object-cover" />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-slate-700">{user.name.charAt(0)}</div>
                           )}
                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <i className="fas fa-camera text-white"></i>
                           </div>
                        </div>
                     </div>
                     {uploadingPhoto && <div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-circle-notch fa-spin text-white drop-shadow-md"></i></div>}
                  </div>
                  <h2 className="text-xl font-bold">{user.name}</h2>
                  <span className="text-sm text-blue-200 bg-white/10 px-3 py-0.5 rounded-full mt-1 border border-white/10 backdrop-blur-sm">{user.division || 'Peserta Magang'}</span>
               </div>
            </div>
         </header>

         {/* Floating Main Card */}
         <div className="px-5 -mt-16 relative z-20">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
               {/* Live Clock & Location Status */}
               <div className="flex justify-between items-end mb-6 pb-6 border-b border-slate-100">
                  <div>
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">Waktu Sekarang</p>
                     <div className="text-3xl font-black text-slate-800 tracking-tight leading-none font-mono">
                        {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-sm text-slate-400 font-sans ml-1 font-medium animate-pulse">WITA</span>
                     </div>
                     <p className="text-xs font-medium text-slate-400 mt-1">
                        {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                     </p>
                  </div>
                  <div className="text-right">
                     {location ? (
                        <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Lokasi Aman
                        </div>
                     ) : error ? (
                        <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-red-100 flex items-center gap-1.5 shadow-sm">
                           <i className="fas fa-exclamation-circle"></i> Error GPS
                        </div>
                     ) : (
                        <div className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-amber-100 flex items-center gap-1.5 shadow-sm">
                           <i className="fas fa-circle-notch fa-spin"></i> Cari Lokasi
                        </div>
                     )}
                  </div>
               </div>

               {/* Personal Stats Section */}
               <div className="grid grid-cols-3 gap-3 mb-6 -mt-12 relative z-20">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                     <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Hadir Luar</div>
                     <div className="text-lg font-bold text-blue-600">{personalStats.present}</div>
                     <div className="text-[8px] text-slate-400 mt-0.5">Bulan Ini</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                     <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Telat</div>
                     <div className="text-lg font-bold text-red-500">{personalStats.late}</div>
                     <div className="text-[8px] text-slate-400 mt-0.5">Bulan Ini</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                     <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Izin</div>
                     <div className="text-lg font-bold text-emerald-500">{personalStats.onLeave}</div>
                     <div className="text-[8px] text-slate-400 mt-0.5">Disetujui</div>
                  </div>
               </div>

               {/* Action Buttons */}
               <div className="grid grid-cols-2 gap-4">
                  <button
                     onClick={handleClockInClick}
                     disabled={loading || !!todayCheckIn}
                     className={`relative h-28 rounded-2xl flex flex-col items-center justify-center gap-2 overflow-hidden transition-all duration-300 group shadow-lg ${todayCheckIn
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/30 active:scale-95'
                        }`}
                  >
                     <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl"><i className="fas fa-sign-in-alt"></i></div>
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${todayCheckIn ? 'bg-slate-200' : 'bg-white/20 backdrop-blur-sm'}`}>
                        <i className="fas fa-sign-in-alt"></i>
                     </div>
                     <span className="font-bold text-sm">Absen Masuk</span>
                  </button>

                  <button
                     onClick={handleClockOutClick}
                     disabled={loading || !todayCheckIn || !!todayCheckOut}
                     className={`relative h-28 rounded-2xl flex flex-col items-center justify-center gap-2 overflow-hidden transition-all duration-300 group shadow-lg ${!todayCheckIn || todayCheckOut
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-orange-500/30 active:scale-95'
                        }`}
                  >
                     <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl"><i className="fas fa-sign-out-alt"></i></div>
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${!todayCheckIn || todayCheckOut ? 'bg-slate-200' : 'bg-white/20 backdrop-blur-sm'}`}>
                        <i className="fas fa-sign-out-alt"></i>
                     </div>
                     <span className="font-bold text-sm">Absen Pulang</span>
                  </button>
               </div>

               {/* Quick Action: Leave Request Button */}
               <button
                  onClick={() => setShowLeaveModal(true)}
                  className="w-full mt-4 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold text-sm shadow-sm border border-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95"
               >
                  <i className="fas fa-calendar-plus text-lg"></i>
                  <span>Ajukan Izin / Sakit</span>
               </button>
            </div>
         </div>

         {/* Tabs Navigation */}
         <div className="px-6 mt-8">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 flex mb-6">
               <button
                  onClick={() => setActiveTab('attendance')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'attendance' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
               >
                  Riwayat Absen
               </button>
               <button
                  onClick={() => setActiveTab('leaves')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'leaves' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
               >
                  Riwayat Izin
               </button>
               <button
                  onClick={() => setActiveTab('recap')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'recap' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
               >
                  Recap Bulanan
               </button>
            </div>

            {/* Content Area */}
            <div className="space-y-4 animate-fade-in-up">
               {activeTab === 'attendance' && (
                  <>
                     {history.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
                           <i className="fas fa-history text-4xl text-slate-200 mb-3 block"></i>
                           <p className="text-slate-400 text-xs">Belum ada aktivitas hari ini.</p>
                        </div>
                     ) : (
                        <div className="relative pl-4 border-l-2 border-slate-200 space-y-6">
                           {history.map((record) => (
                              <div key={record.id} className="relative">
                                 {/* Timeline Dot */}
                                 <div className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${record.type === 'in' ? (record.isLate ? 'bg-amber-400' : 'bg-blue-500') : 'bg-orange-500'}`}></div>

                                 <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                                    <div className="w-14 h-14 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => window.open(record.photoUrl, '_blank')}>
                                       <img src={record.photoUrl} alt="Bukti" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <div className="flex justify-between items-center mb-0.5">
                                          <h4 className="font-bold text-slate-800 text-sm truncate">{record.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}</h4>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${record.type === 'in' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                             {new Date(record.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                       </div>
                                       <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                          <i className="fas fa-map-marker-alt"></i>
                                          <span className="truncate">{record.location.latitude.toFixed(5)}, {record.location.longitude.toFixed(5)}</span>
                                       </div>
                                       {record.isLate && record.type === 'in' && <span className="text-[10px] text-red-500 font-bold mt-1 block">TERLAMBAT</span>}
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </>
               )}

               {activeTab === 'leaves' && (
                  <>
                     {leaveHistory.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
                           <i className="far fa-folder-open text-4xl text-slate-200 mb-3 block"></i>
                           <p className="text-slate-400 text-xs">Belum ada pengajuan.</p>
                        </div>
                     ) : (
                        <div className="space-y-3">
                           {leaveHistory.map((leave) => (
                              <div key={leave.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                                 <div className={`absolute top-0 bottom-0 left-0 w-1 ${leave.status === 'approved' ? 'bg-emerald-500' : leave.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                                 <div className="pl-3">
                                    <div className="flex justify-between items-start mb-1">
                                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${leave.type === 'sakit' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                                          {leave.type}
                                       </span>
                                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                          leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                          }`}>
                                          {leave.status === 'pending' ? 'Menunggu' : leave.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                                       </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-1">{leave.reason}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                       <i className="far fa-calendar-alt"></i>
                                       <span>{new Date(leave.startDate).toLocaleDateString('id-ID')} - {new Date(leave.endDate).toLocaleDateString('id-ID')}</span>
                                    </div>
                                    {leave.status === 'rejected' && leave.rejectionReason && (
                                       <div className="mt-2 p-2 bg-red-50 border-l-2 border-red-200 text-red-700 text-xs italic">
                                          <strong>Alasan Penolakan:</strong> {leave.rejectionReason}
                                       </div>
                                    )}
                                    {leave.status === 'pending' && (
                                       <button
                                          onClick={() => handleEditLeave(leave)}
                                          className="mt-3 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-100 flex items-center justify-center gap-2 transition-all"
                                       >
                                          <i className="fas fa-edit"></i> Edit Pengajuan
                                       </button>
                                    )}
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </>
               )}

               {activeTab === 'recap' && (
                  <MonthlyRecap userId={user.id} />
               )}
            </div>
         </div>

         {showCamera && <CameraCapture onCapture={onPhotoCaptured} onClose={() => setShowCamera(false)} />}

         {/* Modern Leave Modal */}
         {showLeaveModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
               <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-3xl p-6 sm:p-8 animate-fade-in-up shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                        <h3 className="text-xl font-bold text-slate-800">{editingLeave ? 'Edit Pengajuan' : 'Ajukan Izin'}</h3>
                        <p className="text-xs text-slate-400">{editingLeave ? 'Perbarui data pengajuan Anda.' : 'Isi form berikut dengan benar.'}</p>
                     </div>
                     <button onClick={() => { setShowLeaveModal(false); setEditingLeave(null); setLeaveForm({ type: 'sakit', startDate: '', endDate: '', reason: '', attachmentUrl: '' }); }} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"><i className="fas fa-times"></i></button>
                  </div>

                  <form onSubmit={submitLeaveRequest} className="space-y-5">
                     <div className="flex bg-slate-100 p-1.5 rounded-xl">
                        <button type="button" onClick={() => setLeaveForm({ ...leaveForm, type: 'sakit' })} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${leaveForm.type === 'sakit' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Sakit</button>
                        <button type="button" onClick={() => setLeaveForm({ ...leaveForm, type: 'izin' })} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${leaveForm.type === 'izin' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Izin</button>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dari Tanggal</label>
                           <input type="date" required className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 text-sm font-semibold text-slate-700" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sampai Tanggal</label>
                           <input type="date" required className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 text-sm font-semibold text-slate-700" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                        </div>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Alasan</label>
                        <textarea required rows={3} className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 font-medium" placeholder="Jelaskan alasan izin/sakit..." value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}></textarea>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bukti (Surat Dokter/Lainnya)</label>
                        <input type="file" ref={attachmentInputRef} onChange={handleLeaveAttachmentChange} accept="image/*" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer bg-slate-50 rounded-xl border-2 border-dashed border-slate-200" />
                        {leaveForm.attachmentUrl && (
                           <div className="mt-2 relative w-full h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                              <img src={leaveForm.attachmentUrl} alt="Preview" className="w-full h-full object-contain" />
                              <button type="button" onClick={() => { setLeaveForm({ ...leaveForm, attachmentUrl: '' }); if (attachmentInputRef.current) attachmentInputRef.current.value = ''; }} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg hover:bg-red-600 transition-colors"><i className="fas fa-times"></i></button>
                           </div>
                        )}
                     </div>

                     <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl shadow-slate-900/20 hover:bg-black transition-all active:scale-95 mt-4">Kirim Pengajuan</button>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};

export default InternDashboard;
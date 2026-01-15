import React, { useMemo } from 'react';
import { AttendanceRecord, User } from '../types';

interface AttendanceOverviewProps {
  allAttendance: AttendanceRecord[];
  users: User[];
}

// Helper to normalize division names (merge similar ones)
const normalizeDivision = (division: string): string => {
  if (!division) return 'Umum';
  const normalized = division.toLowerCase().trim();
  
  // Merge similar divisions
  if (normalized.includes('arsip')) return 'Arsiparis';
  if (normalized.includes('komputer') || normalized.includes('pranata')) return 'Pranata Komputer';
  
  return division;
};

const AttendanceOverview: React.FC<AttendanceOverviewProps> = ({ allAttendance, users }) => {
  // Calculate statistics
  const stats = useMemo(() => {
    const interns = users.filter(u => u.role === 'intern');
    
    // Total attendance records
    const totalRecords = allAttendance.length;
    
    // Unique users who have attended
    const usersWithAttendance = new Set(allAttendance.map(r => r.userId));
    
    // Valid vs Invalid
    const validAttendance = allAttendance.filter(r => r.status === 'valid').length;
    const invalidAttendance = allAttendance.filter(r => r.status === 'invalid').length;
    
    // Late attendance
    const lateAttendance = allAttendance.filter(r => r.type === 'in' && r.isLate).length;
    
    // Check-in and Check-out
    const checkIns = allAttendance.filter(r => r.type === 'in').length;
    const checkOuts = allAttendance.filter(r => r.type === 'out').length;
    
    // Attendance rate
    const attendanceRate = interns.length > 0 
      ? Math.round((usersWithAttendance.size / interns.length) * 100) 
      : 0;
    
    // Late rate
    const lateRate = checkIns > 0 
      ? Math.round((lateAttendance / checkIns) * 100) 
      : 0;
    
    // Validity rate
    const validityRate = totalRecords > 0 
      ? Math.round((validAttendance / totalRecords) * 100) 
      : 0;
    
    return {
      totalRecords,
      usersWithAttendance: usersWithAttendance.size,
      validAttendance,
      invalidAttendance,
      lateAttendance,
      checkIns,
      checkOuts,
      totalInterns: interns.length,
      attendanceRate,
      lateRate,
      validityRate
    };
  }, [allAttendance, users]);

  // Attendance by division (with normalization)
  const divisionStats = useMemo(() => {
    const divisions = new Map<string, { count: number; late: number; valid: number }>();
    
    allAttendance.forEach(record => {
      const div = normalizeDivision(record.division);
      const current = divisions.get(div) || { count: 0, late: 0, valid: 0 };
      
      divisions.set(div, {
        count: current.count + 1,
        late: current.late + (record.type === 'in' && record.isLate ? 1 : 0),
        valid: current.valid + (record.status === 'valid' ? 1 : 0)
      });
    });
    
    return Array.from(divisions.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        rate: data.count > 0 ? Math.round((data.valid / data.count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [allAttendance]);

  // Top attendees
  const topAttendees = useMemo(() => {
    const userStats = new Map<string, { name: string; count: number; late: number }>();
    
    allAttendance.forEach(record => {
      const current = userStats.get(record.userId) || { name: record.userName, count: 0, late: 0 };
      userStats.set(record.userId, {
        ...current,
        count: current.count + 1,
        late: current.late + (record.type === 'in' && record.isLate ? 1 : 0)
      });
    });
    
    return Array.from(userStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [allAttendance]);

  return (
    <div className="space-y-6">
      {/* Key Metrics - Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold opacity-90 uppercase tracking-wide">Total Absensi</h3>
            <i className="fas fa-chart-bar text-2xl opacity-30"></i>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.totalRecords}</p>
          <p className="text-sm opacity-80">Keseluruhan periode</p>
        </div>

        {/* Attendance Rate */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold opacity-90 uppercase tracking-wide">Tingkat Hadir</h3>
            <i className="fas fa-check-circle text-2xl opacity-30"></i>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.attendanceRate}%</p>
          <p className="text-sm opacity-80">{stats.usersWithAttendance} dari {stats.totalInterns} peserta</p>
        </div>

        {/* Late Attendance */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold opacity-90 uppercase tracking-wide">Terlambat</h3>
            <i className="fas fa-clock text-2xl opacity-30"></i>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.lateAttendance}</p>
          <p className="text-sm opacity-80">{stats.lateRate}% dari check-in</p>
        </div>

        {/* Validity Rate */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold opacity-90 uppercase tracking-wide">Validitas</h3>
            <i className="fas fa-map-marker-alt text-2xl opacity-30"></i>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.validityRate}%</p>
          <p className="text-sm opacity-80">{stats.validAttendance} valid records</p>
        </div>
      </div>

      {/* Check-in & Check-out Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Check-in & Check-out</h3>
            <i className="fas fa-sign-in-alt text-blue-500 text-2xl opacity-30"></i>
          </div>
          
          <div className="space-y-4">
            {/* Check-in */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Masuk (Check-in)</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.checkIns}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.totalRecords > 0 ? (stats.checkIns / stats.totalRecords) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{stats.totalRecords > 0 ? Math.round((stats.checkIns / stats.totalRecords) * 100) : 0}% dari total</p>
            </div>

            {/* Check-out */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Pulang (Check-out)</span>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.checkOuts}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.totalRecords > 0 ? (stats.checkOuts / stats.totalRecords) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{stats.totalRecords > 0 ? Math.round((stats.checkOuts / stats.totalRecords) * 100) : 0}% dari total</p>
            </div>
          </div>
        </div>

        {/* Validitas Lokasi */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Validitas Lokasi</h3>
            <i className="fas fa-location-check text-purple-500 text-2xl opacity-30"></i>
          </div>
          
          <div className="space-y-4">
            {/* Valid */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">✓ Sesuai Lokasi (Valid)</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.validAttendance}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.totalRecords > 0 ? (stats.validAttendance / stats.totalRecords) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{stats.validityRate}% valid rate</p>
            </div>

            {/* Invalid */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">✗ Luar Lokasi (Invalid)</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">{stats.invalidAttendance}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-400 to-red-600 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.totalRecords > 0 ? (stats.invalidAttendance / stats.totalRecords) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{100 - stats.validityRate}% invalid rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Division Stats with improved visuals */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-800 dark:text-white mb-6 text-lg flex items-center gap-2">
          <i className="fas fa-building text-blue-500"></i>
          Statistik Per Divisi
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 border-b dark:border-slate-800">
                <th className="text-left py-3 px-4 font-semibold">Divisi</th>
                <th className="text-center py-3 px-4 font-semibold">Total</th>
                <th className="text-center py-3 px-4 font-semibold">Terlambat</th>
                <th className="text-center py-3 px-4 font-semibold">Valid</th>
                <th className="text-right py-3 px-4 font-semibold">Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {divisionStats.map((div, idx) => (
                <tr key={idx} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="font-bold text-slate-800 dark:text-white">{div.name}</span>
                    </div>
                  </td>
                  <td className="text-center py-4 px-4 dark:text-slate-300">
                    <span className="font-bold">{div.count}</span>
                  </td>
                  <td className="text-center py-4 px-4">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      div.late === 0 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {div.late}
                    </span>
                  </td>
                  <td className="text-center py-4 px-4">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {div.valid}
                    </span>
                  </td>
                  <td className="text-right py-4 px-4">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" 
                          style={{ width: `${div.rate}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-white w-12 text-right">{div.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Attendees */}
      {topAttendees.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 text-lg flex items-center gap-2">
            <i className="fas fa-crown text-yellow-500"></i>
            Top {topAttendees.length} Peserta Paling Aktif
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topAttendees.map((attendee, idx) => (
              <div key={idx} className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 p-5 rounded-xl border dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      idx === 0 ? 'bg-yellow-500' : 
                      idx === 1 ? 'bg-slate-400' : 
                      idx === 2 ? 'bg-orange-500' : 
                      'bg-blue-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 dark:text-white truncate">{attendee.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Peserta Magang</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Kehadiran:</span>
                    <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{attendee.count}x</span>
                  </div>
                  {attendee.late > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Terlambat:</span>
                      <span className="font-bold text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-lg">
                        {attendee.late}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceOverview;

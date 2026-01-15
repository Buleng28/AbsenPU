import React, { useMemo } from 'react';
import { AttendanceRecord, User } from '../types';

interface AttendanceOverviewProps {
  allAttendance: AttendanceRecord[];
  users: User[];
}

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

  // Attendance by division
  const divisionStats = useMemo(() => {
    const divisions = new Map<string, { count: number; late: number; valid: number }>();
    
    allAttendance.forEach(record => {
      const div = record.division || 'Umum';
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
      .slice(0, 5);
  }, [allAttendance]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Absensi</p>
          <p className="text-2xl md:text-3xl font-bold dark:text-white">{stats.totalRecords}</p>
          <p className="text-[10px] text-slate-400 mt-1">Keseluruhan periode</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Peserta Hadir</p>
          <p className="text-2xl md:text-3xl font-bold dark:text-white">{stats.usersWithAttendance}</p>
          <p className="text-[10px] text-slate-400 mt-1">dari {stats.totalInterns} peserta</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Tingkat Kehadiran</p>
          <p className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.attendanceRate}%</p>
          <p className="text-[10px] text-slate-400 mt-1">Valid records</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Terlambat</p>
          <p className="text-2xl md:text-3xl font-bold text-red-600 dark:text-red-400">{stats.lateAttendance}</p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.lateRate}% dari check-in</p>
        </div>
      </div>

      {/* Check-in & Check-out Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 text-sm uppercase tracking-wide">Check-in / Check-out</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Masuk (Check-in)</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.checkIns}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ width: `${stats.totalRecords > 0 ? (stats.checkIns / stats.totalRecords) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Pulang (Check-out)</span>
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.checkOuts}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full" 
                style={{ width: `${stats.totalRecords > 0 ? (stats.checkOuts / stats.totalRecords) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 text-sm uppercase tracking-wide">Validitas Lokasi</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Valid (Sesuai Lokasi)</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.validAttendance}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-emerald-500 h-2 rounded-full" 
                style={{ width: `${stats.totalRecords > 0 ? (stats.validAttendance / stats.totalRecords) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Invalid (Luar Lokasi)</span>
              <span className="text-xl font-bold text-red-600 dark:text-red-400">{stats.invalidAttendance}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-red-500 h-2 rounded-full" 
                style={{ width: `${stats.totalRecords > 0 ? (stats.invalidAttendance / stats.totalRecords) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Division Stats */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-800 dark:text-white mb-4">Statistik Per Divisi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b dark:border-slate-800">
                <th className="text-left pb-3">Divisi</th>
                <th className="text-center pb-3">Total</th>
                <th className="text-center pb-3">Terlambat</th>
                <th className="text-center pb-3">Valid</th>
                <th className="text-right pb-3">Rate</th>
              </tr>
            </thead>
            <tbody>
              {divisionStats.map((div, idx) => (
                <tr key={idx} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3">
                    <span className="font-bold text-slate-800 dark:text-white">{div.name}</span>
                  </td>
                  <td className="text-center py-3 dark:text-slate-300">{div.count}</td>
                  <td className="text-center py-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${div.late > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'text-slate-400'}`}>
                      {div.late}
                    </span>
                  </td>
                  <td className="text-center py-3">
                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {div.valid}
                    </span>
                  </td>
                  <td className="text-right py-3 dark:text-slate-300 font-bold">{div.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Attendees */}
      {topAttendees.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Top 5 Peserta Paling Aktif</h3>
          <div className="space-y-3">
            {topAttendees.map((attendee, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">{attendee.name}</p>
                    <p className="text-[10px] text-slate-400">{attendee.count} kali hadir</p>
                  </div>
                </div>
                {attendee.late > 0 && (
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">
                    {attendee.late}x terlambat
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceOverview;

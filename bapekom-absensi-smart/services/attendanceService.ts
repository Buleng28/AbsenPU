import { AttendanceRecord, DashboardStats, WeeklyStats } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getUsers } from './userService';
import { getLeaveRequests } from './leaveService';
import { getSettings } from './settingsService';

// Safe ID Generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Helper to calculate distance
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Distance in meters
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

// Helper to check if today is within a date range
const isTodayInRange = (startDate: string, endDate: string) => {
  const today = new Date().toISOString().split('T')[0];
  return today >= startDate && today <= endDate;
};

// --- Service Methods ---

export const checkLocationValidity = (lat: number, lng: number): boolean => {
  const settings = getSettings();
  const distance = getDistanceFromLatLonInKm(lat, lng, settings.officeLat, settings.officeLng);
  return distance <= settings.maxDistanceMeters;
};

export const submitAttendance = async (record: Omit<AttendanceRecord, 'id' | 'isLate' | 'status'>): Promise<AttendanceRecord> => {
  const settings = getSettings();
  const date = new Date(record.timestamp);
  const currentHours = date.getHours();
  const currentMinutes = date.getMinutes();

  // Dynamic Late Logic
  const [lateHour, lateMinute] = settings.lateThreshold.split(':').map(Number);

  // Logic: If current hour > lateHour OR (current hour == lateHour AND current minute > lateMinute)
  const isLate = currentHours > lateHour || (currentHours === lateHour && currentMinutes > lateMinute);

  const isValidLoc = checkLocationValidity(record.location.latitude, record.location.longitude);

  const fullRecord: AttendanceRecord = {
    ...record,
    id: generateId(),
    isLate,
    status: isValidLoc ? 'valid' : 'invalid', // Auto-flag based on geofence
  };

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('attendance').insert([fullRecord]);
    if (error) throw error;
    return fullRecord;
  }

  // If not configured, you might want to explicitly throw an error
  // or handle it differently, but for now, we remove the silent fallback.
  throw new Error('Supabase is not configured.');
};

export const getTodaysRecords = async (): Promise<AttendanceRecord[]> => {
  try {
    if (isSupabaseConfigured && supabase) {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .gte('timestamp', `${today}T00:00:00`)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as AttendanceRecord[];
    }
    throw new Error('Supabase skipped');
  } catch (err) {
    // Local Storage Fallback
    const all = JSON.parse(localStorage.getItem('bapekom_attendance') || '[]');
    const todayStr = new Date().toISOString().split('T')[0];
    return all.filter((r: AttendanceRecord) => r.timestamp.startsWith(todayStr));
  }
};

export const getAllAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as AttendanceRecord[];
    }
    throw new Error('Supabase skipped');
  } catch (err) {
    // Local Storage Fallback: Return everything
    const all = JSON.parse(localStorage.getItem('bapekom_attendance') || '[]');
    return all.sort((a: AttendanceRecord, b: AttendanceRecord) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
};

export const getUserAttendanceHistory = async (userId: string): Promise<AttendanceRecord[]> => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('userId', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as AttendanceRecord[];
    }
    throw new Error('Supabase skipped');
  } catch (err) {
    // Local Storage Fallback
    const all = JSON.parse(localStorage.getItem('bapekom_attendance') || '[]');
    return all
      .filter((r: AttendanceRecord) => r.userId === userId)
      .sort((a: AttendanceRecord, b: AttendanceRecord) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};

export const getAllStats = async (): Promise<DashboardStats> => {
  // 1. Get Today's Attendance
  const records = await getTodaysRecords();
  const presentUserIds = new Set(records.map(r => r.userId));

  // 2. Get All Interns
  const allUsers = await getUsers();
  const interns = allUsers.filter(u => u.role === 'intern');

  // 3. Get Active Leaves (Approved & Today is within range)
  const allLeaves = await getLeaveRequests();
  const usersOnLeave = new Set(
    allLeaves
      .filter(req => req.status === 'approved' && isTodayInRange(req.startDate, req.endDate))
      .map(req => req.userId)
  );

  // 4. Calculate Alpa
  // Alpa = Interns who are NOT present AND NOT on approved leave
  let alpaCount = 0;
  interns.forEach(intern => {
    if (!presentUserIds.has(intern.id) && !usersOnLeave.has(intern.id)) {
      alpaCount++;
    }
  });

  return {
    totalInterns: interns.length,
    presentToday: presentUserIds.size,
    lateToday: records.filter(r => r.isLate && r.type === 'in').length,
    onLeaveToday: usersOnLeave.size,
    alpaToday: alpaCount,
    activeNow: records.filter(r => r.type === 'in').length - records.filter(r => r.type === 'out').length
  };
}

export const getWeeklyStats = async (): Promise<WeeklyStats[]> => {
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const stats: WeeklyStats[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    const dayName = days[d.getDay()];
    // Randomize data for demo visuals (Total interns ~12)
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const basePresent = isWeekend ? 0 : Math.floor(Math.random() * 3) + 9; // 9-11 people
    const present = Math.max(0, Math.min(12, basePresent));
    const late = isWeekend ? 0 : Math.floor(Math.random() * 4); // 0-3 late

    stats.push({
      date: dayName,
      fullDate: d.toISOString().split('T')[0],
      present: present,
      late: late
    });
  }

  // Override today's data with actual real-time data from local storage/db
  try {
    const todayStats = await getAllStats();
    const lastIndex = stats.length - 1;
    stats[lastIndex].present = todayStats.presentToday;
    stats[lastIndex].late = todayStats.lateToday;
  } catch (e) {
    console.warn("Could not fetch real-time stats for chart overlay", e);
  }

  return stats;
};

export const getUserStats = async (userId: string): Promise<{ present: number; late: number; onLeave: number }> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Get Attendance this month
    let attendanceData: AttendanceRecord[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('userId', userId)
        .gte('timestamp', startOfMonth);
      if (error) throw error;
      attendanceData = data as AttendanceRecord[];
    } else {
      const all = JSON.parse(localStorage.getItem('bapekom_attendance') || '[]');
      attendanceData = all.filter((r: AttendanceRecord) => r.userId === userId && r.timestamp >= startOfMonth);
    }

    const presentCount = new Set(attendanceData.map(r => r.timestamp.split('T')[0])).size;
    const lateCount = attendanceData.filter(r => r.type === 'in' && r.isLate).length;

    // 2. Get Approved Leaves this month
    const allLeaves = await getLeaveRequests();
    const approvedLeavesThisMonth = allLeaves.filter(req =>
      req.userId === userId &&
      req.status === 'approved' &&
      (req.startDate >= startOfMonth.split('T')[0] || req.endDate >= startOfMonth.split('T')[0])
    );

    return {
      present: presentCount,
      late: lateCount,
      onLeave: approvedLeavesThisMonth.length
    };
  } catch (e) {
    console.error("Error in getUserStats:", e);
    return { present: 0, late: 0, onLeave: 0 };
  }
};

export const getMonthlyRecap = async (userId: string, month: number, year: number): Promise<import('../types').MonthlyRecapData> => {
  try {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    // 1. Get all days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const details: import('../types').MonthlyRecapDetail[] = [];

    // 2. Get attendance records for this month
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    let attendanceRecords: AttendanceRecord[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('userId', userId)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);
      if (error) throw error;
      attendanceRecords = data as AttendanceRecord[];
    } else {
      const all = JSON.parse(localStorage.getItem('bapekom_attendance') || '[]');
      attendanceRecords = all.filter((r: AttendanceRecord) =>
        r.userId === userId && r.timestamp >= startDate && r.timestamp <= endDate
      );
    }

    // 3. Get approved leaves for this month
    const allLeaves = await getLeaveRequests();
    const approvedLeaves = allLeaves.filter(req =>
      req.userId === userId &&
      req.status === 'approved'
    );

    // 4. Process each day
    let totalWorkDays = 0;
    let totalPresent = 0;
    let totalLate = 0;
    let totalOnLeave = 0;
    let totalAlpha = 0;

    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      currentDate.setHours(0, 0, 0, 0); // Reset time to midnight
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      const dayName = dayNames[dayOfWeek];

      // Skip future dates (only show past dates and today)
      if (currentDate > today) {
        continue;
      }

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        details.push({
          date: dateStr,
          dayName,
          status: 'weekend'
        });
        continue;
      }

      totalWorkDays++;

      // Check if on leave
      const onLeave = approvedLeaves.find(leave =>
        dateStr >= leave.startDate && dateStr <= leave.endDate
      );

      if (onLeave) {
        totalOnLeave++;
        details.push({
          date: dateStr,
          dayName,
          status: 'leave',
          leaveType: onLeave.type,
          leaveReason: onLeave.reason
        });
        continue;
      }

      // Check attendance
      const checkIn = attendanceRecords.find(r =>
        r.timestamp.startsWith(dateStr) && r.type === 'in'
      );
      const checkOut = attendanceRecords.find(r =>
        r.timestamp.startsWith(dateStr) && r.type === 'out'
      );

      if (checkIn) {
        const checkInTime = new Date(checkIn.timestamp).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const checkOutTime = checkOut ? new Date(checkOut.timestamp).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        }) : undefined;

        if (checkIn.isLate) {
          totalLate++;
          details.push({
            date: dateStr,
            dayName,
            status: 'late',
            checkInTime,
            checkOutTime
          });
        } else {
          totalPresent++;
          details.push({
            date: dateStr,
            dayName,
            status: 'present',
            checkInTime,
            checkOutTime
          });
        }
      } else {
        // Alpha (absent without notice)
        totalAlpha++;
        details.push({
          date: dateStr,
          dayName,
          status: 'alpha'
        });
      }
    }

    const attendancePercentage = totalWorkDays > 0
      ? Math.round(((totalPresent + totalLate + totalOnLeave) / totalWorkDays) * 100)
      : 0;

    return {
      month,
      year,
      totalWorkDays,
      totalPresent,
      totalLate,
      totalOnLeave,
      totalAlpha,
      attendancePercentage,
      details
    };
  } catch (e) {
    console.error("Error in getMonthlyRecap:", e);
    return {
      month,
      year,
      totalWorkDays: 0,
      totalPresent: 0,
      totalLate: 0,
      totalOnLeave: 0,
      totalAlpha: 0,
      attendancePercentage: 0,
      details: []
    };
  }
};
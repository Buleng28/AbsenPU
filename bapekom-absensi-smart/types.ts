export type Role = 'intern' | 'admin';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: Role;
  division?: string;
  profilePhotoUrl?: string; // Base64 string of the profile picture
  password?: string; // Temporarily used for admin operations
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  division: string;
  timestamp: string; // ISO String
  type: 'in' | 'out';
  photoUrl: string;
  location: LocationData;
  isLate: boolean;
  status: 'valid' | 'invalid' | 'pending';
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  division: string;
  type: 'sakit' | 'izin';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  attachmentUrl?: string; // Base64 string for medical letter etc.
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string; // ISO String
  rejectionReason?: string;
}

export interface DashboardStats {
  totalInterns: number;
  presentToday: number;
  lateToday: number;
  onLeaveToday: number; // New field for approved leave count
  alpaToday: number;    // New field for absent without notice
  activeNow: number;
}

export interface WeeklyStats {
  date: string;       // e.g., "Senin"
  fullDate: string;   // e.g., "2023-10-23"
  present: number;
  late: number;
}

export interface SystemSettings {
  officeLat: number;
  officeLng: number;
  maxDistanceMeters: number;
  lateThreshold: string; // HH:mm, e.g., "07:40"
  clockOutTimeMonThu: string; // HH:mm, e.g., "16:00"
  clockOutTimeFri: string; // HH:mm, e.g., "16:30"
}

export interface MonthlyRecapDetail {
  date: string; // YYYY-MM-DD
  dayName: string; // e.g., "Senin"
  status: 'present' | 'late' | 'leave' | 'alpha' | 'weekend';
  checkInTime?: string; // HH:mm
  checkOutTime?: string; // HH:mm
  leaveType?: 'sakit' | 'izin';
  leaveReason?: string;
}

export interface MonthlyRecapData {
  month: number; // 1-12
  year: number;
  totalWorkDays: number; // Total weekdays (Mon-Fri)
  totalPresent: number;
  totalLate: number;
  totalOnLeave: number;
  totalAlpha: number;
  attendancePercentage: number;
  details: MonthlyRecapDetail[];
}
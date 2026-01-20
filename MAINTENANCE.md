# Maintenance: Archiving Attendance & Cleaning Storage ✅

This document explains safe steps to archive old attendance rows and remove old photos from Supabase Storage.

⚠️ IMPORTANT: Always backup your database and/or storage before deleting data.

## 1) Backup
- Use `pg_dump` for DB backup or the Supabase SQL Editor to export tables you plan to modify.

## 2) Archive old attendance rows (SQL)
- There's a helper SQL file at: `sql/archive_attendance.sql` which:
  - Creates `attendance_archive` table (same structure as `attendance`).
  - Moves rows older than 1 year into the archive using a single CTE example.

- For very large tables, prefer the Node script approach (batch processing):
  - `bapekom-absensi-smart/services/cleanupAttendance.ts`

### Run (Node script)
1. Create `.env` at repo root - you can copy `.env.example` and fill values:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CLEANUP_YEARS=1
CLEANUP_BUCKET=attendance-photos
# Optional: DRY_RUN=1 (or pass --dry-run)
```
2. Dry-run first (recommended):
```
npm run cleanup:attendance:dry
```
3. When satisfied, run the real job:
```
npm run cleanup:attendance
```

## 3) Clean storage (attendance photos)
- Use the Node script: `bapekom-absensi-smart/services/cleanupStorage.ts`
- It will delete objects in bucket `attendance-photos` older than `CLEANUP_YEARS` (defaults to 1).

### Run (Node script)
```
CLEANUP_BUCKET=attendance-photos CLEANUP_YEARS=1 npm run cleanup:storage
```

## 4) Post-checks
- Run `services/diagnosticService.checkSupabaseHealth()` or the SQL queries in `diagnosticService.ts` to verify counts.
- Check `attendance_archive` row count and storage bucket size.

## 5) Notes & safety
- Test everything on a staging DB first!
- Consider keeping a retention policy and automating the process via a cron job or GitHub Actions.

If you want, saya bisa commit file ini dan menambahkan npm scripts sekarang. Mau saya tambahkan juga npm scripts ke `package.json`? (ya/saja?)

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { MonthlyRecapData } from '../types';
import { getMonthlyRecap } from '../services/attendanceService';

interface MonthlyRecapProps {
    userId: string;
}

const MonthlyRecap: React.FC<MonthlyRecapProps> = ({ userId }) => {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [recapData, setRecapData] = useState<MonthlyRecapData | null>(null);
    const [loading, setLoading] = useState(false);

    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    useEffect(() => {
        loadRecapData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear]);

    const loadRecapData = async () => {
        setLoading(true);
        try {
            const data = await getMonthlyRecap(userId, selectedMonth, selectedYear);
            setRecapData(data);
        } catch (error) {
            console.error('Error loading recap:', error);
            toast.error('Gagal memuat data recap');
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!recapData) return;

        const csvRows = [
            ['Tanggal', 'Hari', 'Status', 'Jam Masuk', 'Jam Pulang', 'Keterangan'],
            ...recapData.details.map(d => [
                d.date,
                d.dayName,
                d.status === 'present' ? 'Hadir' :
                    d.status === 'late' ? 'Telat' :
                        d.status === 'leave' ? 'Izin' :
                            d.status === 'alpha' ? 'Alpha' : 'Libur',
                d.checkInTime || '-',
                d.checkOutTime || '-',
                d.leaveReason || '-'
            ])
        ];

        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recap_${monthNames[selectedMonth - 1]}_${selectedYear}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Data berhasil diexport!');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'present': return '✅';
            case 'late': return '⚠️';
            case 'leave': return '📝';
            case 'alpha': return '❌';
            case 'weekend': return '🏖️';
            default: return '•';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'late': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'leave': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'alpha': return 'bg-red-50 text-red-700 border-red-200';
            case 'weekend': return 'bg-slate-50 text-slate-400 border-slate-200';
            default: return 'bg-slate-50 text-slate-500 border-slate-200';
        }
    };

    return (
        <div className="space-y-4">
            {/* Filter Section */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Bulan</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 text-sm font-semibold text-slate-700"
                        >
                            {monthNames.map((name, idx) => (
                                <option key={idx} value={idx + 1}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Tahun</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 text-sm font-semibold text-slate-700"
                        >
                            {[...Array(5)].map((_, idx) => {
                                const year = now.getFullYear() - idx;
                                return <option key={year} value={year}>{year}</option>;
                            })}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-blue-600 mb-3"></i>
                    <p className="text-slate-400 text-sm">Memuat data...</p>
                </div>
            ) : recapData ? (
                <>
                    {/* Summary Card */}
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-xl text-white">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold">Recap {monthNames[selectedMonth - 1]} {selectedYear}</h3>
                                <p className="text-xs text-blue-100">Total {recapData.totalWorkDays} hari kerja</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black">{recapData.attendancePercentage}%</div>
                                <div className="text-xs text-blue-100">Kehadiran</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                                <div className="text-2xl font-bold">{recapData.totalPresent}</div>
                                <div className="text-[10px] text-blue-100 mt-1">Hadir</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                                <div className="text-2xl font-bold">{recapData.totalLate}</div>
                                <div className="text-[10px] text-blue-100 mt-1">Telat</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                                <div className="text-2xl font-bold">{recapData.totalOnLeave}</div>
                                <div className="text-[10px] text-blue-100 mt-1">Izin</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                                <div className="text-2xl font-bold">{recapData.totalAlpha}</div>
                                <div className="text-[10px] text-blue-100 mt-1">Alpha</div>
                            </div>
                        </div>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={exportToCSV}
                        className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl font-bold text-sm shadow-sm border border-emerald-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <i className="fas fa-file-csv text-lg"></i>
                        <span>Export ke CSV</span>
                    </button>

                    {/* Detail Harian */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <i className="fas fa-calendar-alt text-blue-600"></i>
                            Detail Harian
                        </h4>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {recapData.details.map((detail, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-xl border ${getStatusColor(detail.status)} transition-all hover:shadow-sm`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{getStatusIcon(detail.status)}</span>
                                            <div>
                                                <div className="text-xs font-bold text-slate-800">
                                                    {detail.dayName}, {new Date(detail.date).getDate()} {monthNames[selectedMonth - 1]}
                                                </div>
                                                {detail.checkInTime && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        Masuk: {detail.checkInTime}
                                                        {detail.checkOutTime && ` • Pulang: ${detail.checkOutTime}`}
                                                    </div>
                                                )}
                                                {detail.leaveReason && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5 italic">
                                                        {detail.leaveType === 'sakit' ? '🏥' : '📋'} {detail.leaveReason}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${detail.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                            detail.status === 'late' ? 'bg-amber-100 text-amber-700' :
                                                detail.status === 'leave' ? 'bg-blue-100 text-blue-700' :
                                                    detail.status === 'alpha' ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-500'
                                            }`}>
                                            {detail.status === 'present' ? 'Hadir' :
                                                detail.status === 'late' ? 'Telat' :
                                                    detail.status === 'leave' ? 'Izin' :
                                                        detail.status === 'alpha' ? 'Alpha' : 'Libur'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
                    <i className="fas fa-inbox text-4xl text-slate-200 mb-3 block"></i>
                    <p className="text-slate-400 text-xs">Tidak ada data untuk ditampilkan</p>
                </div>
            )}
        </div>
    );
};

export default MonthlyRecap;

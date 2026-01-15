import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { WeeklyStats } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface WeeklyBarChartProps {
    stats: WeeklyStats[];
}

const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({ stats }) => {
    const data = {
        labels: stats.map(s => s.date),
        datasets: [
            {
                label: 'Hadir',
                data: stats.map(s => s.present),
                backgroundColor: 'rgba(59, 130, 246, 0.8)', // biru
                borderRadius: 6,
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 1,
            },
            {
                label: 'Terlambat',
                data: stats.map(s => s.late),
                backgroundColor: 'rgba(234, 179, 8, 0.8)', // kuning
                borderRadius: 6,
                borderColor: 'rgba(202, 138, 4, 1)',
                borderWidth: 1,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { display: false },
                ticks: { font: { size: 10 }, color: '#94a3b8' }
            },
            x: {
                grid: { display: false },
                ticks: { font: { size: 10 }, color: '#94a3b8' }
            }
        },
        plugins: {
            legend: {
                position: 'top' as const,
                align: 'end' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 6,
                    font: { size: 10 },
                    color: '#64748b'
                }
            },
            title: {
                display: true,
                text: 'Tren Kehadiran Mingguan',
                align: 'start' as const,
                color: '#1e293b',
                font: { size: 14, weight: 'bold' as const },
                padding: { bottom: 20 }
            },
        },
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm h-full max-h-[300px]">
            <div className="h-full">
                {stats.length > 0 ? (
                    <Bar data={data} options={options} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Tidak ada data statistik.</div>
                )}
            </div>
        </div>
    );
};

export default WeeklyBarChart;
